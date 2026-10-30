# Sistema de Reservas de Salas de Estudio

## Descripción

Aplicación web para consultar la disponibilidad y realizar reservas de salas de estudio.

## Funcionalidades principales

- Visualización de salas.
- Búsqueda y filtros.
- Consulta de disponibilidad.
- Creación de reservas.
- Cancelación de reservas.

## Tecnologías

- React
- Django
- PostgreSQL
- Docker
- Vercel
- Render

## Estado del proyecto

**Fase actual: Gestión y planificación**

Actualmente el proyecto se encuentra en la etapa de definición y planificación.

## Pruebas

Las pruebas de **rendimiento** (número de consultas SQL) y de **solapamiento**
de reservas están en `backend/reservas/test.py`. Al ejecutar `manage.py test`
se usa SQLite en memoria y no se toca la base de datos de producción:

```bash
cd backend
python manage.py test reservas
```

La prueba de **concurrencia** (dos peticiones simultáneas sobre la misma
franja) necesita los bloqueos `SELECT ... FOR UPDATE` de PostgreSQL, por lo
que se omite en SQLite. Para ejecutarla contra una base de pruebas:

```bash
$env:TEST_DATABASE_URL="postgres://usuario:clave@host:5432/db_pruebas"
python manage.py test reservas --settings=config.settings_test
```

## Despliegue del frontend (Vercel)

`frontend/vercel.json` reescribe todas las rutas a `index.html` para que
recargar `/catalogo` o `/catalogo/<id>` no devuelva 404. En Vercel, el
directorio raíz del proyecto debe ser `frontend`.


## Equipo

**Grupo 3 — Quantum Stack**

- Jonathan Alejandro Guzmán Camelo
- Juan Andrés Camacho García
- Juan José Mosquera Varón
