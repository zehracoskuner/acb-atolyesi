// backend/routes/auth.js
import { Router }      from "express";
import bcrypt          from "bcryptjs";
import jwt             from "jsonwebtoken";
import crypto          from "crypto";
import dns             from "dns/promises";
import passport        from "passport";
import { OAuth2Client } from "google-auth-library";
import User            from "../models/User.js";
import ensureAuth      from "../middlewares/ensureAuth.js";
import { googleUpsert } from "../utils/googleUpsert.js";
import { sendVerificationEmail, sendPasswordResetEmail, sendEmailVerifyOtp } from "../services/emailService.js";
import "dotenv/config";

const router   = Router();
const SECRET   = process.env.JWT_SECRET || "atolye-secret-key";
const gClient  = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const SITE_URL =
  process.env.SITE_URL ||
  process.env.CLIENT_URL ||
  (process.env.NODE_ENV === "production" ? "https://xn--acbatlyesi-icb.com" : "http://localhost:5173");

function makeToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role ?? "user" },
    SECRET,
    { expiresIn: "30d" }
  );
}

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try { done(null, await User.findById(id)); }
  catch (err) { done(err); }
});

// ─── Yardımcı: MX kaydı kontrolü ──────────────────────────────────────────
async function hasMxRecord(email) {
  try {
    const domain  = email.split("@")[1];
    const records = await dns.resolveMx(domain);
    return records && records.length > 0;
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════
   GET /api/auth/check-username?q=...
   Kullanıcı adı müsait mi?
═══════════════════════════════════════════ */
router.get("/check-username", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 3)
      return res.json({ available: false, message: "En az 3 karakter olmalı." });

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(q))
      return res.json({ available: false, message: "Sadece harf, rakam ve _ kullanılabilir." });

    const exists = await User.findOne({ kullaniciAdi: q });
    return res.json({
      available: !exists,
      message:   exists ? "Bu kullanıcı adı alınmış." : "Kullanıcı adı müsait!",
    });
  } catch {
    return res.status(500).json({ available: false, message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/auth/register
═══════════════════════════════════════════ */
router.post("/register", async (req, res) => {
  try {
    const { kullaniciAdi, email, sifre } = req.body;

    if (!kullaniciAdi || !email || !sifre)
      return res.status(400).json({ message: "Tüm alanları doldurun." });

    if (sifre.length < 6)
      return res.status(400).json({ message: "Şifre en az 6 karakter olmalı." });

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(kullaniciAdi))
      return res.status(400).json({ message: "Kullanıcı adında geçersiz karakter var (3-30 karakter, harf/rakam/_)." });

    // E-posta format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ message: "Geçersiz e-posta formatı." });

    // MX kaydı kontrolü — domain gerçekten mail sunucusu var mı?
    const mxValid = await hasMxRecord(email);
    if (!mxValid)
      return res.status(400).json({ message: "Bu e-posta adresi geçersiz veya mevcut değil." });

    const exists = await User.findOne({ $or: [{ email }, { kullaniciAdi }] });
    if (exists) {
      const field = exists.email === email ? "E-posta" : "Kullanıcı adı";
      return res.status(409).json({ message: `${field} zaten kullanılıyor.` });
    }

    const sifreHash     = await bcrypt.hash(sifre, 12);
    const verifyToken   = crypto.randomBytes(32).toString("hex");
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await User.create({
      kullaniciAdi,
      email,
      sifreHash,
      authProvider:       "local",
      profileComplete:    true,
      emailVerified:      false,
      emailVerifyToken:   verifyToken,
      emailVerifyExpires: verifyExpires,
    });

    sendVerificationEmail(email, verifyToken).catch(err =>
      console.error("Doğrulama e-postası gönderilemedi:", err.message)
    );

    return res.status(201).json({ message: "Hesap oluşturuldu. Doğrulama e-postası gönderildi." });
  } catch (err) {
    console.error("Register hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/auth/login
═══════════════════════════════════════════ */
router.post("/login", async (req, res) => {
  try {
    const { email, sifre } = req.body;
    if (!email || !sifre)
      return res.status(400).json({ message: "E-posta ve şifre gerekli." });

    const user = await User.findOne({ email });

    if (!user)
      return res.status(401).json({ message: "E-posta veya şifre hatalı." });

    // Google-only kullanıcısı şifreyle giriş yapmaya çalışıyor
    if (!user.sifreHash)
      return res.status(400).json({
        message:  "Bu e-posta adresiyle şifre belirlenmemiş. Google ile giriş yapabilirsin.",
        provider: "google",
      });

    const ok = await bcrypt.compare(sifre, user.sifreHash);
    if (!ok)
      return res.status(401).json({ message: "E-posta veya şifre hatalı." });

    // E-posta doğrulama kontrolü
    if (!user.emailVerified)
      return res.status(403).json({
        code:    "EMAIL_NOT_VERIFIED",
        message: "E-posta adresiniz henüz doğrulanmadı. Lütfen gelen kutunuzu kontrol edin.",
      });

    const token = makeToken(user);
    res.cookie("token", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      token,
      user: {
        _id:             user._id,
        kullaniciAdi:    user.kullaniciAdi,
        email:           user.email,
        avatarUrl:       user.avatarUrl,
        emailVerified:   user.emailVerified,
        authProvider:    user.authProvider,
        profileComplete: user.profileComplete,
        tourCompleted:   user.tourCompleted,
        role:            user.role,
      },
    });
  } catch (err) {
    console.error("Login hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/auth/complete-profile
   Google ile kayıt sonrası kullanıcı adı seçme
═══════════════════════════════════════════ */
router.post("/complete-profile", ensureAuth, async (req, res) => {
  try {
    const { kullaniciAdi } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    if (user.profileComplete) return res.status(400).json({ message: "Profil zaten tamamlanmış." });

    if (!kullaniciAdi || !/^[a-zA-Z0-9_]{3,30}$/.test(kullaniciAdi))
      return res.status(400).json({ message: "Geçerli bir kullanıcı adı gir (3-30 karakter, harf/rakam/_)." });

    const taken = await User.findOne({ kullaniciAdi, _id: { $ne: user._id } });
    if (taken) return res.status(409).json({ message: "Bu kullanıcı adı alınmış." });

    await User.updateOne(
      { _id: user._id },
      { $set: { kullaniciAdi, profileComplete: true } }
    );

    user.kullaniciAdi  = kullaniciAdi;
    user.profileComplete = true;

    const token = makeToken(user);
    return res.json({
      token,
      user: {
        _id:             user._id,
        kullaniciAdi:    user.kullaniciAdi,
        email:           user.email,
        avatarUrl:       user.avatarUrl,
        emailVerified:   user.emailVerified,
        authProvider:    user.authProvider,
        profileComplete: user.profileComplete,
        tourCompleted:   user.tourCompleted,
        role:            user.role,
      },
    });
  } catch (err) {
    console.error("complete-profile hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   GET /api/auth/verify-email?token=...
═══════════════════════════════════════════ */
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: "Token eksik." });

    const user = await User.findOne({
      emailVerifyToken:   token,
      emailVerifyExpires: { $gt: new Date() },
    });

    if (!user)
      return res.redirect(`${SITE_URL}/verify-email?status=invalid`);

    await User.updateOne(
      { _id: user._id },
      {
        $set:   { emailVerified: true },
        $unset: { emailVerifyToken: "", emailVerifyExpires: "" },
      }
    );

    return res.redirect(`${SITE_URL}/verify-email?status=success`);
  } catch (err) {
    console.error("Verify email hatası:", err);
    return res.redirect(`${SITE_URL}/verify-email?status=error`);
  }
});

/* ═══════════════════════════════════════════
   POST /api/auth/resend-verification
═══════════════════════════════════════════ */
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.emailVerified)
      return res.json({ message: "Eğer hesap varsa e-posta gönderildi." });

    const verifyToken   = crypto.randomBytes(32).toString("hex");
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await User.updateOne(
      { _id: user._id },
      { $set: { emailVerifyToken: verifyToken, emailVerifyExpires: verifyExpires } }
    );

    sendVerificationEmail(email, verifyToken).catch(err =>
      console.error("Yeniden doğrulama maili gönderilemedi:", err)
    );

    return res.json({ message: "Doğrulama e-postası tekrar gönderildi." });
  } catch (err) {
    console.error("resend-verification hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/auth/send-verify-otp
   Doğrulanmamış kullanıcıya 6 haneli OTP gönderir.
═══════════════════════════════════════════ */
router.post("/send-verify-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "E-posta gerekli." });

    const user = await User.findOne({ email });
    if (!user || user.emailVerified) {
      // Güvenlik: hesap bulunamasa veya zaten doğrulanmış olsa bile aynı yanıt
      return res.json({ message: "Kod gönderildi." });
    }

    const otp        = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 dakika

    await User.findByIdAndUpdate(
      user._id,
      { $set: { emailVerifyOtp: otp, emailVerifyOtpExpires: otpExpires } },
      { runValidators: false }
    );

    sendEmailVerifyOtp(email, otp).catch(err =>
      console.error("E-posta OTP gönderilemedi:", err.message)
    );

    return res.json({ message: "Doğrulama kodu gönderildi." });
  } catch (err) {
    console.error("send-verify-otp hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/auth/verify-email-otp
   {email, otp} → e-postayı doğrular, token döner.
═══════════════════════════════════════════ */
router.post("/verify-email-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ message: "E-posta ve kod gerekli." });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Geçersiz veya süresi dolmuş kod." });

    if (user.emailVerified) {
      const token = makeToken(user);
      return res.json({ message: "E-posta zaten doğrulanmış.", token, user: user.toSafeJSON() });
    }

    if (
      !user.emailVerifyOtp ||
      user.emailVerifyOtp !== otp ||
      !user.emailVerifyOtpExpires ||
      user.emailVerifyOtpExpires < new Date()
    ) {
      return res.status(400).json({ message: "Geçersiz veya süresi dolmuş kod." });
    }

    await User.findByIdAndUpdate(
      user._id,
      {
        $set:   { emailVerified: true },
        $unset: { emailVerifyOtp: "", emailVerifyOtpExpires: "", emailVerifyToken: "", emailVerifyExpires: "" },
      },
      { runValidators: false }
    );

    user.emailVerified = true;
    const token = makeToken(user);

    return res.json({ token, user: user.toSafeJSON() });
  } catch (err) {
    console.error("verify-email-otp hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/auth/forgot-password
═══════════════════════════════════════════ */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (user) {
      const otp        = String(Math.floor(100000 + Math.random() * 900000));
      const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 dakika

      await User.findByIdAndUpdate(
        user._id,
        { $set: { passwordResetOtp: otp, passwordResetOtpExpires: otpExpires } },
        { runValidators: false }
      );

      sendPasswordResetEmail(email, otp).catch(console.error);
    }

    return res.json({ message: "Eğer bu e-posta kayıtlıysa sıfırlama kodu gönderildi." });
  } catch (err) {
    console.error("forgot-password hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/auth/reset-password
═══════════════════════════════════════════ */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, email, otp, newPassword } = req.body;

    if (!newPassword)
      return res.status(400).json({ message: "Yeni şifre gerekli." });
    if (newPassword.length < 6)
      return res.status(400).json({ message: "Şifre en az 6 karakter olmalı." });

    let user;

    if (email && otp) {
      // OTP flow (mobil / deep-link olmadan)
      user = await User.findOne({
        email,
        passwordResetOtp:        otp,
        passwordResetOtpExpires: { $gt: new Date() },
      });
      if (!user)
        return res.status(400).json({ message: "Geçersiz veya süresi dolmuş kod." });
    } else if (token) {
      // Eski bağlantı flow'u (geriye dönük uyumluluk)
      user = await User.findOne({
        passwordResetToken:   token,
        passwordResetExpires: { $gt: new Date() },
      });
      if (!user)
        return res.status(400).json({ message: "Geçersiz veya süresi dolmuş bağlantı." });
    } else {
      return res.status(400).json({ message: "Doğrulama kodu veya bağlantı gerekli." });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    const updateData = {
      $set:   { sifreHash: hashedNewPassword },
      $unset: {
        passwordResetToken:      "",
        passwordResetExpires:    "",
        passwordResetOtp:        "",
        passwordResetOtpExpires: "",
      },
    };

    if (user.authProvider === "google")
      updateData.$set.authProvider = "both";

    await User.findByIdAndUpdate(user._id, updateData, { runValidators: false });

    return res.json({ message: "Şifren başarıyla güncellendi." });
  } catch (err) {
    console.error("reset-password hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   Google OAuth
═══════════════════════════════════════════ */
router.get("/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get("/google/callback",
  passport.authenticate("google", {
    session:         false,
    failureRedirect: `${SITE_URL}/login?error=google`,
  }),
  (req, res) => {
    const user  = req.user;
    const token = makeToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   30 * 24 * 60 * 60 * 1000,
    });

    // Token URL fragment'ine konur — sunucu loglarına/referrer'a/tarayıcı geçmişine sızmaz.
    const setupQS = !user.profileComplete ? "?setup=1" : "";
    return res.redirect(`${SITE_URL}/auth/callback${setupQS}#token=${encodeURIComponent(token)}`);
  }
);

/* ═══════════════════════════════════════════
   GET /api/auth/me
═══════════════════════════════════════════ */
router.get("/me", ensureAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    return res.json({
      user: {
        _id:             user._id,
        kullaniciAdi:    user.kullaniciAdi,
        email:           user.email,
        avatarUrl:       user.avatarUrl,
        emailVerified:   user.emailVerified,
        authProvider:    user.authProvider,
        profileComplete: user.profileComplete,
        tourCompleted:   user.tourCompleted,
        role:            user.role,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/* ═══════════════════════════════════════════
   POST /api/auth/google/mobile
   Flutter Google Sign-In → idToken doğrulama
═══════════════════════════════════════════ */
router.post("/google/mobile", async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken)
      return res.status(400).json({ message: "idToken gerekli." });

    let payload;
    try {
      const ticket = await gClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ message: "Geçersiz Google token." });
    }

    const email     = payload.email;
    const googleId  = payload.sub;
    const avatarUrl = payload.picture || "";

    if (!email)
      return res.status(400).json({ message: "Google hesabından e-posta alınamadı." });

    const user  = await googleUpsert({ email, googleId, avatarUrl });
    const token = makeToken(user);

    return res.json({
      token,
      user: {
        _id:             user._id,
        kullaniciAdi:    user.kullaniciAdi,
        email:           user.email,
        avatarUrl:       user.avatarUrl,
        emailVerified:   user.emailVerified,
        authProvider:    user.authProvider,
        profileComplete: user.profileComplete,
        tourCompleted:   user.tourCompleted,
        role:            user.role,
      },
    });
  } catch (err) {
    console.error("google/mobile hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;
