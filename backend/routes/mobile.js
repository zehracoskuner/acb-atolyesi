import { Router } from 'express';
import ensureAuth from '../middlewares/ensureAuth.js';
import { authLimiter, writeLimiter } from '../middlewares/rateLimiter.js';
import { TERMS_VERSION } from '../config/terms.js';
import legal from '../config/mobileLegal.json' with { type: 'json' };
import { CHAPTER_HISTORY_ENABLED, DEVELOPMENT_COACH_LAUNCH_ENABLED, PLOTWORLD_SCENE_AI_ENABLED } from '../../shared/features.js';
import { validPushToken, verifyMobileEmail, reorderMobileScenes } from '../services/mobile.js';
import PushDevice from '../models/PushDevice.js';
import PushDelivery from '../models/PushDelivery.js';
import jwt from 'jsonwebtoken';
import { hashSession } from '../services/authSession.js';
import { readMobileTool, saveMobileTool } from '../services/mobileTools.js';
const router = Router();
const toolResponse = action => async (req, res, next) => {
  try { res.json({ saved: await action(req) }); }
  catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message, ...(error.current ? { current: error.current } : {}) });
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Alanları ve metin uzunluklarını kontrol et.' });
    next(error);
  }
};
router.get('/tools/:kind/:recordId', ensureAuth, toolResponse(req => readMobileTool(req.user.id, req.params.kind, req.params.recordId, req.query)));
router.post('/tools/:kind', ensureAuth, writeLimiter, toolResponse(req => saveMobileTool(req.user.id, req.params.kind, req.body)));
router.get('/config', (_req, res) => res.json({ termsVersion: TERMS_VERSION, legal,
  features: { chapterHistory: CHAPTER_HISTORY_ENABLED, developmentCoach: DEVELOPMENT_COACH_LAUNCH_ENABLED, sceneAI: PLOTWORLD_SCENE_AI_ENABLED } }));
router.post('/verify-email', authLimiter, async (req, res, next) => {
  try { await verifyMobileEmail(req.body?.token); res.json({ verified: true }); } catch (error) { next(error); }
});
router.post('/plots/:workId/order', writeLimiter, ensureAuth, async (req, res, next) => {
  try { await reorderMobileScenes(req.params.workId, req.user.id, req.body); res.json({ ok: true }); } catch (error) { next(error); }
});
router.post('/push-device', writeLimiter, ensureAuth, async (req, res, next) => {
  try {
    const { token, platform } = req.body || {};
    if (!validPushToken(token) || !['ios', 'android'].includes(platform)) return res.status(400).json({ message: 'Geçersiz cihaz kaydı.' });
    // ensureAuth already verified this exact credential and its revocable session.
    const credential = req.cookies?.token || req.headers.authorization?.slice(7);
    const sessionHash = hashSession(jwt.decode(credential).sid);
    const existing = await PushDevice.findOne({ token });
    if (existing && String(existing.user) !== req.user.id) {
      await PushDelivery.deleteMany({ device: existing._id });
      existing.set({ user: req.user.id, platform, sessionHash, registeredAt: new Date(), scanAt: null }); await existing.save();
    } else await PushDevice.updateOne({ token }, { $set: { user: req.user.id, platform, sessionHash }, $setOnInsert: { registeredAt: new Date() } }, { upsert: true });
    res.json({ ok: true });
  } catch (error) { next(error); }
});
router.delete('/push-device', ensureAuth, async (req, res, next) => {
  try {
    if (!validPushToken(req.body?.token)) return res.status(400).json({ message: 'Geçersiz cihaz kaydı.' });
    const device = await PushDevice.findOneAndDelete({ token: req.body.token, user: req.user.id });
    if (device) await PushDelivery.deleteMany({ device: device._id });
    res.json({ ok: true });
  } catch (error) { next(error); }
});
export default router;
