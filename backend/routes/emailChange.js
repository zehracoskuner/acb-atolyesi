import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import EmailChange from '../models/EmailChange.js';
import ensureAuth from '../middlewares/ensureAuth.js';
import { getJwtSecret } from '../config/jwt.js';
import { passwordFingerprint } from '../services/authSession.js';
import { sendMail } from '../services/emailService.js';

const router = express.Router();
const hash = value => createHash('sha256').update(value).digest('hex');
const codeHash = (id, code) => createHmac('sha256', getJwtSecret()).update(`${id}:${code}`).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), { status });
const errorReply = (res, error) => res.status(error.code === 11000 ? 409 : error.status || 503).json({
  message: error.code === 11000 ? 'Bu e-posta adresi zaten kullanılıyor.' : error.status ? error.message : 'İşlem tamamlanamadı. Mevcut e-posta adresin korundu; tekrar dene.',
});
const attemptLimiter = rateLimit({ windowMs: 15 * 60000, max: 100, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => req.user?.id || ipKeyGenerator(req.ip), message: { message: 'Çok fazla deneme. Biraz sonra tekrar dene.' } });
const sendLimiter = rateLimit({ windowMs: 3600000, max: 10, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => req.user.id, message: { message: 'Saatlik kod gönderme sınırına ulaştın. Daha sonra tekrar dene.' } });

async function confirm(pending) {
  // Consume once before changing the address. Both device OTP and browser link share this gate.
  const consumed = await EmailChange.findOneAndDelete({ _id: pending._id, requestId: pending.requestId,
    expiresAt: { $gt: new Date() }, attempts: { $lte: 5 } });
  if (!consumed) throw fail(400, 'Bu istek kullanılmış veya süresi dolmuş. Yeni kod iste.');
  const account = await User.findById(consumed.user);
  if (!account || consumed.sessionFingerprint !== passwordFingerprint(account)) throw fail(409, 'Hesap güvenliği değişti. Yeniden giriş yapıp yeni kod iste.');
  const user = await User.findOneAndUpdate({ _id: consumed.user, email: consumed.from, sifreHash: account.sifreHash }, {
    $set: { email: consumed.to, emailVerified: true },
    $unset: { emailVerifyToken: '', emailVerifyExpires: '', emailVerifyOtp: '', emailVerifyOtpExpires: '',
      passwordResetToken: '', passwordResetExpires: '', passwordResetOtp: '', passwordResetOtpExpires: '' },
  }, { new: true, runValidators: true });
  if (!user) throw fail(409, 'Hesap adresi bu sırada değişti. Yeni bir istek başlat.');
  return user;
}

const page = (res, html) => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" });
  return res.type('html').send(`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ACB Atölyesi</title><body><main><h1>ACB Atölyesi</h1>${html}</main></body></html>`);
};
// Existing web settings also receive a usable confirmation link, without changing the frontend.
// GET deliberately does not consume the token: mail scanners must not change the account.
router.get('/email-change/confirm', attemptLimiter, (req, res) => {
  const token = req.query.token;
  if (typeof token !== 'string' || !/^[a-f\d]{64}$/.test(token)) return page(res.status(400), '<p>Geçersiz bağlantı.</p>');
  return page(res, `<p>Yeni e-posta adresini hesabına bağlamak için onayla. Bağlantı 15 dakika geçerlidir.</p><form method="post"><input type="hidden" name="token" value="${token}"><button type="submit">E-posta değişikliğini onayla</button></form>`);
});
router.post('/email-change/confirm', attemptLimiter, express.urlencoded({ extended: false, limit: '2kb' }), async (req, res) => {
  try {
    if (typeof req.body.token !== 'string' || !/^[a-f\d]{64}$/.test(req.body.token)) throw fail(400, 'Geçersiz bağlantı.');
    const pending = await EmailChange.findOne({ tokenHash: hash(req.body.token), expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } });
    if (!pending) throw fail(400, 'Bağlantı kullanılmış veya süresi dolmuş. Uygulamadan yeni kod iste.');
    await confirm(pending);
    return page(res, '<p>E-posta adresin doğrulandı ve güncellendi. Uygulamaya veya web sitesine dönebilirsin.</p>');
  } catch (error) {
    return page(res.status(error.code === 11000 ? 409 : error.status || 503), '<p>Adres güncellenemedi. Mevcut adresin korundu. Uygulamadan yeni bir istek başlat.</p>');
  }
});

router.get('/email-change', ensureAuth, async (req, res) => {
  try {
    const [pending, user] = await Promise.all([EmailChange.findOne({ user: req.user.id, expiresAt: { $gt: new Date() } }), User.findById(req.user.id)]);
    res.set('Cache-Control', 'no-store').json({ hasPassword: !!user?.sifreHash, pending: pending ? { email: pending.to, expiresAt: pending.expiresAt, resendAt: new Date(+pending.sentAt + 60000), locked: pending.attempts >= 5 } : null });
  } catch (error) { errorReply(res, error); }
});
router.patch('/change-email', ensureAuth, sendLimiter, async (req, res) => {
  let requestId;
  try {
    const email = typeof req.body.newEmail === 'string' ? req.body.newEmail.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, 'Geçerli bir e-posta adresi gir.');
    const user = await User.findById(req.user.id);
    if (!user) throw fail(404, 'Kullanıcı bulunamadı.');
    if (user.email === email) throw fail(400, 'Yeni adres mevcut adresinden farklı olmalı.');
    if (user.sifreHash && (typeof req.body.currentPassword !== 'string' || !await bcrypt.compare(req.body.currentPassword, user.sifreHash))) throw fail(400, 'Mevcut şifreni doğru gir.');
    if (await User.exists({ email })) throw fail(409, 'Bu e-posta adresi zaten kullanılıyor.');
    requestId = randomUUID(); const code = String(randomInt(0, 1000000)).padStart(6, '0'); const token = randomBytes(32).toString('hex'); const now = new Date();
    let pending;
    try {
      pending = await EmailChange.findOneAndUpdate({ user: user._id, sentAt: { $lte: new Date(+now - 60000) } }, {
        $set: { requestId, from: user.email, to: email, codeHash: codeHash(requestId, code), tokenHash: hash(token), sessionFingerprint: passwordFingerprint(user), attempts: 0, sentAt: now, expiresAt: new Date(+now + 15 * 60000) },
      }, { upsert: true, new: true, runValidators: true });
    } catch (error) { if (error.code === 11000) throw fail(429, 'Yeni kod istemeden önce 60 saniye bekle.'); throw error; }
    const rawBase = process.env.API_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api` : process.env.NODE_ENV !== 'production' ? 'http://localhost:5000/api' : '');
    const base = new URL(rawBase);
    if (!['https:', 'http:'].includes(base.protocol) || (process.env.NODE_ENV === 'production' && base.protocol !== 'https:') || base.username || base.password || base.search || base.hash) throw new Error('Invalid API_URL');
    const link = `${base.toString().replace(/\/$/, '')}/user/email-change/confirm?token=${token}`;
    await sendMail({ to: email, subject: 'Yeni e-posta adresini doğrula — ACB Atölyesi',
      text: `E-posta değiştirme kodun: ${code}. 15 dakika geçerlidir. Mevcut adresin onayına kadar korunur. Uygulamada kodu gir veya bu bağlantıyı açıp onayla: ${link}. İsteği sen yapmadıysan görmezden gel.`,
      html: `<h1>Yeni e-posta adresini doğrula</h1><p>Doğrulama kodun: <strong>${code}</strong></p><p>Kod 15 dakika geçerlidir. Mevcut adresin onayına kadar korunur.</p><p><a href="${link.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">E-posta değişikliğini onayla</a></p><p>İsteği sen yapmadıysan görmezden gel.</p>` });
    res.status(202).json({ verificationRequired: true, user: user.toSafeJSON(), pending: { email, expiresAt: pending.expiresAt, resendAt: new Date(+now + 60000), locked: false }, message: 'Yeni adresine kod ve onay bağlantısı gönderildi. Onaylayana kadar mevcut adresin korunur.' });
  } catch (error) {
    // Delivery failures must never change the login address or leave a falsely sent code.
    if (requestId) await EmailChange.deleteOne({ user: req.user.id, requestId }).catch(() => {});
    errorReply(res, error);
  }
});
router.post('/email-change/verify', ensureAuth, attemptLimiter, async (req, res) => {
  try {
    if (typeof req.body.otp !== 'string' || !/^\d{6}$/.test(req.body.otp)) throw fail(400, '6 haneli kodu gir.');
    const pending = await EmailChange.findOneAndUpdate({ user: req.user.id, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } }, { new: true });
    if (!pending) throw fail(400, 'Kodun süresi veya deneme hakkın doldu. Yeni kod iste.');
    if (pending.codeHash !== codeHash(pending.requestId, req.body.otp)) throw fail(400, 'Kod doğru değil. En fazla 5 deneme yapabilirsin.');
    const user = await confirm(pending); res.json({ user: user.toSafeJSON(), message: 'Yeni e-posta adresin doğrulandı ve kaydedildi.' });
  } catch (error) { errorReply(res, error); }
});
router.delete('/email-change', ensureAuth, async (req, res) => {
  try { await EmailChange.deleteOne({ user: req.user.id }); res.json({ message: 'E-posta değişikliği iptal edildi.' }); }
  catch (error) { errorReply(res, error); }
});
export default router;
