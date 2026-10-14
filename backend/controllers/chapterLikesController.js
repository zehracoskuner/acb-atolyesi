import ChapterLike from "../models/ChapterLike.js";
import { notifyLike } from "../services/notificationService.js";
import { changeWorkLike, desiredLike, likeTarget } from "../services/likes.js";

export const toggleChapterLike = async (req, res) => {
  try {
    const result = await changeWorkLike({ userId: req.user.id, chapterId: req.params.chapterId, liked: desiredLike(req.body) });
    if (result.added) notifyLike({ senderId: req.user.id, workId: result.workId }).catch(console.error);
    res.json({ liked: result.liked, likedByMe: result.liked, likeCount: result.likeCount, workLikeCount: result.workLikeCount });
  } catch (err) {
    if (!err.status) console.error("chapter like:", err);
    res.status(err.status || 500).json({ message: err.status ? err.message : "Beğeni işlemi başarısız." });
  }
};
export const checkChapterLike = async (req, res) => {
  try {
    await likeTarget({ chapterId: req.params.chapterId });
    const [liked, likeCount] = await Promise.all([
      req.user ? ChapterLike.exists({ user: req.user.id, chapter: req.params.chapterId }) : false,
      ChapterLike.countDocuments({ chapter: req.params.chapterId }),
    ]);
    res.json({ liked: !!liked, likedByMe: !!liked, likeCount });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.status ? err.message : "Beğeni durumu alınamadı." });
  }
};
