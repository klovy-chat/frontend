/**
 * Tryb aplikacji ustawiany przez Vite:
 * - `npm run dev`  → isDevelopment = true
 * - `npm run build` + hosting → isProduction = true
 *
 * To jest odpowiednik backendowego NODE_ENV, ale po stronie frontu
 * Vite sam przełącza te flagi — nie trzeba ich ręcznie zmieniać w kodzie.
 */
export const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

/** W dev requesty idą przez proxy Vite; w prod bezpośrednio na VITE_BACKEND_URL. */
export const usesDirectBackendUrl = isProduction;
