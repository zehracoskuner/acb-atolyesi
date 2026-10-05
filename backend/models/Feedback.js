import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: ['suggestion', 'complaint'], required: true },
  subject: { type: String, required: true, maxlength: 160 },
  message: { type: String, required: true, maxlength: 4000 },
  status: { type: String, enum: ['new', 'reviewing', 'closed'], default: 'new' },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
schema.index({ status: 1, createdAt: -1 });
export default mongoose.model('Feedback', schema);
