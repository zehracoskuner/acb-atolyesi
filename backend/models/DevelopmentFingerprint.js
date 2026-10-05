import mongoose from "mongoose";
const schema = new mongoose.Schema({
  workId: { type: mongoose.Schema.Types.ObjectId, required: true },
  hash: { type: String, required: true },
}, { versionKey: false });
schema.index({ workId: 1, hash: 1 }, { unique: true });
export default mongoose.model("DevelopmentFingerprint", schema);
