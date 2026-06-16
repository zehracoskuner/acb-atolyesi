// backend/utils/googleUpsert.js
import User from "../models/User.js";

/**
 * Google kimlik bilgileriyle kullanıcı bul veya oluştur.
 * Hem passport-google OAuth callback'i hem de /api/auth/google/mobile endpoint'i kullanır.
 *
 * @param {{ email: string, googleId: string, avatarUrl?: string }} params
 * @returns {Promise<User>}
 */
export async function googleUpsert({ email, googleId, avatarUrl = "" }) {
  // 1. Daha önce Google ile kayıt olmuş mu?
  let user = await User.findOne({ googleId });
  if (user) return user;

  // 2. Aynı e-posta ile local hesap var mı? → Google'ı bağla
  user = await User.findOne({ email });
  if (user) {
    user.googleId      = googleId;
    user.emailVerified = true; // Google doğruladığı için güvenle kabul edilir

    if (user.authProvider === "local") {
      user.authProvider = "both";
    }
    if (avatarUrl && !user.avatarUrl) {
      user.avatarUrl = avatarUrl;
    }

    await user.save();
    return user;
  }

  // 3. Yeni kullanıcı — geçici kullanıcı adı, onboarding sonrası değiştirilir
  const tempBase = `google_${googleId.slice(0, 10)}`;
  const conflict  = await User.findOne({ kullaniciAdi: tempBase });
  const tempName  = conflict ? `${tempBase}_${Date.now().toString(36)}` : tempBase;

  user = await User.create({
    kullaniciAdi:    tempName,
    email,
    googleId,
    sifreHash:       null,
    authProvider:    "google",
    profileComplete: false, // mobil taraf bu flag'e göre kullanıcı adı ekranına yönlendirir
    emailVerified:   true,  // Google zaten doğruladı
    avatarUrl,
  });

  return user;
}
