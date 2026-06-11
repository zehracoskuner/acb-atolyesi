// backend/controllers/commentController.js
import mongoose from "mongoose";
import Comment  from "../models/Comment.js";
import Chapter  from "../models/Chapter.js";
import Work     from "../models/Work.js";
import User     from "../models/User.js";
import {
  notifyComment,
  notifyReply,
  notifyCommentRemoved,
} from "../services/notificationService.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const toId      = (id) => new mongoose.Types.ObjectId(id);

/* ─────────────────────────────────────────────────────────────
   Yorumu güvenli response şekline çevirir.
   - originalContent / deletedReason / reviewNote zaten select:false
     olduğu için lean sorgudan gelmez; yine de defansif davranıyoruz.
   - isDeleted ise content gizlenir.
   - Ham likes dizisi DIŞARI VERİLMEZ; likeCount + isLiked döner.
───────────────────────────────────────────────────────────── */
function shapeComment(c, viewerId) {
  const likes = Array.isArray(c.likes) ? c.likes : [];
  const isLiked = viewerId
    ? likes.some((id) => id.toString() === viewerId.toString())
    : false;

  const shaped = {
    ...c,
    content:   c.isDeleted ? null : c.content,
    likeCount: typeof c.likeCount === "number" ? c.likeCount : likes.length,
    isLiked,
  };

  // Sızıntı olabilecek alanları her ihtimale karşı kaldır
  delete shaped.likes;
  delete shaped.originalContent;
  delete shaped.deletedReason;
  delete shaped.reviewNote;

  return shaped;
}

/* ─────────────────────────────────────────────────────────────
   GET /api/comments/chapter/:chapterId
   GET /api/comments/work/:workId
   GET /api/comments/:id
───────────────────────────────────────────────────────────── */
export async function getComments(req, res) {
  try {
    const viewerId = req.user?.id || null; // misafir okuyabilir
    let { chapterId, workId, id } = req.params;

    for (const candidate of [chapterId, workId, id]) {
      if (candidate && !isValidId(candidate))
        return res.status(400).json({ error: "Geçersiz kimlik." });
    }

    if (id && !chapterId && !workId) {
      const isChapter = await Chapter.exists({ _id: id }).catch(() => null);
      if (isChapter) chapterId = id;
      else           workId    = id;
    }

    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = chapterId
      ? { chapter: chapterId, parentId: null, status: "published" }
      : { work: workId, chapter: null, parentId: null, status: "published" };

    const [topLevel, total] = await Promise.all([
      Comment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author",    "kullaniciAdi avatarUrl")
        .populate("deletedBy", "kullaniciAdi")
        .lean(),
      Comment.countDocuments(filter),
    ]);

    const topIds = topLevel.map((c) => c._id);
    const replies = topIds.length
      ? await Comment.find({ parentId: { $in: topIds }, status: "published" })
          .sort({ createdAt: 1 })
          .populate("author",    "kullaniciAdi avatarUrl")
          .populate("deletedBy", "kullaniciAdi")
          .lean()
      : [];

    // Yanıtları parent'a göre grupla — HER yanıt da shape'lenir
    const replyMap = {};
    replies.forEach((r) => {
      const key = r.parentId.toString();
      (replyMap[key] = replyMap[key] || []).push(shapeComment(r, viewerId));
    });

    const items = topLevel.map((c) => ({
      ...shapeComment(c, viewerId),
      replies: replyMap[c._id.toString()] || [],
    }));

    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("getComments:", err);
    res.status(500).json({ error: "Yorumlar alınamadı." });
  }
}

/* ─────────────────────────────────────────────────────────────
   POST — yorum oluştur
───────────────────────────────────────────────────────────── */
export async function createComment(req, res) {
  try {
    let { chapterId, workId: paramWorkId, id } = req.params;

    if (id && !chapterId && !paramWorkId) {
      if (!isValidId(id)) return res.status(400).json({ error: "Geçersiz kimlik." });
      const isChapter = await Chapter.exists({ _id: id }).catch(() => null);
      if (isChapter) chapterId   = id;
      else           paramWorkId = id;
    }

    const { content, text, parentId, workId: bodyWorkId } = req.body;
    const body = (content || text || "").trim();
    if (!body)              return res.status(400).json({ error: "Yorum boş olamaz." });
    if (body.length > 2000) return res.status(400).json({ error: "Yorum 2000 karakteri geçemez." });

    const dbUser = await User.findById(req.user.id).select("commentBanned").lean();
    if (dbUser?.commentBanned)
      return res.status(403).json({ message: "Yorum yapma yetkiniz kısıtlanmış." });

    let resolvedWorkId    = paramWorkId || bodyWorkId || null;
    let resolvedChapterId = chapterId   || null;

    for (const cid of [resolvedWorkId, resolvedChapterId, parentId]) {
      if (cid && !isValidId(cid))
        return res.status(400).json({ error: "Geçersiz kimlik." });
    }

    if (resolvedChapterId && !resolvedWorkId) {
      const chapter = await Chapter.findById(resolvedChapterId).lean();
      if (!chapter) return res.status(404).json({ error: "Bölüm bulunamadı." });
      resolvedWorkId = (chapter.work || chapter.eser)?.toString() || null;
    }

    if (!resolvedChapterId && !resolvedWorkId)
      return res.status(400).json({ error: "chapter veya work gerekli." });

    // Eseri bir kez çek; hem görünürlük kontrolü hem bildirim için kullanılır.
    // (Work şemasında ayrı "gizlilik" alanı yok; status taslak/arşiv erişimini belirler.)
    let work = null;
    if (resolvedWorkId) {
      work = await Work.findById(resolvedWorkId).lean();
      if (!work) return res.status(404).json({ error: "Eser bulunamadı." });
      // Yayında olmayan esere (taslak/arşiv) yalnızca sahibi yorum yazabilsin.
      if (work.status !== "published" && work.user?.toString() !== req.user.id)
        return res.status(403).json({ error: "Bu esere yorum yapılamaz." });
    }

    // Yanıt ise: parent gerçekten var mı, ikinci seviye mi?
    let parentComment = null;
    if (parentId) {
      parentComment = await Comment.findById(parentId).lean();
      if (!parentComment)       return res.status(404).json({ error: "Yanıtlanacak yorum bulunamadı." });
      if (parentComment.parentId) return res.status(400).json({ error: "İkinci seviye yanıt desteklenmiyor." });
    }

    const comment = await Comment.create({
      author:   req.user.id,
      chapter:  resolvedChapterId,
      work:     resolvedWorkId,
      content:  body,
      parentId: parentId || null,
      status:   "published",
    });

    await comment.populate("author", "kullaniciAdi avatarUrl");

    // Bildirimler
    const me           = req.user.id;
    const parentAuthor = parentComment?.author?.toString() || null;

    if (parentAuthor && parentAuthor !== me) {
      notifyReply({ senderId: me, recipientId: parentComment.author, workId: resolvedWorkId })
        .catch((e) => console.error("notifyReply:", e.message));
    }

    const workOwner = work?.user?.toString() || null;
    if (workOwner && workOwner !== me && workOwner !== parentAuthor) {
      notifyComment({ senderId: me, workId: resolvedWorkId, commentPreview: body })
        .catch((e) => console.error("notifyComment:", e.message));
    }

    res.status(201).json({
      item:    shapeComment(comment.toObject(), req.user.id),
      message: "Yorum eklendi.",
    });
  } catch (err) {
    console.error("createComment:", err);
    res.status(500).json({ error: "Yorum eklenemedi." });
  }
}

/* ─────────────────────────────────────────────────────────────
   PATCH — düzenle (yalnızca kendi yorumu)
───────────────────────────────────────────────────────────── */
export async function updateComment(req, res) {
  try {
    const { commentId } = req.params;
    if (!isValidId(commentId)) return res.status(400).json({ error: "Geçersiz kimlik." });

    const { content, text } = req.body;
    const body = (content || text || "").trim();
    if (!body)              return res.status(400).json({ error: "Yorum boş olamaz." });
    if (body.length > 2000) return res.status(400).json({ error: "Yorum 2000 karakteri geçemez." });

    const comment = await Comment.findById(commentId);
    if (!comment)                                  return res.status(404).json({ error: "Yorum bulunamadı." });
    if (comment.isDeleted)                         return res.status(410).json({ error: "Bu yorum silinmiş." });
    if (comment.author.toString() !== req.user.id) return res.status(403).json({ error: "Yetkisiz." });

    comment.content  = body;
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();
    await comment.populate("author", "kullaniciAdi avatarUrl");

    res.json({ item: shapeComment(comment.toObject(), req.user.id), message: "Yorum güncellendi." });
  } catch (err) {
    console.error("updateComment:", err);
    res.status(500).json({ error: "Yorum güncellenemedi." });
  }
}

/* ─────────────────────────────────────────────────────────────
   DELETE — silme
   - Yorum sahibi: hard delete (+ yanıtları da sil)
   - Admin/moderatör: soft delete (içerik originalContent'te korunur)
───────────────────────────────────────────────────────────── */
export async function deleteComment(req, res) {
  try {
    const { commentId } = req.params;
    if (!isValidId(commentId)) return res.status(400).json({ error: "Geçersiz kimlik." });

    const { reason } = req.body || {}; // moderatör/admin sebep belirtebilir

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ error: "Yorum bulunamadı." });

    const isOwner = comment.author.toString() === req.user.id;
    const isPriv  = ["admin", "moderator"].includes(req.user.role);

    if (!isOwner && !isPriv) return res.status(403).json({ error: "Yetkisiz." });

    if (isPriv && !isOwner) {
      // Moderatör/admin: soft delete — içerik korunur
      comment.isDeleted       = true;
      comment.deletedAt       = new Date();
      comment.deletedBy       = req.user.id;
      comment.deletedReason   = reason?.trim() || "Moderatör kararı";
      comment.originalContent = comment.content;
      comment.content         = ""; // API response'da gizlenir
      await comment.save();

      notifyCommentRemoved({ recipientId: comment.author, workId: comment.work })
        .catch((e) => console.error("notifyCommentRemoved:", e.message));
    } else {
      // Kullanıcı kendi yorumunu siliyor: yanıtları da sil + hard delete
      await Comment.deleteMany({ parentId: commentId });
      await comment.deleteOne();
    }

    res.json({ message: "Yorum silindi." });
  } catch (err) {
    console.error("deleteComment:", err);
    res.status(500).json({ error: "Yorum silinemedi." });
  }
}

/* ─────────────────────────────────────────────────────────────
   POST /:commentId/like — toggle (atomik)
   Tek bir aggregation-pipeline update ile dizi + likeCount eşzamanlı
   güncellenir. $setUnion idempotent olduğu için çift tıklama / yarış
   durumunda duplicate oluşmaz, sayım kaymaz.
───────────────────────────────────────────────────────────── */
export async function likeComment(req, res) {
  try {
    const { commentId } = req.params;
    if (!isValidId(commentId)) return res.status(400).json({ error: "Geçersiz kimlik." });

    const userId  = req.user.id;
    const userOid = toId(userId);

    const current = await Comment.findById(commentId).select("isDeleted likes").lean();
    if (!current)           return res.status(404).json({ error: "Yorum bulunamadı." });
    if (current.isDeleted)  return res.status(410).json({ error: "Bu yorum silinmiş." });

    const wasLiked = (current.likes || []).some((id) => id.toString() === userId);

    await Comment.updateOne({ _id: commentId }, [
      {
        $set: {
          likes: {
            $cond: [
              { $in: [userOid, { $ifNull: ["$likes", []] }] },
              { $setDifference: ["$likes", [userOid]] }, // beğeniyi kaldır
              { $setUnion:      ["$likes", [userOid]] },  // beğeni ekle (dedupe)
            ],
          },
        },
      },
      { $set: { likeCount: { $size: "$likes" } } },
    ]);

    const liked     = !wasLiked;
    const likeCount = (current.likes?.length || 0) + (liked ? 1 : -1);

    res.json({ liked, likeCount: Math.max(0, likeCount) });
  } catch (err) {
    console.error("likeComment:", err);
    res.status(500).json({ error: "Beğeni işlemi başarısız." });
  }
}

/* ─────────────────────────────────────────────────────────────
   POST /:commentId/report
   ARTIK KULLANILMIYOR — Frontend doğrudan /api/reports'a POST yapar.
   Geriye dönük uyumluluk için 410 döner.
───────────────────────────────────────────────────────────── */
export async function reportComment(req, res) {
  return res.status(410).json({
    error: "Bu endpoint kaldırıldı. Şikayet için POST /api/reports kullanın.",
    hint:  "{ targetType: 'comment', targetId: commentId, reason, description }",
  });
}

/* ─────────────────────────────────────────────────────────────
   Moderatör kuyruğu (GET/PATCH)
───────────────────────────────────────────────────────────── */
export async function getModerationQueue(req, res) {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = { status: "pending_review", isDeleted: { $ne: true } };

    const [items, total] = await Promise.all([
      Comment.find(filter)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "kullaniciAdi email avatarUrl commentBanned")
        .populate("work",   "baslik title")
        .lean(),
      Comment.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("getModerationQueue:", err);
    res.status(500).json({ error: "Kuyruk alınamadı." });
  }
}

export async function moderateComment(req, res) {
  try {
    const { commentId } = req.params;
    if (!isValidId(commentId)) return res.status(400).json({ error: "Geçersiz kimlik." });

    const { action, note } = req.body;
    if (!["approve", "reject"].includes(action))
      return res.status(400).json({ error: "Geçersiz işlem." });

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ error: "Yorum bulunamadı." });

    comment.status     = action === "approve" ? "published" : "rejected";
    comment.reviewNote = note || "";
    comment.reviewedBy = req.user.id;
    comment.reviewedAt = new Date();
    await comment.save();

    if (action === "reject") {
      notifyCommentRemoved({ recipientId: comment.author, workId: comment.work })
        .catch((e) => console.error("notifyCommentRemoved:", e.message));
    }

    res.json({
      message: action === "approve" ? "Yorum yayınlandı." : "Yorum reddedildi.",
      status:  comment.status,
    });
  } catch (err) {
    console.error("moderateComment:", err);
    res.status(500).json({ error: "Moderasyon işlemi başarısız." });
  }
}