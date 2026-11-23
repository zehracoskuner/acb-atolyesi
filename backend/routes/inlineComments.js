import { resolveMentions, notifyMentions } from "../services/mentions.js";
import readerAccess from "../middlewares/readerAccess.js";
// routes/inlineComments.js
import express       from "express";
import mongoose from 'mongoose';
import InlineComment from "../models/InlineComment.js";
import Chapter       from "../models/Chapter.js";
import Work          from "../models/Work.js";
import User          from "../models/User.js";
import ensureAuth    from "../middlewares/ensureAuth.js";
import { publishedDiscussion } from '../services/discussionAccess.js';
import { readerPayload, resolveInlineComment } from '../services/readerContent.js';
import { notifyComment } from '../services/notificationService.js';

const router = express.Router();
router.use(readerAccess);

/* ── GET /inline-comments?chapterId=X ── */
router.get("/", async (req, res) => {
  // Comments can quote prose outside the guest excerpt, including old snapshots.
  if (!req.user) return res.status(401).json({ message: 'Paragraf yorumları için giriş yap.' });
  const { chapterId } = req.query;
  if (!chapterId) return res.status(400).json({ error: "chapterId gerekli" });
  if (!mongoose.isObjectIdOrHexString(chapterId)) return res.status(400).json({ message: 'Geçersiz bölüm kimliği.' });
  try {
    if (!await publishedDiscussion(null, chapterId)) {
      if (req.query.summary === '1' || req.query.page) return res.status(404).json({ message: 'Bölüm bulunamadı.' });
      return res.json({ items: [] }); // Existing unpaged web contract.
    }

    const chapter = await Chapter.findById(chapterId).select('content');
    const { blocks, contentVersion } = readerPayload(chapter);
    if (req.query.contentVersion && req.query.contentVersion !== contentVersion)
      return res.status(409).json({ message: 'Yayınlanan metin değişti. Menüden yeni sürümü kontrol edebilirsin.' });
    const unique = blocks.filter(block => block.text && blocks.filter(other => other.id === block.id).length === 1);
    const attachmentFilters = blocks.filter(b => b.text).map(b => unique.includes(b) ? { blockId: b.id } : { blockId: b.id, contentVersion, paragraphIndex: b.index });
    const filter = { chapterId, status: 'published' };
    if (req.query.summary === '1') {
      const groups = await InlineComment.aggregate([
        { $match: { ...filter, chapterId: chapter._id } }, { $group: { _id: { blockId: '$blockId', contentVersion: '$contentVersion', paragraphIndex: '$paragraphIndex' }, count: { $sum: 1 } } },
      ]);
      const counts = {}; let detachedCount = 0;
      for (const group of groups) {
        const resolved = resolveInlineComment(group._id, blocks, contentVersion);
        if (resolved.attached) counts[resolved.paragraphIndex] = (counts[resolved.paragraphIndex] || 0) + group.count;
        else detachedCount += group.count;
      }
      return res.json({ counts, detachedCount, contentVersion });
    }
    if (req.query.paragraphIndex !== undefined) {
      const index = Number(req.query.paragraphIndex), block = blocks.find(b => b.text && b.index === index);
      if (!Number.isInteger(index) || index < -1) return res.status(400).json({ message: 'Geçersiz paragraf indeksi.' });
      if (index !== -1 && !block) return res.json({ items: [], total: 0, page: 1, pages: 0, contentVersion });
      if (index === -1) { if (attachmentFilters.length) filter.$nor = attachmentFilters; }
      else Object.assign(filter, unique.includes(block) ? { blockId: block.id } : { blockId: block.id, contentVersion, paragraphIndex: index });
    }
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1)), limit = 20;
    const query = InlineComment.find(filter).populate('author', 'kullaniciAdi username avatarUrl').sort({ createdAt: 1, _id: 1 });
    if (req.query.page) query.skip((page - 1) * limit).limit(limit);
    const [items, total] = await Promise.all([query.lean(), InlineComment.countDocuments(filter)]);
    // Unpaged response retained for existing web callers.
    res.json({ items: items.map(item => resolveInlineComment(item, blocks, contentVersion)), total, page, pages: Math.ceil(total / limit), contentVersion });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    res.status(500).json({ error: "İşlem tamamlanamadı." });
  }
});

/* ── POST /inline-comments ── */
router.post("/", ensureAuth, async (req, res) => {
  const { workId, chapterId, paragraphIndex, content } = req.body;
  if (!workId || !chapterId || paragraphIndex == null || typeof content !== 'string' || !content.trim())
    return res.status(400).json({ error: "workId, chapterId, paragraphIndex ve content gerekli" });
  if (![workId, chapterId].every(mongoose.isObjectIdOrHexString)) return res.status(400).json({ message: 'Geçersiz kimlik.' });
  try {
    if (typeof content !== 'string' || content.trim().length > 1000 || !Number.isInteger(Number(paragraphIndex)) || Number(paragraphIndex) < 0) {
      return res.status(400).json({ error: 'Geçersiz yorum.' });
    }
    const chapter = await Chapter.findById(chapterId);
    if (!chapter || String(chapter.work) !== String(workId) || chapter.status !== 'published' || chapter.moderationHold ||
        !await Work.exists({ _id: workId, status: 'published', publishedChapterIds: chapter._id })) {
      return res.status(404).json({ error: 'Bölüm bulunamadı.' });
    }
    const dbUser = await User.findById(req.user.id).select("commentBanned").lean();
    if (dbUser?.commentBanned)
      return res.status(403).json({ message: "Yorum yapma yetkiniz kısıtlanmış." });

    const { blocks, contentVersion } = readerPayload(chapter);
    const block = blocks.find(b => b.index === Number(paragraphIndex) && b.text);
    if (!block || (req.body.blockId && req.body.blockId !== block.id) || (req.body.contentVersion && req.body.contentVersion !== contentVersion))
      return res.status(409).json({ message: 'Yayınlanan metin değişti. Yeni sürümü açıp pasajı tekrar seç.' });
    const mentions = await resolveMentions(content.trim());
    const doc = await InlineComment.create({
      mentions,
      workId,
      chapterId,
      paragraphIndex: Number(paragraphIndex),
      // Old clients cannot prove which publication their index refers to.
      ...(req.body.blockId && req.body.contentVersion ? { blockId: block.id, paragraphText: block.text, contentVersion } : {}),
      content: content.trim(),
      author: req.user.id,
    });
    const populated = await doc.populate("author", "kullaniciAdi username avatarUrl");
    const work = await Work.findById(workId).select('user').lean();
    const ownerId = work?.user?.toString();
    if (ownerId && ownerId !== String(req.user.id) && !mentions.some(mention => String(mention.user) === ownerId)) {
      await notifyComment({ senderId: req.user.id, workId, chapterId, commentPreview: doc.content })
        .catch(error => console.error('inline notifyComment:', error.message));
    }
    await notifyMentions({ senderId: req.user.id, mentions, workId, chapterId }).catch(console.error);
    const item = populated.toObject(); delete item.reviewNote;
    res.status(201).json({ item });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    res.status(500).json({ error: "İşlem tamamlanamadı." });
  }
});

/* ── PATCH /inline-comments/:id ── (sadece kendi yorumunu düzenleyebilir) */
router.patch("/:id", ensureAuth, async (req, res) => {
  try {
    const doc = await InlineComment.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Bulunamadı" });
    if (String(doc.author) !== String(req.user.id))
      return res.status(403).json({ error: "Yetkisiz" });

    const { content } = req.body;
    if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: "İçerik boş olamaz" });
    if (doc.status !== 'published' || !await publishedDiscussion(doc.workId, doc.chapterId))
      return res.status(404).json({ message: 'İçerik bulunamadı.' });
    if (content.trim().length > 1000) return res.status(400).json({ error: "1000 karakter limiti" });

    const previous = doc.mentions || [];
    doc.mentions = await resolveMentions(content.trim());
    doc.content = content.trim();
    await doc.save();
    await doc.populate("author", "kullaniciAdi username avatarUrl");
    await notifyMentions({ senderId: req.user.id, mentions: doc.mentions, previous, workId: doc.workId, chapterId: doc.chapterId }).catch(console.error);
    const item = doc.toObject(); delete item.reviewNote;
    res.json({ item });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    res.status(500).json({ error: "İşlem tamamlanamadı." });
  }
});

/* ── DELETE /inline-comments/:id ── (sadece kendi yorumunu silebilir) */
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const doc = await InlineComment.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Bulunamadı" });
    if (String(doc.author) !== String(req.user.id))
      return res.status(403).json({ error: "Yetkisiz" });
    await doc.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    res.status(500).json({ error: "İşlem tamamlanamadı." });
  }
});

/* ── POST /inline-comments/:id/report ── */
router.post("/:id/report", ensureAuth, async (req, res) => {
  try {
    const doc = await InlineComment.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Bulunamadı" });
    if (String(doc.author) === String(req.user.id))
      return res.status(400).json({ error: "Kendi yorumunu şikayet edemezsin" });
    if (doc.status && doc.status !== "published")
      return res.status(400).json({ error: "Bu yorum zaten inceleme altında" });

    doc.status     = "pending_review";
    doc.reviewNote = req.body.reason?.trim() || "Kullanıcı şikayeti";
    await doc.save();
    res.json({ message: "Şikayetin alındı." });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    res.status(500).json({ error: "İşlem tamamlanamadı." });
  }
});

export default router;
