import mongoose from 'mongoose';
import Chapter from '../models/Chapter.js';
import Work from '../models/Work.js';
import User from '../models/User.js';
import { txOptions } from './imageAssets.js';
import { pinPublishedInlineComments } from './inlineCommentPublication.js';

// Only owner/editor/export paths opt into the private draft field.
export function ownerChapter(chapter) {
  const item = chapter.toObject ? chapter.toObject() : { ...chapter };
  if (item.draftContent) {
    item.title = item.draftContent.title;
    item.content = item.draftContent.content;
    item.media = item.draftContent.media ?? item.media ?? [];
  }
  delete item.draftContent;
  delete item.reviewSubmission;
  return item;
}

export const chapterReviewFilter = { $or: [{ status: 'pending_review' }, { reviewStatus: 'pending_review' }] };
// Staff review the submitted snapshot, never a newer unconfirmed working copy.
export function reviewChapter(chapter) {
  const item = chapter.toObject ? chapter.toObject() : { ...chapter };
  const submission = item.reviewSubmission;
  delete item.reviewSubmission;
  delete item.draftContent;
  return submission ? { ...item, ...submission, status: 'pending_review' } : item;
}

export function applyChapterDraft(chapter) {
  if (chapter.draftContent) {
    chapter.title = chapter.draftContent.title;
    chapter.content = chapter.draftContent.content;
    chapter.media = chapter.draftContent.media ?? chapter.media ?? [];
    chapter.draftContent = undefined;
  }
  chapter.hasUnpublishedChanges = false;
}

// Chapter visibility and the work's reader index must commit together.
export async function publishChapterVersion({ id, userId, expectedRevision, status, workId }) {
  const fail = (status, message, extra = {}) => { throw Object.assign(new Error(message), { status, ...extra }); };
  if (!['draft', 'published'].includes(status)) fail(400, 'Geçersiz durum.');
  return mongoose.connection.transaction(async session => {
    const chapter = await Chapter.findById(id).select('+draftContent +reviewSubmission').session(session);
    if (!chapter) fail(404, 'Bölüm bulunamadı.');
    const work = await Work.findOne({ _id: chapter.work, user: userId }).session(session);
    if (!work) fail(403, 'Erişim reddedildi.');
    if (workId !== undefined && (typeof workId !== 'string' || workId.toLowerCase() !== String(chapter.work))) fail(400, 'workId bölümün eseriyle uyuşmuyor.');
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== (chapter.revision ?? 0))
      fail(409, 'Bölüm değişti; yayınlamadan önce güncel metni kontrol edin.', { code: 'CHAPTER_CONFLICT', current: ownerChapter(chapter) });
    const wasPublished = chapter.status === 'published';
    let pending = false;
    if (status === 'draft') {
      if (wasPublished) await pinPublishedInlineComments(chapter, session);
      if (['pending_review', 'rejected'].includes(chapter.status) || chapter.reviewStatus) chapter.moderationHold = true;
      applyChapterDraft(chapter);
      chapter.status = 'draft'; chapter.publishedRevision = undefined;
      chapter.reviewSubmission = undefined; chapter.reviewStatus = '';
    } else {
      const working = ownerChapter(chapter);
      if (!working.content?.trim()) fail(400, 'Bölüm içeriği boş, yayınlanamaz.');
      const user = await User.findById(userId).select('contentBanned').session(session).lean();
      if (user?.contentBanned || chapter.moderationHold || ['pending_review', 'rejected'].includes(chapter.status) || chapter.reviewStatus) {
        chapter.reviewSubmission = { title: working.title, content: working.content, media: working.media || [], revision: chapter.revision ?? 0 };
        chapter.reviewStatus = 'pending_review'; chapter.moderationHold = true;
        if (!wasPublished) chapter.status = 'pending_review';
        chapter.reviewNote = 'Moderatör onayı bekleniyor.';
        pending = true;
      } else {
        if (wasPublished && working.content !== chapter.content) await pinPublishedInlineComments(chapter, session);
        applyChapterDraft(chapter);
        chapter.publishedRevision = chapter.revision ?? 0;
        chapter.status = 'published'; chapter.reviewNote = '';
        chapter.reviewSubmission = undefined; chapter.reviewStatus = '';
      }
    }
    await chapter.save({ session });
    work.publishedChapterIds = (work.publishedChapterIds || []).filter(value => String(value) !== String(chapter._id));
    if (chapter.status === 'published') work.publishedChapterIds.push(chapter._id);
    work.status = work.publishedChapterIds.length ? 'published' : 'draft';
    await work.save({ session });
    return { item: ownerChapter(chapter), pending, status: pending ? 'pending_review' : chapter.status,
      publicationUpdated: wasPublished && status === 'published' && !pending,
      message: pending ? 'Bölüm değişiklikleri incelemeye gönderildi. Mevcut yayın varsa korunuyor.' : status === 'draft' ? 'Bölüm taslağa alındı.' : wasPublished ? 'Değişiklikler yayınlandı.' : 'Bölüm yayınlandı.' };
  }, txOptions);
}
