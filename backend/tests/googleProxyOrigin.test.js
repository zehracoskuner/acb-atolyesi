import { afterEach, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { startGoogleSession, verifyGoogleSession } from "../services/authSession.js";

const origin = "https://xn--acbatlyesi-icb.com";
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it.each(["passport", "passport-google"])("uses the configured same-origin Google redirect URI in %s", async config => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");
  vi.stubEnv("API_URL", origin + "/api");
  vi.stubEnv("GOOGLE_CALLBACK_URL", origin + "/api/auth/google/callback");
  const { default: passport } = await import(`../config/${config}.js`);
  // Passport clones its registered strategy and supplies redirect per request.
  const strategy = Object.create(passport._strategy("google"));
  const redirect = strategy.redirect = vi.fn();
  strategy.authenticate({ query: {}, headers: { host: "acb-atolyesi-production.up.railway.app" } }, { session: false, state: "browser-nonce", scope: ["profile", "email"] });
  const authorization = new URL(redirect.mock.calls[0][0]);
  expect(authorization.origin).toBe("https://accounts.google.com");
  expect(authorization.searchParams.get("redirect_uri")).toBe(origin + "/api/auth/google/callback");
  expect(authorization.searchParams.get("state")).toBe("browser-nonce");
});
it("keeps production OAuth state host-only and verifies the callback nonce and remember preference", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("JWT_SECRET", randomBytes(32).toString("hex"));
  const req = { query: { rememberMe: "true" } };
  const start = { cookie: vi.fn() };
  const next = vi.fn();
  startGoogleSession(req, start, next);
  expect(next).toHaveBeenCalledOnce();
  const [name, state, options] = start.cookie.mock.calls[0];
  expect(name).toBe("oauth_state");
  expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600000 });
  expect(options).not.toHaveProperty("domain");
  const callback = { query: { state: req.googleState }, cookies: { oauth_state: state } };
  const response = { clearCookie: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() };
  const verified = vi.fn();
  verifyGoogleSession(callback, response, verified);
  expect(verified).toHaveBeenCalledOnce();
  expect(callback.rememberMe).toBe(true);
  expect(response.clearCookie).toHaveBeenCalledWith("oauth_state", expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", path: "/" }));
  expect(response.clearCookie.mock.calls[0][1]).not.toHaveProperty("domain");
});
