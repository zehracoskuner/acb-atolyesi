import readerAccess from "../middlewares/readerAccess.js";
// routes/inlineComments.js
import express       from "express";
import InlineComment from "../models/InlineComment.js";
import Chapter       from "../models/Chapter.js";
import Work          from "../models/Work.js";
import User          from "../models/User.js";
import ensureAuth    from "../middlewares/ensureAuth.js";
import { publishedDiscussion } from '../services/discussionAccess.js';

const router = express.Router();
router.use(readerAccess);

/* ── GET /inline-comments?chapterId=X ── */
router.get("/", async (req, res) => {
  const { chapterId } = req.query;
  if (!chapterId) return res.status(400).json({ error: "chapterId gerekli" });
  try {
    if (!await publishedDiscussion(null, chapterId)) return res.json({ items: [] });

    const items = await InlineComment.find({ chapterId, status: { $ne: "rejected" } })
      .populate("author", "kullaniciAdi username avatarUrl")
      .sort({ paragraphIndex: 1, createdAt: 1 })
      .lean();
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: "İşlem tamamlanamadı." });
  }
});

/* ── POST /inline-comments ── */
router.post("/", ensureAuth, async (req, res) => {
  const { workId, chapterId, paragraphIndex, content } = req.body;
  if (!workId || !chapterId || paragraphIndex == null || typeof content !== 'string' || !content.trim())
    return res.status(400).json({ error: "workId, chapterId, paragraphIndex ve content gerekli" });
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

    const doc = await InlineComment.create({
      workId,
      chapterId,
      paragraphIndex: Number(paragraphIndex),
      content: content.trim(),
      author: req.user.id,
    });
    const populated = await doc.populate("author", "kullaniciAdi username avatarUrl");
    res.status(201).json({ item: populated });
  } catch (e) {
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
    if (!content?.trim()) return res.status(400).json({ error: "İçerik boş olamaz" });
    if (content.trim().length > 1000) return res.status(400).json({ error: "1000 karakter limiti" });

    doc.content = content.trim();
    await doc.save();
    await doc.populate("author", "kullaniciAdi username avatarUrl");
    res.json({ item: doc });
  } catch (e) {
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
    res.status(500).json({ error: "İşlem tamamlanamadı." });
  }
});

export default router;
