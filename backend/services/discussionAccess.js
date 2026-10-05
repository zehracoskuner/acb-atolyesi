import Chapter from '../models/Chapter.js';
import Work from '../models/Work.js';

// Public comments must not reveal withdrawn or private chapters through a
// secondary endpoint. The caller's reader context also applies the age filter.
export async function publishedDiscussion(workId, chapterId) {
  if (chapterId) {
    const chapter = await Chapter.findOne({ _id: chapterId, status: 'published', moderationHold: { $ne: true } }).select('work').lean();
    if (!chapter || (workId && String(workId) !== String(chapter.work))) return false;
    return !!await Work.exists({ _id: chapter.work, status: 'published', publishedChapterIds: chapterId });
  }
  return !!workId && !!await Work.exists({ _id: workId, status: 'published' });
}
