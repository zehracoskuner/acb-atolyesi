import { Router } from 'express';
const router = Router();
const missing = res => res.status(503).json({ message: 'Mobile app link association is not configured.' });
router.get('/.well-known/apple-app-site-association', (_req, res) => {
  const team = process.env.MOBILE_APPLE_TEAM_ID;
  if (!/^[A-Z0-9]{10}$/.test(team || '')) return missing(res);
  res.json({ applinks: { apps: [], details: [{ appID: `${team}.com.acbatolyesi.mobile`, paths: ['/mobile-link/*'] }] } });
});
router.get('/.well-known/assetlinks.json', (_req, res) => {
  const fingerprints = (process.env.MOBILE_ANDROID_CERT_SHA256 || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!fingerprints.length || fingerprints.some(s => !/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(s))) return missing(res);
  res.json([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: 'com.acbatolyesi.mobile', sha256_cert_fingerprints: fingerprints } }]);
});
router.get('/mobile-link/:action', (req, res) => {
  if (!['verify', 'reset'].includes(req.params.action)) return res.status(404).send('Bağlantı bulunamadı.');
  const params = new URLSearchParams();
  for (const key of ['token', 'email', 'otp']) if (typeof req.query[key] === 'string' && req.query[key].length <= 320) params.set(key, req.query[key]);
  const link = `acbatolyesi://mobile-link/${req.params.action}?${params}`;
  res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer');
  res.type('html').send(`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ACB Atölyesi — Hesap bağlantısı</title><body><main><h1>ACB Atölyesi</h1><p>Hesap işlemini mobil uygulamada tamamla.</p><p><a href="${link.replaceAll('&', '&amp;')}">Mobil uygulamayı aç</a></p><p>Uygulama yüklü değilse e-postandaki kodu uygulamadaki doğrulama veya şifre sıfırlama ekranına girebilirsin.</p></main></body></html>`);
});
export default router;
