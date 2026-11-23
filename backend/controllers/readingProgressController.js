// backend/controllers/readingProgressController.js
import ReadingProgress from "../models/ReadingProgress.js";
import Chapter from "../models/Chapter.js";
import Work from "../models/Work.js";
import mongoose from "mongoose";

/* POST /api/reading-progress */
export const trackProgress = async (req, res) => {
  try {
    const { storyId, chapterId, scrollPosition } = req.body;
    const userId = req.user.id;

    if (!storyId || !chapterId)
      return res.status(400).json({ message: "storyId ve chapterId gerekli." });

    if (!mongoose.isValidObjectId(storyId) || !mongoose.isValidObjectId(chapterId) || !Number.isFinite(scrollPosition))
      return res.status(400).json({ message: "Geçersiz okuma ilerlemesi." });
    const work = await Work.findById(storyId).select("publishedChapterIds status").lean();
    if (work?.status !== "published" || !work?.publishedChapterIds?.some(id => String(id) === String(chapterId)))
      return res.status(404).json({ message: "Bölüm bu eserde yayında değil." });
    const chapter = await Chapter.findOne({ _id: chapterId, work: storyId, status: "published" }).select("order title").lean();
    if (!chapter)
      return res.status(404).json({ message: "Bölüm bulunamadı." });

    const savedAt = Number.isSafeInteger(req.body.savedAt) && req.body.savedAt > 0 ? Math.min(req.body.savedAt, Date.now()) : undefined;
    await ReadingProgress.findOneAndUpdate(
      { user: userId, story: storyId, ...(savedAt ? { $or: [{ clientSavedAt: { $lte: savedAt } }, { clientSavedAt: { $exists: false } }] } : {}) },
      {
        chapter:        chapterId,
        chapterNumber:  chapter.order ?? 1,
        chapterTitle:   chapter.title ?? "",
        scrollPosition: Math.min(100, Math.max(0, Math.round(Number(scrollPosition) || 0))),
        clientSavedAt: savedAt || Date.now(),
      },
      { upsert: true, new: true }
    );

    return res.json({ ok: true });
  } catch (err) {
    if (err.code === 11000) return res.json({ ok: true, stale: true });
    console.error("trackProgress hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
};

/* GET /api/reading-progress/:storyId */
export const getProgressByStory = async (req, res) => {
  try {
    const userId  = req.user.id;
    const storyId = req.params.storyId;

    if (!mongoose.isValidObjectId(storyId)) return res.status(400).json({ message: "Geçersiz eser." });
    const progress = await ReadingProgress.findOne({
      user:  userId,
      story: storyId,
    }).lean();

    if (!progress) return res.json({ found: false });
    const [work, chapter] = await Promise.all([
      Work.findById(storyId).select("publishedChapterIds status").lean(),
      Chapter.findOne({ _id: progress.chapter, work: storyId, status: "published" }).select("order title").lean(),
    ]);
    if (!chapter || work?.status !== "published" || !work?.publishedChapterIds?.some(id => String(id) === String(progress.chapter))) return res.json({ found: false });

    return res.json({
      found:          true,
      chapterNumber: chapter.order,
      chapterTitle: chapter.title,
      updatedAt: progress.updatedAt,
      ...(progress.clientSavedAt ? { savedAt: progress.clientSavedAt } : {}),
      chapterId:      String(progress.chapter),
      scrollPosition: progress.scrollPosition ?? 0,
    });
  } catch (err) {
    console.error("getProgressByStory hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
};

/* GET /api/reading-progress */
export const getMyProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const items  = await ReadingProgress.find({ user: userId })
      .populate("story",   "_id title coverImage publishedChapterIds")
      .populate("chapter", "_id title order work status")
      .sort({ updatedAt: -1 })
      .lean();
    return res.json({ items: items.filter(item => item.story && item.chapter && item.chapter.status === "published" && String(item.chapter.work) === String(item.story._id) && item.story.publishedChapterIds?.some(id => String(id) === String(item.chapter._id))) });
  } catch (err) {
    console.error("getMyProgress hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
};
export const clearProgress = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.storyId)) return res.status(400).json({ message: "Geçersiz eser." });
  try {
    await ReadingProgress.deleteOne({ user: req.user.id, story: req.params.storyId });
    return res.json({ ok: true });
  } catch { return res.status(500).json({ message: "Sunucu hatası." }); }
};
