// backend/models/Work.js
import mongoose from "mongoose";

const WorkSchema = new mongoose.Schema(
  {
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
    isAnonymous: { 
      type: Boolean, 
      default: false 
    },
    publishedChapterIds: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Chapter'
    }],
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
  { timestamps: true }
);

const Work = mongoose.model("Work", WorkSchema);

export default Work;