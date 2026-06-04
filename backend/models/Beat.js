// backend/models/Beat.js
import mongoose from "mongoose";

const BeatSchema = new mongoose.Schema(
  {
    workId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    plotId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

    order: { type: Number, required: true, index: true },

    title: { type: String, default: "Yeni Beat" },
    summary: { type: String, default: "" },

    goal: { type: String, default: "" },
    conflict: { type: String, default: "" },
    outcome: { type: String, enum: ["win", "loss", "mixed", "reveal"], default: "mixed" },

    povCharacterId: { type: String, default: "" },
    locationId: { type: String, default: "" },
    timeHint: { type: String, default: "" },

    tension: { type: Number, min: 1, max: 5, default: 3 },
    tags: { type: [String], default: [] },

    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Beat", BeatSchema);
