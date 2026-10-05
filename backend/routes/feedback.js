import { Router } from 'express';
import mongoose from 'mongoose';
import Feedback from '../models/Feedback.js';
import requireRole from '../middlewares/requireRole.js';
import { writeLimiter } from '../middlewares/rateLimiter.js';
import { textField } from '../services/reportWorkflow.js';

const router = Router();
router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  return req.user ? next() : res.status(401).json({ message: 'Giriş gerekli.' });
});
const handle = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (e) { res.status(e.status || 500).json({ message: e.status ? e.message : 'İşlem tamamlanamadı.' }); }
};
router.post('/', writeLimiter, handle(async (req, res) => {
  const { kind, subject, message } = req.body;
  if (!['suggestion', 'complaint'].includes(kind)) return res.status(400).json({ message: 'Öneri veya şikâyet seçin.' });
  const item = await Feedback.create({ author: req.user.id, kind, subject: textField(subject, 160), message: textField(message, 4000) });
  res.status(201).json({ id: item._id, status: item.status });
}));
router.get('/', requireRole('admin'), handle(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const filter = {};
  if (req.query.status && req.query.status !== 'all') {
    if (!['new', 'reviewing', 'closed'].includes(req.query.status)) return res.status(400).json({ message: 'Geçersiz durum.' });
    filter.status = req.query.status;
  }
  if (req.query.kind && req.query.kind !== 'all') {
    if (!['suggestion', 'complaint'].includes(req.query.kind)) return res.status(400).json({ message: 'Geçersiz tür.' });
    filter.kind = req.query.kind;
  }
  const [items, total] = await Promise.all([
    Feedback.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 20).limit(20).populate('author', 'kullaniciAdi email').lean(),
    Feedback.countDocuments(filter),
  ]);
  res.json({ items, total, pages: Math.ceil(total / 20) });
}));
router.patch('/:id', requireRole('admin'), handle(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !['new', 'reviewing', 'closed'].includes(req.body.status)) return res.status(400).json({ message: 'Geçersiz işlem.' });
  const item = await Feedback.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status, handledBy: req.user.id } }, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ message: 'Geri bildirim bulunamadı.' });
  res.json({ id: item._id, status: item.status });
}));
export default router;
