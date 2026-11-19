"""Lógica de negocio de las reservas, separada de las vistas.

La vista solo valida la entrada y traduce estos errores a respuestas HTTP;
aquí vive el flujo de creación completo: reglas de negocio, candados de fila
(concurrencia) y límite diario de horas.
"""

import warnings
from datetime import timedelta

from django.db import transaction
from django.db.models import Max, Q
from django.utils import timezone

from .models import Franjas, Recursos, Reservas, Usuarios

ESTADOS_OCUPADOS = ("activa", "completada")
LIMITE_HORAS_DIARIAS = 3


class ReservaError(Exception):
    """Regla de negocio violada.

    `mensaje` se devuelve tal cual al cliente (formato {"error": "..."}), `status`
    es el código HTTP y `detalle` permite adjuntar campos extra opcionales.
    """

    def __init__(self, mensaje, status=400, detalle=None):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status = status
        self.detalle = detalle


def hoy_y_ahora():
    """Fecha y hora actuales en la zona horaria local configurada."""
    ahora = timezone.localtime()
    return ahora.date(), ahora.time()


def horas_entre(hora_inicio, hora_fin):
    """Duración en horas entre dos horas del día (datetime.time no resta)."""
    inicio = hora_inicio.hour * 3600 + hora_inicio.minute * 60 + hora_inicio.second
    fin = hora_fin.hour * 3600 + hora_fin.minute * 60 + hora_fin.second
    return (fin - inicio) / 3600


def horas_reservadas(usuario_id, fecha):
    """Horas ya reservadas por el usuario en esa fecha (activas + completadas).

    Las reservas canceladas no cuentan para el límite diario.
    """
    reservas = (
        Reservas.objects.filter(
            usuario_id=usuario_id,
            fecha=fecha,
            estado__in=ESTADOS_OCUPADOS,
        )
        .values_list("hora_inicio", "hora_fin")
    )
    return sum(horas_entre(hora_inicio, hora_fin) for hora_inicio, hora_fin in reservas)


def crear_reservas(*, recurso_id, usuario_id, fecha, bloques, semanas=1):
    """Crea las reservas de una sala validando todas las reglas de negocio.

    `bloques` es una lista de pares (hora_inicio, hora_fin) con formatos ya
    validados por el serializer.

    `semanas` (1 a 4) repite la reserva cada 7 días, con el mismo día de la
    semana y la misma franja horaria, hasta 4 fechas en total. Los bloques
    seleccionados se repiten completos en cada fecha de la serie. La
    operación es todo-o-nada: se validan TODAS las fechas y, si alguna
    presenta un conflicto, se lanza ReservaError y la transacción revierte
    sin crear ninguna reserva. El error indica la fecha y la hora del
    inconveniente en el mensaje y en `detalle` (`fecha_conflicto`,
    `hora_inicio`, `hora_fin`).

    Devuelve las reservas creadas o lanza ReservaError con el mensaje y el
    código HTTP (400 o 409) que debe ver el cliente.
    """
    if not 1 <= semanas <= 4:
        raise ReservaError("'semanas' debe estar entre 1 y 4")

    # No se permite reservar en fechas u horarios que ya pasaron.
    hoy, ahora = hoy_y_ahora()
    if fecha < hoy:
        raise ReservaError("No se pueden crear reservas en fechas pasadas")
    if fecha == hoy and any(hora_inicio <= ahora for hora_inicio, _ in bloques):
        raise ReservaError("No se pueden crear reservas en horarios que ya pasaron")

    recurso = Recursos.objects.filter(id=recurso_id).first()
    if recurso is None:
        raise ReservaError("Recurso no encontrado")
    if not recurso.activo:
        raise ReservaError("El recurso no está activo")

    if not Usuarios.objects.filter(id=usuario_id).exists():
        raise ReservaError("Usuario no encontrado")

    # Los bloques no pueden solaparse entre sí (defensa además del serializer).
    ordenados = sorted(bloques)
    for anterior, posterior in zip(ordenados, ordenados[1:]):
        if posterior[0] < anterior[1]:
            raise ReservaError("Los bloques seleccionados se solapan entre sí")

    # Cada semana posterior repite el mismo día de la semana (+7 días).
    # La lista ya viene en orden ascendente, que es el orden de bloqueo.
    fechas = [fecha + timedelta(weeks=semana) for semana in range(semanas)]

    with transaction.atomic():
        # La tabla no tiene secuencia en 'id', se asigna el siguiente
        # manualmente. Este candado sobre reservas se toma PRIMERO para
        # serializar las inserciones concurrentes: así la validación del
        # límite diario de cada fecha (que viene después) siempre ve las
        # reservas que otra petición simultánea haya creado, y dos
        # selecciones del mismo estudiante no pueden sumar más de 3 horas
        # en un mismo día.
        max_id = Reservas.objects.select_for_update().aggregate(max_id=Max("id"))["max_id"]

        # Fase 1: validar TODAS las fechas antes de crear cualquier reserva.
        validadas = []
        for fecha_reserva in fechas:
            # Bloqueamos las franjas para serializar reservas concurrentes
            # del mismo horario, siempre en el mismo orden (fechas
            # ascendentes) para no interbloquear con otra petición.
            franjas_bloque = []
            for hora_inicio, hora_fin in bloques:
                franja = (
                    Franjas.objects.select_for_update()
                    .filter(
                        recurso_id=recurso_id,
                        fecha=fecha_reserva,
                        hora_inicio=hora_inicio,
                        hora_fin=hora_fin,
                    )
                    .first()
                )
                if franja is None:
                    raise ReservaError(
                        "La sala no tiene esa franja horaria para la fecha "
                        f"indicada ({fecha_reserva.isoformat()}, "
                        f"{hora_inicio.strftime('%H:%M')} - "
                        f"{hora_fin.strftime('%H:%M')})",
                        detalle={
                            "fecha_conflicto": fecha_reserva.isoformat(),
                            "hora_inicio": hora_inicio,
                            "hora_fin": hora_fin,
                        },
                    )
                franjas_bloque.append(franja)

            solape = Q()
            for hora_inicio, hora_fin in bloques:
                solape |= Q(hora_inicio__lt=hora_fin, hora_fin__gt=hora_inicio)
            reservas_solape = list(
                Reservas.objects.select_for_update()
                .filter(
                    recurso_id=recurso_id,
                    fecha=fecha_reserva,
                    estado__in=ESTADOS_OCUPADOS,
                )
                .filter(solape)
                .only("hora_inicio", "hora_fin")
            )
            if reservas_solape:
                # Se informa el bloque de la selección que choca, para que el
                # estudiante sepa qué fecha y qué hora corregir.
                conflicto = next(
                    (
                        (hora_inicio, hora_fin)
                        for hora_inicio, hora_fin in ordenados
                        if any(
                            reserva.hora_inicio < hora_fin
                            and reserva.hora_fin > hora_inicio
                            for reserva in reservas_solape
                        )
                    ),
                    ordenados[0],
                )
                hora_inicio, hora_fin = conflicto
                raise ReservaError(
                    f"El {fecha_reserva.isoformat()} las "
                    f"{hora_inicio.strftime('%H:%M')} - "
                    f"{hora_fin.strftime('%H:%M')} ya está reservado",
                    status=409,
                    detalle={
                        "fecha_conflicto": fecha_reserva.isoformat(),
                        "hora_inicio": hora_inicio,
                        "hora_fin": hora_fin,
                    },
                )

            # El límite diario se valida de forma independiente para cada
            # fecha de la serie.
            horas_previas = horas_reservadas(usuario_id, fecha_reserva)
            horas_nuevas = sum(horas_entre(hi, hf) for hi, hf in bloques)
            if horas_previas + horas_nuevas > LIMITE_HORAS_DIARIAS + 1e-9:
                raise ReservaError(
                    f"Por día solo puedes reservar {LIMITE_HORAS_DIARIAS} horas "
                    f"(fecha {fecha_reserva.isoformat()}): ya reservaste "
                    f"{horas_previas:g} y esta selección sumaría {horas_nuevas:g}",
                    detalle={
                        "fecha_conflicto": fecha_reserva.isoformat(),
                        "horas_reservadas": round(horas_previas, 2),
                        "horas_seleccionadas": round(horas_nuevas, 2),
                        "horas_limite": LIMITE_HORAS_DIARIAS,
                        "horas_disponibles": round(
                            max(0.0, LIMITE_HORAS_DIARIAS - horas_previas), 2
                        ),
                    },
                )

            validadas.append((fecha_reserva, franjas_bloque))

        # Fase 2: crear las reservas de todas las fechas ya validadas. Si
        # alguna validación falló, se llegó hasta aquí sin insertar nada.
        #
        # 'creada_en' es timestamp SIN zona horaria en la BD: se guarda hora
        # local naive y Django la convierte a UTC al escribirla (USE_TZ=True),
        # por eso la BD almacena el instante correcto en UTC. Al leerla, el
        # ORM devuelve un naive que el serializer etiqueta como UTC (ver
        # InstanteUTCField); así la pantalla muestra la hora local real.
        # Guardar aquí la UTC (timezone.now()) haría que se mostrara 5 horas
        # de más (5 PM se vería como 10 PM).
        # Django avisa con RuntimeWarning al guardar un datetime naive con
        # USE_TZ=True; es el comportamiento deseado aquí, así que se silencia.
        creado_en = timezone.localtime().replace(tzinfo=None)

        creadas = []
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            for indice_fecha, (fecha_reserva, franjas_bloque) in enumerate(validadas):
                for indice, ((hora_inicio, hora_fin), franja) in enumerate(
                    zip(bloques, franjas_bloque)
                ):
                    creadas.append(
                        Reservas.objects.create(
                            id=(max_id or 0)
                            + 1
                            + indice_fecha * len(bloques)
                            + indice,
                            franja=franja,
                            recurso=recurso,
                            usuario_id=usuario_id,
                            fecha=fecha_reserva,
                            hora_inicio=hora_inicio,
                            hora_fin=hora_fin,
                            estado="activa",
                            creada_en=creado_en,
                        )
                    )

    # Se releen desde la BD para que la respuesta de creación sea idéntica a
    # una lectura posterior ("Mis reservas"): en memoria `creada_en` trae la
    # hora local sin convertir, mientras que la BD almacena UTC, y serializar
    # cada caso produciría horas distintas en pantalla.
    return list(
        Reservas.objects.filter(id__in=[reserva.id for reserva in creadas]).order_by(
            "id"
        )
    )
