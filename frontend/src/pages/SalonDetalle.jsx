import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  MapPin,
  Tag,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { getRecursoDetalle } from "../api/recursosCatalogo";
import { getDisponibilidad, getFechasDisponibilidad } from "../api/disponibilidad";
import { crearReserva, getResumenReservas } from "../api/reservasApi";
import { useUser } from "../context/UserContext";
import FechasDisponibilidad from "../components/disponibilidad/FechasDisponibilidad";
import HorariosDisponibilidad from "../components/disponibilidad/HorariosDisponibilidad";
import ResultadoReserva from "../components/common/ResultadoReserva";

function horasEntre(horaInicio, horaFin) {
  const [hi, mi] = horaInicio.split(":").map(Number);
  const [hf, mf] = horaFin.split(":").map(Number);
  return (hf * 60 + mf - (hi * 60 + mi)) / 60;
}

function formatoHoras(valor) {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1);
}

function fechaLarga(fecha) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function hoyISO() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

// Solo se muestran fechas de hoy en adelante.
function fechasFuturas(lista) {
  const hoy = hoyISO();
  return lista.filter((item) => item.fecha >= hoy);
}

function primeraFechaValida(lista) {
  const hoy = hoyISO();
  return lista.find((item) => item.fecha === hoy)?.fecha ?? lista[0]?.fecha ?? null;
}

function claveDe(franja) {
  return `${franja.hora_inicio}-${franja.hora_fin}`;
}

function horasDeClaves(claves, franjas) {
  return claves.reduce((total, clave) => {
    const franja = franjas.find((f) => claveDe(f) === clave);
    if (!franja) return total;
    return total + horasEntre(franja.hora_inicio, franja.hora_fin);
  }, 0);
}

function ordenarClaves(claves, franjas) {
  return [...claves].sort((a, b) => {
    const ia = franjas.findIndex((f) => claveDe(f) === a);
    const ib = franjas.findIndex((f) => claveDe(f) === b);
    return ia - ib;
  });
}

export default function SalonDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { nombreUsuario } = useUser();

  const [recurso, setRecurso] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [fechas, setFechas] = useState([]);
  const [cargandoFechas, setCargandoFechas] = useState(true);
  const [errorFechas, setErrorFechas] = useState(null);
  const [fechaSel, setFechaSel] = useState(null);

  const [franjas, setFranjas] = useState([]);
  const [cargandoFranjas, setCargandoFranjas] = useState(false);
  const [errorFranjas, setErrorFranjas] = useState(null);
  const [seleccion, setSeleccion] = useState([]);

  const [reservando, setReservando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  // Resultado de la reserva (modal con animación): exito | error.
  const [resultado, setResultado] = useState(null);
  const [resumen, setResumen] = useState(null);

  useEffect(() => {
    const fetchDetalle = async () => {
      setCargando(true);
      try {
        const data = await getRecursoDetalle(id);
        setRecurso(data);
      } catch (err) {
        console.error("Error al cargar detalle:", err);
        setError(err.userMessage || "No se pudo cargar la información del recurso");
      } finally {
        setCargando(false);
      }
    };

    fetchDetalle();
  }, [id]);

  // Fechas con franjas cargadas para esta sala (solo se recalculan al cambiar de sala).
  useEffect(() => {
    let cancelado = false;
    const fetchFechas = async () => {
      setFechaSel(null);
      setSeleccion([]);
      setMensaje(null);
      setCargandoFechas(true);
      setErrorFechas(null);
      try {
        const data = await getFechasDisponibilidad(id);
        if (cancelado) return;
        const lista = fechasFuturas(data.fechas ?? []);
        setFechas(lista);
        setFechaSel(primeraFechaValida(lista));
      } catch (err) {
        console.error("Error al cargar fechas:", err);
        if (!cancelado)
          setErrorFechas(
            err.userMessage || "No se pudieron cargar las fechas disponibles",
          );
      } finally {
        if (!cancelado) setCargandoFechas(false);
      }
    };

    fetchFechas();
    return () => {
      cancelado = true;
    };
  }, [id]);

  const obtenerDisponibilidad = async () => {
    const data = await getDisponibilidad(id, fechaSel);
    setFranjas(data.franjas ?? []);
  };

  const obtenerResumen = async () => {
    if (!fechaSel || !nombreUsuario?.id) return;
    try {
      const data = await getResumenReservas(nombreUsuario.id, fechaSel);
      setResumen(data);
      // Si la selección ya no cabe en el límite restante, se limpia.
      setSeleccion((prev) =>
        horasDeClaves(prev, franjas) <= data.horas_disponibles ? prev : [],
      );
    } catch (err) {
      console.error("Error al cargar resumen de reservas:", err);
    }
  };

  // Límite diario de horas del estudiante para la fecha seleccionada.
  useEffect(() => {
    const fetchResumen = async () => {
      await obtenerResumen();
    };
    fetchResumen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaSel, nombreUsuario?.id]);

  // Franjas de la fecha seleccionada.
  useEffect(() => {
    if (!fechaSel) return;

    let cancelado = false;
    const fetchFranjas = async () => {
      setCargandoFranjas(true);
      setErrorFranjas(null);
      setSeleccion([]);
      setMensaje(null);
      try {
        const data = await getDisponibilidad(id, fechaSel);
        if (!cancelado) setFranjas(data.franjas ?? []);
      } catch (err) {
        console.error("Error al cargar disponibilidad:", err);
        if (!cancelado)
          setErrorFranjas(
            err.userMessage || "No se pudo cargar la disponibilidad",
          );
      } finally {
        if (!cancelado) setCargandoFranjas(false);
      }
    };

    fetchFranjas();
    return () => {
      cancelado = true;
    };
  }, [id, fechaSel]);

  const actualizarFechas = async () => {
    try {
      const data = await getFechasDisponibilidad(id);
      const lista = fechasFuturas(data.fechas ?? []);
      setFechas(lista);
      // Se conserva la fecha seleccionada si sigue disponible.
      setFechaSel((prev) =>
        prev && lista.some((item) => item.fecha === prev)
          ? prev
          : primeraFechaValida(lista),
      );
    } catch (err) {
      console.error("Error al actualizar fechas:", err);
    }
  };

  const seleccionClaves = seleccion;
  const horasSeleccion = horasDeClaves(seleccionClaves, franjas);

  // Etiqueta de la selección: rango si es continuo; si no, lista de horarios.
  const etiquetaHoras = (() => {
    if (!seleccionClaves.length) return null;
    const [iniPrimera] = seleccionClaves[0].split("-");
    const [, finUltima] =
      seleccionClaves[seleccionClaves.length - 1].split("-");
    const span = horasEntre(iniPrimera, finUltima);
    if (span === horasSeleccion) {
      return `${iniPrimera.slice(0, 5)} - ${finUltima.slice(0, 5)} (${formatoHoras(horasSeleccion)} h)`;
    }
    const lista = seleccionClaves
      .map((clave) => {
        const [hi, hf] = clave.split("-");
        return `${hi.slice(0, 5)}–${hf.slice(0, 5)}`;
      })
      .join(", ");
    return `${lista} (${formatoHoras(horasSeleccion)} h)`;
  })();

  // Clic en una hora: la agrega (rellena el tramo vecino si está libre) o la quita.
  const manejarClicHorario = (clave) => {
    const idxClic = franjas.findIndex((f) => claveDe(f) === clave);
    if (idxClic < 0) return;

    if (seleccionClaves.includes(clave)) {
      setSeleccion((prev) => prev.filter((c) => c !== clave));
      setMensaje(null);
      return;
    }

    const limite =
      resumen && resumen.fecha === fechaSel ? resumen.horas_disponibles : null;

    // Si hay una hora ya seleccionada al lado, rellena el tramo si está libre.
    const idxsSel = seleccionClaves
      .map((c) => franjas.findIndex((f) => claveDe(f) === c))
      .filter((i) => i >= 0);
    let idxsNuevos = [idxClic];
    if (idxsSel.length) {
      const vecino = idxsSel.reduce(
        (best, i) =>
          Math.abs(i - idxClic) < Math.abs(best - idxClic) ? i : best,
        idxsSel[0],
      );
      const [desde, hasta] =
        vecino <= idxClic ? [vecino, idxClic] : [idxClic, vecino];
      const tramo = franjas.slice(desde, hasta + 1);
      if (tramo.every((f) => f.disponible)) {
        idxsNuevos = tramo.map((_, k) => desde + k);
      }
    }

    let aAgregar = idxsNuevos.map((i) => claveDe(franjas[i]));
    const horasTotal = horasDeClaves(
      [...new Set([...seleccionClaves, ...aAgregar])],
      franjas,
    );
    if (limite !== null && horasTotal > limite) {
      const horasSolo = horasDeClaves([...seleccionClaves, clave], franjas);
      if (horasSolo > limite) {
        setMensaje({
          tipo: "error",
          texto: `No te cabe esa hora: ya llevas ${formatoHoras(horasSeleccion)} de ${resumen.horas_limite} horas este día.`,
        });
        return;
      }
      aAgregar = [clave];
    }

    setSeleccion(
      ordenarClaves([...new Set([...seleccionClaves, ...aAgregar])], franjas),
    );
    setMensaje(null);
  };

  const reservar = async () => {
    if (!seleccionClaves.length || !fechaSel || !nombreUsuario?.id) return;

    if (resumen && resumen.fecha === fechaSel) {
      if (horasSeleccion > resumen.horas_disponibles) {
        setMensaje({
          tipo: "error",
          texto: `Por día solo puedes reservar ${resumen.horas_limite} horas: ya reservaste ${formatoHoras(resumen.horas_reservadas)} en esta fecha.`,
        });
        return;
      }
    }

    const bloques = seleccionClaves.map((clave) => {
      const [hora_inicio, hora_fin] = clave.split("-");
      return { hora_inicio, hora_fin };
    });

    setReservando(true);
    setMensaje(null);
    setResultado(null);
    try {
      await crearReserva({
        recursoId: id,
        usuarioId: nombreUsuario.id,
        fecha: fechaSel,
        bloques,
      });
      setResultado({
        tipo: "exito",
        texto: `Reserva confirmada: ${fechaSel} · ${etiquetaHoras}`,
      });
      setSeleccion([]);
    } catch (err) {
      console.error("Error al reservar:", err);
      setResultado({
        tipo: "error",
        texto: err.userMessage || "No se pudo crear la reserva",
      });
    } finally {
      // El modal ya se ve: aqui se libera el botón y el refresco de la
      // pantalla corre en paralelo, sin hacer esperar al usuario.
      setReservando(false);
    }

    // Las tres consultas se disparan juntas en vez de una tras otra: con la
    // BD en EE.UU. cada viaje de red cuesta cientos de milisegundos.
    await Promise.allSettled([
      obtenerDisponibilidad(),
      obtenerResumen(),
      actualizarFechas(),
    ]);
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-100">
        <div className="flex justify-center px-4 py-10">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="text-slate-400 text-sm text-center py-8">
              Cargando información...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100">
        <div className="flex justify-center px-4 py-10">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
            <button
              onClick={() => navigate("/catalogo")}
              className="mt-4 flex items-center gap-2 text-teal-600 hover:text-teal-700 text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al catálogo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="px-4 py-8">
        <div className="w-full max-w-6xl mx-auto">
          <button
            onClick={() => navigate("/catalogo")}
            className="flex items-center gap-2 text-teal-600 hover:text-teal-700 text-sm font-medium mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al catálogo
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h1 className="text-2xl font-bold text-slate-900">{recurso.nombre}</h1>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      recurso.activo
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        recurso.activo ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    {recurso.activo ? "Disponible" : "Ocupado"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Tag className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">Tipo:</span> {recurso.tipo}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">Ubicación:</span> {recurso.ubicacion}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">Capacidad:</span> {recurso.capacidad} estudiantes
                  </div>
                </div>

                {recurso.atributos && (
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 mb-2">Atributos</h2>
                    <div className="flex flex-wrap gap-2">
                      {recurso.atributos.split(",").map((attr, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md"
                        >
                          {attr.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-bold text-slate-900">Disponibilidad</h2>
                  <span className="text-xs text-slate-400">Selecciona fecha y horario</span>
                </div>
            <p className="text-sm text-slate-500 mb-4">
              Elige un día y marca las horas que quieras: pueden ser seguidas
              o separadas, hasta 3 horas en total.
            </p>

            {cargandoFechas ? (
              <div className="text-slate-400 text-sm text-center py-6">
                Cargando fechas...
              </div>
            ) : errorFechas ? (
              <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-red-700 text-sm">
                {errorFechas}
              </div>
            ) : !fechas.length ? (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 p-6 text-center">
                <CalendarX className="w-6 h-6 text-slate-400" />
                <p className="text-sm text-slate-500">
                  Esta sala no tiene horarios registrados
                </p>
              </div>
            ) : (
              <>
                <FechasDisponibilidad
                  fechas={fechas}
                  fechaSeleccionada={fechaSel}
                  onSeleccionar={setFechaSel}
                />

                {resumen && resumen.fecha === fechaSel && (
                  <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    <p>
                      {resumen.horas_disponibles <= 0
                        ? `Límite diario alcanzado: ya reservaste las ${resumen.horas_limite} horas permitidas para este día.`
                        : resumen.horas_reservadas > 0
                          ? `Este día ya reservaste ${formatoHoras(resumen.horas_reservadas)} de ${resumen.horas_limite} horas (quedan ${formatoHoras(resumen.horas_disponibles)}).`
                          : `Puedes reservar hasta ${resumen.horas_limite} horas en este día.`}
                    </p>
                    {resumen.reservas?.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {resumen.reservas.map((reserva) => (
                          <li
                            key={reserva.id}
                            className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 rounded-md px-2 py-1"
                          >
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {reserva.recurso_nombre}:{" "}
                            {reserva.hora_inicio.slice(0, 5)}–
                            {reserva.hora_fin.slice(0, 5)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {cargandoFranjas ? (
                  <div className="text-slate-400 text-sm text-center py-6">
                    Cargando horarios...
                  </div>
                ) : errorFranjas ? (
                  <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-red-700 text-sm">
                    {errorFranjas}
                  </div>
                ) : !franjas.length ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 p-6 text-center">
                    <CalendarX className="w-6 h-6 text-slate-400" />
                    <p className="text-sm text-slate-500">
                      Sin horarios disponibles para esta fecha
                    </p>
                  </div>
                ) : (
                  <HorariosDisponibilidad
                    franjas={franjas}
                    seleccion={seleccionClaves}
                    onSeleccionar={manejarClicHorario}
                    horasDisponibles={
                      resumen && resumen.fecha === fechaSel
                        ? Math.max(0, resumen.horas_disponibles - horasSeleccion)
                        : null
                    }
                  />
                )}
              </>
            )}

              </div>
            </div>

            <aside className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 lg:sticky lg:top-4">
                <h2 className="text-base font-bold text-slate-900 mb-4">
                  Confirmar Detalles
                </h2>

                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Estudiante que reserva
                </p>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 mb-4">
                  <div className="bg-teal-500 text-white rounded-full p-1.5 shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {nombreUsuario?.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {[nombreUsuario?.codigo, nombreUsuario?.programa]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>

                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Resumen de selección
                </p>
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 mb-4 text-sm">
                  <div className="flex items-center gap-2 px-3 py-2 text-slate-700">
                    <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
                    {fechaSel ? fechaLarga(fechaSel) : "Sin fecha seleccionada"}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 text-slate-700">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    {etiquetaHoras ?? "Sin horario seleccionado"}
                  </div>
                </div>

                <div className="rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-xs px-3 py-2 mb-4 flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Máximo 3 horas por día: pueden ser seguidas o separadas.
                    {resumen && resumen.fecha === fechaSel && (
                      <>
                        {" "}
                        Te quedan {formatoHoras(resumen.horas_disponibles)} de{" "}
                        {resumen.horas_limite} horas este día.
                      </>
                    )}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={reservar}
                  disabled={
                    !seleccionClaves.length || reservando || !nombreUsuario?.id
                  }
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold py-3 transition-colors"
                >
                  {reservando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Confirmando reserva...
                    </>
                  ) : (
                    "Reservar Espacio"
                  )}
                </button>

                {mensaje && (
                  <div
                    className={`mt-4 rounded-xl p-3 border text-sm flex items-start gap-2 ${
                      mensaje.tipo === "exito"
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}
                  >
                    {mensaje.tipo === "exito" ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    )}
                    {mensaje.texto}
                  </div>
                )}
              </div>
            </aside>

            {/* Resultado de la reserva: modal con animación Lottie. */}
            {resultado && (
              <ResultadoReserva
                tipo={resultado.tipo}
                mensaje={resultado.texto}
                onCerrar={() => setResultado(null)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
