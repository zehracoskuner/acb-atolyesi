import mongoose from 'mongoose';
import Chapter from '../models/Chapter.js';
import Work from '../models/Work.js';
import Notification from '../models/Notification.js';
import { staff } from './contentModeration.js';
import { fail, textField } from './reportWorkflow.js';
import { txOptions } from './imageAssets.js';
import { ownerChapter } from './chapterPublication.js';

export function chapterReview(action) {
  return async (req, res) => {
    try {
      staff(req.user);
      const reason = textField(req.body?.reason || req.body?.reviewNote);
      const result = await mongoose.connection.transaction(async session => {
        const chapter = await Chapter.findById(req.params.id).select('+draftContent +reviewSubmission').session(session);
        if (!chapter) fail(404, 'Bölüm bulunamadı.');
        const submission = chapter.reviewSubmission;
        if (!submission && chapter.reviewStatus === 'rejected') fail(409, 'Bu başvuru zaten sonuçlandı; yazar yeniden inceleme istemelidir.');
        if (!submission && chapter.status !== 'pending_review' && chapter.reviewHistory.at(-1)?.revision === req.body.expectedRevision)
          fail(409, 'Bu sürümün incelemesi zaten sonuçlandı.');
        const reviewedRevision = submission?.revision ?? chapter.revision;
        if (!Number.isInteger(req.body.expectedRevision) || req.body.expectedRevision !== reviewedRevision) fail(409, 'Bölüm sürümü değişti; güncel metni inceleyin.');
        const work = await Work.findById(chapter.work).session(session);
        if (String(work.user) === req.user.id) fail(403, 'Kendi bölümünüzde karar veremezsiniz.');
        if (submission && chapter.reviewStatus === 'pending_review') {
          const working = ownerChapter(chapter);
          const wasPublished = chapter.status === 'published';
          if (action === 'approve') {
            chapter.title = submission.title; chapter.content = submission.content; chapter.media = submission.media;
            chapter.publishedRevision = submission.revision;
            chapter.status = 'published';
            chapter.hasUnpublishedChanges = working.title !== submission.title || working.content !== submission.content || JSON.stringify(working.media || []) !== JSON.stringify(submission.media || []);
            chapter.draftContent = chapter.hasUnpublishedChanges ? { title: working.title, content: working.content, media: working.media } : undefined;
            chapter.moderationHold = false; chapter.moderationCase = null;
          } else if (!wasPublished) {
            chapter.status = 'rejected'; chapter.moderationHold = true;
          }
          chapter.reviewStatus = action === 'approve' ? '' : 'rejected';
          chapter.reviewSubmission = undefined;
        } else {
        if (action === 'approve' && chapter.status !== 'pending_review') fail(409, 'Yazar önce yeniden inceleme istemelidir.');
        chapter.status = action === 'approve' ? 'published' : 'rejected';
        if (action === 'approve') chapter.publishedRevision = chapter.revision ?? 0;
        chapter.moderationHold = action !== 'approve';
        if (action === 'approve') chapter.moderationCase = null;
        }
        chapter.reviewNote = reason; chapter.reviewedBy = req.user.id; chapter.reviewedAt = new Date();
        chapter.reviewHistory.push({ revision: reviewedRevision, by: req.user.id, at: new Date(), action, reason });
        await chapter.save({ session });
        work.publishedChapterIds = work.publishedChapterIds.filter(id => String(id) !== String(chapter._id));
        if (chapter.status === 'published') work.publishedChapterIds.push(chapter._id);
        work.status = work.publishedChapterIds.length ? 'published' : 'draft';
        await work.save({ session });
        await Notification.create([{ recipient: work.user, sender: null, type: action === 'approve' ? 'chapter_approved' : 'chapter_rejected', work: work._id,
          text: `ACB Atölyesi: "${submission?.title ?? chapter.title}" ${action === 'approve' ? 'yayına alındı' : chapter.status === 'published' ? 'değişiklikleri reddedildi; mevcut yayın korunuyor' : 'reddedildi'}. Gerekçe: ${reason}` }], { session });
        return ownerChapter(chapter);
      }, txOptions);
      res.json({ item: result, bolum: result, message: 'İnceleme kaydedildi.' });
    } catch (e) { res.status(e.status || 503).json({ message: e.message }); }
  };
}
