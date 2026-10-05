import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import AuthSession from "../models/AuthSession.js";
import { getJwtSecret } from "../config/jwt.js";

export const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
export const hashSession = value => crypto.createHash("sha256").update(value).digest("hex");
export const passwordFingerprint = user => hashSession(user.sifreHash || "no-password");

async function issueSession(user, seconds) {
  const sid = crypto.randomBytes(32).toString("hex");
  await AuthSession.create({ tokenHash: hashSession(sid), user: user._id,
    passwordFingerprint: passwordFingerprint(user), expiresAt: new Date(Date.now() + seconds * 1000) });
  return jwt.sign({ id: String(user._id), sid }, getJwtSecret(), { expiresIn: seconds });
}

// Native clients must use a persisted, revocable session too. No refresh/legacy bypass.
export const createNativeSession = user => issueSession(user, 12 * 3600);

export async function createWebSession(req, res, user, rememberMe) {
  const seconds = rememberMe === true ? 30 * 86400 : 12 * 3600;
  await revokeWebSession(req.cookies?.token);
  const token = await issueSession(user, seconds);
  res.cookie("token", token, { ...cookieOptions(), ...(rememberMe === true ? { maxAge: seconds * 1000 } : {}) });
  res.set("Cache-Control", "no-store");
}

export async function revokeWebSession(token) {
  if (!token) return;
  let payload;
  try { payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"], ignoreExpiration: true }); }
  catch { return; }
  if (typeof payload.sid === "string") await AuthSession.deleteOne({ tokenHash: hashSession(payload.sid) });
}

export async function validWebSession(payload, user) {
  if (typeof payload.sid !== "string" || !/^[a-f0-9]{64}$/.test(payload.sid)) return false;
  return !!await AuthSession.exists({ tokenHash: hashSession(payload.sid), user: user._id,
    passwordFingerprint: passwordFingerprint(user), expiresAt: { $gt: new Date() } });
}

export function startGoogleSession(req, res, next) {
  const nonce = crypto.randomBytes(32).toString("hex");
  const state = jwt.sign({ nonce, rememberMe: req.query.rememberMe === "true", purpose: "google-login" }, getJwtSecret(), { expiresIn: "10m" });
  res.cookie("oauth_state", state, { ...cookieOptions(), maxAge: 600000 });
  req.googleState = nonce;
  next();
}

export function verifyGoogleSession(req, res, next) {
  res.clearCookie("oauth_state", cookieOptions());
  try {
    const state = jwt.verify(req.cookies?.oauth_state, getJwtSecret(), { algorithms: ["HS256"] });
    if (state.purpose !== "google-login" || typeof req.query.state !== "string" || state.nonce !== req.query.state) throw new Error("Invalid state");
    req.rememberMe = state.rememberMe === true;
    next();
  } catch { res.status(400).send("Google giriş isteğinin süresi doldu veya doğrulanamadı. Lütfen yeniden giriş yapın."); }
}
