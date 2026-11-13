# Sistema de Reservas de Salas de Estudio

## Descripción

Aplicación web para consultar la disponibilidad y realizar reservas de salas de estudio.

## Funcionalidades principales

- Visualización de salas.
- Búsqueda y filtros.
- Consulta de disponibilidad.
- Creación de reservas.
- Creación de reservas recurrentes (1 a 4 semanas seguidas).
- Cancelación de reservas.

## Reservas recurrentes

`POST /api/reservas/` acepta el campo opcional `semanas` (entero de 1 a 4,
por defecto 1). La reserva se repite cada 7 días con el mismo día de la
semana y la misma franja horaria:

```json
{
  "recurso_id": 1,
  "usuario_id": 1,
  "fecha": "2026-11-12",
  "bloques": [{ "hora_inicio": "08:00:00", "hora_fin": "09:00:00" }],
  "semanas": 4
}
```

Los bloques seleccionados se repiten completos en cada fecha de la serie
(un tramo, varios tramos o horas separadas, dentro del tope de 3 horas por
día). La serie se valida **fecha por fecha** (franja cargada, horario libre
y límite diario, evaluado por separado en cada fecha). Si alguna fecha
presenta un conflicto, la operación es todo-o-nada: **no se crea ninguna
reserva** y la respuesta informa la fecha **y la hora** del inconveniente
en `error` y en los campos `fecha_conflicto`, `hora_inicio` y `hora_fin`
(HTTP 400 o 409 según el motivo).

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
