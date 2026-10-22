import { useState, useEffect } from "react";
import { getTipos } from "../../api/tipos";
import { RANGOS_CAPACIDAD } from "../../constants/rangosCapacidad";

export default function Filtros({
  tipo = "",
  onTipoChange,
  capacidad = "",
  onCapacidadChange,
}) {
  const [tipos, setTipos] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    const fetchTipos = async () => {
      try {
        const data = await getTipos();
        if (!cancelado) setTipos(data.tipos ?? []);
      } catch (err) {
        console.error("Error al cargar tipos:", err);
        if (!cancelado) setError("No se pudieron cargar los tipos");
      }
    };

    fetchTipos();

    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 sm:items-end">
      {/* Filtro por tipo */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="filtro-tipo"
          className="text-sm font-medium text-slate-600"
        >
          Tipo
        </label>
        <select
          id="filtro-tipo"
          value={tipo}
          onChange={(e) => onTipoChange?.(e.target.value)}
          disabled={!!error}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        >
          <option value="">Todas las categorías</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      {/* Filtro por capacidad (rangos de 3) */}
      <div
        role="group"
        aria-label="Filtrar por capacidad"
        className="flex flex-wrap items-center gap-2"
      >
        <span className="text-sm font-medium text-slate-600 mr-1">
          Capacidad
        </span>
        {RANGOS_CAPACIDAD.map((rango) => {
          const activo = capacidad === rango.id;
          return (
            <button
              key={rango.id || "todas"}
              type="button"
              aria-pressed={activo}
              onClick={() => onCapacidadChange?.(rango.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                activo
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {rango.etiqueta}
            </button>
          );
        })}
      </div>
    </div>
  );
}
