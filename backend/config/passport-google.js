// backend/config/passport-google.js
import "dotenv/config";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { googleUpsert } from "../utils/googleUpsert.js";

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

      const user = await googleUpsert({ email, googleId, avatarUrl });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

export default passport;
