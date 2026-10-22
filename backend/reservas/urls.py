from django.urls import path
from .views import (
    usuarios_lista,
    catalogo_recursos,
    recurso_detalle,
    filtro_tipo,
    recurso_disponibilidad,
    recurso_disponibilidad_fechas,
    reservas_crear,
    usuario_resumen_reservas,
)

urlpatterns = [
    path("usuarios/", usuarios_lista),
    path("usuarios/<int:usuario_id>/resumen-reservas/", usuario_resumen_reservas),
    path("recursos/", catalogo_recursos),
    path("recursos/<int:recurso_id>/", recurso_detalle),
    path("recursos/<int:recurso_id>/disponibilidad/", recurso_disponibilidad),
    path("recursos/<int:recurso_id>/disponibilidad/fechas/", recurso_disponibilidad_fechas),
    path("reservas/", reservas_crear),
    path("tipos/", filtro_tipo),
]
