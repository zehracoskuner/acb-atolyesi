import mongoose from "mongoose";

// Text snapshots are immutable; only checkpoint metadata can be updated.
const schema = new mongoose.Schema({
  isCheckpoint: { type: Boolean, default: false },
  label: { type: String, default: "", maxlength: 80 },
  chapter: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  work: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  revision: { type: Number, required: true, immutable: true },
  title: { type: String, required: true, immutable: true },
  content: { type: String, default: "", immutable: true },
  savedAt: { type: Date, required: true, immutable: true },
  restoredFromRevision: { type: Number, immutable: true },
  restoredFrom: { type: Number, immutable: true },
}, { versionKey: false });
schema.index({ chapter: 1, revision: -1 }, { unique: true });
export default mongoose.model("ChapterVersion", schema);
