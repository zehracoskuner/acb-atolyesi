// models/Quote.js
import mongoose from "mongoose";

const quoteSchema = new mongoose.Schema(
  {
    /* Alıntıyı kaydeden kullanıcı */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* Alıntının alındığı eser */
    work: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Work",
      required: true,
    },

    /* Alıntı metni */
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    /* Gösterim için snapshot — eser silinse bile alıntı kalsın */
    workTitle:  { type: String, required: true, trim: true },
    authorName: { type: String, required: true, trim: true },

    /* Kitap türü etiketi — work.genre'den gelir */
    genre: {
      type: String,
      trim: true,
      default: "belirtilmemiş",
    },

    /* Kullanıcının kendi eklediği serbest etiketler */
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: "En fazla 10 etiket eklenebilir.",
      },
    },

    /* Zaman damgası — telif delili için */
    savedAt: {
      type: Date,
      default: Date.now,
      immutable: true, // bir kez yazılır, değiştirilemez
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

/* Aynı kullanıcı aynı metni aynı eserden iki kez kaydetmesin */
quoteSchema.index(
  { user: 1, work: 1, text: 1 },
  { unique: true, name: "unique_user_work_text" }
);

export default mongoose.model("Quote", quoteSchema);