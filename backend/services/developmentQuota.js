import Analysis from "../models/DevelopmentAnalysis.js";
import { developmentConfig, DEVELOPMENT_WINDOW_MS } from "../config/development.js";
import { databaseNow } from "./databaseClock.js";

// Only committed successes spend quota. The caller holds the user gate on writes.
export async function readDevelopmentQuota(userId, { config = developmentConfig(), now, session = null } = {}) {
  now ??= await databaseNow();
  const successes = await Analysis.find({ userId, analyzedAt: { $gt: new Date(now.getTime() - DEVELOPMENT_WINDOW_MS) } })
    .sort({ analyzedAt: -1 }).select("analyzedAt").session(session).lean();
  const remaining = Math.max(0, config.dailyLimit - successes.length);
  const nextAvailableAt = remaining ? null : new Date(successes[config.dailyLimit - 1].analyzedAt.getTime() + DEVELOPMENT_WINDOW_MS);
  return { dailyLimit: config.dailyLimit, used: successes.length, remaining, nextAvailableAt,
    retryAfter: nextAvailableAt ? Math.max(1, Math.ceil((nextAvailableAt.getTime() - now.getTime()) / 1000)) : 0 };
}
