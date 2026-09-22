import { useState } from "react";
import TopBar from "../components/common/TopBar";
import Filtros from "../components/common/Filtros";
import { RANGOS_CAPACIDAD } from "../constants/rangosCapacidad";
import StudyRoomsContainer from "../components/StudyRoomsContainer";

export default function Catalogo() {
  const [tipoSeleccionado, setTipoSeleccionado] = useState("");
  const [capacidadSeleccionada, setCapacidadSeleccionada] = useState("");

  const rangoActivo =
    RANGOS_CAPACIDAD.find((r) => r.id === capacidadSeleccionada) ??
    RANGOS_CAPACIDAD[0];

  return (
    <div className="min-h-screen bg-slate-100">
      <TopBar />
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">
              Catálogo de Salones
            </h1>
            <Filtros
              tipo={tipoSeleccionado}
              onTipoChange={setTipoSeleccionado}
              capacidad={capacidadSeleccionada}
              onCapacidadChange={setCapacidadSeleccionada}
            />
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Selecciona un recurso para ver su disponibilidad
          </p>
          <StudyRoomsContainer
            tipo={tipoSeleccionado}
            capMin={rangoActivo.min}
            capMax={rangoActivo.max}
          />
        </div>
      </div>
    </div>
  );
}
