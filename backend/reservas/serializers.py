from rest_framework import serializers
from .models import Usuarios, Recursos, Franjas


class UsuariosSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="nombre")

    class Meta:
        model = Usuarios
        fields = ["id", "name", "codigo", "programa", "correo"]




class CatalogoRecursosSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre = serializers.CharField(max_length=120)
    tipo = serializers.CharField(max_length=60)
    ubicacion = serializers.CharField(max_length=80)
    capacidad = serializers.IntegerField()
    atributos = serializers.CharField(max_length=200, allow_blank=True, allow_null=True)
    activo = serializers.BooleanField()

    class Meta:
        model = Recursos
        fields = ["id", "nombre", "tipo", "ubicacion", "capacidad", "atributos", "activo"]


class RecursoDetalleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recursos
        fields = ["id", "nombre", "tipo", "ubicacion", "capacidad", "atributos", "activo"]




