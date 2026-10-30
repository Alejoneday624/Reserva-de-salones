"""Pruebas de rendimiento (número de consultas SQL) y de solapamiento.

Ejecutar con SQLite en memoria (rápido y sin tocar producción):

    python manage.py test reservas

Las pruebas de concurrencia real (dos peticiones simultáneas) necesitan los
bloqueos ``SELECT ... FOR UPDATE`` de PostgreSQL y se omiten en SQLite. Para
ejecutarlas, exporte ``TEST_DATABASE_URL`` apuntando a una base de pruebas:

    $env:TEST_DATABASE_URL="postgres://usuario:clave@host:5432/db_pruebas"
    python manage.py test reservas --settings=config.settings_test
"""

from datetime import time, timedelta
from threading import Barrier, Thread

from django.db import connection, connections
from django.db.models import Max
from django.test import TestCase, TransactionTestCase, skipUnlessDBFeature
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from .models import Franjas, Recursos, Reservas, Usuarios
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

    def crear_recurso(self, id_, nombre="Sala de estudio", activo=1):
        return Recursos.objects.create(
            id=id_,
            nombre=nombre,
            tipo="Sala de estudio",
            ubicacion="Bloque A",
            capacidad=6,
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
            creada_en=timezone.now(),
        )

    def payload(self, bloques, *, usuario_id=1, recurso_id=1, fecha=None):
        return {
            "recurso_id": recurso_id,
            "usuario_id": usuario_id,
            "fecha": (fecha or self.fecha).isoformat(),
            "bloques": [
                {"hora_inicio": inicio.isoformat(), "hora_fin": fin.isoformat()}
                for inicio, fin in bloques
            ],
        }

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
