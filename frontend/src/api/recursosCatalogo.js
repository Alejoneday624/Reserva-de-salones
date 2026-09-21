import api from "./axios";

export const getCatalogoRecursos = async () => {
  try {
    const response = await api.get("recursos/");
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