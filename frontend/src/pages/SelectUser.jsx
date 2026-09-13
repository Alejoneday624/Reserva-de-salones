import { useEffect, useState } from "react";
import { getSaludo, getDatosPrueba } from "../api/reservasApi";

export default function SelectUser() {
  const [mensaje, setMensaje] = useState("");
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSaludo = async () => {
      try {
        const data = await getSaludo();
        setMensaje(data.mensaje);
      } catch (err) {
        console.error("Error al obtener el saludo:", err);
      }
    };

    const cargarDatos = async () => {
      try {
        const data = await getDatosPrueba();
        setDatos(data);
      } catch (err) {
        console.error("Error al cargar datos de prueba:", err);
        setError("No se pudieron cargar los datos de prueba");
      }
    };

    const cargarTodo = async () => {
      setCargando(true);
      await Promise.all([fetchSaludo(), cargarDatos()]);
      setCargando(false);
    };

    cargarTodo();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Encabezado */}
        <header className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 text-center">
            <h1 className="text-3xl font-bold text-slate-800">
                {mensaje ? " Conectado al backend y a la base de datos" : "Conectando..."}
            </h1>
             <p className="text-lg font-semibold text-green-600 mt-2">
                {datos && " Conexión exitosa con Supabase"}
            </p>

            <p className="text-sm text-slate-500 mt-2">
                {mensaje}
            </p>
            <h2 className="text-base font-medium text-indigo-600 mt-4">
                🚧 Este proyecto está en construcción, vuelve más tarde xddd
            </h2>
            </header>

        {/* Estado de carga / error */}
        {cargando && (
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 text-slate-500 text-center">
            Cargando datos...
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-red-700">
            {error}
          </div>
        )}

        {/* Totales */}
        {!cargando && datos && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <TotalCard titulo="Usuarios" total={datos.usuarios ?? 0} />
              <TotalCard titulo="Recursos" total={datos.recursos ?? 0} />
              <TotalCard titulo="Franjas" total={datos.franjas ?? 0} />
              <TotalCard titulo="Reservas" total={datos.reservas ?? 0} />
            </div>

            {/* Usuario de la base de datos */}
            <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200 text-center">
              <p className="text-sm text-slate-500">
                Usuario de la base de datos
              </p>
              <p className="text-lg font-semibold text-slate-800 mt-1">
                {datos.usuario_seleccionado ?? "Sin usuarios registrados"}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TotalCard({ titulo, total }) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 text-center">
      <p className="text-3xl font-bold text-indigo-600">{total}</p>
      <p className="text-sm text-slate-500 mt-1">{titulo}</p>
    </div>
  );
}