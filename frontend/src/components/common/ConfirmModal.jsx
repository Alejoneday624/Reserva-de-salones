import { useEffect } from "react";

// Diálogo de confirmación genérico.
//
// Uso por defecto (SelectUser): sin texto propio se muestra el mensaje de
// confirmación de acceso con `userName`.
// Uso para cancelar una reserva:
//   <ConfirmModal
//     isOpen={...}
//     titulo="Cancelar reserva"
//     mensaje="¿Seguro que deseas cancelar esta reserva?"
//     textoConfirmar="Sí, cancelar"
//     confirmarPeligroso
//     onConfirm={...}
//     onCancel={...}
//   />
export default function ConfirmModal({
  isOpen,
  userName,
  titulo = "Confirmar Selección",
  mensaje,
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  confirmarPeligroso = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <h2 className="text-xl font-bold text-slate-900 mb-2">{titulo}</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          {mensaje ?? (
            <>
              ¿Confirmas que deseas acceder al portal de reservas de salas de
              estudio como{" "}
              <span className="font-bold text-slate-800">{userName}</span>?
            </>
          )}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
          >
            {textoCancelar}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-5 py-2.5 rounded-lg text-white font-medium text-sm transition-colors ${
              confirmarPeligroso
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#0c1e3c] hover:bg-[#152d54]"
            }`}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
