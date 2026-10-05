import mongoose from 'mongoose';
const id = mongoose.Schema.Types.ObjectId;
const schema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  kind: { type: String, enum: ['cover', 'avatar', 'banner', 'chapter'], required: true },
  target: { type: id, required: true }, owner: { type: id, required: true },
  asset: { type: id, ref: 'ImageAsset' }, version: String,
  snapshot: { type: mongoose.Schema.Types.Mixed, select: false },
  status: { type: String, enum: ['pending', 'removed', 'dismissed', 'reversed'], default: 'pending' },
  revision: { type: Number, default: 0 }, reportCount: { type: Number, default: 0 },
  notifiedThreshold: { type: Boolean, default: false },
  events: [{ at: Date, by: id, action: String, reason: String, message: String }],
  restoreMarker: String,
}, { timestamps: true });
schema.index({ status: 1, updatedAt: -1 });
export default mongoose.model('ContentCase', schema);
