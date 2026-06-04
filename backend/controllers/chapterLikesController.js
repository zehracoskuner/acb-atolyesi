import ChapterLike from "../models/ChapterLike.js";
import Chapter from "../models/Chapter.js";
import Work from "../models/Work.js";
import { notifyLike } from "../services/notificationService.js";

export const toggleChapterLike = async (req, res) => {
  try {
    const userId        = req.user.id;
    const { chapterId } = req.params;

    // workId'yi İSTEMCİDEN ALMA — chapter'dan türet (veri bütünlüğü)
    const chapter = await Chapter.findById(chapterId).select("work").lean();
    if (!chapter) return res.status(404).json({ error: "Bölüm bulunamadı" });
    const workId = chapter.work;

    const existing = await ChapterLike.findOne({ user: userId, chapter: chapterId });

    let liked;
    if (existing) {
      await ChapterLike.deleteOne({ _id: existing._id });
      liked = false;
    } else {
      try {
        await ChapterLike.create({ user: userId, chapter: chapterId, work: workId });
        liked = true;
      } catch (e) {
        if (e.code === 11000) liked = true;   // yarış: zaten beğenilmiş, sorun değil
        else throw e;
      }
    }

    // İki count'u paralel al
    const [likeCount, workTotal] = await Promise.all([
      ChapterLike.countDocuments({ chapter: chapterId }),
      ChapterLike.countDocuments({ work: workId }),
    ]);
    await Work.findByIdAndUpdate(workId, { likeCount: workTotal });

    // Sadece YENİ beğenide bildirim (toggle-off veya yarışta değil)
    if (liked && !existing) {
      notifyLike({ senderId: userId, workId }).catch(console.error);
    }

    return res.json({ liked, likeCount });
  } catch (err) {
    console.error("toggleChapterLike error:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
};

export const checkChapterLike = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const [liked, likeCount] = await Promise.all([
      ChapterLike.exists({ user: req.user.id, chapter: chapterId }),
      ChapterLike.countDocuments({ chapter: chapterId }),
    ]);
    res.json({ liked: !!liked, likeCount });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
};