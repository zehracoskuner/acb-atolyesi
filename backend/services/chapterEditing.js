import { captureDevelopmentWriting } from "./developmentWriting.js";
import mongoose from "mongoose";
import Chapter from "../models/Chapter.js";
import Work from "../models/Work.js";
import { sanitizeChapterHtml } from "../utils/sanitizeHtml.js";
import { ownerChapter } from "./chapterPublication.js";
import { validateChapterMedia } from "./chapterMedia.js";
import { chapterEditorContent, preserveLegacyClientParagraphIds } from "./readerContent.js";

import { initializeDevelopment, advanceDevelopment, developmentStatus } from "./developmentProgress.js";

const fail = (status, message) => Object.assign(new Error(message), { status });
export async function createChapter({ workId, userId, title }) {
  if (title !== undefined && typeof title !== "string") throw fail(400, "Başlık metin olmalıdır.");
  return mongoose.connection.transaction(async session => {
    const work = await Work.findOne({ _id: workId, user: userId }).session(session);
    if (!work) throw fail(403, "Erişim reddedildi.");
    // Serialize simultaneous appends to this work before reading its last order.
    await Work.updateOne({ _id: workId }, { $inc: { __v: 1 } }, { session });
    const last = await Chapter.findOne({ work: workId }).sort({ order: -1 }).session(session);
    const order = last ? last.order + 1 : 1;
    const savedAt = new Date();
    const [chapter] = await Chapter.create([{ work: workId, title: title?.trim() || `Bölüm ${order}`,
      content: "", order, status: "draft", revision: 0, savedAt }], { session });
    return { item: chapter, revision: 0, savedAt };
  }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
}

async function ownedChapter(id, userId, session = null) {
  const chapter = await Chapter.findById(id).select("+draftContent").session(session);
  if (!chapter) throw fail(404, "Bölüm bulunamadı.");
  const work = await Work.findOne({ _id: chapter.work, user: userId }).session(session);
  if (!work) throw fail(403, "Bu bölüme yalnızca eser sahibi erişebilir.");
  return { chapter, work };
}

// Reordering changes metadata only; it must not create a text revision,
// reset moderation/publication or overwrite a newer text from another device.
export async function updateChapterOrder({ id, userId, order }) {
  if (!Number.isSafeInteger(order) || order < 0)
    throw fail(400, "Bölüm sırası sıfır veya pozitif bir tam sayı olmalı.");
  return mongoose.connection.transaction(async session => {
    const { chapter } = await ownedChapter(id, userId, session);
    // Use the same work lock as createChapter for concurrent appends.
    await Work.updateOne({ _id: chapter.work }, { $inc: { __v: 1 } }, { session });
    chapter.order = order;
    await chapter.save({ session });
    return { item: ownerChapter(chapter), revision: chapter.revision ?? 0,
      savedAt: chapter.savedAt, draftedFromPublished: false };
  }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
}

export async function saveChapter({ id, userId, expectedRevision, title, content, media, eligibleWordDelta = 0, paragraphEditing = false }) {
  if (!Number.isSafeInteger(eligibleWordDelta) || eligibleWordDelta < 0) throw fail(400, "Geçersiz kelime artışı.");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw fail(400, "Güncel kayıt bilgisi gerekli. Bölümü yeniden açın.");
  if ((title !== undefined && typeof title !== "string") || (content !== undefined && typeof content !== "string"))
    throw fail(400, "Başlık ve içerik metin olmalıdır.");
  return mongoose.connection.transaction(async session => {
    const { chapter, work } = await ownedChapter(id, userId, session);
    const revision = chapter.revision ?? 0;
    if (revision !== expectedRevision) {
      throw Object.assign(fail(409, "Bölüm başka bir sekme veya cihazda değişti. Metniniz korunuyor; sunucudaki metni karşılaştırın."), {
        code: "CHAPTER_CONFLICT", current: ownerChapter(chapter),
      });
    }
    await initializeDevelopment(work, session);
    const current = ownerChapter(chapter);
    const nextTitle = title === undefined ? current.title : title.trim() || current.title;
    const cleanContent = value => sanitizeChapterHtml(value, { paragraphIds: true });
    const matchesContent = (next, saved) => next === saved ||
      (paragraphEditing && next === cleanContent(chapterEditorContent(saved)));
    let nextContent = content === undefined ? current.content : cleanContent(content);
    if (content !== undefined && !paragraphEditing) {
      nextContent = preserveLegacyClientParagraphIds(nextContent, current.content);
    }
    const nextMedia = media === undefined ? (current.media || []) : await validateChapterMedia(media, userId, session, current.media || []);
    const contentChanged = !matchesContent(nextContent, current.content);
    if (!contentChanged) nextContent = current.content;
    const changed = nextTitle !== current.title || contentChanged || JSON.stringify(nextMedia) !== JSON.stringify(current.media || []);
    if (!changed) {
      if (work.isModified()) await work.save({ session });
      return { item: current, revision, savedAt: chapter.savedAt || chapter.updatedAt, draftedFromPublished: false, development: developmentStatus(work) };
    }

    const acceptedWords = await captureDevelopmentWriting({ chapter, work, beforeContent: current.content, nextContent, claimed: eligibleWordDelta, excluded: !contentChanged, session });
    const savedAt = new Date();
    const keepPublished = chapter.status === "published";
    const drafted = !keepPublished && chapter.status !== "draft";
    if (["pending_review", "rejected"].includes(chapter.status)) chapter.moderationHold = true;
    if (keepPublished) {
      chapter.publishedRevision ??= revision;
      chapter.hasUnpublishedChanges = nextTitle !== chapter.title || !matchesContent(nextContent, chapter.content) || JSON.stringify(nextMedia) !== JSON.stringify(chapter.media || []);
      chapter.draftContent = chapter.hasUnpublishedChanges ? { title: nextTitle, content: nextContent, media: nextMedia } : undefined;
      chapter.set({ revision: revision + 1, savedAt });
    } else {
      chapter.set({ title: nextTitle, content: nextContent, media: nextMedia, revision: revision + 1, savedAt,
        draftContent: undefined, hasUnpublishedChanges: false, publishedRevision: undefined,
        status: "draft", ...(chapter.moderationHold ? {} : { reviewNote: "", reviewedAt: null, reviewedBy: null }) });
    }
    await chapter.save({ session });
    advanceDevelopment(work, acceptedWords);
    if (!keepPublished) work.publishedChapterIds = (work.publishedChapterIds || []).filter(value => String(value) !== String(id));
    work.status = work.publishedChapterIds.length ? "published" : "draft";
    await work.save({ session });
    return { item: ownerChapter(chapter), revision: chapter.revision, savedAt, draftedFromPublished: drafted, development: developmentStatus(work) };
  }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" }).catch(async error => {
    if (error.name === "VersionError") {
      const { chapter } = await ownedChapter(id, userId);
      if ((chapter.revision ?? 0) !== expectedRevision) throw Object.assign(
        fail(409, "Bölüm başka bir sekme veya cihazda değişti. Metniniz korunuyor."),
        { code: "CHAPTER_CONFLICT", current: ownerChapter(chapter) });
    }
    throw error;
  });
}
