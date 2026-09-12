from django.urls import path
from .views import saludo, datos_prueba

urlpatterns = [
    path("saludo/", saludo),
    path("datos_prueba/", datos_prueba),
]