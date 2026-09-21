export default function VerButton({ onClick, texto = "Ver disponibilidad", className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`w-full py-2.5 rounded-lg bg-teal-500 text-white font-medium text-sm hover:bg-teal-600 transition-colors ${className}`}
    >
      {texto}
    </button>
  );
}
