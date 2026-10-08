import { afterEach, expect, it, vi } from "vitest";
import { resolveApiBase } from "../../frontend/src/lib/apiBase.js";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each([
  {},
  { VITE_API_BASE: "https://acb-atolyesi-production.up.railway.app/api" },
  { VITE_API_URL: "https://acb-atolyesi-production.up.railway.app/api" },
  { VITE_API_BASE: "https://other.example.test/api", VITE_API_URL: "https://old.example.test/api" },
])("keeps production web API requests same-origin despite stale build variables %j", env => {
  expect(resolveApiBase({ ...env, PROD: true })).toBe("/api");
});
it("preserves local development and configured development endpoints", () => {
  expect(resolveApiBase({ PROD: false })).toBe("http://localhost:5000/api");
  expect(resolveApiBase({ PROD: false, VITE_API_URL: "http://localhost:6000/api" })).toBe("http://localhost:6000/api");
  expect(resolveApiBase({ PROD: false, VITE_API_BASE: "/api", VITE_API_URL: "http://localhost:6000/api" })).toBe("/api");
});
it("verifies and logs out a cookie-only production session through the frontend origin", async () => {
  vi.resetModules();
  vi.stubEnv("PROD", true);
  vi.stubEnv("VITE_API_BASE", "https://acb-atolyesi-production.up.railway.app/api");
  const values = new Map();
  vi.stubGlobal("localStorage", { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });
  const fetchMock = vi.fn().mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ user: { _id: "member" } }) })
    .mockResolvedValueOnce({ status: 200, ok: true });
  vi.stubGlobal("fetch", fetchMock);
  const session = await import("../../frontend/src/lib/session.js");
  await session.refreshSession();
  expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/me", expect.objectContaining({ credentials: "include", cache: "no-store", headers: {} }));
  expect(session.getSession().status).toBe("authenticated");
  await session.logoutSession();
  expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/logout", expect.objectContaining({ method: "POST", credentials: "include", headers: {} }));
  expect(session.getSession().status).toBe("guest");
});
