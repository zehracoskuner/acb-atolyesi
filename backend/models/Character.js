import mongoose from "mongoose";

const CharacterSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    work: { type: mongoose.Schema.Types.ObjectId, ref: "Work", required: true, index: true },

    name: { type: String, required: true, trim: true },
    color: { type: String, default: "#7dd3fc" },

    tagline: { type: String, default: "" },
    notes: { type: String, default: "" },
    role: { type: String, default: "" },
    x: { type: Number, default: 240 },
    y: { type: Number, default: 200 },
    faction: { type: String, default: "" },   // birazdan kullanacağız
    location: { type: String, default: "" },  // birazdan kullanacağız
    traits: { type: [String], default: [] },
    status: { type: String, default: "active", enum: ["active", "archived"] },
  },
  { timestamps: true }
);

CharacterSchema.index({ user: 1, work: 1, updatedAt: -1 });

export default mongoose.model("Character", CharacterSchema);
