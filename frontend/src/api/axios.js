import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/",
  // Sin esto, si el backend se cuelga la petición queda infinita.
  timeout: 10000,
});

// Normaliza todos los errores para que las pantallas puedan mostrar un
// mensaje claro sin repetir lógica: `error.userMessage`.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ECONNABORTED") {
      error.userMessage =
        "El servidor tardó demasiado en responder. Intenta de nuevo.";
    } else if (!error.response) {
      // Sin respuesta: el backend está caído o no hay conexión de red.
      error.userMessage =
        "No se pudo conectar con el servidor. Verifica que el backend esté activo.";
    } else if (error.response.status >= 500) {
      error.userMessage =
        "El servidor tuvo un problema interno. Intenta más tarde.";
    } else {
      // Errores de negocio (4xx): el backend ya envía {"error": "..."}.
      error.userMessage =
        error.response.data?.error || "Ocurrió un error inesperado.";
    }
    return Promise.reject(error);
  },
);

export default api;
