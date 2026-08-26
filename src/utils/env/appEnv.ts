// appEnv.ts
// DEV vs PROD i czy API idzie wprost (prod) czy przez proxy Vite.
// Zakres:
//  - usesDirectBackendUrl
//  - DEV vs PROD i czy fetch idzie wprost czy przez proxy Vite
// Zmiana tego flaguje waitBackend i bazę URL — testuj oba tryby.
// Przy zmianach: backend.ts, waitBackend.ts, api/client.ts.

export const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

export const usesDirectBackendUrl = isProduction;
