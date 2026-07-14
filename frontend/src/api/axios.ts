import axios from "axios";

// En Docker, les appels restent sur l'origine du frontend et Nginx relaie /api
// vers le backend. VITE_API_URL reste disponible pour un backend externe.
const BASE_URL = import.meta.env.VITE_API_URL || "";

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
