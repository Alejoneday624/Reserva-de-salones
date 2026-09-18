import api from "./axios";

export const getListaUsuarios = async () => {
  try {
    const response = await api.get("usuarios/");
    return response.data;
  } catch (error) {
    console.error("Error al obtener la lista de usuarios:", error);
    throw error;
  }
};
