import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  MapPin,
  Users,
} from "lucide-react";
import { getReservasUsuario } from "../api/reservasApi";
import { useUser } from "../context/UserContext";

// Los 4 estados que la HDU de consulta de reservas muestra al estudiante.
// El backend los resuelve a partir del estado guardado y el momento actual.
const ESTADOS = {
  activa: { label: "Activa", className: "bg-green-50 text-green-700 ring-green-200", dot: "bg-green-500" },
  "en curso": { label: "En curso", className: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" },
  vencida: { label: "Vencida", className: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  cancelada: { label: "Cancelada", className: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
};

function configEstado(estado) {
  return ESTADOS[String(estado ?? "").toLowerCase()] ?? ESTADOS.activa;
}

function formatearFecha(fecha) {
  if (!fecha) return "—";
  const fechaDate = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(fechaDate.getTime())) return fecha;
  return fechaDate.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Los horarios llegan como "07:00:00"; solo se muestran HH:MM.
function formatearHora(hora) {
  return hora ? String(hora).slice(0, 5) : "—";
}

// `creada_en` llega como ISO con zona horaria.
function formatearCreacion(iso) {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MisReservas() {
  const { nombreUsuario } = useUser();
  const navigate = useNavigate();
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const usuarioId = nombreUsuario?.id;
  const nombre = nombreUsuario?.name;

  useEffect(() => {
    // Sin usuario no hay nada que consultar; ProtectedRoute ya redirige en
    // ese caso, así que el aviso se muestra en el render y no con setState.
    if (!usuarioId) return;

    let cancelado = false;

    const cargarReservas = async () => {
      setCargando(true);
      setError(null);
      try {
        const data = await getReservasUsuario(usuarioId);
        if (cancelado) return;

        const lista = Array.isArray(data?.reservas) ? data.reservas : [];
        // El backend ya ordena de la más reciente a la más antigua; este
        // orden es defensivo para que la vista no dependa de ese detalle.
        const ordenadas = [...lista].sort(
          (a, b) => new Date(b.creada_en ?? 0) - new Date(a.creada_en ?? 0)
        );
        setReservas(ordenadas);
      } catch (err) {
        console.error("Error al cargar reservas:", err);
        if (!cancelado) setError("No se pudieron cargar las reservas");
      } finally {
        if (!cancelado) setCargando(false);
      }
    };

    cargarReservas();

    return () => {
      cancelado = true;
    };
  }, [usuarioId]);

  const encabezado = (
    <>
      <div className="flex items-center gap-2 mb-1">
        <CalendarCheck className="w-5 h-5 text-teal-600" />
        <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
          Consulta de reservas
        </span>
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Mis Reservas</h1>
      <p className="text-sm text-slate-500 mb-6">
        {nombre
          ? `Reservas registradas a nombre de ${nombre}`
          : "Reservas del usuario seleccionado"}
      </p>
    </>
  );

  const volver = (
    <button
      type="button"
      onClick={() => navigate("/catalogo")}
      className="mt-6 text-sm font-medium text-teal-600 hover:text-teal-700"
    >
      ← Volver al catálogo
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {encabezado}

          {cargando && (
            <div className="text-slate-400 text-sm text-center py-10">
              Cargando reservas...
            </div>
          )}

          {!cargando && error && (
            <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {!cargando && !error && reservas.length === 0 && (
            <div className="rounded-xl border border-slate-200 p-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                <CalendarDays className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">
                {nombre ? `${nombre} aún no tiene reservas` : "No hay reservas registradas"}
              </p>
              <p className="text-xs text-slate-400">
                Selecciona una sala en el catálogo para crear una reserva
              </p>
            </div>
          )}

          {!cargando && !error && reservas.length > 0 && (
            <>
              <p className="text-xs text-slate-500 mb-4">
                {reservas.length} reserva{reservas.length === 1 ? "" : "s"} ·
                de la más reciente a la más antigua
              </p>

              <div className="flex flex-col gap-4">
                {reservas.map((reserva) => {
                  const estado = configEstado(reserva.estado);

                  return (
                    <article
                      key={reserva.id}
                      className="bg-slate-50 rounded-xl border border-slate-200 p-5"
                    >
                      {/* Sala + estado */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <h2 className="font-bold text-slate-900 text-base truncate">
                            {reserva.sala}
                          </h2>
                          <p className="text-xs text-slate-500">
                            Reserva #{reserva.id}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${estado.className}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${estado.dot}`} />
                          {estado.label}
                        </span>
                      </div>

                      {/* Ubicación y capacidad */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mb-3">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {reserva.ubicacion}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-slate-400" />
                          {reserva.capacidad} lugares
                        </span>
                      </div>

                      {/* Fecha y horario */}
                      <div className="flex flex-col gap-2 text-sm text-slate-600">
                        <span className="inline-flex items-start gap-2">
                          <CalendarDays className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                          <span className="capitalize">{formatearFecha(reserva.fecha)}</span>
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-medium">
                            {formatearHora(reserva.hora_inicio)} - {formatearHora(reserva.hora_fin)}
                          </span>
                        </span>
                      </div>

                      {/* Fecha de creación */}
                      <p className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-400">
                        Creada el {formatearCreacion(reserva.creada_en)}
                      </p>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {error && volver}
        </div>
      </div>
    </div>
  );
}
