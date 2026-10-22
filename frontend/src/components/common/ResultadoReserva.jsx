import { useEffect } from "react";
import { Lottie } from "lottie-react";
import acceptedAnimation from "../../assets/animaciones/accepted.json";
import failedAnimation from "../../assets/animaciones/failed.json";

// Resultado de una reserva: modal emergente con animación Lottie.
// Uso:
//   <ResultadoReserva tipo="exito" mensaje="Reserva confirmada..." onCerrar={...} />
const TIPOS = {
  exito: {
    animacion: acceptedAnimation,
    titulo: "Reserva confirmada",
    boton: "bg-teal-500 hover:bg-teal-600",
  },
  error: {
    animacion: failedAnimation,
    titulo: "No se pudo completar",
    boton: "bg-red-500 hover:bg-red-600",
  },
};

export default function ResultadoReserva({ tipo = "exito", mensaje, onCerrar }) {
  const config = TIPOS[tipo] ?? TIPOS.error;

  // Cerrar con la tecla Escape.
  useEffect(() => {
    const manejarEscape = (evento) => {
      if (evento.key === "Escape") onCerrar?.();
    };
    window.addEventListener("keydown", manejarEscape);
    return () => window.removeEventListener("keydown", manejarEscape);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={config.titulo}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="mx-auto h-28 w-28">
          <Lottie
            src={config.animacion}
            loop={false}
            autoplay
            className="h-full w-full"
          />
        </div>

        <h2 className="mt-2 text-lg font-bold text-slate-900">
          {config.titulo}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{mensaje}</p>

        <button
          type="button"
          onClick={onCerrar}
          className={`mt-5 w-full rounded-xl py-3 text-sm font-semibold text-white transition-colors ${config.boton}`}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
