import api from "./axios";

export const getCatalogoRecursos = async ({ tipo = "", capMin, capMax } = {}) => {
  try {
    const params = {};
    if (tipo) params.tipo = tipo;
    if (capMin) params.cap_min = capMin;
    if (capMax) params.cap_max = capMax;
    const response = await api.get("recursos/", { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching recursos:", error);
    throw error;
  }
};

export const getRecursoDetalle = async (id) => {
  try {
    const response = await api.get(`recursos/${id}/`);
    return response.data;
  } catch (error) {
    console.error("Error fetching recurso detalle:", error);
    throw error;
  }
};