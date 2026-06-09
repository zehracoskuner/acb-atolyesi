import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/* ─── Genel API limiti ─── */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max:      800,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { message: "Çok fazla istek gönderildi. Lütfen biraz bekle." },
});

/* ─── Auth limiti (brute force koruması) ─── */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { message: "Çok fazla giriş denemesi. 15 dakika sonra tekrar dene." },
  skipSuccessfulRequests: true,
});

/* ─── Kayıt limiti ─── */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      5,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { message: "Bu IP'den çok fazla hesap oluşturuldu. 1 saat sonra tekrar dene." },
});

/* ─── Yazma limiti (yorum, beğeni, günlük) ─── */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      30,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { message: "Çok hızlı işlem yapıyorsun. Biraz bekle." },
});

/* ─── Upload limiti ─── */
// Dosya yükleme pahalı bir işlem — saatte 20 yükleme yeterli
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { message: "Çok fazla dosya yüklendi. 1 saat sonra tekrar dene." },
});

/* ─── AI limiti ─── */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "AI limitine ulaştın. 1 saat sonra tekrar dene." },
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
});