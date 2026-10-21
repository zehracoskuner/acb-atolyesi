import mongoose from "mongoose";

export const chapterMediaSchema = new mongoose.Schema({
  type: { type: String, enum: ["image", "youtube", "spotify"], required: true },
  url: { type: String, required: true, maxlength: 2048 },
  caption: { type: String, default: "", maxlength: 240 },
}, { _id: false });
