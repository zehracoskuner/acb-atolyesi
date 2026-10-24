import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: String,
  nextAt: { type: Date, required: true },
});
schema.index({ nextAt: 1 }, { expireAfterSeconds: 86400 });
export default mongoose.model("MentionCooldown", schema);
