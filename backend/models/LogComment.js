// backend/models/LogComment.js
import mongoose from "mongoose";

const logCommentSchema = new mongoose.Schema(
  {
    log: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Log",
      required: true,
      index:    true,
    },
    author: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    content: {
      type:      String,
      required:  true,
      maxlength: 500,
      trim:      true,
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "LogComment", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("LogComment", logCommentSchema);
