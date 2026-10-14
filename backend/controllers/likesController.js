import Like from "../models/Likes.js";
import { notifyLike } from "../services/notificationService.js";
import { changeWorkLike, desiredLike, likeTarget } from "../services/likes.js";

async function change(req, res, liked) {
  try {
    const result = await changeWorkLike({ userId: req.user.id, workId: req.params.workId || req.body?.workId, liked });
    if (result.added) notifyLike({ senderId: req.user.id, workId: result.workId }).catch(console.error);
    res.json({ liked: result.liked, likeCount: result.likeCount });
  } catch (err) {
    if (!err.status) console.error("work like:", err);
    res.status(err.status || 500).json({ message: err.status ? err.message : "Beğeni işlemi başarısız." });
  }
}
export const toggleLike = (req, res) => {
  try { return change(req, res, desiredLike(req.body)); }
  catch (err) { return res.status(err.status).json({ message: err.message }); }
};
export const unlike = (req, res) => change(req, res, false);
export const checkLike = async (req, res) => {
  try {
    const work = await likeTarget({ workId: req.params.workId });
    const liked = req.user ? !!await Like.exists({ user: req.user.id, work: work._id }) : false;
    res.json({ liked, likeCount: work.likeCount ?? 0 });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.status ? err.message : "Beğeni durumu alınamadı." });
  }
};
