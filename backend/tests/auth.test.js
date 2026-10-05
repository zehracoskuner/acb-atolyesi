import { sessionStore } from "./fixtures/sessionStore.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import jwt from "jsonwebtoken";
import ensureAuth, { optionalAuth } from "../middlewares/ensureAuth.js";
import requireRole from "../middlewares/requireRole.js";
import User from "../models/User.js";
import publicRouter from "../routes/public.js";
import { newTermsAcceptance, TERMS_VERSION } from "../config/terms.js";

const id = "000000000000000000000001";
let account, issue;
beforeEach(() => {
  issue = sessionStore();
  vi.stubEnv("JWT_SECRET", randomBytes(32).toString("hex"));
  account = { _id: id, email: "test@example.test", role: "user", profileComplete: true, birthYear: 1990, ...newTermsAcceptance() };
  vi.spyOn(User, "findById").mockImplementation(() => ({ select: () => ({ lean: async () => account }) }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const sign = (payload = { id }, options = {}) => issue(account || { _id: id }, payload, options);
async function run(token, optional = false, cookies = {}) {
  const req = { headers: token ? { authorization: "Bearer " + token } : {}, cookies };
  const res = { set: vi.fn(), vary: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  await (optional ? optionalAuth : ensureAuth)(req, res, next);
  return { req, res, next };
}

describe("session authentication", () => {
  it('requires profile completion for legacy accounts missing birthYear on the backend too', async () => {
    account.birthYear = null;
    const { res, req } = await run(sign());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PROFILE_INCOMPLETE' }));
    expect(req.user).toBeUndefined();
    expect((await run(sign(), true)).req.user).toBeUndefined();
  });
  it.each(["user", "moderator", "admin"])("requires current DB terms for %s with either session transport", async role => {
    account.role = role;
    for (const acceptance of [
      { termsVersion: null, termsAcceptedAt: null },
      { termsVersion: "old-version", termsAcceptedAt: new Date() },
      { termsVersion: TERMS_VERSION, termsAcceptedAt: null },
    ]) {
      Object.assign(account, acceptance);
      const token = sign({ id, role: "admin", ...newTermsAcceptance() });
      for (const cookies of [{}, { token }]) {
        const { req, res, next } = await run(token, false, cookies);
        expect(req.user).toBeUndefined();
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          code: "TERMS_ACCEPTANCE_REQUIRED", currentTermsVersion: TERMS_VERSION,
        }));
        const optional = await run(token, true, cookies);
        expect(optional.req.user).toBeUndefined();
        expect(optional.next).toHaveBeenCalledWith();
      }
    }
  });
  it.each([false, true])("missing and invalid credentials, optional=%s", async optional => {
    for (const token of [undefined, "invalid", sign({ id }, { expiresIn: -1 }),
      jwt.sign({ id }, randomBytes(32).toString("hex")), sign({ role: "admin" }),
      sign({ id: "invalid" }), sign({ id }, { algorithm: "HS384" })]) {
      const { req, res, next } = await run(token, optional);
      expect(req.user).toBeUndefined();
      if (optional) expect(next).toHaveBeenCalledWith();
      else expect(res.status).toHaveBeenCalledWith(401);
    }
  });
  it("accepts header and cookie sessions and preserves cookie precedence", async () => {
    expect((await run(sign())).req.user.id).toBe(id);
    expect((await run(undefined, true, { token: sign() })).req.user.id).toBe(id);
    expect((await run(sign(), false, { token: "invalid" })).res.status).toHaveBeenCalledWith(401);
  });
  it("rejects deleted and banned accounts; public requests remain anonymous", async () => {
    account = null;
    expect((await run(sign())).res.status).toHaveBeenCalledWith(401);
    account = { _id: id, role: "banned" };
    expect((await run(sign())).res.status).toHaveBeenCalledWith(403);
    expect((await run(sign(), true)).req.user).toBeUndefined();
  });
  it.each(["user", "moderator", "admin"])("checks current %s staff permissions", async role => {
    account.role = role;
    const { req, res } = await run(sign({ id, role: "admin" }));
    expect(req.user.role).toBe(role);
    const next = vi.fn();
    requireRole("admin", "moderator")(req, res, next);
    if (role === "user") expect(res.status).toHaveBeenCalledWith(403);
    else expect(next).toHaveBeenCalledWith();
    const adminNext = vi.fn();
    requireRole("admin")(req, res, adminNext);
    expect(adminNext.mock.calls.length).toBe(role === "admin" ? 1 : 0);
  });
  it("forwards storage failures instead of disguising them as invalid tokens", async () => {
    User.findById.mockImplementation(() => { throw new Error("storage unavailable"); });
    expect((await run(sign(), true)).next).toHaveBeenCalledWith(expect.any(Error));
  });
  it("protects follow actions and uses optional auth on public profiles", () => {
    const routes = publicRouter.stack.filter(layer => layer.route).map(layer => layer.route);
    expect(routes.find(r => r.path === "/profile/:id/follow").stack[0].handle).toBe(ensureAuth);
    expect(routes.find(r => r.path === "/profile/:id").stack[0].handle).toBe(optionalAuth);
  });
});

describe("startup configuration", () => {
  it.each([undefined, "", "   "])("fails before server initialization for an absent or blank secret (%s)", secret => {
    const env = { ...process.env, DOTENV_CONFIG_PATH: "__nonexistent_test_env__" };
    delete env.JWT_SECRET;
    if (secret !== undefined) env.JWT_SECRET = secret;
    const result = spawnSync(process.execPath, ["server.js"], { env, encoding: "utf8", timeout: 10000 });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("JWT_SECRET ortam değişkeni gereklidir");
    expect(result.stdout).not.toContain("portunda");
  });
});
