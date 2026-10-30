"""Configuración de Django para ejecutar las pruebas.

Nunca toca la base de datos de producción: por defecto usa SQLite en memoria.

Uso:
    python manage.py test reservas --settings=config.settings_test

Para probar la concurrencia real (bloqueos SELECT ... FOR UPDATE) hay que
usar PostgreSQL; exporte TEST_DATABASE_URL con una base *de pruebas*:

    $env:TEST_DATABASE_URL="postgres://usuario:clave@host:5432/db_pruebas"
    python manage.py test reservas --settings=config.settings_test
"""

import os

import dj_database_url

# settings.py exige DATABASE_URL; en CI puede no existir un .env. Se define
# una URL ficticia porque justo debajo se reemplaza por la base de pruebas.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from .settings import *  # noqa: E402,F401,F403

DEBUG = False
SECRET_KEY = "clave-solo-para-pruebas"

_url_pruebas = os.getenv("TEST_DATABASE_URL")

if _url_pruebas:
    DATABASES = {"default": dj_database_url.parse(_url_pruebas)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
