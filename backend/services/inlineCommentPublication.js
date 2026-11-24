import InlineComment from '../models/InlineComment.js';
import { inlineCommentAnchors, readerPayload } from './readerContent.js';

// Pin comments written before paragraph identities were stored, while the
// original published snapshot is still available in the publication transaction.
export async function pinPublishedInlineComments(chapter, session) {
  const chapterId = chapter._id;
  const hashes = new Set(await InlineComment.distinct('blockId', {
    chapterId, paragraphId: null, blockId: { $exists: true },
  }).session(session));
  if (!hashes.size) return;
  const { blocks, contentVersion } = readerPayload(chapter);
  const anchors = inlineCommentAnchors(blocks, contentVersion);
  const updates = anchors.passages.flatMap(block => {
    const filter = hashes.has(block.id) && anchors.legacyFilter(block);
    return filter ? [{ updateMany: {
      filter: { chapterId, ...filter },
      update: { $set: { paragraphId: block.paragraphId } },
      timestamps: false,
    } }] : [];
  });
  if (updates.length) await InlineComment.bulkWrite(updates, { session });
}
