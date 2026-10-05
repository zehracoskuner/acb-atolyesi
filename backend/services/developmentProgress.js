import { DEVELOPMENT_WORD_THRESHOLD } from "../config/development.js";
import mongoose from "mongoose";
import { Parser } from "htmlparser2";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import { readDevelopmentQuota } from "./developmentQuota.js";

export function countWords(html = "") {
  let text = "";
  const parser = new Parser({ ontext: value => { text += value; }, onclosetag: () => { text += " "; } });
  parser.write(html); parser.end();
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}

export function developmentStatus(work) {
  return { analysisCount: work.developmentAnalysisCount || 0, eligibleForDevelopmentReview: (work.developmentNewWords || 0) - (work.lastDevelopmentWordCheckpoint || 0) >= DEVELOPMENT_WORD_THRESHOLD, kind: work.developmentAnalysisCount ? "comparison" : "baseline", pendingWords: Math.max(0, (work.developmentNewWords || 0) - (work.lastDevelopmentWordCheckpoint || 0)), threshold: DEVELOPMENT_WORD_THRESHOLD };
}

// Lazy baseline for existing works, sampled BEFORE a new edit/import/restore.
// A single sticky flag means even a 20,000-word legacy work queues only once.
export async function initializeDevelopment(work, session) {
  if (work.developmentInitializedAt) { advanceDevelopment(work, 0); return; }
  const chapters = await Chapter.find({ work: work._id }).select("content").session(session).lean();
  work.developmentNewWords = chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0);
  work.developmentInitializedAt = new Date();
  advanceDevelopment(work, 0);
}

export function advanceDevelopment(work, words) {
  work.developmentNewWords = (work.developmentNewWords || 0) + words;
  work.eligibleForDevelopmentReview = developmentStatus(work).eligibleForDevelopmentReview;
}

export async function readDevelopment({ workId, userId }) {
  return mongoose.connection.transaction(async session => {
    const work = await Work.findOne({ _id: workId, user: userId }).session(session);
    if (!work) throw Object.assign(new Error("Erişim reddedildi."), { status: 403 });
    await initializeDevelopment(work, session);
    if (work.isModified()) await work.save({ session });
    return { ...developmentStatus(work), quota: await readDevelopmentQuota(userId, { session }) };
  }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
}
