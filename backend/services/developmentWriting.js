import { createHash } from "node:crypto";
import { Parser } from "htmlparser2";
import ChapterVersion from "../models/ChapterVersion.js";
import Fingerprint from "../models/DevelopmentFingerprint.js";
import Sample from "../models/DevelopmentSample.js";

export function plainWords(html = "") {
  let text = "";
  const parser = new Parser({ ontext: t => { text += t; }, onclosetag: () => { text += " "; } });
  parser.write(html); parser.end();
  return text.normalize("NFC").trim().split(/\s+/u).filter(Boolean);
}
export const textHash = text => createHash("sha256").update(text).digest("hex");
async function remember(workId, text, session) {
  if (text) await Fingerprint.updateOne({ workId, hash: textHash(text) }, { $setOnInsert: { workId, hash: textHash(text) } }, { upsert: true, session });
}

// Conservative net-new accounting, not plagiarism detection. The lifetime
// chapter high-water prevents delete/reinsert and undo inflation. Fingerprints
// also catch a second copy appended to the same/different chapter of this work.
export async function captureDevelopmentWriting({ chapter, work, nextContent, claimed, excluded, session }) {
  const before = plainWords(chapter.content), after = plainWords(nextContent);
  if (chapter.developmentWordHighWater == null) {
    let high = before.length;
    for await (const version of ChapterVersion.find({ chapter: chapter._id }).select("content").session(session).lean().cursor()) {
      const words = plainWords(version.content);
      high = Math.max(high, words.length);
      await remember(work._id, words.join(" "), session);
    }
    chapter.developmentWordHighWater = high;
  }
  await remember(work._id, before.join(" "), session);
  let start = 0, end = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  const inserted = after.slice(start, after.length - end).join(" ");
  const full = after.join(" ");
  // Single words/common short phrases are legitimate recurring writing.
  // Fingerprint pasted spans only when substantial; full-document hashes and
  // the high-water still protect short document reloads/delete-and-reinsert.
  const substantial = after.length - start - end >= 32;
  const hashes = [textHash(full), ...(substantial ? [textHash(inserted)] : [])];
  const repeated = await Fingerprint.exists({ workId: work._id, hash: { $in: hashes } }).session(session);
  const words = excluded || repeated ? 0 : Math.min(claimed, Math.max(0, after.length - chapter.developmentWordHighWater));
  chapter.developmentWordHighWater = Math.max(chapter.developmentWordHighWater, after.length);
  await remember(work._id, full, session);
  if (substantial) await remember(work._id, inserted, session);
  if (words) await Sample.create([{
    workId: work._id, chapterId: chapter._id, revision: (chapter.revision || 0) + 1,
    contentHash: textHash(full), text: inserted,
    checkpointStart: work.developmentNewWords || 0, checkpointEnd: (work.developmentNewWords || 0) + words,
  }], { session });
  return words;
}
