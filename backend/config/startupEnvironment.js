import { getJwtSecret } from "./jwt.js";
import { allowedOrigins } from "../middlewares/cookieOrigin.js";

export function validateStartupEnvironment() {
  const secret = getJwtSecret();
  allowedOrigins();
  if (process.env.NODE_ENV !== "production") return;
  if (Buffer.byteLength(secret) < 32 || /^(<|change.?me|your[-_])/i.test(secret)) throw new Error("Production JWT_SECRET must contain at least 32 bytes of non-placeholder secret material.");
  for (const name of ["MONGO_URI", "ADMIN_SECRET_PATH", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "RESEND_API_KEY", "EMAIL_FROM"]) {
    if (!process.env[name]?.trim() || process.env[name].includes("<")) throw new Error(`Production requires ${name}.`);
  }
  if (!/^mongodb(?:\+srv)?:\/\/[^\s]+$/.test(process.env.MONGO_URI)) throw new Error("MONGO_URI must be a MongoDB URI.");
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(process.env.ADMIN_SECRET_PATH)) throw new Error("ADMIN_SECRET_PATH must be a single route segment.");
  // Explicit API/callback URLs avoid localhost/platform-domain fallback in production.
  for (const name of ["API_URL", "GOOGLE_CALLBACK_URL"]) {
    let url;
    try { url = new URL(process.env[name]); } catch { throw new Error(`Production requires a valid ${name}.`); }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || /^(localhost|127\.|\[::1\])/.test(url.hostname)) throw new Error(`${name} must use a public HTTPS URL.`);
  }
  if (process.env.PORT && (!/^\d+$/.test(process.env.PORT) || +process.env.PORT < 1 || +process.env.PORT > 65535)) throw new Error("PORT must be between 1 and 65535.");
}
