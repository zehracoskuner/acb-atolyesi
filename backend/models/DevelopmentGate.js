import mongoose from "mongoose";
// One durable lock per USER, across works and application processes. No TTL:
// after a crash an operator must verify the provider stopped before clearing it.
const schema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  token: String,
  startedAt: Date,
  lastSuccessAt: Date,
}, { versionKey: false });
export default mongoose.model("DevelopmentGate", schema);
