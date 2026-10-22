import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  device: { type: mongoose.Schema.Types.ObjectId, ref: 'PushDevice', required: true },
  notification: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', required: true },
  state: { type: String, enum: ['queued', 'ticket', 'sent', 'failed'], default: 'queued', index: true },
  ticket: String, attemptedAt: Date, attempts: { type: Number, default: 0 }, error: String,
}, { timestamps: true });
schema.index({ device: 1, notification: 1 }, { unique: true });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 86400 });
export default mongoose.model('PushDelivery', schema);
