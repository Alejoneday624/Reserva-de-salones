from django.urls import path
from .views import usuarios_lista, catalogo_recursos, recurso_detalle, filtro_tipo

urlpatterns = [
    path("usuarios/", usuarios_lista),
    path("recursos/", catalogo_recursos),
    path("recursos/<int:recurso_id>/", recurso_detalle),
    path("tipos/", filtro_tipo),
]
