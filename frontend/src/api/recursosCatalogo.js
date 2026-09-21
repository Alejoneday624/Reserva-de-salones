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