import TopBar from "../components/common/TopBar";
import StudyRoomsContainer from "../components/StudyRoomsContainer";

export default function Catalogo() {
  return (
    <div className="min-h-screen bg-slate-100">
      <TopBar />
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Catálogo de Salones</h1>
          <p className="text-sm text-slate-500 mb-6">
            Selecciona un recurso para ver su disponibilidad
          </p>
          <StudyRoomsContainer />
        </div>
      </div>
    </div>
  );
}
