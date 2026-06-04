// backend/models/Chapter.js
import mongoose from "mongoose";

const chapterSchema = new mongoose.Schema(
  {
    work: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Work",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    content: {
      type: String,
      default: "",
    },

    order: {
      type: Number,
      default: 1,
    },

    // draft          → taslak
    // published      → yayında
    // pending_review → AI şüpheli buldu, admin onayı bekliyor
    // rejected       → admin reddetti
    status: {
      type: String,
      enum: ["draft", "published", "pending_review", "rejected"],
      default: "draft",
    },

    // AI veya admin tarafından yazılan red/uyarı notu
    reviewNote: {
      type: String,
      default: "",
    },

    // Hangi admin inceledi
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// pending_review kuyruğunu hızlı çekmek için index
chapterSchema.index({ status: 1, createdAt: -1 });

const Chapter = mongoose.model("Chapter", chapterSchema);
export default Chapter;