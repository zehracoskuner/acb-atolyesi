import mongoose from 'mongoose';
const id = mongoose.Schema.Types.ObjectId;
const schema = new mongoose.Schema({
  _id: { type: id, ref: 'User' }, lock: { type: Number, default: 0 },
  violations: [{ caseId: id, asset: id, at: Date, active: Boolean, consumedBy: id }],
  penalties: [{ at: Date, until: Date, cases: [id], revokedAt: Date }],
  manual: { until: Date, reason: String, by: id },
  manualHistory: [{ at: Date, until: Date, reason: String, by: id }],
}, { timestamps: true });
export default mongoose.model('VisualAccount', schema);
