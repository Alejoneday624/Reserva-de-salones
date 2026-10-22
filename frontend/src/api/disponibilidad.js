import api from "./axios";

export const getFechasDisponibilidad = async (id) => {
  try {
    const response = await api.get(`recursos/${id}/disponibilidad/fechas/`);
    return response.data;
  } catch (error) {
    console.error("Error al obtener fechas de disponibilidad:", error);
    throw error;
  }
};

export const getDisponibilidad = async (id, fecha) => {
  try {
    const response = await api.get(`recursos/${id}/disponibilidad/`, {
      params: { fecha },
    });
    return response.data;
  } catch (error) {
    console.error("Error al obtener disponibilidad:", error);
    throw error;
  }
};
