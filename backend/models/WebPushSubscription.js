import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: String, auth: String },
  sessionHash: { type: String, required: true },
  registeredAt: { type: Date, default: Date.now },
  scanAt: Date,
}, { timestamps: true });
export default mongoose.model('WebPushSubscription', schema);
