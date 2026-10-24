// Frontend/src/config.js
// dev: http://127.0.0.1:8000   |   production build: "" (same origin as backend)
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';