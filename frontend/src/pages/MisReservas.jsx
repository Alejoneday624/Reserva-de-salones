import { CalendarCheck } from "lucide-react";

export default function MisReservas() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <CalendarCheck className="w-10 h-10 text-teal-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900 mb-1">Mis Reservas</h1>
          <p className="text-sm text-slate-500">
            Próximamente podrás consultar aquí todas tus reservas.
          </p>
        </div>
      </div>
    </div>
  );
}
