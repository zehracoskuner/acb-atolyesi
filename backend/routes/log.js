import { resolveMentions, notifyMentions } from "../services/mentions.js";
import readerAccess from "../middlewares/readerAccess.js";
import mongoose from "mongoose";
// backend/routes/logs.js
import { Router }     from "express";
import Log            from "../models/Log.js";
import LogComment     from "../models/LogComment.js";
import User           from "../models/User.js";
import ensureAuth, { optionalAuth } from "../middlewares/ensureAuth.js";
import { notifyLogLike, notifyLogComment } from "../services/notificationService.js";

import { canReadLog } from "../services/logAccess.js";
import { logCommentCounts } from "../services/logCommentCounts.js";
import { arrayLikeUpdate, desiredLike, validateLikeId } from "../services/likes.js";

const router = Router();
router.use(readerAccess);

router.get("/:id/detail", optionalAuth, async (req, res) => {
  try {
    validateLikeId(req.params.id);
    const log = await Log.findById(req.params.id);
    if (!await canReadLog(log, req.user?.id)) return res.status(404).json({ message: "Bu günlük girdisi silinmiş veya artık erişime kapalı." });
    await log.populate("author", "kullaniciAdi avatarUrl");
    await log.populate("relatedWork", "title coverImage");
    const item = log.toObject();
    res.json({ item: { ...item, likes: undefined, likeCount: item.likes.length,
      likedByMe: item.likes.some(id => String(id) === String(req.user?.id)) } });
  } catch (err) {
    res.status(err.status || 500).json({ message: "Günlük girdisi yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   GET /api/logs/:userId
   — Bir yazarın günlük girdilerini getir
   — Gizlilik: public → herkes, followers → sadece takipçiler
═══════════════════════════════════════════ */
router.get("/:userId", optionalAuth, async (req, res, next) => {
  if (req.params.userId === "my") return next("route");
  try {
    const { userId } = req.params;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    // Görüntüleyen kim?
    const viewerId = req.user?.id ?? null;

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

    const counts = await logCommentCounts(logs);
    // Her log için viewerId beğenmiş mi?
    const items = logs.map(log => ({
      ...log,
      commentCount: counts.get(String(log._id)) ?? 0,
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
   GET /api/logs/my
   — Giriş yapmış kullanıcının kendi günlükleri (tümü görünürlük)
═══════════════════════════════════════════ */
router.get("/my", ensureAuth, async (req, res) => {
  try {
    const limit = Math.min(30, parseInt(req.query.limit) || 20);
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const skip  = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      Log.find({ author: req.user.id })
        .populate("relatedWork", "_id title coverImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Log.countDocuments({ author: req.user.id }),
    ]);

    const counts = await logCommentCounts(logs);
    const items = logs.map((l) => ({
      _id:       l._id,
      commentCount: counts.get(String(l._id)) ?? 0,
      content:   l.content,
      mentions:  l.mentions || [],
      visibility: l.visibility,
      likeCount: l.likes?.length ?? 0,
      likedByMe: (l.likes || []).some(id => String(id) === String(req.user.id)),
      relatedWork: l.relatedWork
        ? { _id: l.relatedWork._id, title: l.relatedWork.title }
        : null,
      createdAt: l.createdAt,
    }));

    return res.json({ items, total, hasMore: skip + items.length < total });
  } catch (err) {
    console.error("GET /logs/my hatası:", err);
    return res.status(500).json({ message: "Günlükler yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/logs
   — Yeni günlük girdisi oluştur
═══════════════════════════════════════════ */
router.post("/", ensureAuth, async (req, res) => {
  try {
    const { content, relatedWork, visibility } = req.body;

    if (typeof content !== "string" || !content.trim())
      return res.status(400).json({ message: "İçerik boş olamaz." });

    if (content.trim().length > 800)
      return res.status(400).json({ message: "Günlük girdisi en fazla 800 karakter olabilir." });

    const mentions = await resolveMentions(content.trim());
    const log = await Log.create({
      mentions,
      author:      req.user.id,
      content:     content.trim(),
      relatedWork: relatedWork || null,
      visibility:  ["public", "followers", "private"].includes(visibility) ? visibility : "public",
    });

    await notifyMentions({ senderId: req.user.id, mentions, log, isLogEntry: true }).catch(console.error);
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
    return res.status(err.status || 500).json({ message: err.status ? err.message : "Girdi oluşturulamadı." });
  }
});

/* ═══════════════════════════════════════════
   DELETE /api/logs/:id
   — Girdiyi sil (sadece sahibi)
═══════════════════════════════════════════ */
router.patch("/:id", ensureAuth, async (req, res) => {
  try {
    validateLikeId(req.params.id);
    const { content } = req.body;
    if (typeof content !== "string" || !content.trim() || content.trim().length > 800)
      return res.status(400).json({ message: "Günlük girdisi 1–800 karakter olmalı." });
    const log = await Log.findById(req.params.id);
    if (!log) return res.status(404).json({ message: "Girdi bulunamadı." });
    if (String(log.author) !== String(req.user.id)) return res.status(403).json({ message: "Bu girdiyi düzenleme yetkiniz yok." });
    const previous = log.mentions || [];
    log.mentions = await resolveMentions(content.trim());
    log.content = content.trim();
    await log.save();
    await notifyMentions({ senderId: req.user.id, mentions: log.mentions, previous, log, isLogEntry: true }).catch(console.error);
    return res.json({ item: log });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.status ? err.message : "Girdi düzenlenemedi." });
  }
});

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
    validateLikeId(req.params.id);
    const desired = desiredLike(req.body);
    const log = await Log.findById(req.params.id);
    if (!log) return res.status(404).json({ message: "Girdi bulunamadı." });

    if (!await canReadLog(log, req.user.id))
      return res.status(403).json({ message: "Bu içeriği görüntüleme yetkiniz yok." });

    // Return the pre-update document from this atomic operation, rather than
    // the stale access-check read, to decide whether a notification is due.
    const before = await Log.findOneAndUpdate(
      { _id: log._id, visibility: log.visibility, author: log.author },
      arrayLikeUpdate(req.user.id, desired), { new: false, select: "likes" }
    ).lean();
    if (!before) return res.status(404).json({ message: "Girdi artık kullanılamıyor." });
    const alreadyLiked = (before.likes || []).some(id => String(id) === String(req.user.id));
    const liked = desired ?? !alreadyLiked;
    const beforeCount = new Set((before.likes || []).map(String)).size;

    // Bildirim — sadece beğenirken, beğeniyi geri alırken değil
    if (liked && !alreadyLiked) {
      notifyLogLike({
        senderId:    req.user.id,
        logId:       log._id.toString(),
        logAuthorId: log.author.toString(),
      }).catch(console.error);
    }

    return res.json({
      likeCount: beforeCount + (liked === alreadyLiked ? 0 : liked ? 1 : -1),
      likedByMe: liked,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.status ? err.message : "İşlem başarısız." });
  }
});

export default router;

/* ═══════════════════════════════════════════
   GET /api/logs/:id/comments
═══════════════════════════════════════════ */
router.get("/:id/comments", optionalAuth, async (req, res) => {
  try {
    const log = await Log.findById(req.params.id);
    if (!await canReadLog(log, req.user?.id)) return res.status(404).json({ message: "Girdi bulunamadı." });
    const comments = await LogComment.find({ log: req.params.id })
      .populate("author", "_id kullaniciAdi avatarUrl")
      .populate("replyToAuthor", "_id kullaniciAdi")
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
    const { content, parentId } = req.body;
    if (typeof content !== "string" || !content.trim()) return res.status(400).json({ message: "Yorum boş olamaz." });
    if (content.trim().length > 500) return res.status(400).json({ message: "Yorum en fazla 500 karakter." });

    const dbUser = await User.findById(req.user.id).select("commentBanned").lean();
    if (dbUser?.commentBanned)
      return res.status(403).json({ message: "Yorum yapma yetkiniz kısıtlanmış." });

    const log = await Log.findById(req.params.id);
    if (!log) return res.status(404).json({ message: "Girdi bulunamadı." });
    if (!await canReadLog(log, req.user.id)) return res.status(403).json({ message: "Bu içeriği görüntüleme yetkiniz yok." });
    let parent = null;
    if (parentId != null) {
      if (typeof parentId !== "string" || !mongoose.isObjectIdOrHexString(parentId))
        return res.status(400).json({ message: "Geçersiz yorum." });
      parent = await LogComment.findOne({ _id: parentId, log: log._id }).lean();
      if (!parent) return res.status(404).json({ message: "Yanıtlanacak yorum bulunamadı." });
    }
    const mentions = await resolveMentions(content.trim());
    const comment = await LogComment.create({ mentions, log: req.params.id, author: req.user.id, content: content.trim(), parentId: parentId ?? null,
      threadId: parent ? (parent.threadId || parent.parentId || parent._id) : null, replyToAuthor: parent?.author || null });
    const populated = await comment.populate([
      { path: "author", select: "_id kullaniciAdi avatarUrl" },
      { path: "replyToAuthor", select: "_id kullaniciAdi" },
    ]);

    // Bildirim gönder
    notifyLogComment({
      senderId:       req.user.id,
      logId:          req.params.id,
      logAuthorId:    log.author.toString(),
      commentPreview: content.trim(),
      replyAuthorId: parent?.author,
      excludeRecipientIds: mentions.map(mention => String(mention.user)),
    }).catch(console.error);

    await notifyMentions({ senderId: req.user.id, mentions, log }).catch(console.error);
    return res.status(201).json({ item: populated });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.status ? err.message : "Yorum eklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   DELETE /api/logs/:id/comments/:commentId
═══════════════════════════════════════════ */
router.patch("/:id/comments/:commentId", ensureAuth, async (req, res) => {
  try {
    validateLikeId(req.params.id);
    validateLikeId(req.params.commentId);
    const { content } = req.body;
    if (typeof content !== "string" || !content.trim() || content.trim().length > 500)
      return res.status(400).json({ message: "Yorum 1–500 karakter olmalı." });
    const comment = await LogComment.findOne({ _id: req.params.commentId, log: req.params.id });
    if (!comment) return res.status(404).json({ message: "Yorum bulunamadı." });
    if (String(comment.author) !== String(req.user.id)) return res.status(403).json({ message: "Bu yorumu düzenleme yetkiniz yok." });
    const log = await Log.findById(req.params.id);
    if (!await canReadLog(log, req.user.id)) return res.status(404).json({ message: "Girdi bulunamadı." });
    const user = await User.findById(req.user.id).select("commentBanned").lean();
    if (user?.commentBanned) return res.status(403).json({ message: "Yorum yapma yetkiniz kısıtlanmış." });
    const previous = comment.mentions || [];
    comment.mentions = await resolveMentions(content.trim());
    comment.content = content.trim();
    await comment.save();
    await comment.populate([{ path: "author", select: "_id kullaniciAdi avatarUrl" }, { path: "replyToAuthor", select: "_id kullaniciAdi" }]);
    await notifyMentions({ senderId: req.user.id, mentions: comment.mentions, previous, log }).catch(console.error);
    return res.json({ item: comment });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.status ? err.message : "Yorum düzenlenemedi." });
  }
});

router.delete("/:id/comments/:commentId", ensureAuth, async (req, res) => {
  try {
    const comment = await LogComment.findById(req.params.commentId);
    if (!comment || String(comment.log) !== req.params.id) return res.status(404).json({ message: "Yorum bulunamadı." });
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
