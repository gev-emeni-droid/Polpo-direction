// Configuration API avec support pour les variables d'environnement
export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'https://polpo-direction-api.gev-emeni.workers.dev';

// Fallback localStorage si l'API n'est pas disponible
export const USE_FALLBACK = import.meta.env?.VITE_USE_FALLBACK === 'true' || false;

export default {
  API_BASE_URL,
  USE_FALLBACK,
};
