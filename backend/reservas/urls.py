from django.urls import path
from .views import usuarios_lista

urlpatterns = [
    path("usuarios/", usuarios_lista),
]
