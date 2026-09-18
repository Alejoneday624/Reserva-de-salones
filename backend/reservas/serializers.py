from rest_framework import serializers
from .models import Usuarios


class UsuariosSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="nombre")
    subtitle = serializers.SerializerMethodField()

    class Meta:
        model = Usuarios
        fields = ["id", "name", "subtitle", "codigo", "programa", "correo"]

    def get_subtitle(self, obj):
        return "Estudiante Pregrado UAN"
