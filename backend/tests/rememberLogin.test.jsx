import { afterEach, beforeEach, expect, it, vi } from "vitest";
import React from "../../frontend/node_modules/react/index.js";
import { renderToStaticMarkup } from "../../frontend/node_modules/react-dom/server.node.js";
import { MemoryRouter } from "../../frontend/node_modules/react-router-dom/dist/index.mjs";
const mocks = vi.hoisted(() => ({ refreshSession: vi.fn(), getSession: vi.fn(), sync: vi.fn() }));
vi.mock("../../frontend/src/lib/session", () => ({ ...mocks, forgetSession: vi.fn() }));
vi.mock("../../frontend/src/services/readingProgressService", () => ({ syncLocalProgressToServer: mocks.sync }));
import Login from "../../frontend/src/pages/Login.jsx";
import { completeWebLogin } from "../../frontend/src/lib/auth.js";
beforeEach(() => {
  vi.stubGlobal("React", React);
  for (const name of ["localStorage", "sessionStorage"]) {
    const values = new Map([["token", "legacy"]]);
    vi.stubGlobal(name, { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });
  }
  mocks.refreshSession.mockResolvedValue();
  mocks.getSession.mockReturnValue({ status: "authenticated" });
  mocks.sync.mockResolvedValue();
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("renders an unchecked, labelled opt-in with the duration and shared-device guidance", () => {
  const html = renderToStaticMarkup(<MemoryRouter><Login /></MemoryRouter>);
  expect(html).toContain('type="checkbox"');
  expect(html).not.toContain('checked=""');
  expect(html).toContain("Oturumu açık tut");
  expect(html).toContain("30 gün");
  expect(html).toContain("Ortak cihazlarda işaretleme");
});
it("restores identity through the cookie and removes legacy browser tokens", async () => {
  await completeWebLogin();
  expect(localStorage.getItem("token")).toBeUndefined();
  expect(sessionStorage.getItem("token")).toBeUndefined();
  expect(mocks.refreshSession).toHaveBeenCalledWith({ force: true });
  expect(localStorage.getItem("acb_session_changed")).toBeTruthy();
  expect(mocks.sync).toHaveBeenCalledOnce();
});
it("does not announce success or sync personal data if the cookie was rejected", async () => {
  mocks.getSession.mockReturnValue({ status: "guest" });
  await expect(completeWebLogin()).rejects.toThrow();
  expect(mocks.sync).not.toHaveBeenCalled();
  expect(localStorage.getItem("acb_session_changed")).toBeUndefined();
});
