import { useEffect } from "react";

export default function ConfirmModal({ isOpen, userName, onConfirm, onCancel }) {
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
      >
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Confirmar Selección
        </h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          ¿Confirmas que deseas acceder al portal de reservas de salas de estudio como{" "}
          <span className="font-bold text-slate-800">{userName}</span>?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-5 py-2.5 rounded-lg bg-[#0c1e3c] text-white font-medium text-sm hover:bg-[#152d54] transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
