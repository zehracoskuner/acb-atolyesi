// backend/config/passport-google.js
import "dotenv/config";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

function getApiBase() {
  if (process.env.GOOGLE_CALLBACK_BASE_URL) return process.env.GOOGLE_CALLBACK_BASE_URL;
  if (process.env.API_URL) return process.env.API_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api`;
  return "http://localhost:5000/api";
}

const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  `${getApiBase().replace(/\/$/, "")}/auth/google/callback`;

passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  GOOGLE_CALLBACK_URL,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email     = profile.emails?.[0]?.value;
      const googleId  = profile.id;
      const avatarUrl = profile.photos?.[0]?.value || "";

      if (!email) return done(new Error("Google hesabından e-posta alınamadı."));

      // 1. Daha önce Google ile kayıt olmuş mu?
      let user = await User.findOne({ googleId });
      if (user) return done(null, user);

      // 2. Aynı e-posta ile local hesap var mı? → Google'ı bağla
      // Bu adım sayesinde Duplicate Key Error önlenir ve hesaplar birleşir.
      user = await User.findOne({ email });
      if (user) {
        user.googleId      = googleId;
        user.emailVerified = true; // ← Google sağladığı için güvenle doğrulandı kabul ediyoruz
        
        if (user.authProvider === "local") {
          user.authProvider = "both";
        }
        if (avatarUrl && !user.avatarUrl) {
          user.avatarUrl = avatarUrl;
        }
        
        await user.save();
        return done(null, user);
      }

      // 3. Yeni kullanıcı — geçici kullanıcı adı oluşturulur
      const tempBase = `google_${googleId.slice(0, 10)}`;
      const conflict = await User.findOne({ kullaniciAdi: tempBase });
      const tempName = conflict ? `${tempBase}_${Date.now().toString(36)}` : tempBase;

      user = await User.create({
        kullaniciAdi:    tempName,
        email,
        googleId,
        sifreHash:       null,
        authProvider:    "google",
        profileComplete: false,   // ← Kullanıcının onboarding/setup adımından geçmesi gerek
        isemailVerified:   true,    // ← Google zaten doğruladığı için manuel e-posta atılmaz
        avatarUrl,
      });

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

export default passport;
