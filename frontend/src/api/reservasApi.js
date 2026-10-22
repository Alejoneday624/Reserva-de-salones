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

export const crearReserva = async ({ recursoId, usuarioId, fecha, bloques }) => {
  try {
    const response = await api.post("reservas/", {
      recurso_id: recursoId,
      usuario_id: usuarioId,
      fecha,
      bloques,
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