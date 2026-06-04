// controllers/likesController.js
import Like from "../models/Likes.js";
import Work from "../models/Work.js";
import { notifyLike } from "../services/notificationService.js";

export const toggleLike = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workId } = req.body;

    if (!workId) return res.status(400).json({ error: "workId gerekli" });

    const existing = await Like.findOne({ user: userId, work: workId });

    if (existing) {
      await Like.deleteOne({ _id: existing._id });
      const updated = await Work.findByIdAndUpdate(
        workId,
        { $inc: { likeCount: -1 } },
        { new: true, select: "likeCount" }
      );
      return res.json({ liked: false, likeCount: Math.max(0, updated?.likeCount ?? 0) });
    }

    await Like.create({ user: userId, work: workId });
    const updated = await Work.findByIdAndUpdate(
      workId,
      { $inc: { likeCount: 1 } },
      { new: true, select: "likeCount" }
    );

    notifyLike({ senderId: userId, workId }).catch(console.error);

    return res.json({ liked: true, likeCount: updated?.likeCount ?? 1 });
  } catch (err) {
    if (err.code === 11000) return res.json({ liked: true });
    console.error("toggleLike error:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
};

export const checkLike = async (req, res) => {
  try {
    const like = await Like.exists({ user: req.user.id, work: req.params.workId });
    // ✅ Work'ten gerçek count'u çek
    const work = await Work.findById(req.params.workId).select("likeCount");
    res.json({ liked: !!like, likeCount: work?.likeCount ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
};

export const unlike = async (req, res) => {
  try {
    const { workId } = req.params;
    await Like.deleteOne({ user: req.user.id, work: workId });
    const updated = await Work.findByIdAndUpdate(
      workId,
      { $inc: { likeCount: -1 } },
      { new: true, select: "likeCount" }
    );
    res.json({ liked: false, likeCount: Math.max(0, updated?.likeCount ?? 0) });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
};