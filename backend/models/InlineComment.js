// backend/models/InlineComment.js
// Mevcut modeline şu alanları ekle (yoksa):
//
//   status: {
//     type: String,
//     enum: ["published", "pending_review", "rejected"],
//     default: "published",
//   },
//   reviewNote: { type: String, default: "" },
//
// Örnek tam schema:

import mongoose from "mongoose";

const inlineCommentSchema = new mongoose.Schema({
  workId:         { type: mongoose.Schema.Types.ObjectId, ref: "Work",    required: true },
  chapterId:      { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: true },
  paragraphIndex: { type: Number, required: true },
  content:        { type: String, required: true, maxlength: 1000 },
  author:         { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // Moderasyon — route'daki /report endpoint'i için gerekli
  status: {
    type:    String,
    enum:    ["published", "pending_review", "rejected"],
    default: "published",
  },
  reviewNote: { type: String, default: "" },
}, { timestamps: true });

inlineCommentSchema.index({ chapterId: 1, paragraphIndex: 1, createdAt: 1 });

export default mongoose.model("InlineComment", inlineCommentSchema);