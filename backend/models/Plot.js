// backend/models/Plot.js
import mongoose from "mongoose";

const sceneSchema = new mongoose.Schema(
  {
    title: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 200,
    },
    description: {
      type:      String,
      default:   "",
      maxlength: 2000,
    },
    // Act artık serbest string — "giris", "gelisme", "act1", "beginning" hepsi geçerli
    act: {
      type:    String,
      default: "giris",
      trim:    true,
    },
    goal: {
      type:      String,
      default:   "",
      maxlength: 500,
    },
    volume: {
      type:    String,
      enum:    ["short", "medium", "long", ""],
      default: "",
    },
    isAlternative: {
      type:    Boolean,
      default: false,
    },
    status: {
      type:    String,
      enum:    ["idea", "drafting", "writing", "done"],
      default: "idea",
    },
    time: {
      type:      String,
      default:   "",
      maxlength: 200,
    },
    draftText: {
      type:      String,
      default:   "",
      maxlength: 50000,
    },
    chapter: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Chapter",
      default: null,
    },
    characters: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Character" },
    ],
     connections: [{
   target:   { type: mongoose.Schema.Types.ObjectId, required: false },
   edgeType: { type: String, default: "sonuc" },
 }],
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const plotSchema = new mongoose.Schema(
  {
    work: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Work",
      required: true,
      unique:   true,
      index:    true,
    },
    // Sahneler flat array — act field'ı hangi perdeye ait olduğunu tutar
    scenes: { type: [sceneSchema], default: [] },

    // Geriye dönük uyumluluk: eski nested acts yapısı okunur ama artık yazılmaz
    acts: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Plot", plotSchema);