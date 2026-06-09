// backend/routes/logs.js
import { Router }     from "express";
import Log            from "../models/Log.js";
import LogComment     from "../models/LogComment.js";
import User           from "../models/User.js";
import ensureAuth     from "../middlewares/ensureAuth.js";
import { notifyLogLike, notifyLogComment } from "../services/notificationService.js";

const router = Router();

/* ═══════════════════════════════════════════
   GET /api/logs/:userId
   — Bir yazarın günlük girdilerini getir
   — Gizlilik: public → herkes, followers → sadece takipçiler
═══════════════════════════════════════════ */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    // Görüntüleyen kim?
    let viewerId = null;
    try {
      const header = req.headers.authorization;
      if (header?.startsWith("Bearer ")) {
        const jwt     = (await import("jsonwebtoken")).default;
        const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET || "atolye-secret-key");
        viewerId = decoded.id;
      }
    } catch { /* token yoksa önemseme */ }

    const isOwner = viewerId && String(viewerId) === String(userId);

    // Gizlilik filtresi
    let visibilityFilter;
    if (isOwner) {
      visibilityFilter = {}; // sahibi hepsini görür
    } else if (viewerId) {
      const viewer = await User.findById(viewerId).select("following").lean();
      const isFollowing = viewer?.following?.some(id => id.toString() === String(userId));
      visibilityFilter = isFollowing
        ? { visibility: { $in: ["public", "followers"] } }
        : { visibility: "public" };
    } else {
      visibilityFilter = { visibility: "public" };
    }

    const query = { author: userId, ...visibilityFilter };

    const [logs, total] = await Promise.all([
      Log.find(query)
        .populate("author",      "_id kullaniciAdi avatarUrl")
        .populate("relatedWork", "_id title coverImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Log.countDocuments(query),
    ]);

    // Her log için viewerId beğenmiş mi?
    const items = logs.map(log => ({
      ...log,
      likeCount: log.likes?.length ?? 0,
      likedByMe: viewerId ? log.likes?.some(id => id.toString() === String(viewerId)) : false,
      likes:     undefined, // dizinin kendisini gönderme
    }));

    return res.json({ items, total, page, hasMore: skip + items.length < total });
  } catch (err) {
    console.error("GET /logs/:userId hatası:", err);
    return res.status(500).json({ message: "Günlük yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/logs
   — Yeni günlük girdisi oluştur
═══════════════════════════════════════════ */
router.post("/", ensureAuth, async (req, res) => {
  try {
    const { content, relatedWork, visibility } = req.body;

    if (!content?.trim())
      return res.status(400).json({ message: "İçerik boş olamaz." });

    if (content.trim().length > 280)
      return res.status(400).json({ message: "Günlük girdisi en fazla 280 karakter olabilir." });

    const log = await Log.create({
      author:      req.user.id,
      content:     content.trim(),
      relatedWork: relatedWork || null,
      visibility:  ["public", "followers", "private"].includes(visibility) ? visibility : "public",
    });

    const populated = await log.populate([
      { path: "author",      select: "_id kullaniciAdi avatarUrl" },
      { path: "relatedWork", select: "_id title coverImage" },
    ]);

    return res.status(201).json({
      item: {
        ...populated.toObject(),
        likeCount: 0,
        likedByMe: false,
        likes:     undefined,
      },
    });
  } catch (err) {
    console.error("POST /logs hatası:", err);
    return res.status(500).json({ message: "Girdi oluşturulamadı." });
  }
});

/* ═══════════════════════════════════════════
   DELETE /api/logs/:id
   — Girdiyi sil (sadece sahibi)
═══════════════════════════════════════════ */
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const log = await Log.findById(req.params.id);
    if (!log) return res.status(404).json({ message: "Girdi bulunamadı." });

    if (log.author.toString() !== String(req.user.id))
      return res.status(403).json({ message: "Bu girdiyi silme yetkiniz yok." });

    await log.deleteOne();
    return res.json({ message: "Silindi." });
  } catch (err) {
    return res.status(500).json({ message: "Silinemedi." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/logs/:id/like
   — Beğen / beğeniyi geri al
═══════════════════════════════════════════ */
router.post("/:id/like", ensureAuth, async (req, res) => {
  try {
    const log = await Log.findById(req.params.id);
    if (!log) return res.status(404).json({ message: "Girdi bulunamadı." });

    // Gizlilik kontrolü
    if (log.visibility === "followers") {
      const viewer = await User.findById(req.user.id).select("following").lean();
      const isFollowing = viewer?.following?.some(id => id.toString() === log.author.toString());
      if (!isFollowing && log.author.toString() !== String(req.user.id))
        return res.status(403).json({ message: "Bu içeriği görüntüleme yetkiniz yok." });
    }

    const alreadyLiked = log.likes.some(id => id.toString() === String(req.user.id));

    if (alreadyLiked) {
      log.likes.pull(req.user.id);
    } else {
      log.likes.addToSet(req.user.id);
    }

    await log.save();

    // Bildirim — sadece beğenirken, beğeniyi geri alırken değil
    if (!alreadyLiked) {
      notifyLogLike({
        senderId:    req.user.id,
        logId:       log._id.toString(),
        logAuthorId: log.author.toString(),
      }).catch(console.error);
    }

    return res.json({
      likeCount: log.likes.length,
      likedByMe: !alreadyLiked,
    });
  } catch (err) {
    return res.status(500).json({ message: "İşlem başarısız." });
  }
});

export default router;

/* ═══════════════════════════════════════════
   GET /api/logs/:id/comments
═══════════════════════════════════════════ */
router.get("/:id/comments", async (req, res) => {
  try {
    const comments = await LogComment.find({ log: req.params.id })
      .populate("author", "_id kullaniciAdi avatarUrl")
      .sort({ createdAt: 1 })
      .lean();
    return res.json({ items: comments });
  } catch (err) {
    return res.status(500).json({ message: "Yorumlar yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/logs/:id/comments
═══════════════════════════════════════════ */
router.post("/:id/comments", ensureAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "Yorum boş olamaz." });
    if (content.trim().length > 500) return res.status(400).json({ message: "Yorum en fazla 500 karakter." });

    const dbUser = await User.findById(req.user.id).select("commentBanned").lean();
    if (dbUser?.commentBanned)
      return res.status(403).json({ message: "Yorum yapma yetkiniz kısıtlanmış." });

    const log = await Log.findById(req.params.id);
    if (!log) return res.status(404).json({ message: "Girdi bulunamadı." });
    const comment = await LogComment.create({ log: req.params.id, author: req.user.id, content: content.trim() });
    const populated = await comment.populate("author", "_id kullaniciAdi avatarUrl");

    // Bildirim gönder
    notifyLogComment({
      senderId:       req.user.id,
      logId:          req.params.id,
      logAuthorId:    log.author.toString(),
      commentPreview: content.trim(),
    }).catch(console.error);

    return res.status(201).json({ item: populated });
  } catch (err) {
    return res.status(500).json({ message: "Yorum eklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   DELETE /api/logs/:id/comments/:commentId
═══════════════════════════════════════════ */
router.delete("/:id/comments/:commentId", ensureAuth, async (req, res) => {
  try {
    const comment = await LogComment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Yorum bulunamadı." });
    const log = await Log.findById(req.params.id);
    const isCommentOwner = comment.author.toString() === String(req.user.id);
    const isLogOwner     = log?.author?.toString() === String(req.user.id);
    if (!isCommentOwner && !isLogOwner) return res.status(403).json({ message: "Yetki yok." });
    await comment.deleteOne();
    return res.json({ message: "Silindi." });
  } catch (err) {
    return res.status(500).json({ message: "Silinemedi." });
  }
});