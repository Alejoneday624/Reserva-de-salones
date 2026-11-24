import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  CalendarCheck,
  CalendarDays,
  Clock,
  Filter,
  MapPin,
  Users,
} from "lucide-react";
import { cancelarReserva, getReservasUsuario } from "../api/reservasApi";
import { configEstado } from "../constants/estadosReserva";
import { useUser } from "../context/UserContext";
import ConfirmModal from "../components/common/ConfirmModal";
import ResultadoReserva from "../components/common/ResultadoReserva";

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

// Las reservas de una serie (la misma selección repetida 1 a 4 semanas)
// se crean en UNA sola petición y quedan con `creada_en` idéntico, hasta
// el microsegundo: ese instante es la clave que las agrupa. Una sola
// petición = una serie, así que dos creaciones distintas nunca se mezclan.
//
// Solo las tiradas de 2 o más reservas se consideran serie: una reserva
// suelta no se etiqueta ni entra en el filtro. Las series se numeran de la
// más reciente a la más antigua (la última creada es la Serie 1), igual
// que el orden del listado.
function calcularSeries(reservas) {
  const porInstante = new Map();
  for (const reserva of reservas) {
    // Sin `creada_en` no hay clave fiable: cada reserva queda en su propio
    // grupo (de 1) y por lo tanto fuera del concepto de serie.
    const clave = reserva.creada_en || `sin-creacion-${reserva.id}`;
    const grupo = porInstante.get(clave);
    if (grupo) grupo.push(reserva);
    else porInstante.set(clave, [reserva]);
  }

  const tiradas = [...porInstante.entries()]
    .filter(([, grupo]) => grupo.length > 1)
    .sort(([instanteA], [instanteB]) => new Date(instanteB) - new Date(instanteA));

  const seriePorId = new Map();
  const series = tiradas.map(([creadaEn, grupo], indice) => {
    const numero = indice + 1;
    // Dentro de la serie se lee en orden cronológico (semana 1, semana 2...):
    // todas comparten hora de creación, así que el desempate es la fecha.
    const ordenadas = [...grupo].sort(
      (a, b) =>
        new Date(`${a.fecha}T00:00:00`) - new Date(`${b.fecha}T00:00:00`) ||
        a.id - b.id
    );
    ordenadas.forEach((reserva, posicion) => {
      seriePorId.set(reserva.id, {
        clave: creadaEn,
        numero,
        posicion: posicion + 1,
        total: ordenadas.length,
      });
    });
    return { clave: creadaEn, creadaEn, numero, total: ordenadas.length };
  });

  return { series, seriePorId };
}

export default function MisReservas() {
  const { nombreUsuario } = useUser();
  const navigate = useNavigate();
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Flujo de cancelación.
  const [reservaSeleccionada, setReservaSeleccionada] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Filtro por serie: clave vacía = "todas las series".
  const [serieSeleccionada, setSerieSeleccionada] = useState("");

  const usuarioId = nombreUsuario?.id;
  const nombre = nombreUsuario?.name;

  // Evita setState después de desmontar (p. ej. al cambiar de ruta).
  const montado = useRef(true);
  useEffect(() => {
    return () => {
      montado.current = false;
    };
  }, []);

  // Descarga y ordena las reservas sin tocar el estado: así se reutiliza
  // tanto desde el effect de carga como después de cancelar una reserva.
  const obtenerReservas = useCallback(async () => {
    const data = await getReservasUsuario(usuarioId);
    const lista = Array.isArray(data?.reservas) ? data.reservas : [];
    // El backend ya ordena de la más reciente a la más antigua; este orden
    // es defensivo para que la vista no dependa de ese detalle.
    return [...lista].sort(
      (a, b) => new Date(b.creada_en ?? 0) - new Date(a.creada_en ?? 0)
    );
  }, [usuarioId]);

  useEffect(() => {
    // Sin usuario no hay nada que consultar; ProtectedRoute ya redirige en
    // ese caso, así que el aviso se muestra en el render y no con setState.
    if (!usuarioId) return;

    let cancelado = false;

    // Los setState viven en los callbacks (nunca de forma síncrona en el
    // cuerpo del effect) y se descartan si el usuario cambia de pantalla.
    obtenerReservas()
      .then((lista) => {
        if (cancelado) return;
        setReservas(lista);
        setError(null);
      })
      .catch((err) => {
        console.error("Error al cargar reservas:", err);
        if (cancelado) return;
        setError("No se pudieron cargar las reservas");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [usuarioId, obtenerReservas]);

  // Cancela la reserva seleccionada y refresca el listado para que el
  // estudiante vea el nuevo estado (cancelada) y la franja liberada.
  const confirmarCancelacion = async () => {
    if (cancelando || !reservaSeleccionada || !usuarioId) return;

    const reserva = reservaSeleccionada;
    setCancelando(true);
    try {
      await cancelarReserva(reserva.id, usuarioId);

      setReservaSeleccionada(null);
      setResultado({
        tipo: "exito",
        titulo: "Cancelación realizada",
        mensaje: `La reserva de ${reserva.sala} fue cancelada. Su franja horaria ya está disponible para otra reserva.`,
      });
    } catch (err) {
      console.error("Error al cancelar la reserva:", err);
      setReservaSeleccionada(null);
      setResultado({
        tipo: "error",
        titulo: "No se pudo cancelar",
        mensaje: err.userMessage || "No se pudo cancelar la reserva",
      });
      return;
    } finally {
      if (montado.current) setCancelando(false);
    }

    // Refresco del listado para que se vea el nuevo estado (cancelada).
    // Si falla se conserva la lista anterior: la cancelación ya ocurrió.
    try {
      const lista = await obtenerReservas();
      if (!montado.current) return;
      setReservas(lista);
      setError(null);
    } catch (err) {
      console.error("Error al actualizar el listado de reservas:", err);
    }
  };

  // Reservas visibles según el filtro por serie. Se recalculan con cada
  // carga/cancelación, así que el filtro sobrevive a un refresco de lista.
  const { series, seriePorId } = useMemo(
    () => calcularSeries(reservas),
    [reservas]
  );

  // Si la serie elegida ya desapareció (p. ej. se canceló su última
  // reserva) el filtro se restablece solo a "todas las series".
  const serieActiva = series.some((serie) => serie.clave === serieSeleccionada)
    ? serieSeleccionada
    : "";

  const serieFiltrada = serieActiva
    ? series.find((serie) => serie.clave === serieActiva) ?? null
    : null;

  const visibles = serieFiltrada
    ? reservas.filter(
        (reserva) => seriePorId.get(reserva.id)?.clave === serieFiltrada.clave
      )
    : reservas;

  const claseCampo =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-400";
  const claseEtiqueta =
    "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1";

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
              {/* Filtro por serie: solo aparece si el usuario creó al
                  menos una serie (2 o más reservas en la misma tanda). */}
              {series.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <h2 className="text-sm font-semibold text-slate-700">
                      Filtros
                    </h2>
                  </div>

                  <label htmlFor="filtro-serie" className={claseEtiqueta}>
                    Serie
                  </label>
                  <select
                    id="filtro-serie"
                    value={serieActiva}
                    onChange={(e) => setSerieSeleccionada(e.target.value)}
                    className={claseCampo}
                  >
                    <option value="">
                      Todas las series ({series.length})
                    </option>
                    {series.map((serie) => (
                      <option key={serie.clave} value={serie.clave}>
                        {`Serie ${serie.numero} · ${serie.total} reservas · creada el ${formatearCreacion(
                          serie.creadaEn
                        )}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <p className="text-xs text-slate-500 mb-4">
                {`${visibles.length} reserva${visibles.length === 1 ? "" : "s"}${
                  serieFiltrada ? ` · Serie ${serieFiltrada.numero}` : ""
                } · de la más reciente a la más antigua`}
              </p>

              <div className="flex flex-col gap-4">
                {visibles.map((reserva) => {
                  const estado = configEstado(reserva.estado);
                  const serie = seriePorId.get(reserva.id);

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
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <p className="text-xs text-slate-500">
                              Reserva #{reserva.id}
                            </p>
                            {/* Solo las reservas creadas en la misma tanda
                                (serie semanal) llevan etiqueta. */}
                            {serie && (
                              <span className="inline-flex items-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-200 px-2 py-0.5 text-xs font-semibold">
                                Serie {serie.numero}
                              </span>
                            )}
                          </div>
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

                      {/* Serie/creación + acción de cancelar: en una serie
                          la hora de creación es idéntica en todas, así que
                          se muestra una sola vez en el filtro y aquí solo
                          va la posición dentro de la serie. */}
                      <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-slate-400">
                          {serie
                            ? `Serie ${serie.numero} · ${serie.posicion} de ${serie.total}`
                            : `Creada el ${formatearCreacion(reserva.creada_en)}`}
                        </p>

                        {/* Solo las reservas futuras y no canceladas se pueden
                            cancelar (lo decide el backend). */}
                        {reserva.cancelable && (
                          <button
                            type="button"
                            onClick={() => setReservaSeleccionada(reserva)}
                            disabled={cancelando}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Cancelar reserva
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {error && volver}
        </div>
      </div>

      {/* Confirmación previa a cancelar (criterio de la HDU). */}
      <ConfirmModal
        isOpen={!!reservaSeleccionada}
        titulo="Cancelar reserva"
        mensaje={
          reservaSeleccionada
            ? `¿Seguro que deseas cancelar la reserva de ${reservaSeleccionada.sala} del ${formatearFecha(
                reservaSeleccionada.fecha
              )} de ${formatearHora(reservaSeleccionada.hora_inicio)} a ${formatearHora(
                reservaSeleccionada.hora_fin
              )}? La franja horaria quedará disponible nuevamente.`
            : undefined
        }
        textoConfirmar={cancelando ? "Cancelando..." : "Sí, cancelar"}
        textoCancelar="No, mantener"
        confirmarPeligroso
        onConfirm={confirmarCancelacion}
        onCancel={() => {
          if (!cancelando) setReservaSeleccionada(null);
        }}
      />

      {/* Resultado de la cancelación: modal con animación. */}
      {resultado && (
        <ResultadoReserva
          tipo={resultado.tipo}
          titulo={resultado.titulo}
          mensaje={resultado.mensaje}
          onCerrar={() => setResultado(null)}
        />
      )}
    </div>
  );
}
