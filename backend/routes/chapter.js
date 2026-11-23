import readerAccess from "../middlewares/readerAccess.js";
import { chapterReview } from "../services/chapterReview.js";
// backend/routes/chapter.js
import express      from "express";
import ensureAuth   from "../middlewares/ensureAuth.js";
import Chapter      from "../models/Chapter.js";
import Work         from "../models/Work.js";
import Notification from "../models/Notification.js";
import User         from "../models/User.js";
import { sendStaffMail } from "../services/emailService.js";
import ChapterVersion from "../models/ChapterVersion.js";
import { ownedChapter, saveChapterVersion, createChapterVersion, markChapterCheckpoint, updateChapterOrder } from "../services/chapterHistory.js";

import { readDevelopment } from "../services/developmentProgress.js";
import { runDevelopmentCoach, readLatestDevelopment, listDevelopmentAnalyses } from "../services/developmentCoach.js";
import { aiLimiter } from "../middlewares/rateLimiter.js";
import { deleteLikedChapter } from "../services/likes.js";
import { ownerChapter, publishChapterVersion } from "../services/chapterPublication.js";
import { CHAPTER_HISTORY_ENABLED, DEVELOPMENT_COACH_LAUNCH_ENABLED } from "../../shared/features.js";

const router = express.Router();
router.use(readerAccess);
router.use(/^\/development(?=\/|$)/, ensureAuth, (_req, res, next) => {
  if (!DEVELOPMENT_COACH_LAUNCH_ENABLED) return res.status(503).json({ code: "DEVELOPMENT_COMING_SOON", message: "Gelişim Koçu beta aşamasında. Çok yakında." });
  next();
});
router.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
router.use((req, res, next) => {
  if (!CHAPTER_HISTORY_ENABLED && /^\/[^/]+\/(versions(?:\/|$)|checkpoint(?:\/|$))/i.test(req.path))
    return res.status(404).json({ message: "Bu özellik henüz kullanıma açık değil." });
  next();
});

async function assertWorkOwner(workId, userId) {
  const work = await Work.findOne({ _id: workId, user: userId });
  if (!work) throw Object.assign(new Error("Erişim reddedildi."), { status: 403 });
  return work;
}

async function notifyAuthor({ userId, workId, type, text }) {
  try {
    await Notification.create({ recipient: userId, sender: null, type, work: workId, text, read: false });
  } catch (err) { console.error("Bildirim oluşturulamadı:", err.message); }
}

async function notifyStaff({ workId, type, text }) {
  try {
    const staff = await User.find({ role: { $in: ["admin", "moderator"] } }).select("_id").lean();
    await Promise.all(
      staff.map(u =>
        Notification.create({ recipient: u._id, sender: null, type, work: workId, text, read: false })
      )
    );
  } catch (err) { console.error("Staff bildirimi oluşturulamadı:", err.message); }
}


// ════════════════════════════════════════════
// 1. BÖLÜMLERİ GETİR — GET /api/chapters?workId=...
// ════════════════════════════════════════════
router.get("/", ensureAuth, async (req, res) => {
  try {
    const { workId } = req.query;
    const userId = req.user?.id || req.userId;
    if (!workId) return res.status(400).json({ message: "workId gerekli." });
    await assertWorkOwner(workId, userId);
    const chapters = await Chapter.find({ work: workId })
      .select("_id title order status reviewStatus hasUnpublishedChanges +draftContent")
      .sort({ order: 1 });
    res.json({ items: chapters.map(ch => ({ _id: ch._id, title: ownerChapter(ch).title, order: ch.order, status: ch.status, reviewStatus: ch.reviewStatus, hasUnpublishedChanges: ch.hasUnpublishedChanges })) });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.status && err.status < 500 ? err.message : "Bölümler yüklenemedi." });
  }
});

// ════════════════════════════════════════════
// 2. TEK BÖLÜM GETİR — GET /api/chapters/:id
// ════════════════════════════════════════════
router.get("/development/:workId", ensureAuth, async (req, res) => {
  try { res.json(await readDevelopment({ workId: req.params.workId, userId: req.user?.id || req.userId })); }
  catch (err) { historyError(res, err); }
});

router.get("/development/:workId/latest", ensureAuth, async (req, res) => {
  try { res.json(await readLatestDevelopment({ workId: req.params.workId, userId: req.user?.id || req.userId })); }
  catch (err) { historyError(res, err); }
});
router.get("/development/:workId/analyses", ensureAuth, async (req, res) => {
  try { res.json(await listDevelopmentAnalyses({ workId: req.params.workId, userId: req.user.id,
    before: req.query.before === undefined ? undefined : Number(req.query.before) })); }
  catch (err) { historyError(res, err); }
});

router.post("/development/:workId", ensureAuth, aiLimiter, async (req, res) => {
  try { res.json(await runDevelopmentCoach({ workId: req.params.workId, userId: req.user?.id || req.userId })); }
  catch (err) {
    if (err.retryAfter) res.set("Retry-After", String(err.retryAfter));
    res.status(err.status || 503).json({ code: err.code || "DEVELOPMENT_UNAVAILABLE", message: err.status ? err.message : "Gelişim değerlendirmesi hazırlanamadı. Hakkın ve yeni yazıların korunuyor.", ...(err.quota ? { quota: err.quota, retryAfter: err.retryAfter } : {}) });
  }
});

router.get("/:id", ensureAuth, async (req, res) => {
  try {
    const userId  = req.user?.id || req.userId;
    const chapter = await Chapter.findById(req.params.id).select("+draftContent");
    if (!chapter) return res.status(404).json({ message: "Bölüm bulunamadı." });
    await assertWorkOwner(chapter.work, userId);
    res.json({ item: ownerChapter(chapter) });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.status && err.status < 500 ? err.message : "Bölüm yüklenemedi." });
  }
});

// ════════════════════════════════════════════
// 3. YENİ BÖLÜM — POST /api/chapters
// ════════════════════════════════════════════
router.post("/", ensureAuth, async (req, res) => {
  try {
    const { workId, title } = req.body;
    const userId = req.user?.id || req.userId;
    if (!workId) return res.status(400).json({ message: "workId gerekli." });
    res.status(201).json(await createChapterVersion({ workId, userId, title }));
  } catch (err) {
    console.error("Create Chapter Error:", err);
    res.status(err.status || 500).json({ message: err.status && err.status < 500 ? err.message : "Bölüm oluşturulamadı." });
  }
});

// ════════════════════════════════════════════
// 4. BÖLÜM GÜNCELLE — PUT /api/chapters/:id
// ════════════════════════════════════════════
function historyError(res, err) {
  return res.status(err.status || 503).json({ message: err.status ? err.message : "Kayıt tamamlanamadı. Metniniz korunuyor; tekrar deneyin.", code: err.status ? err.code : undefined, current: err.current });
}
router.put("/:id", ensureAuth, async (req, res) => {
  try {
    if (req.body.order !== undefined) {
      if (Object.keys(req.body).some(key => key !== "order"))
        return res.status(400).json({ message: "Sıralama ayrı bir istekle kaydedilmelidir." });
      return res.json(await updateChapterOrder({ id: req.params.id,
        userId: req.user?.id || req.userId, order: req.body.order }));
    }
    res.json(await saveChapterVersion({ id: req.params.id, userId: req.user?.id || req.userId,
      expectedRevision: req.body.expectedRevision, title: req.body.title, content: req.body.content, media: req.body.media, eligibleWordDelta: req.body.eligibleWordDelta }));
  } catch (err) { historyError(res, err); }
});
router.post("/:id/checkpoint", ensureAuth, async (req, res) => {
  try {
    res.json(await markChapterCheckpoint({ id: req.params.id, userId: req.user?.id || req.userId,
      expectedRevision: req.body.expectedRevision, label: req.body.label }));
  } catch (err) { historyError(res, err); }
});
router.get("/:id/versions", ensureAuth, async (req, res) => {
  try {
    await ownedChapter(req.params.id, req.user?.id || req.userId);
    const before = req.query.before === undefined ? undefined : Number(req.query.before);
    if (before !== undefined && (!Number.isSafeInteger(before) || before < 0)) return res.status(400).json({ message: "Geçersiz kayıt." });
    const items = await ChapterVersion.find({ chapter: req.params.id, ...(before === undefined ? {} : { revision: { $lt: before } }) })
      .select("revision title savedAt restoredFrom isCheckpoint label").sort({ revision: -1 }).limit(50).lean();
    res.json({ items, nextBefore: items.length === 50 ? items.at(-1).revision : null });
  } catch (err) { historyError(res, err); }
});
router.get("/:id/versions/:revision", ensureAuth, async (req, res) => {
  try {
    await ownedChapter(req.params.id, req.user?.id || req.userId);
    const item = await ChapterVersion.findOne({ chapter: req.params.id, revision: Number(req.params.revision) }).lean();
    if (!item) return res.status(404).json({ message: "Kayıt bulunamadı." });
    res.json({ item });
  } catch (err) { historyError(res, err); }
});
router.post("/:id/versions/:revision/restore", ensureAuth, async (req, res) => {
  try {
    res.json(await saveChapterVersion({ id: req.params.id, userId: req.user?.id || req.userId,
      expectedRevision: req.body.expectedRevision, restoreRevision: Number(req.params.revision) }));
  } catch (err) { historyError(res, err); }
});

// ════════════════════════════════════════════
// 5. DURUM GÜNCELLE — PATCH /api/chapters/:id/status
// ════════════════════════════════════════════
router.patch("/:id/status", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const result = await publishChapterVersion({ id: req.params.id, userId,
      expectedRevision: req.body.expectedRevision, status: req.body.status, workId: req.body.workId });
    if (result.pending) {
      await notifyStaff({ workId: result.item.work, type: 'chapter_pending', text: `"${result.item.title}" bölümü moderatör onayı bekliyor.` });
      await notifyAuthor({ userId, workId: result.item.work, type: 'chapter_pending', text: result.message });
      try { await sendStaffMail({ subject: 'Bölüm inceleme başvurusu', urgency: 'medium', html: '<p>Yeni bölüm başvurusu moderatör panelinde inceleme bekliyor.</p>' }); }
      catch (error) { console.error('Staff mail gönderilemedi:', error.message); }
    }
    res.status(result.pending ? 202 : 200).json(result);
  } catch (error) { historyError(res, error); }
});


router.patch("/:id/approve", ensureAuth, chapterReview('approve'));
router.patch("/:id/reject", ensureAuth, chapterReview('reject'));


// ════════════════════════════════════════════
// 7. REDDET — PATCH /api/chapters/:id/reject
// ════════════════════════════════════════════


// ════════════════════════════════════════════
// 8. SİL — DELETE /api/chapters/:id
// ════════════════════════════════════════════
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const userId  = req.user?.id || req.userId;
    await deleteLikedChapter({ chapterId: req.params.id, userId });
    res.json({ message: "Bölüm silindi." });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(err.status || 500).json({ message: err.status && err.status < 500 ? err.message : "Silinemedi." });
  }
});

export default router;
