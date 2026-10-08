// Web cookies and OAuth state must use the frontend origin in production.
export function resolveApiBase(env) {
  if (env.PROD) return "/api";
  return env.VITE_API_BASE || env.VITE_API_URL || "http://localhost:5000/api";
}

export const API_BASE = import.meta.env.PROD ? "/api" : resolveApiBase(import.meta.env);
