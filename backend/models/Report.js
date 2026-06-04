// backend/models/Report.js
import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    // Kim şikayet etti
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Ne şikayet edildi
    targetType: {
      type: String,
      enum: ["work", "chapter", "user", "comment"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "targetType", // dinamik ref — targetType'a göre hangi koleksiyon
    },

    reason: {
      type: String,
      enum: [
        "spam",
        "uygunsuz_icerik",
        "telif_ihlali",
        "taciz",
        "nefret_soylemi",
        "diger",
      ],
      required: true,
    },

    description: {
      type: String,
      default: "",
      maxlength: 500,
    },

    // Admin işlemi
    status: {
      type: String,
      enum: ["pending", "resolved", "dismissed"],
      default: "pending",
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    adminNote: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Aynı kişi aynı içeriği bir kez şikayet edebilir
reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });

// Bekleyen şikayetleri hızlı çekmek için
reportSchema.index({ status: 1, createdAt: -1 });

const Report = mongoose.model("Report", reportSchema);
export default Report;