import api from "./axios";

export const getSaludo = async () => {
  try {
    const response = await api.get("saludo/"); 
    return response.data; 
    } catch (error) {
    console.error("Error al obtener el saludo:", error);
    throw error; Q
  }
}

export const getDatosPrueba = async () => {
  try {
    const response = await api.get("datos_prueba/");
    return response.data;
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    throw error;
  }
};