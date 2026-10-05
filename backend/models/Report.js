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
      enum: ["work", "chapter", "user", "comment", "cover", "avatar", "banner"],
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

    contentCase: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentCase' },
    targetVersion: String,
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },

    stage: { type: String, enum: ['received', 'reviewing', 'awaiting_information', 'decided', 'appeal_review'] },
    revision: { type: Number, default: 0 },
    originalWork: { type: String, maxlength: 4000 },
    targetOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    evidenceSnapshot: { type: mongoose.Schema.Types.Mixed, select: false },
    history: [{ at: Date, kind: String, text: String, audience: { type: String, enum: ['reporter', 'shared'] } }],
    decisions: [{ at: Date, outcome: String, action: String, rationale: String, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }],
    appeals: [{ at: Date, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, decision: Number, rationale: String }],
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
reportSchema.index({ reporter: 1, targetType: 1, targetId: 1, targetVersion: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' }, name: 'open_report_version' });

// Bekleyen şikayetleri hızlı çekmek için
reportSchema.index({ status: 1, createdAt: -1 });

const Report = mongoose.model("Report", reportSchema);
export default Report;
