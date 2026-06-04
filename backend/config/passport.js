import "dotenv/config";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";

const SITE_URL = process.env.SITE_URL || "http://localhost:5173";

passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  `${process.env.API_URL || "http://localhost:5000/api"}/auth/google/callback`,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error("Google hesabından e-posta alınamadı."));

      let user = await User.findOne({ email });

      if (!user) {
        user = await User.create({
          kullaniciAdi: profile.displayName?.replace(/\s+/g, "") || `yazar${Date.now()}`,
          email,
          sifreHash:    await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
          googleId:     profile.id,
          avatarUrl:    profile.photos?.[0]?.value || "",
          emailVerified: true,
        });
      } else if (!user.googleId) {
        user.googleId      = profile.id;
        user.emailVerified = true;
        if (!user.avatarUrl && profile.photos?.[0]?.value) {
          user.avatarUrl = profile.photos[0].value;
        }
        await user.save();
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try { done(null, await User.findById(id)); }
  catch (err) { done(err); }
});

export default passport;