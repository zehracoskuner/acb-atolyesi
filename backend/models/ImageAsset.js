import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  url: { type: String, required: true, unique: true },
  publicId: String, providerVersion: String,
  bytes: { type: Buffer, select: false }, mime: String,
  state: { type: String, enum: ['active', 'removed'], default: 'active' },
  delivery: { type: String, enum: ['available', 'purge_pending', 'purged', 'external'], default: 'available' },
  deliveryError: String,
}, { timestamps: true });
export default mongoose.model('ImageAsset', schema);
