import mongoose from "mongoose";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";

// One read-only transaction pins title, chapter membership, order and text to
// the same database snapshot, including cursor getMore calls for long books.
// Never fall back to ordinary reads: those can silently mix different versions.
export async function readBookSnapshot(workId, userId) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
    const work = await Work.findOne({ _id: workId, user: userId })
      .select("title").session(session).lean();
    if (!work) throw Object.assign(new Error("Eser bulunamadı veya indirme yetkiniz yok."), { status: 404 });
    const manifest = await Chapter.find({ work: workId })
      .select("_id revision").session(session).lean();
    const chapters = await Chapter.find({ work: workId })
      .select("_id revision title content order createdAt")
      .sort({ order: 1, createdAt: 1, _id: 1 }).session(session).lean();
    const ids = new Set(chapters.map(ch => String(ch._id)));
    const revisions = new Map(chapters.map(ch => [String(ch._id), ch.revision ?? 0]));
    if (ids.size !== manifest.length || manifest.some(ch => !ids.has(String(ch._id))) ||
        manifest.some(ch => revisions.get(String(ch._id)) !== (ch.revision ?? 0)) ||
        chapters.some(ch => typeof ch.content !== "string" || typeof ch.title !== "string")) {
      throw new Error("Eksik bölüm içeriği.");
    }
    const snapshot = Object.freeze({ title: work.title, chapters: Object.freeze(chapters.map(ch =>
      Object.freeze({ title: ch.title, content: ch.content }))) });
    await session.commitTransaction();
    return snapshot;
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}
