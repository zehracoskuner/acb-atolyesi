// backend/models/Comment.js
import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const commentSchema = new mongoose.Schema(
  {
    author: { type: ObjectId, ref: "User", required: true, index: true },

    // chapter VEYA work — ikisi de opsiyonel, controller'da doğrulanır
    chapter: { type: ObjectId, ref: "Chapter", default: null },
    work:    { type: ObjectId, ref: "Work",    default: null },

    content:  { type: String, required: true, maxlength: 2000, trim: true },
    parentId: { type: ObjectId, ref: "Comment", default: null },

    // Beğeni — toggle destekli array. likeCount denormalize, $size ile senkron tutulur.
    likes:     [{ type: ObjectId, ref: "User" }],
    likeCount: { type: Number, default: 0, min: 0 },

    // ── Düzenleme izi ────────────────────────────────────────
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date,    default: null },

    // ── Soft delete ──────────────────────────────────────────
    // Şikayet/moderasyon sonucu silinen yorumlar hard delete yapılmaz.
    // Asıl metin originalContent'te saklanır; frontend isDeleted:true ise
    // "[Bu yorum kaldırıldı]" gösterir.
    isDeleted:     { type: Boolean, default: false, index: true },
    deletedAt:     { type: Date,    default: null },
    deletedBy:     { type: ObjectId, ref: "User", default: null },
    deletedReason: { type: String,  default: "", select: false }, // ← API'de default dönmez

    // KRİTİK: asla default response'a düşmesin. Yalnızca açıkça +select edilince gelir.
    originalContent: { type: String, default: "", select: false },

    // ── Moderatör onay kuyruğu (commentBanned kullanıcılar için) ──
    // Şikayet için DEĞİL — ban sonrası onay akışı.
    status: {
      type:    String,
      enum:    ["published", "pending_review", "rejected"],
      default: "published",
      index:   true,
    },
    reviewNote: { type: String, default: "", select: false }, // ← API'de default dönmez
    reviewedBy: { type: ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/* ── Index'ler — gerçek sorgu şekline göre compound ───────────
   getComments top-level:  { chapter, parentId:null, status } sort createdAt:-1
   getComments work-level: { work,    parentId:null, status } sort createdAt:-1
   yanıtlar:               { parentId:{$in}, status }         sort createdAt:1
   moderasyon kuyruğu:     { status, isDeleted }              sort createdAt:1
──────────────────────────────────────────────────────────── */
commentSchema.index({ chapter: 1, parentId: 1, status: 1, createdAt: -1 });
commentSchema.index({ work: 1,    parentId: 1, status: 1, createdAt: -1 });
commentSchema.index({ parentId: 1, status: 1, createdAt: 1 });
commentSchema.index({ status: 1,  isDeleted: 1, createdAt: 1 });

export default mongoose.model("Comment", commentSchema);