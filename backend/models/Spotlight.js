import mongoose from "mongoose";

const ids = [{ type: mongoose.Schema.Types.ObjectId, ref: "Work" }];
const bins = () => Array(48).fill(0);
const rotationSchema = new mongoose.Schema({
  _id: { type: String, default: "main" },
  revision: { type: Number, default: 0 },
  publicationBackfillDone: { type: Boolean, default: false },
  roundId: { type: Number, default: 0 },
  roundOrder: ids,
  cursor: { type: Number, default: 0 },
  slotDuration: { type: Number, default: 86400000 },
  minimumDurationLocked: { type: Boolean, default: false },
  currentWorkId: { type: mongoose.Schema.Types.ObjectId, default: null },
  slotStartedAt: Date,
  slotEndsAt: Date,
  lastTickAt: Date,
  slotExposureMs: { type: [Number], default: bins },
  slotServedMs: { type: Number, default: 0 },
}, { versionKey: false });

const historySchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: "Work" },
  firstEnrolledRound: { type: Number, required: true },
  completedShows: { type: Number, default: 0 },
  totalExposureMs: { type: Number, default: 0 },
  // Both counts and actual exposure are retained: a 40-minute slot spans bins unevenly.
  slotCounts: { type: [Number], default: bins },
  exposureMs: { type: [Number], default: bins },
  anchorMinute: Number,
  lastStartedAt: Date,
  lastCompletedAt: Date,
}, { versionKey: false });

const showingSchema = new mongoose.Schema({
  work: { type: mongoose.Schema.Types.ObjectId, required: true },
  roundId: { type: Number, required: true },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
  plannedDurationMs: Number,
  servedMs: Number,
  exposureMs: [Number],
  status: { type: String, enum: ["completed", "withdrawn"], required: true },
}, { versionKey: false });
showingSchema.index({ work: 1, endedAt: -1 });
showingSchema.index({ roundId: 1, work: 1 }, { unique: true });

export const SpotlightRotation = mongoose.model("SpotlightRotation", rotationSchema);
export const SpotlightHistory = mongoose.model("SpotlightHistory", historySchema);
export const SpotlightShowing = mongoose.model("SpotlightShowing", showingSchema);
