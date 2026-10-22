import mongoose from 'mongoose';

// Kept outside User so public/profile serializers never expose verification secrets.
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  requestId: { type: String, required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  codeHash: { type: String, required: true },
  tokenHash: { type: String, required: true, index: true },
  sessionFingerprint: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  sentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});
export default mongoose.model('EmailChange', schema);
