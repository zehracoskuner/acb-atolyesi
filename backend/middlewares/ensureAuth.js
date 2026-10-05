import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { validWebSession } from "../services/authSession.js";
import { getJwtSecret } from "../config/jwt.js";
import { hasCurrentTerms, TERMS_VERSION } from "../config/terms.js";

function authenticate(optional, allowPending = false) {
  return async (req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    res.vary("Cookie");
    res.vary("Authorization");
    delete req.user;
    // Preserve cookie precedence for browsers; mobile clients use Bearer.
    const header = req.headers.authorization || "";
    const token = req.cookies?.token || (header.startsWith("Bearer ") ? header.slice(7) : null);
    const reject = (status, message) => optional ? next() : res.status(status).json({ message });
    if (!token) return reject(401, "Giriş yapmanız gerekiyor.");
    // Configuration failures are not invalid credentials.
    const secret = getJwtSecret();
    let decoded;
    try {
      decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
      if (!decoded || typeof decoded !== "object" ||
          typeof decoded.id !== "string" || !/^[a-f\d]{24}$/i.test(decoded.id)) {
        return reject(401, "Yetkisiz veya token geçersiz.");
      }
    } catch {
      return reject(401, "Yetkisiz veya token geçersiz.");
    }
    try {
      const user = await User.findById(decoded.id).select("_id email role profileComplete termsVersion termsAcceptedAt birthYear matureAcknowledgements sifreHash").lean();
      if (!user) return reject(401, "Yetkisiz veya token geçersiz.");
      if (!await validWebSession(decoded, user)) return reject(401, "Oturumunuz sona erdi. Lütfen yeniden giriş yapın.");
      req.webSession = !!req.cookies?.token;
      if (user.role === "banned") return reject(403, "Hesabınız askıya alınmış.");
      const profileIncomplete = user.profileComplete === false || !Number.isInteger(user.birthYear);
      if (!allowPending && (!hasCurrentTerms(user) || profileIncomplete)) {
        // Public reads remain available as anonymous reads, without member privileges.
        if (optional) return next();
        return res.status(403).json({
          code: profileIncomplete ? "PROFILE_INCOMPLETE" : "TERMS_ACCEPTANCE_REQUIRED",
          message: profileIncomplete
            ? "Profilinizi tamamlayıp güncel sözleşmeyi kabul edin."
            : "Devam etmek için güncel Kullanıcı Sözleşmesi'ni kabul edin.",
          currentTermsVersion: TERMS_VERSION,
        });
      }
      req.user = { id: String(user._id), email: user.email, role: user.role ?? "user", birthYear: user.birthYear, matureAcknowledgements: user.matureAcknowledgements || [] };
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export const optionalAuth = authenticate(true);
// Only identity/me, profile completion and explicit terms acceptance use this.
export const ensureIdentity = authenticate(false, true);
export default authenticate(false);
