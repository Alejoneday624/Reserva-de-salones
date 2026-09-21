from django.urls import path
from .views import usuarios_lista, catalogo_recursos

urlpatterns = [
    path("usuarios/", usuarios_lista),
    path("recursos/", catalogo_recursos),
]
