import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    excerpt: { type: String }, // Frontend'den gelmezse ilk 150 karakteri alabilirsin
    author: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", // User modelinle eşleşmeli
      required: true 
    },
    // models/Story.js içine eklenecekler:
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    excerpt: { type: String },
    color: { type: String, default: "purple" },
    tag: { type: String, default: "Genel" },
    color: { type: String, default: "purple" },
    isPublished: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date }
  },
  { timestamps: true }
);

const Story = mongoose.model("Story", storySchema);
export default Story;