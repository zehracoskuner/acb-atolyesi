// backend/models/Log.js
import mongoose from "mongoose";

const logSchema = new mongoose.Schema(
  {
    author: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },
    content: {
      type:      String,
      required:  true,
      maxlength: 280,
      trim:      true,
    },
    // İsteğe bağlı — hangi eserle ilgili olduğunu etiketleyebilir
    relatedWork: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Work",
      default: null,
    },
    visibility: {
      type:    String,
      enum:    ["public", "followers", "private"],
      default: "public",
    },
    // Beğeni sayısı — basit tutalım, ayrı koleksiyon açmaya gerek yok
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

// Eski girdileri otomatik sil — 1 yıl
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

export default mongoose.model("Log", logSchema);