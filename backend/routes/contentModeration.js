import { Router } from 'express';
import ContentCase from '../models/ContentCase.js';
import ImageAsset from '../models/ImageAsset.js';
import VisualAccount from '../models/VisualAccount.js';
import Report from '../models/Report.js';
import Chapter from '../models/Chapter.js';
import { decideContent, manualVisualBlock } from '../services/contentModeration.js';
import requireRole from '../middlewares/requireRole.js';
import uploadOrigin from '../middlewares/uploadOrigin.js';
const router = Router();
const staffOnly = requireRole('admin', 'moderator');
const handle = fn => async (req, res) => { try { await fn(req, res); } catch (e) { res.status(e.status || (e.name === 'CastError' ? 400 : 500)).json({ message: e.status ? e.message : 'İşlem tamamlanamadı.' }); } };
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/cases', staffOnly, handle(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const filter = ['pending', 'removed', 'dismissed', 'reversed'].includes(req.query.status) ? { status: req.query.status } : {};
  res.json({ items: await ContentCase.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * 30).limit(30).lean() });
}));
router.get('/cases/:id', staffOnly, handle(async (req, res) => {
  const item = await ContentCase.findById(req.params.id).select('+snapshot').lean();
  if (!item) return res.status(404).json({ message: 'İnceleme bulunamadı.' });
  const complaints = await Report.find({ contentCase: item._id }).select('reason description createdAt').limit(100).lean();
  const asset = item.asset ? await ImageAsset.findById(item.asset).lean() : null;
  const current = item.kind === 'chapter' ? await Chapter.findById(item.target).select('title content revision status moderationHold').lean() : null;
  const involved = String(item.owner) === String(req.user.id) || !!await Report.exists({ contentCase: item._id, reporter: req.user.id });
  res.json({ item, complaints, asset, current, canDecide: !involved });
}));
router.get('/cases/:id/evidence', staffOnly, handle(async (req, res) => {
  const item = await ContentCase.findById(req.params.id);
  const asset = item?.asset && await ImageAsset.findById(item.asset).select('+bytes');
  if (!asset?.bytes) return res.status(404).json({ message: 'Özel görsel kanıtı bulunmuyor.' });
  const mime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(asset.mime) ? asset.mime : 'application/octet-stream';
  res.set('X-Content-Type-Options', 'nosniff').type(mime).send(asset.bytes);
}));
router.post('/cases/:id/decision', uploadOrigin, staffOnly, handle(async (req, res) => res.json(await decideContent(req.params.id, req.user, req.body))));
router.get('/users/:id/images', staffOnly, handle(async (req, res) => res.json({ item: await VisualAccount.findById(req.params.id).lean() })));
router.post('/users/:id/images/block', uploadOrigin, staffOnly, handle(async (req, res) => res.json(await manualVisualBlock(req.user, req.params.id, req.body))));
export default router;
