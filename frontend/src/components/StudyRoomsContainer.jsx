import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, SearchX } from "lucide-react";
import { getCatalogoRecursos } from "../api/recursosCatalogo";
import VerButton from "./common/VerButton";

// Normaliza texto para comparar sin importar mayúsculas ni tildes.
const normalizar = (texto = "") =>
  String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export default function StudyRoomsContainer({
  tipo = "",
  capMin = null,
  capMax = null,
  search = "",
}) {
  const navigate = useNavigate();
  const [recursos, setRecursos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    const fetchRecursos = async () => {
      setCargando(true);
      setError(null);
      try {
        const data = await getCatalogoRecursos({ tipo, capMin, capMax });
        if (!cancelado) setRecursos(data.catalogo_recursos ?? []);
      } catch (err) {
        console.error("Error al cargar catálogo:", err);
        if (!cancelado) setError("No se pudieron cargar los recursos");
      } finally {
        if (!cancelado) setCargando(false);
      }
    };

    fetchRecursos();

    return () => {
      cancelado = true;
    };
  }, [tipo, capMin, capMax]);

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

  if (recursos.length === 0) {
    const criterios = [
      tipo ? `tipo "${tipo}"` : null,
      capMin || capMax ? `capacidad ${capMin ?? "*"}–${capMax ?? "*"}` : null,
    ].filter(Boolean);

    return (
      <div className="rounded-xl bg-slate-50 p-6 border border-slate-200 text-slate-500 text-sm text-center py-8">
        {criterios.length
          ? `No hay recursos con ${criterios.join(" y ")}.`
          : "No hay recursos registrados."}
      </div>
    );
  }

  // Búsqueda por coincidencias en nombre, tipo, ubicación y atributos.
  const termino = normalizar(search).trim();
  const recursosFiltrados = !termino
    ? recursos
    : recursos.filter((recurso) =>
        [recurso.nombre, recurso.tipo, recurso.ubicacion, recurso.atributos]
          .map(normalizar)
          .some((campo) => campo?.includes(termino))
      );

  if (recursosFiltrados.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 p-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
          <SearchX className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600 mb-1">
          No se encontraron salas
        </p>
        <p className="text-xs text-slate-400">
          Revisa el término "{search.trim()}" o ajusta los filtros de tipo y
          capacidad.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {recursosFiltrados.map((recurso) => (
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
