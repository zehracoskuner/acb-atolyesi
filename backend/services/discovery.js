import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import User from "../models/User.js";
import Log from "../models/Log.js";
import { serializePublicWorkCard } from "./publicWork.js";

export function searchText(value) {
  return typeof value === "string" ? value.trim().slice(0, 100) : "";
}
export function literalRegex(value) {
  return new RegExp(searchText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}
export function listPage(query = {}, defaultLimit = 20) {
  return { page: Math.min(10000, Math.max(1, parseInt(query.page, 10) || 1)),
    limit: Math.min(50, Math.max(1, parseInt(query.limit, 10) || defaultLimit)) };
}

// Validate both the chapter's owner and its current publication state before
// pagination/counting. Only IDs enter the pipeline, never draft or reader text.
export function publishedWorkStages(filter = {}) {
  return [
    { $match: { ...filter, status: "published", "publishedChapterIds.0": { $exists: true } } },
    { $lookup: { from: Chapter.collection.name, localField: "publishedChapterIds", foreignField: "_id",
      let: { workId: "$_id" }, pipeline: [
        { $match: { status: "published", $expr: { $eq: ["$work", "$$workId"] } } },
        { $project: { _id: 1 } },
      ], as: "publicChapters" } },
    { $match: { "publicChapters.0": { $exists: true } } },
  ];
}

export async function discoverWorks(query = {}, defaultLimit = 20) {
  const { page, limit } = listPage(query, defaultLimit);
  const filter = {};
  const term = searchText(query.q);
  if (term) filter.$or = [{ title: literalRegex(term) }, { description: literalRegex(term) }];
  const genres = searchText(query.genres || query.genre).split(",").map(g => g.trim()).filter(g => g && g !== "all");
  if (genres.length) filter["universe.genres"] = { $in: genres };
  const sort = query.sort === "popular" ? { likeCount: -1, createdAt: -1, _id: -1 }
    : query.sort === "newest" ? { createdAt: -1, _id: -1 } : { updatedAt: -1, _id: -1 };
  const [result] = await Work.aggregate([...publishedWorkStages(filter), { $facet: {
    items: [{ $sort: sort }, { $skip: (page - 1) * limit }, { $limit: limit },
      { $project: { title: 1, description: 1, coverImage: 1, isAnonymous: 1, user: 1,
        "universe.genres": 1, likeCount: 1, createdAt: 1, updatedAt: 1, publicChapters: 1 } }],
    total: [{ $count: "count" }],
  } }]);
  const works = await Work.populate(result.items, { path: "user", select: "_id kullaniciAdi avatarUrl" });
  const total = result.total[0]?.count || 0;
  return { items: works.map(w => serializePublicWorkCard(w, w.publicChapters.map(ch => ch._id))),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export function writerCard(user, viewerId) {
  return { _id: user._id, kullaniciAdi: user.kullaniciAdi, avatarUrl: user.avatarUrl || "",
    bio: user.bio || "", followerCount: user.followers?.length || 0,
    isFollowedByMe: !!viewerId && (user.followers || []).some(id => String(id) === String(viewerId)) };
}
export async function discoverWriters(viewerId) {
  const logs = await Log.find({ visibility: "public" }).select("author").sort({ createdAt: -1, _id: -1 }).limit(20).lean();
  const ids = [...new Set(logs.map(l => String(l.author)))].slice(0, 5);
  const users = await User.find({ _id: { $in: ids } }).select("_id kullaniciAdi avatarUrl bio followers").lean();
  return ids.map(id => users.find(u => String(u._id) === id)).filter(Boolean).map(u => writerCard(u, viewerId));
}
