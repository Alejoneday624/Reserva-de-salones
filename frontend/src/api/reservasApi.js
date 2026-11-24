import api from "./axios";

export const getUsuarios = async () => {
  try {
    const response = await api.get("usuarios/");
    return response.data;
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    throw error;
  }
};

export const crearReserva = async ({ recursoId, usuarioId, fecha, bloques, semanas = 1 }) => {
  try {
    const response = await api.post("reservas/", {
      recurso_id: recursoId,
      usuario_id: usuarioId,
      fecha,
      bloques,
      // Repetición semanal: 1 a 4 semanas con el mismo día y horario.
      semanas,
    });
    return response.data;
  } catch (error) {
    console.error("Error al crear reserva:", error);
    throw error;
  }
};

export const getResumenReservas = async (usuarioId, fecha) => {
  try {
    const response = await api.get(`usuarios/${usuarioId}/resumen-reservas/`, {
      params: { fecha },
    });
    return response.data;
  } catch (error) {
    console.error("Error al obtener resumen de reservas:", error);
    throw error;
  }
};

// Reservas del usuario seleccionado, de la más reciente a la más antigua.
export const getReservasUsuario = async (usuarioId) => {
  try {
    const response = await api.get(`usuarios/${usuarioId}/reservas/`);
    return response.data;
  } catch (error) {
    console.error("Error al obtener reservas del usuario:", error);
    throw error;
  }
};
// Cancela una reserva del estudiante. El backend valida que sea futura,
// que no esté cancelada ya y que pertenezca a `usuarioId`; si falla, el
// interceptor de axios deja el motivo en `error.userMessage`.
export const cancelarReserva = async (reservaId, usuarioId) => {
  try {
    const response = await api.post(`reservas/${reservaId}/cancelar/`, {
      usuario_id: usuarioId,
    });
    return response.data;
  } catch (error) {
    console.error("Error al cancelar la reserva:", error);
    throw error;
  }
};
