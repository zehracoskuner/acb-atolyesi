import mongoose from 'mongoose';
import Chapter from '../models/Chapter.js';
import Work from '../models/Work.js';
import Notification from '../models/Notification.js';
import { staff } from './contentModeration.js';
import { fail, textField } from './reportWorkflow.js';
import { txOptions } from './imageAssets.js';

export function chapterReview(action) {
  return async (req, res) => {
    try {
      staff(req.user);
      const reason = textField(req.body?.reason || req.body?.reviewNote);
      const result = await mongoose.connection.transaction(async session => {
        const chapter = await Chapter.findById(req.params.id).session(session);
        if (!chapter) fail(404, 'Bölüm bulunamadı.');
        if (!Number.isInteger(req.body.expectedRevision) || req.body.expectedRevision !== chapter.revision) fail(409, 'Bölüm sürümü değişti; güncel metni inceleyin.');
        const work = await Work.findById(chapter.work).session(session);
        if (String(work.user) === req.user.id) fail(403, 'Kendi bölümünüzde karar veremezsiniz.');
        if (action === 'approve' && chapter.status !== 'pending_review') fail(409, 'Yazar önce yeniden inceleme istemelidir.');
        chapter.status = action === 'approve' ? 'published' : 'rejected';
        chapter.moderationHold = action !== 'approve';
        if (action === 'approve') chapter.moderationCase = null;
        chapter.reviewNote = reason; chapter.reviewedBy = req.user.id; chapter.reviewedAt = new Date();
        chapter.reviewHistory.push({ revision: chapter.revision, by: req.user.id, at: new Date(), action, reason });
        await chapter.save({ session });
        work.publishedChapterIds = work.publishedChapterIds.filter(id => String(id) !== String(chapter._id));
        if (action === 'approve') work.publishedChapterIds.push(chapter._id);
        work.status = work.publishedChapterIds.length ? 'published' : 'draft';
        await work.save({ session });
        await Notification.create([{ recipient: work.user, sender: null, type: action === 'approve' ? 'chapter_approved' : 'chapter_rejected', work: work._id,
          text: `ACB Atölyesi: "${chapter.title}" ${action === 'approve' ? 'yayına alındı' : 'yayından kaldırıldı'}. Gerekçe: ${reason}` }], { session });
        return chapter;
      }, txOptions);
      res.json({ item: result, bolum: result, message: 'İnceleme kaydedildi.' });
    } catch (e) { res.status(e.status || 503).json({ message: e.message }); }
  };
}
