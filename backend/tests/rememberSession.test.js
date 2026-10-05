import { beforeEach, afterEach, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import AuthSession from "../models/AuthSession.js";
import User from "../models/User.js";
import router from "../routes/auth.js";
import { ensureIdentity } from "../middlewares/ensureAuth.js";
import { createWebSession, validWebSession, revokeWebSession, startGoogleSession, verifyGoogleSession } from "../services/authSession.js";

vi.mock("../services/emailService.js", () => ({ sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn(), sendEmailVerifyOtp: vi.fn() }));
vi.mock("passport", () => ({ default: { authenticate: () => (req, res, next) => next(), serializeUser: vi.fn(), deserializeUser: vi.fn() } }));
vi.mock("bcryptjs", () => ({ default: { compare: async () => true } }));
const user = { _id: "000000000000000000000001", email: "member@example.test", sifreHash: "password-hash", emailVerified: true };
const response = () => ({ cookie: vi.fn(), clearCookie: vi.fn(), set: vi.fn(), vary: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() });
let records;
beforeEach(() => {
  vi.stubEnv("JWT_SECRET", randomBytes(32).toString("hex"));
  records = new Map();
  vi.spyOn(AuthSession, "create").mockImplementation(async row => records.set(row.tokenHash, row));
  vi.spyOn(AuthSession, "deleteOne").mockImplementation(async query => records.delete(query.tokenHash));
  vi.spyOn(AuthSession, "exists").mockImplementation(async query => {
    const row = records.get(query.tokenHash);
    return row && String(row.user) === String(query.user) && row.passwordFingerprint === query.passwordFingerprint && row.expiresAt > query.expiresAt.$gt;
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

it.each([true, false, undefined, "true"])("persists only explicit opt-in: %s", async remember => {
  const res = response();
  await createWebSession({}, res, user, remember);
  const [, token, options] = res.cookie.mock.calls[0];
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const duration = remember === true ? 30 * 86400 : 12 * 3600;
  expect(payload.exp - payload.iat).toBe(duration);
  expect(options.maxAge).toBe(remember === true ? duration * 1000 : undefined);
  expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  expect(await validWebSession(payload, user)).toBe(true);
  expect(records.has(payload.sid)).toBe(false);
  expect(await validWebSession(payload, { ...user, sifreHash: "changed" })).toBe(false);
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + duration * 1000 + 1);
  expect(await validWebSession(payload, user)).toBe(false);
});

it("revokes a copied cookie at logout and preserves other devices", async () => {
  const first = response(), second = response();
  await createWebSession({}, first, user, true);
  await createWebSession({}, second, user, true);
  const token = first.cookie.mock.calls[0][1];
  const logout = router.stack.find(x => x.route?.path === "/logout").route.stack[0].handle;
  await logout({ cookies: { token } }, response());
  expect(await validWebSession(jwt.decode(token), user)).toBe(false);
  expect(await validWebSession(jwt.decode(second.cookie.mock.calls[0][1]), user)).toBe(true);
  vi.spyOn(User, "findById").mockReturnValue({ select: () => ({ lean: async () => user }) });
  const res = response(), next = vi.fn();
  await ensureIdentity({ headers: {}, cookies: { token } }, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

it("replaces the current session on sign-in without accepting an invalid old token", async () => {
  const first = response(), second = response();
  await createWebSession({}, first, user, true);
  const token = first.cookie.mock.calls[0][1];
  await createWebSession({ cookies: { token } }, second, user, false);
  expect(await validWebSession(jwt.decode(token), user)).toBe(false);
  await expect(revokeWebSession("invalid")).resolves.toBeUndefined();
});

it("web password login never returns the credential in JSON", async () => {
  vi.spyOn(User, "findOne").mockResolvedValue(user);
  const login = router.stack.find(x => x.route?.path === "/login").route.stack[0].handle;
  const res = response();
  await login({ body: { email: user.email, sifre: "password", web: true, rememberMe: true } }, res);
  expect(res.json.mock.calls[0][0].token).toBeUndefined();
  expect(res.cookie.mock.calls[0][2].maxAge).toBe(30 * 86400 * 1000);
});

it.each(['user', 'moderator', 'admin'])("never issues a token for an already verified %s through OTP", async role => {
  vi.spyOn(User, "findOne").mockResolvedValue({ ...user, role });
  const verify = router.stack.find(x => x.route?.path === "/verify-email-otp").route.stack[0].handle;
  const res = response();
  await verify({ body: { email: user.email, otp: "123456" } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json.mock.calls[0][0].token).toBeUndefined();
  expect(res.cookie).not.toHaveBeenCalled();
});

it.each([false, true])("consumes a valid OTP once; web=%s", async web => {
  const candidate = { ...user, emailVerified: false, emailVerifyOtp: '123456', emailVerifyOtpExpires: new Date(Date.now() + 60000) };
  vi.spyOn(User, 'findOne').mockResolvedValue(candidate);
  vi.spyOn(User, 'findOneAndUpdate').mockResolvedValueOnce({ ...user, toSafeJSON: () => ({ _id: user._id }) }).mockResolvedValueOnce(null);
  const verify = router.stack.find(x => x.route?.path === '/verify-email-otp').route.stack[0].handle;
  const req = { body: { email: user.email, otp: '123456', web, ...(web ? {} : { client: "native" }) } };
  const first = response(), replay = response();
  await verify(req, first);
  expect(first.json.mock.calls[0][0].user._id).toBe(user._id);
  expect(!!first.json.mock.calls[0][0].token).toBe(!web);
  expect(first.cookie.mock.calls.length).toBe(web ? 1 : 0);
  expect(User.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ emailVerified: false, emailVerifyOtp: '123456', emailVerifyOtpExpires: { $gt: expect.any(Date) } });
  await verify(req, replay);
  expect(replay.status).toHaveBeenCalledWith(400);
  expect(replay.cookie).not.toHaveBeenCalled();
});

it('sets Secure in production without changing persistence preference', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const res = response();
  await createWebSession({}, res, user, true);
  expect(res.cookie.mock.calls[0][2]).toMatchObject({ secure: true, httpOnly: true, sameSite: 'lax', maxAge: 30 * 86400 * 1000 });
});

it("binds Google's remember preference to the initiating browser and expires state", () => {
  const start = response();
  const req = { query: { rememberMe: "true" } };
  startGoogleSession(req, start, vi.fn());
  const state = start.cookie.mock.calls[0][1];
  const callback = { query: { state: req.googleState }, cookies: { oauth_state: state } };
  const next = vi.fn();
  verifyGoogleSession(callback, response(), next);
  expect(callback.rememberMe).toBe(true);
  expect(next).toHaveBeenCalledOnce();
  for (const invalid of [{ ...callback, cookies: {} }, { ...callback, query: { state: "forged" } }]) {
    const res = response();
    verifyGoogleSession(invalid, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  }
  vi.useFakeTimers(); vi.setSystemTime(Date.now() + 601000);
  const res = response();
  verifyGoogleSession(callback, res, vi.fn());
  expect(res.status).toHaveBeenCalledWith(400);
});
