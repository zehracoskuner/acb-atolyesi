import mongoose from "mongoose";

const librarySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    work: { type: mongoose.Schema.Types.ObjectId, ref: "Work", required: true },
  },
  { timestamps: true }
);

// Aynı kullanıcı aynı eseri iki kez ekleyemesin
librarySchema.index({ user: 1, work: 1 }, { unique: true });

export default mongoose.model("Library", librarySchema);