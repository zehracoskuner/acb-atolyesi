import mongoose from "mongoose";
import { matureFilter } from "./matureAccess.js";
import Log from "../models/Log.js";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import User from "../models/User.js";
import ChapterLike from "../models/ChapterLike.js";

const PAGE_SIZE = 15;
const publicWork = { status: "published", isAnonymous: { $ne: true } };
const workFields = { _id: 1, title: 1, coverImage: 1 };

export function parseFeedQuery(query) {
  const scope = query.scope ?? "public";
  const page = query.page ?? "1";
  if (Object.keys(query).some(key => !["scope", "page"].includes(key)) ||
      !["public", "following"].includes(scope) || typeof page !== "string" ||
      !/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page)) || Number(page) > 100000) {
    throw Object.assign(new Error("Geçersiz akış kapsamı veya sayfa."), { status: 400 });
  }
  return { scope, page: Number(page) };
}

export async function readFeed({ viewerId, scope, page }) {
  const viewer = scope === "following" ? await User.findById(viewerId).select("following").lean() : null;
  const following = viewer?.following || [];
  const logFilter = scope === "following"
    ? { author: { $in: following }, visibility: { $in: ["public", "followers"] } }
    : { visibility: "public" };
  // Merge before paginating: no per-source cap, no lost items beyond page four.
  const pipeline = [
    { $match: logFilter },
    { $project: { _id: 1, type: { $literal: "log" }, author: 1, createdAt: 1, content: 1,
      visibility: 1, relatedWork: 1, likeCount: { $size: { $ifNull: ["$likes", []] } },
      likedByMe: { $in: [new mongoose.Types.ObjectId(viewerId), { $ifNull: ["$likes", []] }] } } },
  ];
  if (scope === "following" && following.length) pipeline.push({ $unionWith: {
    coll: Chapter.collection.name,
    pipeline: [
      { $match: { status: "published", createdAt: { $gt: new Date(Date.now() - 30 * 86400000) } } },
      { $lookup: { from: Work.collection.name, localField: "work", foreignField: "_id", as: "book",
        pipeline: [{ $match: { ...publicWork, ...matureFilter(), user: { $in: following } } }, { $project: { ...workFields, user: 1 } }] } },
      { $unwind: "$book" },
      { $project: { _id: 1, type: { $literal: "chapter" }, createdAt: 1, author: "$book.user",
        chapter: { _id: "$_id", title: "$title", order: "$order" },
        work: { _id: "$book._id", title: "$book.title", coverImage: "$book.coverImage" } } },
    ],
  } });
  pipeline.push(
    { $sort: { createdAt: -1, _id: -1, type: 1 } },
    { $facet: { count: [{ $count: "total" }], items: [
      { $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE },
      { $lookup: { from: User.collection.name, localField: "author", foreignField: "_id", as: "author",
        pipeline: [{ $project: { _id: 1, kullaniciAdi: 1, avatarUrl: 1 } }] } },
      { $set: { author: { $ifNull: [{ $arrayElemAt: ["$author", 0] }, null] } } },
      { $lookup: { from: Work.collection.name, localField: "relatedWork", foreignField: "_id", as: "relatedWork",
        pipeline: [{ $match: { ...publicWork, ...matureFilter() } }, { $project: workFields }] } },
      { $set: { relatedWork: { $ifNull: [{ $arrayElemAt: ["$relatedWork", 0] }, null] } } },
    ] } },
  );
  const [result] = await Log.aggregate(pipeline);
  const items = result?.items || [];
  const total = result?.count?.[0]?.total || 0;
  const authorIds = [...new Map(items.filter(item => item.author?._id).map(item => [String(item.author._id), item.author._id])).values()];
  // One batch for the visible authors; anonymous titles never enter this response.
  const shelves = authorIds.length ? await Work.aggregate([
    { $match: { ...publicWork, ...matureFilter(), user: { $in: authorIds } } },
    { $sort: { updatedAt: -1, _id: -1 } },
    { $group: { _id: "$user", total: { $sum: 1 }, works: { $push: { _id: "$_id", title: "$title", coverImage: "$coverImage" } } } },
    { $project: { total: 1, works: { $slice: ["$works", 3] } } },
  ]) : [];
  const shelfMap = new Map(shelves.map(shelf => [String(shelf._id), { works: shelf.works, total: shelf.total }]));
  const chapterIds = items.filter(item => item.type === "chapter").map(item => item._id);
  const likes = chapterIds.length ? await ChapterLike.aggregate([
    { $match: { chapter: { $in: chapterIds } } },
    { $group: { _id: "$chapter", count: { $sum: 1 }, mine: { $max: { $cond: [{ $eq: ["$user", new mongoose.Types.ObjectId(viewerId)] }, 1, 0] } } } },
  ]) : [];
  const likeMap = new Map(likes.map(like => [String(like._id), like]));
  return { items: items.map(item => ({ ...item,
    ...(item.type === "chapter" ? { likeCount: likeMap.get(String(item._id))?.count || 0, likedByMe: !!likeMap.get(String(item._id))?.mine } : {}),
    authorShelf: shelfMap.get(String(item.author?._id)) || { works: [], total: 0 } })),
    scope, page, total, hasMore: page * PAGE_SIZE < total, isEmpty: total === 0 };
}

export async function readLatestWork(viewerId) {
  // Draft saves do not necessarily touch Work.updatedAt; include the last saved chapter.
  const [work] = await Work.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(viewerId) } },
    { $project: { ...workFields, updatedAt: 1, status: 1 } },
    { $lookup: { from: Chapter.collection.name, localField: "_id", foreignField: "work", as: "lastChapter",
      pipeline: [
        { $project: { workedAt: { $ifNull: ["$savedAt", "$updatedAt"] } } },
        { $sort: { workedAt: -1 } }, { $limit: 1 },
      ] } },
    { $set: { lastWorkedAt: { $max: ["$updatedAt", { $arrayElemAt: ["$lastChapter.workedAt", 0] }] } } },
    { $sort: { lastWorkedAt: -1, _id: -1 } }, { $limit: 1 },
    { $project: { ...workFields, status: 1, lastWorkedAt: 1 } },
  ]);
  return work || null;
}
