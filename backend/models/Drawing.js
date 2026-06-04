// backend/models/Drawing.js
import mongoose from "mongoose";

const drawingSchema = new mongoose.Schema(
  {
    work: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Work",
      required: true,
      unique:   true,
      index:    true,
    },
    // Cloudinary'de saklanan JSON dosyasının URL'si
    snapshotUrl: {
      type:    String,
      default: null,
    },
    // Cloudinary public_id — üzerine yazma/silme için
    snapshotPublicId: {
      type:    String,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Drawing", drawingSchema);