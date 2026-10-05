import User from "../models/User.js";

export async function canReadLog(log, viewerId) {
  if (!log) return false;
  if (log.visibility === "public") return true;
  if (!viewerId) return false;
  if (String(log.author) === String(viewerId)) return true;
  if (log.visibility !== "followers") return false;
  const viewer = await User.findById(viewerId).select("following").lean();
  return viewer?.following?.some(id => String(id) === String(log.author)) ?? false;
}
