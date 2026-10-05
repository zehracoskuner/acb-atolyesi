// backend/models/Work.js
import mongoose from "mongoose";
import { protectWorkReads } from "../services/matureAccess.js";

const WorkSchema = new mongoose.Schema(
  {
    contentWarning: { type: Boolean, default: false, index: true },
    firstPublishedAt: Date,
    lastPublishedChapterAt: Date,
    removedCoverCase: { type: String, default: "" },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: "Yeni Çalışma",
    },
    coverImage: { 
      type: String, 
      default: null },

    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    universe: {
      genres: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 5,
        message: "En fazla 5 tür seçilebilir.",
      }, },
      tone: { type: String, default: "" },       // karanlık, mizahi…
      rules: { type: String, default: "" },      // evren kuralları
      themes: { type: String, default: "" },     // kader, ihanet…
    },

    // 🔥 YENİ EKLENEN YAYIN ALANLARI
    preface: { 
      type: String, 
      default: "" 
    },
    // Eski anonim eserlerin gizliliği korunur; yeni eserler anonim olamaz.
    isAnonymous: { 
      type: Boolean,
      default: false,
      validate: {
        validator(value) { return !this.isNew || value !== true; },
        message: "Yeni eserler anonim oluşturulamaz.",
      },
    },
    publishedChapterIds: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Chapter'
    }],
    lastDevelopmentAnalysisAt: { type: Date, default: null },
    lastDevelopmentWordCheckpoint: { type: Number, default: 0, min: 0 },
    developmentAnalysisCount: { type: Number, default: 0, min: 0 },
    developmentNewWords: { type: Number, default: 0, min: 0 },
    developmentInitializedAt: { type: Date, default: null },
    eligibleForDevelopmentReview: { type: Boolean, default: false },
    customChapterTitles: {
      type: Map,
      of: String,
      default: {}
    },
  
    likeCount: { 
      type: Number, 
      default: 0, 
      min: 0 
    }
    
  },
  { timestamps: true, optimisticConcurrency: true }
);

// New works start at zero; only pre-existing works need a lazy text baseline.
WorkSchema.pre("save", function () {
  if (this.isNew && !this.developmentInitializedAt) this.developmentInitializedAt = new Date();
});

protectWorkReads(WorkSchema);

const Work = mongoose.model("Work", WorkSchema);

export default Work;
