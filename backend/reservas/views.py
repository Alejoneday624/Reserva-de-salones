from rest_framework.decorators import api_view
from rest_framework.response import Response


from .models import Usuarios, Recursos, Franjas, Reservas


@api_view(["GET"])
def datos_prueba(request):
    usuario = Usuarios.objects.first()

    return Response({
        "usuarios": Usuarios.objects.count(),
        "recursos": Recursos.objects.count(),
        "franjas": Franjas.objects.count(),
        "reservas": Reservas.objects.count(),
        "usuario_seleccionado": usuario.nombre if usuario else None,
    })

@api_view(["GET"])
def saludo(request):
    return Response({
        "mensaje": "Hola desde Django !!!"
    })

