import { captureDevelopmentWriting } from "./developmentWriting.js";
import mongoose from "mongoose";
import Chapter from "../models/Chapter.js";
import Work from "../models/Work.js";
import ChapterVersion from "../models/ChapterVersion.js";
import { sanitizeChapterHtml } from "../utils/sanitizeHtml.js";

import { initializeDevelopment, advanceDevelopment, developmentStatus } from "./developmentProgress.js";

const fail = (status, message) => Object.assign(new Error(message), { status });
export async function markChapterCheckpoint({ id, userId, expectedRevision, label = "" }) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw fail(400, "Güncel kayıt bilgisi gerekli.");
  if (typeof label !== "string" || label.trim().length > 80) throw fail(400, "Kayıt adı en fazla 80 karakter olmalıdır.");
  return mongoose.connection.transaction(async session => {
    const { chapter } = await ownedChapter(id, userId, session);
    const revision = chapter.revision ?? 0;
    if (revision !== expectedRevision) throw Object.assign(fail(409, "Bölüm değişti. Güncel metni kontrol edin."), { code: "CHAPTER_CONFLICT", current: chapter.toObject() });
    // Legacy chapters may not have a snapshot yet. Capture exactly the saved text,
    // without changing the chapter, revision, publication state or save timestamp.
    let item = await ChapterVersion.findOne({ chapter: id, revision }).session(session);
    if (!item) [item] = await ChapterVersion.create([{
      chapter: id, work: chapter.work, revision, title: chapter.title, content: chapter.content,
      savedAt: chapter.savedAt || chapter.updatedAt,
    }], { session });
    item.isCheckpoint = true;
    item.label = label.trim();
    await item.save({ session });
    return { item };
  }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
}

export async function createChapterVersion({ workId, userId, title }) {
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
    await ChapterVersion.create([{ chapter: chapter._id, work: workId, revision: 0,
      title: chapter.title, content: "", savedAt }], { session });
    return { item: chapter, revision: 0, savedAt };
  }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
}

export async function ownedChapter(id, userId, session = null) {
  const chapter = await Chapter.findById(id).session(session);
  if (!chapter) throw fail(404, "Bölüm bulunamadı.");
  const work = await Work.findOne({ _id: chapter.work, user: userId }).session(session);
  if (!work) throw fail(403, "Bu bölümün geçmişine yalnızca eser sahibi erişebilir.");
  return { chapter, work };
}

// Reordering changes metadata only; it must not create a text revision,
// reset moderation/publication or overwrite a newer text from another device.
export async function updateChapterOrder({ id, userId, order }) {
  if (!Number.isSafeInteger(order) || order < 0)
    throw fail(400, "Bölüm sırası sıfır veya pozitif bir tam sayı olmalı.");
  return mongoose.connection.transaction(async session => {
    const { chapter } = await ownedChapter(id, userId, session);
    // Use the same work lock as createChapterVersion for concurrent appends.
    await Work.updateOne({ _id: chapter.work }, { $inc: { __v: 1 } }, { session });
    chapter.order = order;
    await chapter.save({ session });
    return { item: chapter, revision: chapter.revision ?? 0,
      savedAt: chapter.savedAt, draftedFromPublished: false };
  }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
}

export async function saveChapterVersion({ id, userId, expectedRevision, title, content, restoreRevision, eligibleWordDelta = 0 }) {
  if (!Number.isSafeInteger(eligibleWordDelta) || eligibleWordDelta < 0) throw fail(400, "Geçersiz kelime artışı.");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw fail(400, "Güncel kayıt bilgisi gerekli. Bölümü yeniden açın.");
  if ((title !== undefined && typeof title !== "string") || (content !== undefined && typeof content !== "string"))
    throw fail(400, "Başlık ve içerik metin olmalıdır.");
  if (restoreRevision !== undefined && (!Number.isSafeInteger(restoreRevision) || restoreRevision < 0))
    throw fail(400, "Geçersiz kayıt.");
  return mongoose.connection.transaction(async session => {
    const { chapter, work } = await ownedChapter(id, userId, session);
    const revision = chapter.revision ?? 0;
    if (revision !== expectedRevision) {
      throw Object.assign(fail(409, "Bölüm başka bir sekme veya cihazda değişti. Metniniz korunuyor; sunucudaki metni karşılaştırın."), {
        code: "CHAPTER_CONFLICT", current: chapter.toObject(),
      });
    }
    await initializeDevelopment(work, session);
    let source;
    if (restoreRevision !== undefined) {
      source = await ChapterVersion.findOne({ chapter: id, revision: restoreRevision }).session(session);
      if (!source) throw fail(404, "Kayıt bulunamadı.");
      title = source.title;
      content = source.content;
    }
    const nextTitle = title === undefined ? chapter.title : title.trim() || chapter.title;
    const nextContent = content === undefined ? chapter.content : sanitizeChapterHtml(content);
    const contentChanged = nextContent !== chapter.content;
    const changed = nextTitle !== chapter.title || nextContent !== chapter.content;
    if (!changed && source) throw fail(400, "Seçilen metin mevcut metinle aynı; geri yükleme gerekmiyor.");
    if (!changed && !source) {
      if (work.isModified()) await work.save({ session });
      return { item: chapter, revision, savedAt: chapter.savedAt || chapter.updatedAt, draftedFromPublished: false, development: developmentStatus(work) };
    }

    // Capture legacy/current text before replacing it. This is lazy, never a bulk migration.
    const previous = await ChapterVersion.exists({ chapter: id, revision }).session(session);
    if (!previous) await ChapterVersion.create([{
      chapter: id, work: chapter.work, revision, title: chapter.title, content: chapter.content,
      savedAt: chapter.savedAt || chapter.updatedAt || new Date(),
    }], { session });
    const acceptedWords = await captureDevelopmentWriting({ chapter, work, nextContent, claimed: eligibleWordDelta, excluded: !!source || !contentChanged, session });
    const savedAt = new Date();
    const drafted = chapter.status !== "draft";
    if (["pending_review", "rejected"].includes(chapter.status)) chapter.moderationHold = true;
    chapter.set({ title: nextTitle, content: nextContent, revision: revision + 1, savedAt,
      status: "draft", ...(chapter.moderationHold ? {} : { reviewNote: "", reviewedAt: null, reviewedBy: null }) });
    await chapter.save({ session });
    await ChapterVersion.create([{
      chapter: id, work: chapter.work, revision: chapter.revision, title: nextTitle,
      content: nextContent, savedAt, ...(source ? { restoredFrom: source.revision, restoredFromRevision: source.revision } : {}),
    }], { session });
    advanceDevelopment(work, acceptedWords);
    work.publishedChapterIds = (work.publishedChapterIds || []).filter(value => String(value) !== String(id));
    work.status = work.publishedChapterIds.length ? "published" : "draft";
    await work.save({ session });
    return { item: chapter, revision: chapter.revision, savedAt, draftedFromPublished: drafted, development: developmentStatus(work) };
  }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" }).catch(async error => {
    // Concurrent legacy baseline inserts can surface as duplicate-key errors;
    // convert only a verified moved revision into a user-visible conflict.
    if (error.code === 11000 || error.name === "VersionError") {
      const { chapter } = await ownedChapter(id, userId);
      if ((chapter.revision ?? 0) !== expectedRevision) throw Object.assign(
        fail(409, "Bölüm başka bir sekme veya cihazda değişti. Metniniz korunuyor."),
        { code: "CHAPTER_CONFLICT", current: chapter.toObject() });
    }
    throw error;
  });
}
