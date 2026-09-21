import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Users, Tag } from "lucide-react";
import { getRecursoDetalle } from "../api/recursosCatalogo";
import TopBar from "../components/common/TopBar";

export default function SalonDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recurso, setRecurso] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetalle = async () => {
      setCargando(true);
      try {
        const data = await getRecursoDetalle(id);
        setRecurso(data);
      } catch (err) {
        console.error("Error al cargar detalle:", err);
        setError("No se pudo cargar la información del recurso");
      } finally {
        setCargando(false);
      }
    };

    fetchDetalle();
  }, [id]);

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-100">
        <TopBar />
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
        <TopBar />
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
      <TopBar />
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <button
            onClick={() => navigate("/catalogo")}
            className="flex items-center gap-2 text-teal-600 hover:text-teal-700 text-sm font-medium mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al catálogo
          </button>

          <div className="flex items-start justify-between gap-4 mb-6">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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
      </div>
    </div>
  );
}