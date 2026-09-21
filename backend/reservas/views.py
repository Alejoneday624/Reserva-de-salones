from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Usuarios, Recursos, Franjas, Reservas
from .serializers import UsuariosSerializer, CatalogoRecursosSerializer


@api_view(["GET"])
def usuarios_lista(request):
    usuarios = Usuarios.objects.all().order_by("nombre")
    serializer = UsuariosSerializer(usuarios, many=True)
    return Response({"usuarios_lista": serializer.data})

@api_view(["GET"])
def catalogo_recursos(request):
    recursos = Recursos.objects.all().order_by("nombre")
    serializer = CatalogoRecursosSerializer(recursos, many=True)
    return Response({"catalogo_recursos": serializer.data})