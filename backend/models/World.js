// backend/models/World.js
import mongoose from "mongoose";

const entrySchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 2000 },
    notes:       { type: String, default: "", maxlength: 2000 },
    // Bu entry hangi sahnelerle ilişkili?
    scenes: [
      {
        sceneId:    { type: mongoose.Schema.Types.ObjectId },
        sceneTitle: { type: String },
        act:        { type: String },
      },
    ],
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const worldSchema = new mongoose.Schema(
  {
    work: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Work",
      required: true,
      unique:   true,
      index:    true,
    },
    title:     { type: String, default: "" },
    // Dinamik perde yapısı — StructureSetupModal'dan kaydedilir
    structure: {
      templateId: { type: String, default: null },
      acts: [
        {
          id:    { type: String },
          label: { type: String },
          color: { type: String },
          roman: { type: String },
        }
      ],
    },
    locations: { type: [entrySchema], default: [] },
    timeline:  { type: [entrySchema], default: [] },
    rules:     { type: [entrySchema], default: [] },
    notes:     { type: [entrySchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("World", worldSchema);