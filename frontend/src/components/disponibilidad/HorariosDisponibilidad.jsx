function rangoHorario(horaInicio, horaFin) {
  return `${horaInicio.slice(0, 5)} – ${horaFin.slice(0, 5)}`;
}

function horasEntre(horaInicio, horaFin) {
  const [hi, mi] = horaInicio.split(":").map(Number);
  const [hf, mf] = horaFin.split(":").map(Number);
  return (hf * 60 + mf - (hi * 60 + mi)) / 60;
}

export default function HorariosDisponibilidad({
  franjas,
  seleccion = [],
  onSeleccionar,
  horasDisponibles = null,
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-teal-500 bg-teal-50" />
          Disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500" />
          Ocupado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-300" />
          Pasado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-dashed border-indigo-400 bg-indigo-50" />
          Límite diario
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {franjas.map((franja) => {
          const clave = `${franja.hora_inicio}-${franja.hora_fin}`;
          const rango = rangoHorario(franja.hora_inicio, franja.hora_fin);

          if (!franja.disponible) {
            if (franja.pasado) {
              return (
                <div
                  key={clave}
                  className="rounded-xl border border-slate-300 bg-slate-200 px-3 py-3 text-center text-sm text-slate-500"
                >
                  {rango}
                  <span className="block text-[11px] text-slate-500">
                    Pasado
                  </span>
                </div>
              );
            }
            return (
              <div
                key={clave}
                className="rounded-xl border border-red-300 bg-red-100 px-3 py-3 text-center text-sm text-red-500 line-through"
              >
                {rango}
                <span className="block text-[11px] no-underline text-red-500">
                  Ocupado
                </span>
              </div>
            );
          }

          const activa = seleccion.includes(clave);

          const excedeLimite =
            !activa &&
            horasDisponibles !== null &&
            horasEntre(franja.hora_inicio, franja.hora_fin) > horasDisponibles;

          if (excedeLimite) {
            return (
              <div
                key={clave}
                className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50 px-3 py-3 text-center text-sm text-indigo-500"
              >
                {rango}
                <span className="block text-[11px] text-indigo-500">
                  Límite diario
                </span>
              </div>
            );
          }
          return (
            <button
              key={clave}
              type="button"
              onClick={() => onSeleccionar(clave)}
              className={`rounded-xl border px-3 py-3 text-center text-sm font-medium transition-colors ${
                activa
                  ? "border-2 border-teal-500 bg-teal-50 text-teal-700"
                  : "border-slate-200 bg-white text-slate-700 hover:border-teal-400 hover:text-teal-700"
              }`}
            >
              {rango}
              <span
                className={`block text-[11px] font-normal ${
                  activa ? "text-teal-600" : "text-slate-400"
                }`}
              >
                {activa ? "Seleccionado" : "Disponible"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
