from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import Usuarios, Recursos, Franjas, Reservas
from .serializers import UsuariosSerializer, CatalogoRecursosSerializer, RecursoDetalleSerializer


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