import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import { getCatalogoRecursos } from "../api/recursosCatalogo";
import VerButton from "./common/VerButton";

export default function StudyRoomsContainer() {
  const navigate = useNavigate();
  const [recursos, setRecursos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRecursos = async () => {
      setCargando(true);
      try {
        const data = await getCatalogoRecursos();
        setRecursos(data.catalogo_recursos ?? []);
      } catch (err) {
        console.error("Error al cargar catálogo:", err);
        setError("No se pudieron cargar los recursos");
      } finally {
        setCargando(false);
      }
    };

    fetchRecursos();
  }, []);

  if (cargando) {
    return (
      <div className="text-slate-400 text-sm text-center py-8">
        Cargando recursos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-red-700 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {recursos.map((recurso) => (
        <div
          key={recurso.id}
          className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 shadow-sm"
        >
          {/* Encabezado: nombre + badge */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-slate-900 text-base leading-tight">
              {recurso.nombre}
            </h3>
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

          {/* Capacidad */}
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Users className="w-4 h-4" />
            <span>Capacidad: {recurso.capacidad} estudiantes</span>
          </div>

          {/* Atributos */}
          {recurso.atributos && (
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
          )}

          {/* Botón */}
          <div className="mt-auto pt-2">
            <VerButton onClick={() => navigate(`/catalogo/${recurso.id}`)} />
          </div>
        </div>
      ))}
    </div>
  );
}
