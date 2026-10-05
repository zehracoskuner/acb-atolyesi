import mongoose from "mongoose";
const schema = new mongoose.Schema({
  workId: { type: mongoose.Schema.Types.ObjectId, required: true },
  chapterId: { type: mongoose.Schema.Types.ObjectId, required: true },
  revision: { type: Number, required: true },
  contentHash: { type: String, required: true },
  text: { type: String, required: true },
  checkpointStart: { type: Number, required: true },
  checkpointEnd: { type: Number, required: true },
}, { versionKey: false });
schema.index({ workId: 1, checkpointEnd: 1 });
export default mongoose.model("DevelopmentSample", schema);
