import mongoose from "mongoose";

const id = mongoose.Schema.Types.ObjectId;
const milestone = new mongoose.Schema({
  chapterId: { type: id, required: true },
  text: { type: String, required: true },
  shared: Boolean,
});
const character = new mongoose.Schema({
  characterId: { type: id, required: true },
  name: { type: String, required: true },
  afterChapterId: id,
  summary: String,
  summaryAfterChapterId: id,
  portraitAssetId: id,
  portraitAfterChapterId: id,
}, { _id: false });
const relationship = new mongoose.Schema({
  relationshipId: { type: id, required: true },
  writerNote: { type: String, maxlength: 8000 },
  shared: Boolean,
  label: String,
  afterChapterId: id,
  milestones: [milestone],
}, { _id: false });

export default mongoose.model("CharacterGuide", new mongoose.Schema({
  _id: { type: id, ref: "Work" },
  enabled: { type: Boolean, default: false },
  revision: { type: Number, default: 0 },
  characters: [character],
  relationships: [relationship],
}, { timestamps: true }));
