import { vi } from "vitest";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import AuthSession from "../../models/AuthSession.js";
import { hashSession, passwordFingerprint } from "../../services/authSession.js";

// Only persistence is doubled. Production signature, expiry, account binding,
// password fingerprint and revocation checks still run in the real middleware.
export function sessionStore() {
  const records = new Map();
  vi.spyOn(AuthSession, "create").mockImplementation(async row => { records.set(row.tokenHash, row); return row; });
  vi.spyOn(AuthSession, "deleteOne").mockImplementation(async query => ({ deletedCount: Number(records.delete(query.tokenHash)) }));
  vi.spyOn(AuthSession, "exists").mockImplementation(async query => {
    const row = records.get(query.tokenHash);
    return row && String(row.user) === String(query.user) &&
      row.passwordFingerprint === query.passwordFingerprint && row.expiresAt > query.expiresAt.$gt ? { _id: row.tokenHash } : null;
  });
  return (user, payload = { id: String(user._id) }, options = {}) => {
    const sid = randomBytes(32).toString("hex");
    records.set(hashSession(sid), { tokenHash: hashSession(sid), user: user._id,
      passwordFingerprint: passwordFingerprint(user), expiresAt: new Date(Date.now() + 12 * 3600000) });
    return jwt.sign({ ...payload, sid }, process.env.JWT_SECRET, { expiresIn: "12h", ...options });
  };
}
