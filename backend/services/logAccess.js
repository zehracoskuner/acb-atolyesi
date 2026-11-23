import User from "../models/User.js";
import Work from "../models/Work.js";
import { matureFilter } from './matureAccess.js';

export function logWorkPopulation(viewerId) {
  return { path: 'relatedWork', select: '_id title coverImage', match: { ...matureFilter(), $or: [
    { status: 'published', isAnonymous: { $ne: true } },
    ...(viewerId ? [{ user: viewerId }] : []),
  ] } };
}

export async function validateLogWork(id, viewerId) {
  if (!id) return;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id) || !await Work.exists({ _id: id, user: viewerId })) {
    throw Object.assign(new Error('Yalnızca kendi eserini günlüğüne bağlayabilirsin.'), { status: 400 });
  }
}

export async function canReadLog(log, viewerId) {
  if (!log) return false;
  if (log.visibility === "public") return true;
  if (!viewerId) return false;
  if (String(log.author) === String(viewerId)) return true;
  if (log.visibility !== "followers") return false;
  const viewer = await User.findById(viewerId).select("following").lean();
  return viewer?.following?.some(id => String(id) === String(log.author)) ?? false;
}
