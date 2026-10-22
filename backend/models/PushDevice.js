import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  token: { type: String, required: true, unique: true },
  platform: { type: String, enum: ['ios', 'android'], required: true },
  sessionHash: { type: String, required: true },
  registeredAt: { type: Date, default: Date.now }, scanAt: Date,
}, { timestamps: true });
export default mongoose.model('PushDevice', schema);
