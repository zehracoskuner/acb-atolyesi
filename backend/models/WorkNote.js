import mongoose from "mongoose";

const WorkNoteSchema = new mongoose.Schema(
  {
    workId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Work",
      required: true,
      index: true,
    },
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    source: { type: String, default: "manual", index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const WorkNote = mongoose.model("WorkNote", WorkNoteSchema);
export default WorkNote;
