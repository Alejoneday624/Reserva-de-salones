from datetime import date, time

from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models import Exists, OuterRef
from django.shortcuts import get_object_or_404

from .models import Usuarios, Recursos, Franjas, Reservas
from .serializers import (
    UsuariosSerializer,
    CatalogoRecursosSerializer,
    RecursoDetalleSerializer,
    DisponibilidadFranjaSerializer,
    ReservaSerializer,
    ReservaConsultaSerializer,
    ResumenReservaSerializer,
    CrearReservaSerializer,
)
from .services import (
    ESTADOS_OCUPADOS,
    LIMITE_HORAS_DIARIAS,
    ReservaError,
    crear_reservas,
    horas_entre,
    hoy_y_ahora,
)

DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


@api_view(["GET"])
def usuarios_lista(request):
    usuarios = Usuarios.objects.all().order_by("nombre")
    serializer = UsuariosSerializer(usuarios, many=True)
    return Response({"usuarios_lista": serializer.data})

@api_view(["GET"])
def catalogo_recursos(request):
    recursos = Recursos.objects.all().order_by("nombre")

    tipo = request.query_params.get("tipo")
    if tipo:
        recursos = recursos.filter(tipo__iexact=tipo)

    for param, lookup in (("cap_min", "capacidad__gte"), ("cap_max", "capacidad__lte")):
        valor = request.query_params.get(param)
        if valor is None or valor == "":
            continue
        try:
            recursos = recursos.filter(**{lookup: int(valor)})
        except (TypeError, ValueError):
            return Response(
                {"error": f"'{param}' debe ser un número entero"},
                status=400,
            )

    serializer = CatalogoRecursosSerializer(recursos, many=True)
    return Response({"catalogo_recursos": serializer.data})

@api_view(["GET"])
def recurso_detalle(request, recurso_id):
    recurso = get_object_or_404(Recursos, id=recurso_id)
    serializer = RecursoDetalleSerializer(recurso)
    return Response(serializer.data)

@api_view(["GET"])
def filtro_tipo(request):
    tipos = (
        Recursos.objects.exclude(tipo__isnull=True)
        .exclude(tipo__exact="")
        .values_list("tipo", flat=True)
        .distinct()
        .order_by("tipo")
    )
    return Response({"tipos": list(tipos)})


def _franja_pasada(franja, hoy, ahora):
    """True si la franja ya empezó (cualquier fecha anterior a hoy también)."""
    return franja.fecha < hoy or (
        franja.fecha == hoy and franja.hora_inicio <= ahora
    )


def _franjas_con_disponibilidad(recurso_id, fecha=None):
    """Devuelve las franjas del recurso (de una fecha opcional) con su estado.

    Una franja está ocupada si existe una reserva activa o completada de la
    misma sala que se superponga en el horario, o si su horario ya pasó.
    Solo se consideran fechas desde hoy en adelante. Las reservas canceladas
    no bloquean.

    El solape se evalúa en la base de datos (subconsulta EXISTS) en una sola
    consulta; en Python solo se compara la hora contra "ahora", sin bucles
    anidados sobre todas las reservas.
    """
    hoy, ahora = hoy_y_ahora()

    if fecha is not None:
        if fecha < hoy:
            return []
        franjas = Franjas.objects.filter(recurso_id=recurso_id, fecha=fecha)
    else:
        franjas = Franjas.objects.filter(recurso_id=recurso_id, fecha__gte=hoy)

    reservas_solape = Reservas.objects.filter(
        recurso_id=recurso_id,
        fecha=OuterRef("fecha"),
        estado__in=ESTADOS_OCUPADOS,
        hora_inicio__lt=OuterRef("hora_fin"),
        hora_fin__gt=OuterRef("hora_inicio"),
    )

    franjas = franjas.annotate(ocupada=Exists(reservas_solape)).order_by(
        "fecha", "hora_inicio"
    )

    return [
        (franja, not franja.ocupada and not _franja_pasada(franja, hoy, ahora))
        for franja in franjas
    ]


@api_view(["GET"])
def recurso_disponibilidad_fechas(request, recurso_id):
    """Fechas desde hoy que tienen franjas cargadas para una sala, con conteo de libres."""
    fechas = {}
    for franja, libre in _franjas_con_disponibilidad(recurso_id):
        info = fechas.setdefault(
            franja.fecha,
            {"fecha": franja.fecha.isoformat(), "total": 0, "disponibles": 0},
        )
        info["total"] += 1
        if libre:
            info["disponibles"] += 1

    # La existencia se verifica solo si no hubo franjas: si hay filas, la
    # sala existe (FK) y se ahorra un viaje de red de ~200 ms.
    if not fechas:
        get_object_or_404(Recursos, id=recurso_id)

    return Response({"fechas": list(fechas.values())})


@api_view(["GET"])
def recurso_disponibilidad(request, recurso_id):
    """Franjas de una sala para una fecha dada, marcadas como libres u ocupadas."""
    fecha_param = request.query_params.get("fecha")
    if not fecha_param:
        return Response(
            {"error": "El parámetro 'fecha' es obligatorio (YYYY-MM-DD)"},
            status=400,
        )
    try:
        fecha = date.fromisoformat(fecha_param)
    except ValueError:
        return Response({"error": "'fecha' debe tener formato YYYY-MM-DD"}, status=400)

    hoy, ahora = hoy_y_ahora()
    franjas = [
        DisponibilidadFranjaSerializer(
            {
                "hora_inicio": franja.hora_inicio,
                "hora_fin": franja.hora_fin,
                "disponible": libre,
                "pasado": _franja_pasada(franja, hoy, ahora),
            }
        ).data
        for franja, libre in _franjas_con_disponibilidad(recurso_id, fecha)
    ]

    # Igual que en fechas: si hay franjas, la sala existe y se ahorra la
    # consulta extra de existencia (cada query cuesta ~200 ms de red).
    if not franjas:
        get_object_or_404(Recursos, id=recurso_id)

    return Response(
        {
            "fecha": fecha.isoformat(),
            "dia_semana": DIAS_SEMANA[fecha.weekday()],
            "franjas": franjas,
        }
    )


def _mensaje_error(errores):
    """Aplana los errores de DRF al formato {"error": "texto"} del frontend.

    Incluye la ruta completa del campo (p. ej. "bloques.0.hora_fin: ...").
    """
    def texto(clave, valor):
        if isinstance(valor, dict):
            return "; ".join(
                texto(f"{clave}.{k}" if clave else str(k), v)
                for k, v in valor.items()
            )
        cuerpo = (
            ", ".join(str(item) for item in valor)
            if isinstance(valor, (list, tuple))
            else str(valor)
        )
        return f"{clave}: {cuerpo}" if clave else cuerpo

    partes = [
        texto("", valor) if campo == "non_field_errors" else texto(campo, valor)
        for campo, valor in errores.items()
    ]
    return " | ".join(partes) or "Datos inválidos"


@api_view(["POST"])
def reservas_crear(request):
    """Crea reservas para uno o varios bloques horarios contiguos de una sala."""
    entrada = CrearReservaSerializer(data=request.data)
    if not entrada.is_valid():
        return Response({"error": _mensaje_error(entrada.errors)}, status=400)

    datos = entrada.validated_data
    try:
        reservas = crear_reservas(
            recurso_id=datos["recurso_id"],
            usuario_id=datos["usuario_id"],
            fecha=datos["fecha"],
            bloques=[
                (bloque["hora_inicio"], bloque["hora_fin"])
                for bloque in datos["bloques"]
            ],
        )
    except ReservaError as exc:
        cuerpo = {"error": exc.mensaje}
        if exc.detalle:
            cuerpo.update(exc.detalle)
        return Response(cuerpo, status=exc.status)

    return Response(
        {"reservas": ReservaSerializer(reservas, many=True).data}, status=201
    )


@api_view(["GET"])
def reservas_consulta(request):
    """Reservas existentes de todas las salas y usuarios, con filtros.

    La HDU de consulta permite ver la ocupación de una jornada. Todos los
    filtros son opcionales:

    - ``fecha``: día exacto (YYYY-MM-DD). Sin él se consulta todo el histórico.
    - ``tipo``: tipo de sala (sin distinguir mayúsculas).
    - ``cap_min`` / ``cap_max``: rango de capacidad de la sala.
    - ``hora_desde`` / ``hora_hasta``: franja horaria (HH:MM); se devuelven las
      reservas que se crucen con ella.
    """
    reservas = Reservas.objects.select_related("recurso").order_by(
        "fecha", "hora_inicio", "recurso__nombre"
    )

    fecha = None
    fecha_param = request.query_params.get("fecha")
    if fecha_param:
        try:
            fecha = date.fromisoformat(fecha_param)
        except ValueError:
            return Response(
                {"error": "'fecha' debe tener formato YYYY-MM-DD"}, status=400
            )
        reservas = reservas.filter(fecha=fecha)

    tipo = request.query_params.get("tipo")
    if tipo:
        reservas = reservas.filter(recurso__tipo__iexact=tipo)

    for param, lookup in (
        ("cap_min", "recurso__capacidad__gte"),
        ("cap_max", "recurso__capacidad__lte"),
    ):
        valor = request.query_params.get(param)
        if valor is None or valor == "":
            continue
        try:
            reservas = reservas.filter(**{lookup: int(valor)})
        except (TypeError, ValueError):
            return Response(
                {"error": f"'{param}' debe ser un número entero"},
                status=400,
            )

    horas = {}
    for param in ("hora_desde", "hora_hasta"):
        valor = request.query_params.get(param)
        if valor is None or valor == "":
            continue
        try:
            horas[param] = time.fromisoformat(valor)
        except ValueError:
            return Response(
                {"error": f"'{param}' debe tener formato HH:MM"}, status=400
            )

    desde, hasta = horas.get("hora_desde"), horas.get("hora_hasta")
    if desde is not None and hasta is not None and desde >= hasta:
        return Response(
            {"error": "'hora_desde' debe ser anterior a 'hora_hasta'"},
            status=400,
        )
    if desde is not None:
        reservas = reservas.filter(hora_fin__gt=desde)
    if hasta is not None:
        reservas = reservas.filter(hora_inicio__lt=hasta)

    lista = list(reservas)
    return Response(
        {
            "fecha": fecha.isoformat() if fecha else None,
            "total": len(lista),
            "reservas": ReservaConsultaSerializer(lista, many=True).data,
        }
    )


@api_view(["GET"])
def usuario_reservas(request, usuario_id):
    """Reservas de un usuario, ordenadas por fecha de creación.

    Solo se devuelven las reservas del usuario indicado (criterio 1 de la
    HDU de consulta de reservas); si el usuario no existe se responde 404.
    """
    get_object_or_404(Usuarios, id=usuario_id)

    reservas = (
        Reservas.objects.select_related("recurso")
        .filter(usuario_id=usuario_id)
        .order_by("creada_en")
    )

    return Response(
        {
            "usuario_id": usuario_id,
            "total": reservas.count(),
            "reservas": ReservaConsultaSerializer(reservas, many=True).data,
        }
    )


@api_view(["GET"])
def usuario_resumen_reservas(request, usuario_id):
    """Horas reservadas por un usuario en una fecha y su límite diario."""
    fecha_param = request.query_params.get("fecha")
    if not fecha_param:
        return Response(
            {"error": "El parámetro 'fecha' es obligatorio (YYYY-MM-DD)"},
            status=400,
        )
    try:
        fecha = date.fromisoformat(fecha_param)
    except ValueError:
        return Response({"error": "'fecha' debe tener formato YYYY-MM-DD"}, status=400)

    # Se trae la lista una sola vez y las horas se calculan de esas mismas
    # filas: evita una consulta extra, y cada consulta es un viaje de red
    # de ~200 ms a la BD en EE.UU.
    reservas = list(
        Reservas.objects.select_related("recurso")
        .filter(usuario_id=usuario_id, fecha=fecha, estado__in=ESTADOS_OCUPADOS)
        .order_by("hora_inicio")
    )
    # El usuario se consulta solo si no hay reservas: si las hay, la fila
    # garantiza que existe (FK) y se ahorra otro viaje de red.
    if not reservas:
        get_object_or_404(Usuarios, id=usuario_id)
    horas_previas = sum(horas_entre(r.hora_inicio, r.hora_fin) for r in reservas)

    return Response(
        {
            "fecha": fecha.isoformat(),
            "horas_limite": LIMITE_HORAS_DIARIAS,
            "horas_reservadas": round(horas_previas, 2),
            "horas_disponibles": round(
                max(0.0, LIMITE_HORAS_DIARIAS - horas_previas), 2
            ),
            "reservas": ResumenReservaSerializer(reservas, many=True).data,
        }
    )
