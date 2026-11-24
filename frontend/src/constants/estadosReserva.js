// Los 4 estados que las pantallas de reservas muestran al estudiante.
// El backend los resuelve a partir del estado guardado y el momento actual.
export const ESTADOS_RESERVA = {
  activa: {
    label: "Activa",
    className: "bg-green-50 text-green-700 ring-green-200",
    dot: "bg-green-500",
  },
  "en curso": {
    label: "En curso",
    className: "bg-blue-50 text-blue-700 ring-blue-200",
    dot: "bg-blue-500",
  },
  vencida: {
    label: "Vencida",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
  },
  cancelada: {
    label: "Cancelada",
    className: "bg-red-50 text-red-700 ring-red-200",
    dot: "bg-red-500",
  },
};

export function configEstado(estado) {
  return ESTADOS_RESERVA[String(estado ?? "").toLowerCase()] ?? ESTADOS_RESERVA.activa;
}
