import mongoose from "mongoose";

const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  passwordFingerprint: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});

export default mongoose.model("AuthSession", schema);
