import Report from '../models/Report.js';
import ContentCase from '../models/ContentCase.js';
import ImageAsset from '../models/ImageAsset.js';
import VisualAccount from '../models/VisualAccount.js';
import Chapter from '../models/Chapter.js';
export async function prepareContentModeration() {
  await Promise.all([Report.createIndexes(), ContentCase.init(), ImageAsset.init(), VisualAccount.init()]);
  // Replace only the known superseded index, after its replacement exists.
  const indexes = await Report.collection.indexes();
  const old = indexes.find(i => i.unique && JSON.stringify(i.key) === JSON.stringify({ reporter: 1, targetType: 1, targetId: 1 }));
  if (old) {
    try { await Report.collection.dropIndex(old.name); }
    catch (error) { if (error.code !== 27) throw error; } // Another process may have completed the migration.
  }
  // Preserve legacy human/AI holds; never publish or delete any legacy content.
  await Chapter.updateMany({ status: { $in: ['pending_review', 'rejected'] }, moderationHold: { $ne: true } }, { $set: { moderationHold: true } });
}
