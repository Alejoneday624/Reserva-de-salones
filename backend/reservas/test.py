"""Pruebas de rendimiento (número de consultas SQL) y de solapamiento.

Ejecutar con SQLite en memoria (rápido y sin tocar producción):

    python manage.py test reservas

Las pruebas de concurrencia real (dos peticiones simultáneas) necesitan los
bloqueos ``SELECT ... FOR UPDATE`` de PostgreSQL y se omiten en SQLite. Para
ejecutarlas, exporte ``TEST_DATABASE_URL`` apuntando a una base de pruebas:

    $env:TEST_DATABASE_URL="postgres://usuario:clave@host:5432/db_pruebas"
    python manage.py test reservas --settings=config.settings_test
"""

from datetime import datetime, time, timedelta
from threading import Barrier, Thread

from django.db import connection, connections
from django.db.models import Max
from django.test import TestCase, TransactionTestCase, skipUnlessDBFeature
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from .models import Franjas, Recursos, Reservas, Usuarios
from .serializers import ReservaConsultaSerializer
from .services import ReservaError, crear_reservas

HORA = time


def crear_esquema():
    """Crea las tablas de la app en la base de pruebas.

    Los modelos usan ``managed = False`` porque el esquema real vive en
    Supabase, así que Django no las crea al migrar. Aquí se crean una sola vez
    con el editor de esquemas (funciona en SQLite y PostgreSQL).
    """
    existentes = set(connection.introspection.table_names())
    with connection.schema_editor() as editor:
        for modelo in (Usuarios, Recursos, Franjas, Reservas):
            if modelo._meta.db_table not in existentes:
                editor.create_model(modelo)


class EsquemaReservasMixin:
    """Datos mínimos y utilidades compartidas por las pruebas."""

    @classmethod
    def setUpClass(cls):
        # El esquema se crea ANTES de abrir la transacción de la clase: SQLite
        # no permite desactivar las FK dentro de un atomic ya iniciado.
        crear_esquema()
        super().setUpClass()

    def setUp(self):
        self.usuario = self.crear_usuario(1, "Ana Gómez")
        self.recurso = self.crear_recurso(1, "Sala 101")
        self.fecha = timezone.localdate() + timedelta(days=1)

    # ------------------------------------------------------------------
    # Constructores de datos
    # ------------------------------------------------------------------
    def crear_usuario(self, id_, nombre="Estudiante"):
        return Usuarios.objects.create(
            id=id_,
            nombre=nombre,
            codigo=f"COD{id_:04d}",
            programa="Ingeniería de Sistemas",
            correo=f"estudiante{id_}@uan.edu.co",
        )

    def crear_recurso(
        self,
        id_,
        nombre="Sala de estudio",
        activo=1,
        tipo="Sala de estudio",
        capacidad=6,
    ):
        return Recursos.objects.create(
            id=id_,
            nombre=nombre,
            tipo=tipo,
            ubicacion="Bloque A",
            capacidad=capacidad,
            atributos="wifi,proyector",
            activo=activo,
        )

    def crear_franja(self, inicio, fin, *, recurso=None, fecha=None):
        nuevo_id = (
            Franjas.objects.aggregate(max_id=Max("id"))["max_id"] or 0
        ) + 1
        return Franjas.objects.create(
            id=nuevo_id,
            recurso=recurso or self.recurso,
            fecha=fecha or self.fecha,
            hora_inicio=inicio,
            hora_fin=fin,
        )

    def crear_reserva(
        self,
        inicio,
        fin,
        *,
        recurso=None,
        usuario=None,
        fecha=None,
        estado="activa",
        franja=None,
        creada_en=None,
    ):
        nuevo_id = (
            Reservas.objects.aggregate(max_id=Max("id"))["max_id"] or 0
        ) + 1
        franja = franja or self.crear_franja(
            inicio, fin, recurso=recurso, fecha=fecha
        )
        return Reservas.objects.create(
            id=nuevo_id,
            franja=franja,
            recurso=recurso or self.recurso,
            usuario=usuario or self.usuario,
            fecha=fecha or self.fecha,
            hora_inicio=inicio,
            hora_fin=fin,
            estado=estado,
            creada_en=creada_en or timezone.now(),
        )

    def payload(self, bloques, *, usuario_id=1, recurso_id=1, fecha=None, semanas=None):
        datos = {
            "recurso_id": recurso_id,
            "usuario_id": usuario_id,
            "fecha": (fecha or self.fecha).isoformat(),
            "bloques": [
                {"hora_inicio": inicio.isoformat(), "hora_fin": fin.isoformat()}
                for inicio, fin in bloques
            ],
        }
        if semanas is not None:
            datos["semanas"] = semanas
        return datos

    def post_reserva(self, bloques, **kwargs):
        return self.client.post(
            "/api/reservas/",
            data=self.payload(bloques, **kwargs),
            content_type="application/json",
        )


class RendimientoTests(EsquemaReservasMixin, TestCase):
    """Cada endpoint debe usar un número de consultas constante (sin N+1)."""

    def test_catalogo_usa_una_sola_consulta(self):
        for i in range(10):
            self.crear_recurso(100 + i, f"Sala {i}")

        with self.assertNumQueries(1):
            respuesta = self.client.get("/api/recursos/")

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(len(respuesta.json()["catalogo_recursos"]), 11)

    def test_detalle_usa_una_sola_consulta(self):
        with self.assertNumQueries(1):
            respuesta = self.client.get(f"/api/recursos/{self.recurso.id}/")

        self.assertEqual(respuesta.status_code, 200)

    def test_disponibilidad_no_hace_n_plus_1(self):
        """El número de consultas no debe crecer con las franjas ni reservas."""
        fecha = self.fecha

        def hora(minutos):
            return time(6 + minutos // 60, minutos % 60)

        # 30 franjas de media hora, cada una con su reserva: 6:00 → 21:00.
        for i in range(30):
            inicio, fin = hora(i * 30), hora((i + 1) * 30)
            franja = self.crear_franja(inicio, fin, fecha=fecha)
            self.crear_reserva(inicio, fin, franja=franja)

        with CaptureQueriesContext(connection) as consultas:
            respuesta = self.client.get(
                f"/api/recursos/{self.recurso.id}/disponibilidad/",
                {"fecha": fecha.isoformat()},
            )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(len(respuesta.json()["franjas"]), 30)
        # Una sola consulta: el estado ocupado/libre se resuelve con EXISTS.
        self.assertEqual(len(consultas), 1)

    def test_listado_reservas_no_hace_n_plus_1(self):
        """Traer 25 reservas debe costar lo mismo que traer una."""
        for i in range(25):
            inicio = HORA(8 + (i % 3), 0)
            fin = HORA(9 + (i % 3), 0)
            self.crear_reserva(
                inicio,
                fin,
                fecha=self.fecha + timedelta(days=i),
            )

        with self.assertNumQueries(3):
            respuesta = self.client.get(f"/api/usuarios/{self.usuario.id}/reservas/")

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()["total"], 25)

    def test_creacion_escala_lineal_con_los_bloques(self):
        """Cada bloque añade 2 consultas (buscar franja + insertar), no más."""
        manana = self.fecha + timedelta(days=1)
        for fecha in (self.fecha, manana):
            for inicio, fin in (
                (HORA(8), HORA(9)),
                (HORA(9), HORA(10)),
                (HORA(10), HORA(11)),
            ):
                self.crear_franja(inicio, fin, fecha=fecha)

        with CaptureQueriesContext(connection) as un_bloque:
            crear_reservas(
                recurso_id=self.recurso.id,
                usuario_id=self.usuario.id,
                fecha=self.fecha,
                bloques=[(HORA(8), HORA(9))],
            )

        with CaptureQueriesContext(connection) as tres_bloques:
            crear_reservas(
                recurso_id=self.recurso.id,
                usuario_id=self.usuario.id,
                fecha=manana,
                bloques=[(HORA(8), HORA(9)), (HORA(9), HORA(10)), (HORA(10), HORA(11))],
            )

        self.assertEqual(len(tres_bloques) - len(un_bloque), 4)

    def test_creacion_no_depende_de_las_reservas_existentes(self):
        """El costo de crear una reserva no crece con el histórico de la sala."""
        self.crear_franja(HORA(8), HORA(9), fecha=self.fecha)

        with CaptureQueriesContext(connection) as sin_historico:
            crear_reservas(
                recurso_id=self.recurso.id,
                usuario_id=self.usuario.id,
                fecha=self.fecha,
                bloques=[(HORA(8), HORA(9))],
            )

        # 40 reservas de otros usuarios en fechas distintas de la misma sala.
        otro_usuario = self.crear_usuario(2, "Luis Pérez")
        for i in range(40):
            self.crear_reserva(
                HORA(14),
                HORA(15),
                usuario=otro_usuario,
                fecha=self.fecha + timedelta(days=2 + i),
            )

        fecha_nueva = self.fecha + timedelta(days=3)
        self.crear_franja(HORA(8), HORA(9), fecha=fecha_nueva)
        with CaptureQueriesContext(connection) as con_historico:
            crear_reservas(
                recurso_id=self.recurso.id,
                usuario_id=self.usuario.id,
                fecha=fecha_nueva,
                bloques=[(HORA(8), HORA(9))],
            )

        self.assertEqual(len(sin_historico), len(con_historico))


class ConsultaReservasTests(EsquemaReservasMixin, TestCase):
    """HDU: consultar reservas por fecha y filtrar la ocupación de las salas."""

    def get_consulta(self, **params):
        return self.client.get("/api/reservas/consulta/", params)

    def test_devuelve_solo_las_reservas_de_la_fecha(self):
        ayer = self.fecha - timedelta(days=1)
        manana = self.fecha + timedelta(days=1)
        self.crear_reserva(HORA(8), HORA(9), fecha=ayer)
        reserva_hoy = self.crear_reserva(HORA(10), HORA(11), fecha=self.fecha)
        self.crear_reserva(HORA(12), HORA(13), fecha=manana)

        respuesta = self.get_consulta(fecha=self.fecha.isoformat())

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()["total"], 1)
        self.assertEqual(
            [reserva["id"] for reserva in respuesta.json()["reservas"]],
            [reserva_hoy.id],
        )

    def test_permite_consultar_fechas_anteriores_y_futuras(self):
        pasada = self.fecha - timedelta(days=30)
        futura = self.fecha + timedelta(days=30)
        reserva_pasada = self.crear_reserva(HORA(7), HORA(8), fecha=pasada)
        reserva_futura = self.crear_reserva(HORA(7), HORA(8), fecha=futura)

        for fecha, reserva in ((pasada, reserva_pasada), (futura, reserva_futura)):
            with self.subTest(fecha=fecha):
                respuesta = self.get_consulta(fecha=fecha.isoformat())
                self.assertEqual(respuesta.status_code, 200)
                self.assertEqual(
                    [item["id"] for item in respuesta.json()["reservas"]],
                    [reserva.id],
                )

    def test_fecha_sin_reservas_devuelve_lista_vacia(self):
        respuesta = self.get_consulta(
            fecha=(self.fecha + timedelta(days=5)).isoformat()
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()["total"], 0)
        self.assertEqual(respuesta.json()["reservas"], [])

    def test_filtra_por_tipo_capacidad_y_franja_horaria(self):
        auditorio = self.crear_recurso(
            2, "Auditorio", tipo="Auditorio", capacidad=12
        )
        self.crear_reserva(HORA(8), HORA(9))  # sala normal
        reserva_auditorio = self.crear_reserva(
            HORA(8), HORA(9), recurso=auditorio
        )
        self.crear_reserva(HORA(14), HORA(15), recurso=auditorio)

        respuesta = self.get_consulta(
            fecha=self.fecha.isoformat(),
            tipo="auditorio",
            cap_min=10,
            cap_max=12,
            hora_desde="08:00",
            hora_hasta="09:00",
        )

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()["total"], 1)
        reserva = respuesta.json()["reservas"][0]
        self.assertEqual(reserva["id"], reserva_auditorio.id)
        self.assertEqual(reserva["tipo"], "Auditorio")

    def test_sin_fecha_devuelve_todas_las_jornadas(self):
        self.crear_reserva(HORA(8), HORA(9), fecha=self.fecha - timedelta(days=2))
        self.crear_reserva(HORA(8), HORA(9), fecha=self.fecha + timedelta(days=2))

        respuesta = self.get_consulta()

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()["total"], 2)
        self.assertIsNone(respuesta.json()["fecha"])

    def test_fecha_invalida_devuelve_400(self):
        respuesta = self.get_consulta(fecha="2026-13-45")
        self.assertEqual(respuesta.status_code, 400)

    def test_franja_invalida_devuelve_400(self):
        respuesta = self.get_consulta(
            fecha=self.fecha.isoformat(), hora_desde="9", hora_hasta="8"
        )
        self.assertEqual(respuesta.status_code, 400)

    def test_consulta_no_hace_n_plus_1(self):
        for i in range(20):
            self.crear_reserva(
                HORA(8), HORA(9), fecha=self.fecha + timedelta(days=i)
            )

        with self.assertNumQueries(1):
            respuesta = self.get_consulta(fecha=self.fecha.isoformat())

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()["total"], 1)


class SolapamientoTests(EsquemaReservasMixin, TestCase):
    """Nunca deben quedar dos reservas activas en el mismo horario y sala."""

    def test_solape_total_devuelve_409(self):
        self.crear_franja(HORA(8), HORA(9))
        self.crear_reserva(HORA(8), HORA(9))

        respuesta = self.post_reserva([(HORA(8), HORA(9))])

        self.assertEqual(respuesta.status_code, 409)
        self.assertIn("ya está reservado", respuesta.json()["error"])

    def test_solape_parcial_devuelve_409(self):
        self.crear_franja(HORA(8), HORA(10))
        self.crear_franja(HORA(9), HORA(11))
        self.crear_reserva(HORA(8), HORA(10))

        respuesta = self.post_reserva([(HORA(9), HORA(11))])

        self.assertEqual(respuesta.status_code, 409)
        self.assertEqual(Reservas.objects.count(), 1)

    def test_franjas_contiguas_se_permiten(self):
        self.crear_franja(HORA(8), HORA(9))
        self.crear_franja(HORA(9), HORA(10))
        self.crear_reserva(HORA(8), HORA(9))

        respuesta = self.post_reserva([(HORA(9), HORA(10))])

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(Reservas.objects.filter(estado="activa").count(), 2)

    def test_reserva_cancelada_no_bloquea(self):
        self.crear_franja(HORA(8), HORA(9))
        self.crear_reserva(HORA(8), HORA(9), estado="cancelada")

        respuesta = self.post_reserva([(HORA(8), HORA(9))])

        self.assertEqual(respuesta.status_code, 201)

    def test_misma_franja_en_otra_sala_se_permite(self):
        otra_sala = self.crear_recurso(2, "Sala 102")
        self.crear_franja(HORA(8), HORA(9))
        self.crear_franja(HORA(8), HORA(9), recurso=otra_sala)
        self.crear_reserva(HORA(8), HORA(9))

        respuesta = self.post_reserva([(HORA(8), HORA(9))], recurso_id=otra_sala.id)

        self.assertEqual(respuesta.status_code, 201)

    def test_bloques_solapados_en_la_misma_peticion_devuelven_400(self):
        self.crear_franja(HORA(8), HORA(10))
        self.crear_franja(HORA(9), HORA(11))

        respuesta = self.post_reserva([(HORA(8), HORA(10)), (HORA(9), HORA(11))])

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("solapan entre sí", respuesta.json()["error"])
        self.assertEqual(Reservas.objects.count(), 0)

    def test_dos_usuarios_secuenciales_solo_uno_reserva(self):
        self.crear_franja(HORA(8), HORA(9))
        segundo_usuario = self.crear_usuario(2, "Luis Pérez")

        primera = self.post_reserva([(HORA(8), HORA(9))])
        segunda = self.post_reserva(
            [(HORA(8), HORA(9))], usuario_id=segundo_usuario.id
        )

        self.assertEqual(primera.status_code, 201)
        self.assertEqual(segunda.status_code, 409)
        self.assertEqual(Reservas.objects.count(), 1)


class ReservasRecurrentesTests(EsquemaReservasMixin, TestCase):
    """Reservas recurrentes semanales: 1 a 4 semanas, todo-o-nada.

    La serie repite el mismo día de la semana y la misma franja horaria
    (+7 días por semana). Si alguna fecha de la serie tiene un conflicto
    (sin franja, horario ocupado o límite diario), no se debe crear
    NINGUNA reserva y la respuesta debe informar la fecha del conflicto.
    """

    def _crear_franjas(self, semanas, inicio=HORA(8), fin=HORA(9)):
        """Carga la franja para cada una de las `semanas` fechas (+7 días)."""
        for semana in range(semanas):
            self.crear_franja(
                inicio, fin, fecha=self.fecha + timedelta(weeks=semana)
            )

    def test_sin_semanas_crea_una_sola_reserva(self):
        """Sin el campo 'semanas' el comportamiento sigue siendo el actual."""
        self.crear_franja(HORA(8), HORA(9))

        respuesta = self.post_reserva([(HORA(8), HORA(9))])

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(Reservas.objects.count(), 1)

    def test_dos_semanas_crea_dos_reservas(self):
        self._crear_franjas(2)

        respuesta = self.post_reserva([(HORA(8), HORA(9))], semanas=2)

        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(len(respuesta.json()["reservas"]), 2)
        self.assertEqual(Reservas.objects.count(), 2)

    def test_recurrente_con_varias_franjas_crea_todas(self):
        """Varias franjas en una reserva: se repiten completas cada semana."""
        bloques = [(HORA(8), HORA(9)), (HORA(9), HORA(10)), (HORA(10), HORA(11))]
        for inicio, fin in bloques:
            self._crear_franjas(4, inicio, fin)

        respuesta = self.post_reserva(bloques, semanas=4)

        self.assertEqual(respuesta.status_code, 201)
        reservas = respuesta.json()["reservas"]
        # 3 franjas × 4 fechas = 12 reservas, y cada fecha recibe las 3.
        self.assertEqual(len(reservas), 12)
        self.assertEqual(Reservas.objects.count(), 12)

        por_fecha = {}
        for reserva in reservas:
            por_fecha.setdefault(reserva["fecha"], []).append(
                (reserva["hora_inicio"], reserva["hora_fin"])
            )
        for semana in range(4):
            fecha = (self.fecha + timedelta(weeks=semana)).isoformat()
            self.assertEqual(
                sorted(por_fecha[fecha]),
                [
                    ("08:00:00", "09:00:00"),
                    ("09:00:00", "10:00:00"),
                    ("10:00:00", "11:00:00"),
                ],
            )

    def test_conflicto_de_hora_en_una_semana_informa_fecha_y_hora(self):
        """Una hora ocupada en una semana de la serie: nada se crea y se
        informa la fecha Y la hora exacta del conflicto."""
        self._crear_franjas(4, HORA(8), HORA(9))
        self._crear_franjas(4, HORA(15), HORA(16))
        # Solo la franja de 15:00–16:00 de la semana 2 está ocupada.
        fecha_semana2 = self.fecha + timedelta(weeks=1)
        franja_ocupada = Franjas.objects.get(
            recurso=self.recurso,
            fecha=fecha_semana2,
            hora_inicio=HORA(15),
            hora_fin=HORA(16),
        )
        self.crear_reserva(
            HORA(15), HORA(16), fecha=fecha_semana2, franja=franja_ocupada
        )

        respuesta = self.post_reserva(
            [(HORA(8), HORA(9)), (HORA(15), HORA(16))], semanas=4
        )

        self.assertEqual(respuesta.status_code, 409)
        cuerpo = respuesta.json()
        self.assertIn(fecha_semana2.isoformat(), cuerpo["error"])
        self.assertIn("15:00", cuerpo["error"])
        self.assertEqual(cuerpo["fecha_conflicto"], fecha_semana2.isoformat())
        self.assertEqual(cuerpo["hora_inicio"], "15:00:00")
        self.assertEqual(cuerpo["hora_fin"], "16:00:00")
        # Todo-o-nada: solo queda la reserva que ya existía.
        self.assertEqual(Reservas.objects.count(), 1)

    def test_franja_faltante_informa_fecha_y_hora(self):
        """Sin franja cargada en una fecha de la serie: el error trae la hora."""
        self.crear_franja(HORA(8), HORA(9), fecha=self.fecha)
        self.crear_franja(HORA(15), HORA(16), fecha=self.fecha)
        # La semana 2 no tiene ninguna franja cargada.

        respuesta = self.post_reserva(
            [(HORA(8), HORA(9)), (HORA(15), HORA(16))], semanas=2
        )

        fecha_conflicto = (self.fecha + timedelta(weeks=1)).isoformat()
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn(fecha_conflicto, respuesta.json()["error"])
        self.assertEqual(respuesta.json()["fecha_conflicto"], fecha_conflicto)
        self.assertEqual(respuesta.json()["hora_inicio"], "08:00:00")
        self.assertEqual(Reservas.objects.count(), 0)

    def test_cuatro_semanas_crea_cuatro_reservas_mismo_dia_y_hora(self):
        self._crear_franjas(4)

        respuesta = self.post_reserva([(HORA(8), HORA(9))], semanas=4)

        self.assertEqual(respuesta.status_code, 201)
        reservas = respuesta.json()["reservas"]
        self.assertEqual(len(reservas), 4)

        esperadas = [
            (self.fecha + timedelta(weeks=semana)).isoformat() for semana in range(4)
        ]
        self.assertEqual([reserva["fecha"] for reserva in reservas], esperadas)
        # Las cuatro fechas caen el mismo día de la semana...
        self.assertEqual(
            {datetime.fromisoformat(f).weekday() for f in esperadas},
            {datetime.fromisoformat(esperadas[0]).weekday()},
        )
        # ...y todas usan la misma franja horaria.
        self.assertEqual(
            {(r["hora_inicio"], r["hora_fin"]) for r in reservas},
            {("08:00:00", "09:00:00")},
        )
        self.assertEqual(Reservas.objects.count(), 4)

    def test_franja_faltante_en_la_semana_3_no_crea_ninguna(self):
        """La serie se valida entera: sin franja en la semana 3, cero reservas."""
        self._crear_franjas(2)  # semanas 1 y 2 con franja; la 3 y la 4 no

        respuesta = self.post_reserva([(HORA(8), HORA(9))], semanas=4)

        fecha_conflicto = (self.fecha + timedelta(weeks=2)).isoformat()
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn(fecha_conflicto, respuesta.json()["error"])
        self.assertEqual(respuesta.json()["fecha_conflicto"], fecha_conflicto)
        # No se creó ninguna reserva, ni siquiera las de las semanas válidas.
        self.assertEqual(Reservas.objects.count(), 0)

    def test_solape_en_la_semana_2_no_crea_ninguna(self):
        # Franjas en las semanas 1, 3 y 4; la 2 ya tiene una reserva activa.
        for semana in (0, 2, 3):
            self.crear_franja(
                HORA(8), HORA(9), fecha=self.fecha + timedelta(weeks=semana)
            )
        self.crear_reserva(HORA(8), HORA(9), fecha=self.fecha + timedelta(weeks=1))

        respuesta = self.post_reserva([(HORA(8), HORA(9))], semanas=4)

        fecha_conflicto = (self.fecha + timedelta(weeks=1)).isoformat()
        self.assertEqual(respuesta.status_code, 409)
        self.assertIn(fecha_conflicto, respuesta.json()["error"])
        self.assertEqual(respuesta.json()["fecha_conflicto"], fecha_conflicto)
        # Solo queda la reserva que ya existía: no se creó ninguna de la serie.
        self.assertEqual(Reservas.objects.count(), 1)

    def test_limite_diario_se_valida_en_cada_fecha(self):
        """El tope de 3 horas se evalúa por fecha: solo falla la semana 4."""
        self._crear_franjas(4)
        # El usuario ya tiene 3 horas reservadas en la semana 4 (otra sala):
        # esa fecha no admite una hora más, aunque las semanas 1 a 3 sí.
        otra_sala = self.crear_recurso(2, "Sala 102")
        fecha_semana4 = self.fecha + timedelta(weeks=3)
        for inicio, fin in (
            (HORA(8), HORA(9)),
            (HORA(9), HORA(10)),
            (HORA(10), HORA(11)),
        ):
            self.crear_reserva(inicio, fin, recurso=otra_sala, fecha=fecha_semana4)

        respuesta = self.post_reserva([(HORA(8), HORA(9))], semanas=4)

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn(fecha_semana4.isoformat(), respuesta.json()["error"])
        self.assertEqual(
            respuesta.json()["fecha_conflicto"], fecha_semana4.isoformat()
        )
        # No se creó ninguna de las 4 reservas de la serie.
        self.assertEqual(Reservas.objects.count(), 3)

    def test_semanas_fuera_de_rango_devuelven_400(self):
        self.crear_franja(HORA(8), HORA(9))

        for semanas in (0, 5):
            respuesta = self.post_reserva([(HORA(8), HORA(9))], semanas=semanas)
            self.assertEqual(respuesta.status_code, 400)
            self.assertIn("semanas", respuesta.json()["error"])

        self.assertEqual(Reservas.objects.count(), 0)

    def test_servicio_rechaza_semanas_fuera_de_rango(self):
        with self.assertRaises(ReservaError):
            crear_reservas(
                recurso_id=self.recurso.id,
                usuario_id=self.usuario.id,
                fecha=self.fecha,
                bloques=[(HORA(8), HORA(9))],
                semanas=5,
            )

    def test_creacion_escala_lineal_con_las_semanas(self):
        """Cada semana añade 4 consultas (franja, solape, límite e insert)."""
        base = self.fecha + timedelta(days=20)
        for semana in range(5):  # franjas de ambas llamadas (1 + 4 semanas)
            self.crear_franja(HORA(8), HORA(9), fecha=base + timedelta(weeks=semana))

        with CaptureQueriesContext(connection) as una_semana:
            crear_reservas(
                recurso_id=self.recurso.id,
                usuario_id=self.usuario.id,
                fecha=base,
                bloques=[(HORA(8), HORA(9))],
            )

        with CaptureQueriesContext(connection) as cuatro_semanas:
            crear_reservas(
                recurso_id=self.recurso.id,
                usuario_id=self.usuario.id,
                fecha=base + timedelta(weeks=1),
                bloques=[(HORA(8), HORA(9))],
                semanas=4,
            )

        # 3 semanas extra × 4 consultas (las fechas no se solapan entre sí).
        self.assertEqual(len(cuatro_semanas) - len(una_semana), 12)


@skipUnlessDBFeature("has_select_for_update")
class ConcurrenciaTests(EsquemaReservasMixin, TransactionTestCase):
    """Dos peticiones simultáneas: el bloqueo de franjas evita la doble reserva.

    En SQLite ``select_for_update`` no existe y esta clase se omite. Ejecútela
    contra PostgreSQL con TEST_DATABASE_URL (ver docstring del módulo).
    """

    def setUp(self):
        # TransactionTestCase no hace rollback: limpiamos entre pruebas.
        Reservas.objects.all().delete()
        Franjas.objects.all().delete()
        Recursos.objects.all().delete()
        Usuarios.objects.all().delete()
        super().setUp()

    def test_dos_usuarios_simultaneos_solo_crean_una_reserva(self):
        self.crear_franja(HORA(8), HORA(9))
        self.crear_usuario(2, "Luis Pérez")

        barrera = Barrier(2)
        resultados = []

        def intentar(usuario_id):
            connections.close_all()
            try:
                barrera.wait(timeout=10)
                crear_reservas(
                    recurso_id=self.recurso.id,
                    usuario_id=usuario_id,
                    fecha=self.fecha,
                    bloques=[(HORA(8), HORA(9))],
                )
                resultados.append("creada")
            except ReservaError as exc:
                resultados.append(exc.status)
            except Exception as exc:  # pragma: no cover - diagnóstico
                resultados.append(f"error: {exc!r}")
            finally:
                connections.close_all()

        hilos = [
            Thread(target=intentar, args=(usuario_id,))
            for usuario_id in (self.usuario.id, 2)
        ]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join(timeout=20)

        self.assertEqual(sorted(resultados, key=str), [409, "creada"])
        self.assertEqual(Reservas.objects.count(), 1)


class ZonaHorariaTests(EsquemaReservasMixin, TestCase):
    """La reserva debe verse con la hora local real, sin desfases.

    Regresión del bug de zona horaria: la columna ``creada_en`` es naive y DRF
    etiqueta el valor con TIME_ZONE, así que se debe guardar la HORA LOCAL.
    Guardar UTC (``timezone.now()``) haría que la pantalla mostrara la hora de
    más (3 PM se vería como 8 PM).
    """

    def _instante(self, iso):
        """ISO de la API a datetime aware; DRF siempre envía con offset."""
        instante = datetime.fromisoformat(iso)
        self.assertIsNotNone(
            instante.tzinfo, f"creada_en llegó sin zona horaria: {iso!r}"
        )
        return instante

    def test_creada_en_es_la_hora_local_real(self):
        self.crear_franja(HORA(15), HORA(16))

        respuesta = self.post_reserva([(HORA(15), HORA(16))])

        self.assertEqual(respuesta.status_code, 201)
        creada = self._instante(respuesta.json()["reservas"][0]["creada_en"])

        # El instante debe ser "ahora" (no 5 horas atrás ni por delante).
        diferencia = abs((creada - timezone.now()).total_seconds())
        self.assertLess(diferencia, 120)
        # Y en hora local debe coincidir con el reloj del usuario.
        self.assertEqual(creada.hour, timezone.localtime().hour)
        self.assertEqual(creada.minute, timezone.localtime().minute)

    def test_horario_reserva_se_guarda_y_devuelve_tal_cual(self):
        """El horario de la reserva no debe convertirse a otra zona."""
        self.crear_franja(HORA(15), HORA(16))

        respuesta = self.post_reserva([(HORA(15), HORA(16))])

        self.assertEqual(respuesta.status_code, 201)
        reserva = respuesta.json()["reservas"][0]
        self.assertEqual(reserva["hora_inicio"], "15:00:00")
        self.assertEqual(reserva["hora_fin"], "16:00:00")

    def test_consulta_de_reservas_devuelve_hora_local(self):
        """"Mis reservas" muestra el mismo horario y creación sin desfase."""
        self.crear_franja(HORA(15), HORA(16))
        self.assertEqual(
            self.post_reserva([(HORA(15), HORA(16))]).status_code, 201
        )

        consulta = self.client.get(f"/api/usuarios/{self.usuario.id}/reservas/")

        self.assertEqual(consulta.status_code, 200)
        reserva = consulta.json()["reservas"][0]
        self.assertEqual(reserva["hora_inicio"], "15:00:00")
        self.assertEqual(reserva["hora_fin"], "16:00:00")
        creada = self._instante(reserva["creada_en"])
        self.assertLess(abs((creada - timezone.now()).total_seconds()), 120)

    def test_creada_en_coincide_al_releer_desde_la_bd(self):
        """La hora debe coincidir también al recargar "Mis reservas".

        Regresión del bug de zona horaria: la respuesta de creación
        serializaba el objeto en memoria (hora local), pero al releer desde
        la BD `creada_en` llegaba como UTC naive y DRF lo etiquetaba como
        hora local: 5 horas de más en pantalla.
        """
        self.crear_franja(HORA(15), HORA(16))
        self.assertEqual(self.post_reserva([(HORA(15), HORA(16))]).status_code, 201)

        # Lectura fresca que pasa por la BD, igual que al recargar la pantalla.
        reserva_bdd = ReservaConsultaSerializer(
            Reservas.objects.get(estado="activa")
        ).data
        instante = self._instante(reserva_bdd["creada_en"])

        self.assertLess(abs((instante - timezone.now()).total_seconds()), 120)
        # En hora local debe coincidir con el reloj del usuario.
        self.assertLess(
            abs((timezone.localtime(instante) - timezone.localtime()).total_seconds()),
            120,
        )

    def test_ultima_reserva_creada_se_lista_primero(self):
        """"Mis reservas" lista de la más reciente a la más antigua."""
        base = timezone.now()
        for horas_atras, dias in ((3, 0), (2, 1), (1, 2)):
            fecha = self.fecha + timedelta(days=dias)
            self.crear_franja(HORA(8), HORA(9), fecha=fecha)
            self.crear_reserva(
                HORA(8),
                HORA(9),
                fecha=fecha,
                creada_en=base - timedelta(hours=horas_atras),
            )

        respuesta = self.client.get(f"/api/usuarios/{self.usuario.id}/reservas/")

        self.assertEqual(respuesta.status_code, 200)
        fechas = [reserva["fecha"] for reserva in respuesta.json()["reservas"]]
        # La creada hace 1 hora (la más reciente) encabeza la lista.
        self.assertEqual(
            fechas,
            [
                (self.fecha + timedelta(days=2)).isoformat(),
                (self.fecha + timedelta(days=1)).isoformat(),
                self.fecha.isoformat(),
            ],
        )
