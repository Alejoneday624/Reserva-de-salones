import api from "./axios";
export const getTipos = async () => {
    try {
      const response = await api.get("tipos/");
      return response.data;
    } catch (error) {
      console.error("Error fetching tipos:", error);
      throw error;
    }
  };