import mongoose from "mongoose";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import Like from "../models/Likes.js";
import ChapterLike from "../models/ChapterLike.js";

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export function desiredLike(body) {
  if (body?.liked !== undefined && typeof body.liked !== "boolean") fail(400, "Geçersiz beğeni durumu.");
  return body?.liked;
}
export function validateLikeId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) fail(400, "Geçersiz kimlik.");
}

export async function likeTarget({ workId, chapterId, session } = {}) {
  validateLikeId(chapterId || workId);
  if (chapterId) {
    const chapter = await Chapter.findOne({ _id: chapterId, status: "published", moderationHold: { $ne: true } })
      .select("work").session(session || null).lean();
    if (!chapter) fail(404, "Bölüm bulunamadı.");
    workId = chapter.work;
  }
  const work = await Work.findOne({ _id: workId, status: "published",
    ...(chapterId ? { publishedChapterIds: chapterId } : {}) }).session(session || null).lean();
  if (!work) fail(404, "İçerik bulunamadı.");
  return work;
}

// Both sources contribute to the displayed work total. Lock the work before
// reading either source so concurrent server instances retry from a fresh snapshot.
export async function changeWorkLike({ userId, workId, chapterId, liked }) {
  return mongoose.connection.transaction(async session => {
    const work = await likeTarget({ workId, chapterId, session });
    workId = work._id;
    await Work.updateOne({ _id: workId }, { $inc: { likeRevision: 1 } }, { session, timestamps: false });
    const model = chapterId ? ChapterLike : Like;
    const filter = { user: userId, ...(chapterId ? { chapter: chapterId } : { work: workId }) };
    const existing = await model.exists(filter).session(session);
    const next = liked ?? !existing;
    if (next && !existing) await model.create([{ ...filter, work: workId }], { session });
    if (!next && existing) await model.deleteOne(filter, { session });
    // MongoDB transactions do not support parallel operations on one session.
    const directCount = await Like.countDocuments({ work: workId }).session(session);
    const chapterTotal = await ChapterLike.countDocuments({ work: workId }).session(session);
    const workLikeCount = directCount + chapterTotal;
    await Work.updateOne({ _id: workId }, { $set: { likeCount: workLikeCount } }, { session, timestamps: false });
    const likeCount = chapterId ? await ChapterLike.countDocuments({ chapter: chapterId }).session(session) : workLikeCount;
    return { liked: next, likeCount, workLikeCount, workId, added: next && !existing };
  });
}

export async function deleteLikedChapter({ chapterId, userId }) {
  validateLikeId(chapterId);
  return mongoose.connection.transaction(async session => {
    const chapter = await Chapter.findById(chapterId).session(session).lean();
    if (!chapter) fail(404, "Bölüm bulunamadı.");
    const work = await Work.findOneAndUpdate({ _id: chapter.work, user: userId },
      { $inc: { __v: 1, likeRevision: 1 }, $pull: { publishedChapterIds: chapter._id } },
      { session, new: true, timestamps: false }).lean();
    if (!work) fail(403, "Erişim reddedildi.");
    await Chapter.deleteOne({ _id: chapter._id }, { session });
    await ChapterLike.deleteMany({ chapter: chapter._id }, { session });
    const directCount = await Like.countDocuments({ work: work._id }).session(session);
    const chapterCount = await ChapterLike.countDocuments({ work: work._id }).session(session);
    await Work.updateOne({ _id: work._id }, { $set: {
      likeCount: directCount + chapterCount,
      status: work.publishedChapterIds.length ? "published" : "draft",
    } }, { session });
  });
}

// Explicit desired state is retry-safe. Missing state preserves legacy toggle APIs.
export function arrayLikeUpdate(userId, liked, withCount = false) {
  const id = new mongoose.Types.ObjectId(userId);
  const likes = { $ifNull: ["$likes", []] };
  const add = { $setUnion: [likes, [id]] };
  const remove = { $setDifference: [likes, [id]] };
  return [
    { $set: { likes: liked === undefined ? { $cond: [{ $in: [id, likes] }, remove, add] } : liked ? add : remove } },
    ...(withCount ? [{ $set: { likeCount: { $size: "$likes" } } }] : []),
  ];
}
