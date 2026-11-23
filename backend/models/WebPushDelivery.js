import mongoose from 'mongoose';
import { NOTIFICATION_RETENTION_SECONDS } from '../config/notificationRetention.js';
const schema = new mongoose.Schema({
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'WebPushSubscription', required: true },
  notification: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', required: true },
  state: { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued', index: true },
  attempts: { type: Number, default: 0 }, attemptedAt: Date, error: String,
}, { timestamps: true });
schema.index({ subscription: 1, notification: 1 }, { unique: true });
schema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_RETENTION_SECONDS });
export default mongoose.model('WebPushDelivery', schema);
