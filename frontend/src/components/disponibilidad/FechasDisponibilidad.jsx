import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function parseFecha(fecha) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

function etiquetaRelativa(fecha) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diferencia = Math.round((parseFecha(fecha) - hoy) / 86400000);
  if (diferencia === 0) return "Hoy";
  if (diferencia === 1) return "Mañana";
  return null;
}

export default function FechasDisponibilidad({
  fechas,
  fechaSeleccionada,
  onSeleccionar,
}) {
  const contenedorRef = useRef(null);
  const [posicion, setPosicion] = useState({ inicio: true, fin: true });

  const actualizarPosicion = () => {
    const el = contenedorRef.current;
    if (!el) return;
    setPosicion({
      inicio: el.scrollLeft <= 4,
      fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  };

  useEffect(() => {
    actualizarPosicion();
  }, [fechas]);

  const desplazar = (direccion) => {
    const el = contenedorRef.current;
    if (!el) return;
    el.scrollBy({ left: direccion * el.clientWidth * 0.8, behavior: "smooth" });
  };

  if (!fechas.length) return null;

  const botonBase =
    "absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-teal-600 hover:border-teal-400 disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:border-slate-200 shadow-sm";

  return (
    <div className="relative mb-5">
      <button
        type="button"
        onClick={() => desplazar(-1)}
        disabled={posicion.inicio}
        aria-label="Fechas anteriores"
        className={`${botonBase} left-0`}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div
        ref={contenedorRef}
        onScroll={actualizarPosicion}
        className="flex gap-2 overflow-x-auto scroll-smooth px-9 py-1"
      >
        {fechas.map((item) => {
          const fecha = parseFecha(item.fecha);
          const activa = item.fecha === fechaSeleccionada;
          const relativa = etiquetaRelativa(item.fecha);
          const sinLibres = item.disponibles === 0;

          return (
            <button
              key={item.fecha}
              type="button"
              onClick={() => onSeleccionar(item.fecha)}
              className={`shrink-0 w-[4.75rem] flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 transition-colors ${
                activa
                  ? "border-teal-500 bg-teal-500 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-teal-400"
              }`}
            >
              <span
                className={`text-[11px] font-semibold uppercase ${
                  activa ? "text-white" : "text-slate-500"
                }`}
              >
                {relativa ?? DIAS[fecha.getDay()]}
              </span>
              <span className="text-lg font-bold leading-none">
                {fecha.getDate()}
              </span>
              <span
                className={`text-[10px] ${activa ? "text-white/80" : "text-slate-400"}`}
              >
                {MESES[fecha.getMonth()]}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  activa
                    ? "text-white"
                    : sinLibres
                      ? "text-red-400"
                      : "text-teal-600"
                }`}
              >
                {sinLibres ? "sin libres" : `${item.disponibles} libres`}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => desplazar(1)}
        disabled={posicion.fin}
        aria-label="Fechas siguientes"
        className={`${botonBase} right-0`}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
