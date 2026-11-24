import { useEffect, useState } from "react";
import {
  CalendarDays,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  MapPin,
  RotateCcw,
  Tag,
  Users,
} from "lucide-react";
import { getReservasConsulta } from "../api/reservasApi";
import { getTipos } from "../api/tipos";
import { configEstado } from "../constants/estadosReserva";
import { RANGOS_CAPACIDAD } from "../constants/rangosCapacidad";

function hoyISO() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function sumarDias(fechaISO, dias) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia + dias);
  const nuevoAnio = fecha.getFullYear();
  const nuevoMes = String(fecha.getMonth() + 1).padStart(2, "0");
  const nuevoDia = String(fecha.getDate()).padStart(2, "0");
  return `${nuevoAnio}-${nuevoMes}-${nuevoDia}`;
}

function formatearFecha(fecha) {
  if (!fecha) return "todas las fechas";
  const fechaDate = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(fechaDate.getTime())) return fecha;
  return fechaDate.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatearHora(hora) {
  return hora ? String(hora).slice(0, 5) : "—";
}

export default function ConsultaReservas() {
  const [fecha, setFecha] = useState(hoyISO);
  const [tipo, setTipo] = useState("");
  const [capacidad, setCapacidad] = useState("");
  const [horaDesde, setHoraDesde] = useState("");
  const [horaHasta, setHoraHasta] = useState("");

  const [tipos, setTipos] = useState([]);
  const [errorTipos, setErrorTipos] = useState(false);
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    const cargarTipos = async () => {
      try {
        const data = await getTipos();
        if (!cancelado) setTipos(data.tipos ?? []);
      } catch (err) {
        console.error("Error al cargar tipos:", err);
        if (!cancelado) setErrorTipos(true);
      }
    };

    cargarTipos();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    const cargarReservas = async () => {
      // La franja se valida aquí para no enviar una petición que el backend
      // rechazaría y poder mostrar el aviso de inmediato.
      if (horaDesde && horaHasta && horaDesde >= horaHasta) {
        if (!cancelado) {
          setReservas([]);
          setError("La hora 'Desde' debe ser anterior a la hora 'Hasta'.");
          setCargando(false);
        }
        return;
      }

      setCargando(true);
      setError(null);
      try {
        const rango = RANGOS_CAPACIDAD.find((r) => r.id === capacidad);
        const data = await getReservasConsulta({
          fecha,
          tipo,
          cap_min: rango?.min,
          cap_max: rango?.max,
          hora_desde: horaDesde,
          hora_hasta: horaHasta,
        });
        if (cancelado) return;
        setReservas(Array.isArray(data?.reservas) ? data.reservas : []);
      } catch (err) {
        console.error("Error al consultar reservas:", err);
        if (!cancelado) {
          setReservas([]);
          setError(
            err.userMessage || "No se pudieron cargar las reservas de la fecha",
          );
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    };

    cargarReservas();
    return () => {
      cancelado = true;
    };
  }, [fecha, tipo, capacidad, horaDesde, horaHasta]);

  const navegarDia = (delta) => setFecha(sumarDias(fecha || hoyISO(), delta));

  const limpiarFiltros = () => {
    setFecha(hoyISO());
    setTipo("");
    setCapacidad("");
    setHoraDesde("");
    setHoraHasta("");
  };

  const salasOcupadas = new Set(
    reservas
      .filter(
        (reserva) => String(reserva.estado ?? "").toLowerCase() !== "cancelada",
      )
      .map((reserva) => reserva.recurso_id),
  ).size;
  const hayFiltros =
    fecha !== hoyISO() || tipo || capacidad || horaDesde || horaHasta;
  const hayFiltrosDeSala = Boolean(tipo || capacidad || horaDesde || horaHasta);

  const tituloVacio = hayFiltrosDeSala
    ? "No hay reservas que coincidan con los filtros"
    : fecha
      ? "No hay reservas registradas para esta fecha"
      : "No hay reservas registradas";
  const detalleVacio = hayFiltrosDeSala && fecha
    ? `para el ${formatearFecha(fecha)}`
    : fecha
      ? formatearFecha(fecha)
      : "Prueba con otros filtros";

  const claseCampo =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-400";
  const claseEtiqueta =
    "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1";

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-5 h-5 text-teal-600" />
            <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
              Consulta de reservas
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            Reservas por fecha
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Consulta las reservas registradas y las salas con ocupación en una
            jornada. Puedes revisar fechas anteriores o futuras.
          </p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700">Filtros</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="fecha-consulta" className={claseEtiqueta}>
                  Fecha
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navegarDia(-1)}
                    aria-label="Día anterior"
                    className="shrink-0 rounded-lg border border-slate-300 bg-white p-2 text-slate-500 hover:text-teal-600 hover:border-teal-400 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    id="fecha-consulta"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className={claseCampo}
                  />
                  <button
                    type="button"
                    onClick={() => navegarDia(1)}
                    aria-label="Día siguiente"
                    className="shrink-0 rounded-lg border border-slate-300 bg-white p-2 text-slate-500 hover:text-teal-600 hover:border-teal-400 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setFecha(sumarDias(hoyISO(), -1))}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-teal-400 hover:text-teal-700 transition-colors"
                  >
                    Ayer
                  </button>
                  <button
                    type="button"
                    onClick={() => setFecha(hoyISO())}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-teal-400 hover:text-teal-700 transition-colors"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setFecha(sumarDias(hoyISO(), 1))}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-teal-400 hover:text-teal-700 transition-colors"
                  >
                    Mañana
                  </button>
                  <button
                    type="button"
                    onClick={() => setFecha("")}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-teal-400 hover:text-teal-700 transition-colors"
                  >
                    Todas las fechas
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="tipo-consulta" className={claseEtiqueta}>
                    Tipo de sala
                  </label>
                  <select
                    id="tipo-consulta"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    disabled={errorTipos}
                    className={`${claseCampo} disabled:opacity-50`}
                  >
                    <option value="">Todas</option>
                    {tipos.map((opcion) => (
                      <option key={opcion} value={opcion}>
                        {opcion}
                      </option>
                    ))}
                  </select>
                  {errorTipos && (
                    <p className="mt-1 text-xs text-red-500">
                      No se pudieron cargar los tipos
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="capacidad-consulta" className={claseEtiqueta}>
                    Capacidad
                  </label>
                  <select
                    id="capacidad-consulta"
                    value={capacidad}
                    onChange={(e) => setCapacidad(e.target.value)}
                    className={claseCampo}
                  >
                    {RANGOS_CAPACIDAD.map((rango) => (
                      <option key={rango.id || "todas"} value={rango.id}>
                        {rango.id ? `${rango.etiqueta} personas` : "Cualquiera"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="hora-desde" className={claseEtiqueta}>
                    Franja: desde
                  </label>
                  <input
                    id="hora-desde"
                    type="time"
                    value={horaDesde}
                    onChange={(e) => setHoraDesde(e.target.value)}
                    className={claseCampo}
                  />
                </div>

                <div>
                  <label htmlFor="hora-hasta" className={claseEtiqueta}>
                    Franja: hasta
                  </label>
                  <input
                    id="hora-hasta"
                    type="time"
                    value={horaHasta}
                    onChange={(e) => setHoraHasta(e.target.value)}
                    className={claseCampo}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-400">
                La franja filtra las reservas que se crucen con ese horario.
              </p>
              <button
                type="button"
                onClick={limpiarFiltros}
                disabled={!hayFiltros}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-teal-400 hover:text-teal-700 disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:text-slate-600 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restablecer filtros
              </button>
            </div>
          </div>

          <div aria-live="polite">
            {!cargando && !error && (
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <p className="text-sm text-slate-600">
                  {reservas.length} reserva
                  {reservas.length === 1 ? "" : "s"} para{" "}
                  <span className="font-medium capitalize">
                    {formatearFecha(fecha)}
                  </span>
                </p>
                {reservas.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200">
                    <Users className="w-3.5 h-3.5" />
                    {salasOcupadas === 1
                      ? "1 sala ocupada"
                      : `${salasOcupadas} salas ocupadas`}
                  </span>
                )}
              </div>
            )}
          </div>

          {cargando && (
            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-10">
              <Loader2 className="w-4 h-4 animate-spin" />
              Buscando reservas...
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
                <CalendarX className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">
                {tituloVacio}
              </p>
              <p className="text-xs text-slate-400 capitalize">{detalleVacio}</p>
              <p className="mt-2 text-xs text-slate-400">
                Prueba con otra fecha o ajusta los filtros.
              </p>
            </div>
          )}

          {!cargando && !error && reservas.length > 0 && (
            <div className="flex flex-col gap-3">
              {reservas.map((reserva) => {
                const estado = configEstado(reserva.estado);

                return (
                  <article
                    key={reserva.id}
                    className="bg-slate-50 rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
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
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${estado.dot}`}
                        />
                        {estado.label}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="capitalize">
                          {formatearFecha(reserva.fecha)}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-medium">
                          {formatearHora(reserva.hora_inicio)} -{" "}
                          {formatearHora(reserva.hora_fin)}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                        {reserva.tipo}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        {reserva.ubicacion}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400 shrink-0" />
                        {reserva.capacidad} lugares
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
