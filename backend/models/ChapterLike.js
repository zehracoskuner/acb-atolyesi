import mongoose from "mongoose";

const chapterLikeSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  chapter: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: true },
  work:    { type: mongoose.Schema.Types.ObjectId, ref: "Work", required: true },
}, { timestamps: true });

chapterLikeSchema.index({ user: 1, chapter: 1 }, { unique: true });
chapterLikeSchema.index({ chapter: 1 });
chapterLikeSchema.index({ work: 1 });

export default mongoose.model("ChapterLike", chapterLikeSchema);