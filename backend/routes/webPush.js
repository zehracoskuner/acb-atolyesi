import { Router } from 'express';
import auth from '../middlewares/ensureAuth.js';
import Subscription from '../models/WebPushSubscription.js';
import { webPushConfig, validateSubscription } from '../services/webPush.js';
const router = Router();
router.use(auth);
router.get('/config', (req, res) => {
  const config = webPushConfig();
  res.json({ enabled: !!config, publicKey: config?.publicKey || null });
});
router.post('/subscribe', async (req, res, next) => {
  try {
    if (!webPushConfig()) return res.status(503).json({ message: 'Tarayıcı bildirimleri henüz etkinleştirilmedi.' });
    const value = validateSubscription(req.body);
    const existing = await Subscription.findOne({ endpoint: value.endpoint });
    const sameSession = existing && existing.sessionHash === req.sessionHash && String(existing.user) === req.user.id;
    const now = new Date();
    await Subscription.findOneAndUpdate({ endpoint: value.endpoint }, { $set: {
      ...value, user: req.user.id, sessionHash: req.sessionHash,
      ...(!sameSession ? { registeredAt: now, scanAt: now } : {}),
    } }, { upsert: true, runValidators: true });
    res.json({ ok: true });
  } catch (error) { next(error); }
});
router.post('/unsubscribe', async (req, res, next) => {
  try {
    if (typeof req.body?.endpoint !== 'string') return res.status(400).json({ message: 'Abonelik adresi gerekli.' });
    await Subscription.deleteOne({ endpoint: req.body.endpoint, user: req.user.id });
    res.json({ ok: true });
  } catch (error) { next(error); }
});
export default router;
