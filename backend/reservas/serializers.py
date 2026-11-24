from datetime import timezone as zona_utc

from django.utils import timezone
from rest_framework import serializers
from .models import Usuarios, Recursos, Franjas, Reservas


class InstanteUTCField(serializers.DateTimeField):
    """Campo para `creada_en`, cuya columna es `timestamp` SIN zona horaria.

    Django convierte el valor a UTC al escribirlo (USE_TZ=True), pero al
    leerlo devuelve un datetime naive (sin tzinfo). DRF etiquetaría ese naive
    con TIME_ZONE (America/Bogota) y la pantalla mostraría la hora de más
    (5 horas: 5 PM se vería como 10 PM). Aquí se etiqueta UTC explícitamente
    para que el navegador convierta a la hora local del usuario.
    """

    def to_representation(self, value):
        if value is not None and timezone.is_naive(value):
            value = value.replace(tzinfo=zona_utc.utc)
        return super().to_representation(value)


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


class DisponibilidadFranjaSerializer(serializers.Serializer):
    hora_inicio = serializers.TimeField()
    hora_fin = serializers.TimeField()
    disponible = serializers.BooleanField()
    pasado = serializers.BooleanField(required=False, default=False)


class ReservaSerializer(serializers.ModelSerializer):
    creada_en = InstanteUTCField()

    class Meta:
        model = Reservas
        fields = [
            "id",
            "franja",
            "recurso",
            "usuario",
            "fecha",
            "hora_inicio",
            "hora_fin",
            "estado",
            "creada_en",
        ]


class ReservaConsultaSerializer(serializers.ModelSerializer):
    """Reserva tal como la ve el estudiante en "Mis reservas".

    La sala, la fecha y el horario salen de la propia reserva y el estado se
    resuelve contra el momento actual (ver Reservas.estado_resuelto).
    """

    sala = serializers.CharField(source="recurso.nombre")
    recurso_id = serializers.IntegerField(source="recurso.id")
    tipo = serializers.CharField(source="recurso.tipo")
    ubicacion = serializers.CharField(source="recurso.ubicacion")
    capacidad = serializers.IntegerField(source="recurso.capacidad")
    estado = serializers.SerializerMethodField()
    cancelable = serializers.BooleanField(source="es_cancelable")
    creada_en = InstanteUTCField()

    class Meta:
        model = Reservas
        fields = [
            "id",
            "recurso_id",
            "sala",
            "tipo",
            "ubicacion",
            "capacidad",
            "fecha",
            "hora_inicio",
            "hora_fin",
            "estado",
            "cancelable",
            "creada_en",
        ]

    def get_estado(self, obj):
        return obj.estado_resuelto


class ResumenReservaSerializer(serializers.ModelSerializer):
    recurso_nombre = serializers.CharField(source="recurso.nombre")

    class Meta:
        model = Reservas
        fields = ["id", "recurso", "recurso_nombre", "hora_inicio", "hora_fin", "estado"]


class CancelarReservaSerializer(serializers.Serializer):
    """Entrada de POST /api/reservas/<id>/cancelar/.

    `usuario_id` es el estudiante que solicita la cancelación: la vista
    verifica que la reserva le pertenezca.
    """

    usuario_id = serializers.IntegerField()


class BloqueHorarioSerializer(serializers.Serializer):
    """Un tramo horario de reserva: hora_inicio debe ser anterior a hora_fin."""

    hora_inicio = serializers.TimeField()
    hora_fin = serializers.TimeField()

    def validate(self, attrs):
        if attrs["hora_inicio"] >= attrs["hora_fin"]:
            raise serializers.ValidationError(
                "'hora_inicio' debe ser anterior a 'hora_fin'"
            )
        return attrs


class CrearReservaSerializer(serializers.Serializer):
    """Entrada de POST /api/reservas/.

    Acepta el formato actual (`bloques`, una lista de tramos) y el formato
    antiguo (`hora_inicio` / `hora_fin` simples), que se convierte en un único
    bloque. La validación de solape entre bloques también vive aquí.

    `semanas` indica cuántas semanas seguidas se repite la reserva (1 a 4,
    mismo día de la semana y misma franja horaria); opcional y por defecto 1,
    para no romper a los clientes actuales.
    """

    recurso_id = serializers.IntegerField()
    usuario_id = serializers.IntegerField()
    fecha = serializers.DateField()
    semanas = serializers.IntegerField(
        default=1,
        min_value=1,
        max_value=4,
        error_messages={
            "invalid": "'semanas' debe ser un número entero",
            "min_value": "'semanas' debe ser al menos 1",
            "max_value": "'semanas' debe ser máximo 4",
        },
    )
    bloques = serializers.ListField(
        child=BloqueHorarioSerializer(),
        required=False,
        allow_empty=True,
        error_messages={"not_a_list": "'bloques' debe ser una lista"},
    )
    # Compatibilidad con el formato anterior de un solo tramo horario.
    hora_inicio = serializers.TimeField(required=False)
    hora_fin = serializers.TimeField(required=False)

    def validate(self, attrs):
        if not attrs.get("bloques"):
            if attrs.get("hora_inicio") is None or attrs.get("hora_fin") is None:
                raise serializers.ValidationError(
                    "Faltan campos obligatorios: bloques (o hora_inicio y hora_fin)"
                )
            bloque = BloqueHorarioSerializer(
                data={
                    "hora_inicio": attrs["hora_inicio"],
                    "hora_fin": attrs["hora_fin"],
                }
            )
            bloque.is_valid(raise_exception=True)
            attrs["bloques"] = [bloque.validated_data]

        # Los bloques no pueden solaparse entre sí.
        ordenados = sorted(
            attrs["bloques"],
            key=lambda b: (b["hora_inicio"], b["hora_fin"]),
        )
        for anterior, posterior in zip(ordenados, ordenados[1:]):
            if posterior["hora_inicio"] < anterior["hora_fin"]:
                raise serializers.ValidationError(
                    "Los bloques seleccionados se solapan entre sí"
                )
        return attrs




