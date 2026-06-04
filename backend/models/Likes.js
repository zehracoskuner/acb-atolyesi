// models/Like.js
import mongoose from "mongoose";

const likeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    work: { type: mongoose.Schema.Types.ObjectId, ref: "Work", required: true },
  },
  { timestamps: true }
);

// Bir kullanıcı bir eseri sadece bir kez beğenebilir
likeSchema.index({ user: 1, work: 1 }, { unique: true });

const Like = mongoose.model("Like", likeSchema);
export default Like;