"""Lógica de negocio de las reservas, separada de las vistas.

La vista solo valida la entrada y traduce estos errores a respuestas HTTP;
aquí vive el flujo de creación completo: reglas de negocio, candados de fila
(concurrencia) y límite diario de horas.
"""

import warnings

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


def crear_reservas(*, recurso_id, usuario_id, fecha, bloques):
    """Crea las reservas de una sala validando todas las reglas de negocio.

    `bloques` es una lista de pares (hora_inicio, hora_fin) con formatos ya
    validados por el serializer.

    Devuelve las reservas creadas o lanza ReservaError con el mensaje y el
    código HTTP (400 o 409) que debe ver el cliente.
    """
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

    with transaction.atomic():
        # Bloqueamos las franjas para serializar reservas concurrentes del mismo horario.
        franjas_bloque = []
        for hora_inicio, hora_fin in bloques:
            franja = (
                Franjas.objects.select_for_update()
                .filter(
                    recurso_id=recurso_id,
                    fecha=fecha,
                    hora_inicio=hora_inicio,
                    hora_fin=hora_fin,
                )
                .first()
            )
            if franja is None:
                raise ReservaError(
                    "La sala no tiene esa franja horaria para la fecha "
                    f"indicada ({hora_inicio.strftime('%H:%M')} - "
                    f"{hora_fin.strftime('%H:%M')})"
                )
            franjas_bloque.append(franja)

        solape = Q()
        for hora_inicio, hora_fin in bloques:
            solape |= Q(hora_inicio__lt=hora_fin, hora_fin__gt=hora_inicio)
        ocupada = (
            Reservas.objects.select_for_update()
            .filter(
                recurso_id=recurso_id,
                fecha=fecha,
                estado__in=ESTADOS_OCUPADOS,
            )
            .filter(solape)
            .exists()
        )
        if ocupada:
            raise ReservaError(
                "Alguno de los horarios seleccionados ya está reservado",
                status=409,
            )

        # La tabla no tiene secuencia en 'id', se asigna el siguiente manualmente.
        # El bloqueo sobre reservas serializa las inserciones concurrentes, por lo
        # que la validación del límite diario se hace después de adquirirlo.
        max_id = Reservas.objects.select_for_update().aggregate(max_id=Max("id"))["max_id"]

        horas_previas = horas_reservadas(usuario_id, fecha)
        horas_nuevas = sum(horas_entre(hi, hf) for hi, hf in bloques)
        if horas_previas + horas_nuevas > LIMITE_HORAS_DIARIAS + 1e-9:
            raise ReservaError(
                f"Por día solo puedes reservar {LIMITE_HORAS_DIARIAS} horas: "
                f"ya reservaste {horas_previas:g} y esta selección "
                f"sumaría {horas_nuevas:g}",
                detalle={
                    "horas_reservadas": round(horas_previas, 2),
                    "horas_seleccionadas": round(horas_nuevas, 2),
                    "horas_limite": LIMITE_HORAS_DIARIAS,
                    "horas_disponibles": round(
                        max(0.0, LIMITE_HORAS_DIARIAS - horas_previas), 2
                    ),
                },
            )

        # 'creada_en' es timestamp SIN zona horaria en la BD, se guarda hora local
        # de Bogotá; al leerla Django la interpreta con TIME_ZONE, así que coincide.
        # Django avisa con RuntimeWarning al guardar una fecha naive con USE_TZ=True;
        # es el comportamiento deseado aquí, así que se silencia.
        creado_en = timezone.localtime().replace(tzinfo=None)

        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            reservas = [
                Reservas.objects.create(
                    id=(max_id or 0) + 1 + indice,
                    franja=franja,
                    recurso=recurso,
                    usuario_id=usuario_id,
                    fecha=fecha,
                    hora_inicio=hora_inicio,
                    hora_fin=hora_fin,
                    estado="activa",
                    creada_en=creado_en,
                )
                for indice, ((hora_inicio, hora_fin), franja) in enumerate(
                    zip(bloques, franjas_bloque)
                )
            ]

    return reservas
