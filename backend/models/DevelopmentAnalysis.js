import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  workId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sequence: { type: Number, required: true },
  analyzedAt: { type: Date, required: true },
  checkpointStart: { type: Number, required: true },
  checkpointEnd: { type: Number, required: true },
  kind: { type: String, enum: ["baseline", "comparison"], required: true },
  sources: [{ chapterId: mongoose.Schema.Types.ObjectId, revision: Number, contentHash: String, words: Number }],
  modelIdentifier: { type: String, required: true },
  promptVersion: { type: String, required: true },
  analysisVersion: { type: String, required: true },
  result: { type: mongoose.Schema.Types.Mixed, required: true },
  profileSnapshot: mongoose.Schema.Types.Mixed,
}, { versionKey: false });
schema.index({ userId: 1, analyzedAt: -1 });
schema.index({ workId: 1, sequence: 1 }, { unique: true });
schema.index({ workId: 1, checkpointEnd: 1 }, { unique: true });
export default mongoose.model("DevelopmentAnalysis", schema);
