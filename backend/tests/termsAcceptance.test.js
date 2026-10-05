import { createNativeSession } from "../services/authSession.js";
import { sessionStore } from "./fixtures/sessionStore.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";

import bcrypt from "bcryptjs";
import dns from "dns/promises";
import User from "../models/User.js";
import router from "../routes/auth.js";
import ensureAuth, { optionalAuth } from "../middlewares/ensureAuth.js";
import { googleUpsert } from "../utils/googleUpsert.js";
import { sendVerificationEmail } from "../services/emailService.js";
import { TERMS_VERSION } from "../config/terms.js";
import { TERMS_VERSION as DISPLAYED_VERSION, membershipStep } from "../../frontend/src/lib/terms.js";

const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("google-auth-library", () => ({ OAuth2Client: class { verifyIdToken(...args) { return verifyIdToken(...args); } } }));
vi.mock("../services/emailService.js", () => ({ sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn(), sendEmailVerifyOtp: vi.fn() }));
vi.mock("passport", () => ({ default: {
  authenticate: () => (req, res, next) => next(), serializeUser: vi.fn(), deserializeUser: vi.fn(),
} }));

const id = "000000000000000000000001";
const valid = { termsAccepted: true, termsVersion: TERMS_VERSION };
let user, writes, server, base, token;
function query(value) {
  const chain = { select: () => chain, lean: () => chain, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
  return chain;
}
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$or") return value.some(part => matches(row, part));
    if (value && typeof value === "object" && "$ne" in value) return String(row[key]) !== String(value.$ne);
    return String(row[key]) === String(value);
  });
}
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", randomBytes(32).toString("hex"));
  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/api/auth", router);
  app.post("/api/member-action", ensureAuth, (req, res) => res.json({ ok: true }));
  app.get("/api/public-read", optionalAuth, (req, res) => res.json({ member: !!req.user }));
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}/api`;

});
afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  vi.unstubAllEnvs();
});
beforeEach(() => {
  user = new User({ _id: id, email: "member@example.test", kullaniciAdi: "member", birthYear: 2007, profileComplete: true, emailVerified: true, sifreHash: "hash" });
  token = sessionStore()(user);
  writes = [];
  vi.spyOn(User, "findById").mockImplementation(key => query(String(key) === id ? user : null));
  vi.spyOn(User, "findOne").mockImplementation(filter => query(user && matches(user, filter) ? user : null));
  vi.spyOn(User, "create").mockImplementation(async value => {
    writes.push(value);
    user = new User({ _id: id, ...value });
    return user;
  });
  vi.spyOn(User, "updateOne").mockImplementation(async (filter, update) => {
    if (!user || !matches(user, filter)) return { modifiedCount: 0 };
    writes.push(update.$set);
    Object.assign(user, update.$set);
    return { modifiedCount: 1 };
  });
  vi.spyOn(User.prototype, "save").mockImplementation(async function () { return this; });
  vi.spyOn(dns, "resolveMx").mockResolvedValue([{ exchange: "mail.example.test" }]);
  vi.spyOn(bcrypt, "hash").mockResolvedValue("hashed-password");
  vi.spyOn(bcrypt, "compare").mockResolvedValue(true);
  sendVerificationEmail.mockResolvedValue(undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

async function request(path, body, session = token, method = "POST", cookie = false) {
  const headers = { "Content-Type": "application/json" };
  if (session) headers[cookie ? "Cookie" : "Authorization"] = cookie ? `token=${session}` : `Bearer ${session}`;
  const response = await fetch(base + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}

describe("explicit consent over HTTP (real routes/auth, isolated storage and external services)", () => {
  it.each(["production", "development"])("local login sets the intended cookie flags in %s", async env => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = env;
    try {
      const result = await fetch(base + "/auth/login", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, sifre: "password" }),
      });
      expect(result.status).toBe(200);
      const cookie = result.headers.get("set-cookie");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Path=/");
      expect(cookie.includes("Secure")).toBe(env === "production");
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
    }
  });
  it("keeps the displayed and enforced document versions identical; legacy records have no consent", () => {
    expect(DISPLAYED_VERSION).toBe(TERMS_VERSION);
    expect(user.termsVersion).toBeNull();
    expect(user.termsAcceptedAt).toBeNull();
    expect(user.toSafeJSON().requiresTermsAcceptance).toBe(true);
  });

  it.each([undefined, false, "true", "false", 1, 0, null, [], {}])("rejects registration without literal true (%j) before side effects", async termsAccepted => {
    const result = await request("/auth/register", { kullaniciAdi: "newuser", email: "new@example.test", sifre: "password", termsVersion: TERMS_VERSION, termsAccepted }, null);
    expect(result.status).toBe(400);
    expect(result.body.code).toBe("TERMS_ACCEPTANCE_REQUIRED");
    expect(User.create).not.toHaveBeenCalled();
    expect(dns.resolveMx).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it.each([undefined, "old-version", "future-version", 123])("rejects a missing or stale version (%j)", async termsVersion => {
    const result = await request("/auth/register", { ...valid, termsVersion }, null);
    expect(result.status).toBe(409);
    expect(result.body.code).toBe("TERMS_VERSION_MISMATCH");
    expect(writes).toEqual([]);
  });

  it("persists registration version and a server time; ignores client timestamps and marketing fields", async () => {
    const before = Date.now();
    const result = await request("/auth/register", { ...valid, kullaniciAdi: "newuser", email: "new@example.test", sifre: "password", termsAcceptedAt: "1990-01-01", marketingConsent: true }, null);
    expect(result.status).toBe(201);
    expect(writes).toHaveLength(1);
    expect(user.termsVersion).toBe(TERMS_VERSION);
    expect(user.termsAcceptedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(user.termsAcceptedAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(writes[0]).not.toHaveProperty("marketingConsent");
  });

  it.each([false, true])("requires a DB acceptance even with an existing signed session, cookie=%s", async cookie => {
    const result = await request("/member-action", {}, token, "POST", cookie);
    expect(result.status).toBe(403);
    expect(result.body.code).toBe("TERMS_ACCEPTANCE_REQUIRED");
    expect((await request("/auth/me", undefined, token, "GET", cookie)).body.user.requiresTermsAcceptance).toBe(true);
    expect((await request("/public-read", undefined, token, "GET", cookie)).body.member).toBe(false);
  });

  it("direct acceptance needs authentication and explicit current-version consent", async () => {
    expect((await request("/auth/accept-terms", valid, null)).status).toBe(401);
    expect((await request("/auth/accept-terms", valid, "invalid")).status).toBe(401);
    expect((await request("/auth/accept-terms", {})).status).toBe(400);
    expect((await request("/auth/accept-terms", { ...valid, termsAccepted: "true" })).status).toBe(400);
    expect((await request("/auth/accept-terms", { ...valid, termsVersion: "old" })).status).toBe(409);
    expect(writes).toEqual([]);
  });

  it("reaccepts legacy/old terms without requiring a new login; repeat requests preserve the first acceptance", async () => {
    user.termsVersion = "old";
    user.termsAcceptedAt = new Date("2025-01-01");
    expect((await request("/member-action", {})).status).toBe(403);
    const before = Date.now();
    const accepted = await request("/auth/accept-terms", { ...valid, termsAcceptedAt: "1990-01-01" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.user.requiresTermsAcceptance).toBe(false);
    expect(user.termsAcceptedAt.getTime()).toBeGreaterThanOrEqual(before);
    const firstTime = user.termsAcceptedAt.getTime();
    expect((await request("/auth/accept-terms", valid)).status).toBe(200);
    expect(writes).toHaveLength(1);
    expect(user.termsAcceptedAt.getTime()).toBe(firstTime);
    expect((await request("/member-action", {})).status).toBe(200);
    expect((await request("/public-read", undefined, token, "GET")).body.member).toBe(true);
  });

  it("rejects banned users even on acceptance and identity endpoints", async () => {
    user.role = "banned";
    expect((await request("/auth/accept-terms", valid)).status).toBe(403);
    expect((await request("/auth/me", undefined, token, "GET")).status).toBe(403);
    expect(writes).toEqual([]);
  });

  it("local login returns the pending state and never silently accepts", async () => {
    const result = await request("/auth/login", { email: user.email, sifre: "password", client: "native" }, null);
    expect(result.status).toBe(200);
    expect(result.body.user.requiresTermsAcceptance).toBe(true);
    expect(membershipStep(result.body.user)).toBe("/sozlesme-kabul");
    expect((await request("/member-action", {}, result.body.token)).status).toBe(403);
    expect(writes).toEqual([]);
  });

  it("Google upsert creates only a pending account without fabricated acceptance", async () => {
    user = null;
    const google = await googleUpsert({ email: "google@example.test", googleId: "google-id" });
    token = await createNativeSession(google);
    expect(google.profileComplete).toBe(false);
    expect(google.termsAcceptedAt).toBeNull();
    expect(google.termsVersion).toBeNull();
    expect((await request("/member-action", {})).body.code).toBe("PROFILE_INCOMPLETE");
    expect((await request("/auth/accept-terms", valid)).body.code).toBe("PROFILE_INCOMPLETE");
    expect((await request("/auth/complete-profile", { kullaniciAdi: "newname" })).status).toBe(400);
    expect(user.profileComplete).toBe(false);
  });

  it.each([{}, { termsAccepted: false }, { termsAccepted: "true" }, { ...valid, termsVersion: "old" }])("cannot complete a Google profile without current consent: %j", async consent => {
    user.profileComplete = false;
    const result = await request("/auth/complete-profile", { kullaniciAdi: "newname", ...consent });
    expect([400, 409]).toContain(result.status);
    expect(user.profileComplete).toBe(false);
    expect(writes).toEqual([]);
  });

  it("Google profile completion saves username and acceptance together using server time", async () => {
    user.profileComplete = false;
    const before = Date.now();
    const result = await request("/auth/complete-profile", { kullaniciAdi: "newname", birthYear: 2008, ...valid, termsAcceptedAt: "1990-01-01" });
    expect(result.status).toBe(200);
    expect(result.body.user).toMatchObject({ profileComplete: true, termsVersion: TERMS_VERSION, requiresTermsAcceptance: false });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ kullaniciAdi: "newname", birthYear: 2008, profileComplete: true, termsVersion: TERMS_VERSION });
    expect(user.termsAcceptedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect((await request("/member-action", {}, token)).status).toBe(200);
    expect((await request("/auth/complete-profile", { kullaniciAdi: "another", ...valid })).status).toBe(400);
    expect(writes).toHaveLength(1);
  });

  it("Google mobile login cannot grant membership or accept terms from token payload/request", async () => {
    user.googleId = "google-id";
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ email: user.email, sub: user.googleId }) });
    const result = await request("/auth/google/mobile", { idToken: "fixture", ...valid }, null);
    expect(result.status).toBe(200);
    expect(result.body.user.requiresTermsAcceptance).toBe(true);
    expect((await request("/member-action", {}, result.body.token)).status).toBe(403);
    expect(writes).toEqual([]);
  });

  it("storage failure does not acknowledge acceptance", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    User.updateOne.mockRejectedValueOnce(new Error("storage unavailable"));
    expect((await request("/auth/accept-terms", valid)).status).toBe(500);
    expect((await request("/member-action", {})).status).toBe(403);
  });
});

it.each([undefined, null, "2007", 2007.5, 1899, 9999])("profile completion rejects invalid birth year %j", async birthYear => {
  user.profileComplete = false;
  const result = await request("/auth/complete-profile", { kullaniciAdi: "newname", birthYear, ...valid });
  expect(result.status).toBe(400); expect(writes).toEqual([]);
});
it("existing accounts supply a missing year once and cannot change it later", async () => {
  user.birthYear = null;
  const result = await request("/auth/complete-profile", { birthYear: 2008, ...valid });
  expect(result.status).toBe(200); expect(user.birthYear).toBe(2008);
  expect((await request("/auth/complete-profile", { birthYear: 2007, ...valid })).status).toBe(409);
  expect(user.birthYear).toBe(2008); expect(writes).toHaveLength(1);
});

it("retrying an already completed profile with the same year succeeds without extra writes", async () => {
  const result = await request("/auth/complete-profile", { birthYear: 2007, ...valid });
  expect(result.status).toBe(200);
  expect(result.body.user).toMatchObject({ birthYear: 2007, profileComplete: true });
  expect(writes).toEqual([]);
});

it("legacy accounts with an absent birthYear preserve their completed profile and username", async () => {
  user.birthYear = undefined;
  // Match MongoDB's null filter semantics for a legacy missing field.
  User.updateOne.mockImplementationOnce(async (_filter, update) => {
    writes.push(update.$set); Object.assign(user, update.$set); return { modifiedCount: 1 };
  });
  const result = await request("/auth/complete-profile", { birthYear: 2008, kullaniciAdi: "replacement", ...valid });
  expect(result.status).toBe(200);
  expect(result.body.user).toMatchObject({ birthYear: 2008, profileComplete: true, kullaniciAdi: "member" });
  expect(writes).toHaveLength(1);
});

it.each(["production", "development"])("logout expires the same cookie in %s without requiring a valid session", async env => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = env;
  try {
    const result = await fetch(base + "/auth/logout", { method: "POST", headers: { Cookie: "token=expired" } });
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    const cookie = result.headers.get("set-cookie");
    expect(cookie).toContain("token=;");
    expect(cookie).toContain("Expires=Thu, 01 Jan 1970");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie.includes("Secure")).toBe(env === "production");
  } finally { process.env.NODE_ENV = previous; }
});
