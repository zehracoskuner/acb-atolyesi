import mongoose from "mongoose";

const readingListSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    works: [
      {
        work: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Work",
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
        note: {
          type: String,
          trim: true,
          maxlength: 300,
          default: "",
        },
      },
    ],
  },
  { timestamps: true }
);

// Bir kullanıcının aynı isimle birden fazla liste oluşturmasını engelle
readingListSchema.index({ owner: 1, name: 1 }, { unique: true });

// EN ÖNEMLİ KISIM BURASI: Eski module.exports yerine export default kullanıyoruz
export default mongoose.model("ReadingList", readingListSchema);