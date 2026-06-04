// backend/models/Relationship.js
import mongoose from "mongoose";

const RelationshipSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User",      required: true, index: true },
    work: { type: mongoose.Schema.Types.ObjectId, ref: "Work",      required: true, index: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: "Character", required: true, index: true },
    to:   { type: mongoose.Schema.Types.ObjectId, ref: "Character", required: true, index: true },

    // enum kaldırıldı — custom ilişki türlerine izin ver
    type: {
      type:     String,
      required: true,
      trim:     true,
      maxlength: 80,
      index:    true,
    },

    label:    { type: String,  default: "",     trim: true },
    strength: { type: Number,  default: 3,      min: 1, max: 5 },
    directed: { type: Boolean, default: true },
    color:    { type: String,  default: "",     trim: true }, // kullanıcı tanımlı ip rengi

    status: { type: String, default: "active", enum: ["active", "archived"] },
  },
  { timestamps: true }
);

RelationshipSchema.pre("validate", function (next) {
  if (this.from?.toString() === this.to?.toString()) return next(new Error("REL_SELF"));
  next();
});

// Directed duplicate kilidi
RelationshipSchema.index(
  { user: 1, work: 1, from: 1, to: 1, type: 1, directed: 1 },
  { unique: true }
);

RelationshipSchema.index({ user: 1, work: 1, updatedAt: -1 });

export default mongoose.model("Relationship", RelationshipSchema);