# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.db import models
from django.utils import timezone

# Estados que la consulta de reservas muestra al estudiante. Se calculan a
# partir del estado guardado en la BD (activa / completada / cancelada) y del
# momento actual.
ESTADOS_MOSTRADOS = ("activa", "en curso", "vencida", "cancelada")


class Usuarios(models.Model):
    id = models.IntegerField(primary_key=True)
    nombre = models.CharField(max_length=120)
    codigo = models.CharField(unique=True, max_length=20)
    programa = models.CharField(max_length=80)
    correo = models.CharField(unique=True, max_length=120)

    class Meta:
        managed = False
        db_table = 'usuarios'


class Recursos(models.Model):
    id = models.IntegerField(primary_key=True)
    nombre = models.CharField(max_length=120)
    tipo = models.CharField(max_length=60)
    ubicacion = models.CharField(max_length=80)
    capacidad = models.IntegerField()
    atributos = models.CharField(max_length=200, blank=True, null=True)
    activo = models.SmallIntegerField()

    class Meta:
        managed = False
        db_table = 'recursos'


class Franjas(models.Model):
    id = models.IntegerField(primary_key=True)
    recurso = models.ForeignKey(Recursos, models.DO_NOTHING)
    fecha = models.DateField()
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()

    class Meta:
        managed = False
        db_table = 'franjas'


class Reservas(models.Model):
    id = models.IntegerField(primary_key=True)
    franja = models.ForeignKey(Franjas, models.DO_NOTHING)
    recurso = models.ForeignKey(Recursos, models.DO_NOTHING)
    usuario = models.ForeignKey(Usuarios, models.DO_NOTHING)
    fecha = models.DateField()
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    estado = models.CharField(max_length=15)
    creada_en = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'reservas'

    @property
    def estado_resuelto(self):
        """Estado de la reserva para mostrarlo al estudiante.

        La BD guarda el estado operativo (activa / completada / cancelada) y
        la consulta requiere: cancelada, vencida, en curso o activa. La
        cancelación es un hecho guardado; el resto se deriva comparando
        fecha y horario de la reserva contra el momento actual.

        Usa la fecha y el horario propios de la reserva (los mismos que se
        muestran), no los de la franja, para que lo visto y el estado
        coincidan siempre.
        """
        if (self.estado or "").strip().lower() == "cancelada":
            return "cancelada"

        # localtime() devuelve hora local con tzinfo; .time()/.date() lo
        # descartan, así que la comparación es naive contra naive.
        ahora = timezone.localtime()
        hoy, hora_actual = ahora.date(), ahora.time()

        if self.fecha < hoy or (self.fecha == hoy and self.hora_fin <= hora_actual):
            return "vencida"
        if self.fecha == hoy and self.hora_inicio <= hora_actual < self.hora_fin:
            return "en curso"
        return "activa"
