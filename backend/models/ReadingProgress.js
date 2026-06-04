// backend/models/ReadingProgress.js
import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
    story:   { type: mongoose.Schema.Types.ObjectId, ref: "Work",    required: true },
    chapter: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: true },
    chapterNumber:  { type: Number, required: true },
    chapterTitle:   { type: String, required: true },
    scrollPosition: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

schema.index({ user: 1, story: 1 }, { unique: true });

export default mongoose.model("ReadingProgress", schema);