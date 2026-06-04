// backend/controllers/readingProgressController.js
import ReadingProgress from "../models/ReadingProgress.js";
import Chapter from "../models/Chapter.js";

/* POST /api/reading-progress */
export const trackProgress = async (req, res) => {
  try {
    const { storyId, chapterId, scrollPosition } = req.body;
    const userId = req.user.id;

    if (!storyId || !chapterId)
      return res.status(400).json({ message: "storyId ve chapterId gerekli." });

    const chapter = await Chapter.findById(chapterId).select("order title").lean();
    if (!chapter)
      return res.status(404).json({ message: "Bölüm bulunamadı." });

    await ReadingProgress.findOneAndUpdate(
      { user: userId, story: storyId },
      {
        chapter:        chapterId,
        chapterNumber:  chapter.order ?? 1,
        chapterTitle:   chapter.title ?? "",
        scrollPosition: Math.min(100, Math.max(0, Math.round(Number(scrollPosition) || 0))),
      },
      { upsert: true, new: true }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("trackProgress hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
};

/* GET /api/reading-progress/:storyId */
export const getProgressByStory = async (req, res) => {
  try {
    const userId  = req.user.id;
    const storyId = req.params.storyId;

    const progress = await ReadingProgress.findOne({
      user:  userId,
      story: storyId,
    }).lean();

    if (!progress) return res.json({ found: false });

    return res.json({
      found:          true,
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
      .populate("story",   "_id title coverImage")
      .populate("chapter", "_id title order")
      .sort({ updatedAt: -1 })
      .lean();
    return res.json({ items });
  } catch (err) {
    console.error("getMyProgress hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
};