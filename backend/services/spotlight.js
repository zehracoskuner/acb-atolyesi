import mongoose from "mongoose";
import { readerContext } from "./matureAccess.js";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import { SpotlightRotation, SpotlightHistory, SpotlightShowing } from "../models/Spotlight.js";
import { databaseNow } from "./databaseClock.js";
import { buildRound, durationFor, exposureBetween, HALF_HOUR, HEARTBEAT_GRACE, minuteOfDay, publicationOrder } from "./spotlightSchedule.js";
import { PUBLIC_WORK_FIELDS, serializePublicWork } from "./publicWork.js";
import { getPublishedChapterIdsByWork } from "./publishedChapters.js";

const transactionOptions = { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" };
const TICK_INTERVAL = 10000;

export async function prepareSpotlight() {
  await Promise.all([SpotlightRotation.init(), SpotlightHistory.init(), SpotlightShowing.init()]);
  try {
    await SpotlightRotation.updateOne({ _id: "main" }, { $setOnInsert: { roundId: 0 } }, { upsert: true });
  } catch (error) { if (error.code !== 11000) throw error; }
  const state = await SpotlightRotation.findById("main").lean();
  if (state.publicationBackfillDone) return;
  // Legacy data has no reliable publication timestamp. Preserve a one-time,
  // explicitly estimated baseline rather than letting subsequent edits move it.
  await Chapter.updateMany({ status: "published", firstPublishedAt: null }, [{ $set: {
    firstPublishedAt: { $ifNull: ["$reviewedAt", "$createdAt"] },
    publicationDateEstimated: true,
  } }], { timestamps: false });
  const dates = await Chapter.aggregate([
    { $match: { firstPublishedAt: { $type: "date" } } },
    { $group: { _id: "$work", first: { $min: "$firstPublishedAt" }, last: { $max: "$firstPublishedAt" } } },
  ]);
  if (dates.length) await Work.bulkWrite(dates.map(item => ({ updateOne: {
    filter: { _id: item._id },
    update: { $min: { firstPublishedAt: item.first }, $max: { lastPublishedChapterAt: item.last } },
    timestamps: false,
  } })));
  await SpotlightRotation.updateOne({ _id: "main" }, { $set: { publicationBackfillDone: true } });
}

async function eligibleWorks(session) {
  return Work.aggregate([
    { $match: { status: "published", "publishedChapterIds.0": { $exists: true }, firstPublishedAt: { $type: "date" } } },
    { $lookup: { from: Chapter.collection.name, let: { workId: "$_id", ids: "$publishedChapterIds" }, pipeline: [
      { $match: { status: "published", $expr: { $and: [{ $eq: ["$work", "$$workId"] }, { $in: ["$_id", "$$ids"] }] } } },
      { $limit: 1 }, { $project: { _id: 1 } },
    ], as: "readable" } },
    { $match: { "readable.0": { $exists: true } } },
    { $project: { _id: 1, firstPublishedAt: 1, lastPublishedChapterAt: 1 } },
  ]).session(session);
}

async function finishShowing(state, histories, endedAt, status, session) {
  const history = histories.get(String(state.currentWorkId));
  const complete = status === "completed";
  const exposure = state.slotExposureMs;
  history.exposureMs = history.exposureMs.map((value, i) => value + exposure[i]);
  history.slotCounts = history.slotCounts.map((value, i) => value + Number(exposure[i] > 0));
  history.totalExposureMs += state.slotServedMs;
  history.completedShows += Number(complete);
  history.lastStartedAt = state.slotStartedAt;
  if (complete) history.lastCompletedAt = endedAt;
  await history.save({ session });
  await SpotlightShowing.create([{
    work: state.currentWorkId, roundId: state.roundId, startedAt: state.slotStartedAt,
    endedAt, status, plannedDurationMs: state.slotDuration,
    servedMs: state.slotServedMs, exposureMs: exposure,
  }], { session });
  state.currentWorkId = null;
  state.cursor++;
}

// A transactional write on the singleton serializes independent server instances.
// History, completion receipts and the next slot commit together or not at all.
export async function advanceSpotlight() {
  const now = await databaseNow();
  const previous = await SpotlightRotation.findById("main").lean();
  if (!previous?.publicationBackfillDone) throw new Error("Spotlight has not been initialized");
  if (previous.lastTickAt && +now - +previous.lastTickAt < TICK_INTERVAL && (!previous.currentWorkId || +now < +previous.slotEndsAt)) return previous;
  return mongoose.connection.transaction(async session => {
    const state = await SpotlightRotation.findOneAndUpdate({ _id: "main" }, { $inc: { revision: 1 } }, { new: true, session });
    const clock = await databaseNow();
    if (state.lastTickAt && +clock <= +state.lastTickAt) return state.toObject();
    const works = await eligibleWorks(session);
    const eligible = new Set(works.map(work => String(work._id)));
    const historyIds = [...eligible, ...(state.currentWorkId ? [state.currentWorkId] : [])];
    const histories = new Map((await SpotlightHistory.find({ _id: { $in: historyIds } }).session(session)).map(item => [String(item._id), item]));
    for (const work of works) {
      if (!histories.has(String(work._id))) {
        const history = new SpotlightHistory({ _id: work._id, firstEnrolledRound: state.roundId || 1 });
        await history.save({ session });
        histories.set(String(work._id), history);
      }
    }

    let nextStart = clock;
    if (state.currentWorkId) {
      if (!eligible.has(String(state.currentWorkId))) {
        // Withdrawal never earns a completed turn or restores an earlier place.
        await finishShowing(state, histories, clock, "withdrawn", session);
      } else if (+clock - +state.lastTickAt > HEARTBEAT_GRACE) {
        // A missing worker heartbeat is downtime, not phantom exposure. Resume
        // the SAME work for all of its remaining duration after the outage.
        state.slotEndsAt = new Date(+state.slotEndsAt + (+clock - +state.lastTickAt));
      } else {
        const until = new Date(Math.min(+clock, +state.slotEndsAt));
        const extra = exposureBetween(state.lastTickAt, until);
        state.slotExposureMs = state.slotExposureMs.map((value, i) => value + extra[i]);
        state.slotServedMs += Math.max(0, +until - +state.lastTickAt);
        if (+clock >= +state.slotEndsAt) {
          // Never backdate the next slot: a late worker must not steal even a
          // few seconds from its minimum guaranteed display duration.
          nextStart = clock;
          await finishShowing(state, histories, state.slotEndsAt, "completed", session);
        }
      }
    }

    // Only genuinely first-time entrants may join the tail of a frozen round.
    // A work that disappears and returns retains its identity and history.
    const enrolled = new Set(state.roundOrder.map(String));
    const newcomers = works.filter(work => !enrolled.has(String(work._id)) && histories.get(String(work._id)).firstEnrolledRound === state.roundId).sort(publicationOrder);
    state.roundOrder.push(...newcomers.map(work => work._id));
    if (!state.currentWorkId) {
      while (state.cursor < state.roundOrder.length && !eligible.has(String(state.roundOrder[state.cursor]))) state.cursor++;
      if (state.cursor >= state.roundOrder.length && works.length) {
        state.roundId++;
        state.slotDuration = durationFor(works.length, state.minimumDurationLocked);
        if (state.slotDuration === HALF_HOUR) state.minimumDurationLocked = true;
        state.roundOrder = buildRound(works, histories, nextStart, state.slotDuration, state.roundId === 1);
        state.cursor = 0;
      }
      if (state.cursor < state.roundOrder.length) {
        state.currentWorkId = state.roundOrder[state.cursor];
        state.slotStartedAt = nextStart;
        state.slotEndsAt = new Date(+nextStart + state.slotDuration);
        state.slotServedMs = Math.max(0, +clock - +nextStart);
        state.slotExposureMs = exposureBetween(nextStart, clock);
        const history = histories.get(String(state.currentWorkId));
        if (history.anchorMinute == null) {
          history.anchorMinute = minuteOfDay(nextStart);
          await history.save({ session });
        }
      } else {
        state.slotStartedAt = undefined;
        state.slotEndsAt = undefined;
      }
    }
    state.lastTickAt = clock;
    await state.save({ session });
    return state.toObject();
  }, transactionOptions);
}

let pendingTick;
export function tickSpotlight() {
  if (!pendingTick) pendingTick = advanceSpotlight().finally(() => { pendingTick = null; });
  return pendingTick;
}

export function startSpotlightWorker() {
  const tick = () => tickSpotlight().catch(error => console.error("Spotlight rotation:", error.message));
  void tick();
  const timer = setInterval(tick, TICK_INTERVAL);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await pendingTick;
  };
}

export async function readSpotlight() {
  const state = await readerContext.run(undefined, () => tickSpotlight());
  const serverNow = await databaseNow();
  let work = null;
  if (state.currentWorkId) {
    const item = await Work.findOne({ _id: state.currentWorkId, status: "published" })
      .select(PUBLIC_WORK_FIELDS).populate("user", "_id kullaniciAdi avatarUrl").lean();
    if (item) {
      const ids = (await getPublishedChapterIdsByWork([item])).get(String(item._id));
      if (ids?.length) work = serializePublicWork(item, ids);
    }
  }
  return { work, serverNow, slotEndsAt: state.slotEndsAt || null, slotStartedAt: state.slotStartedAt || null, roundId: state.roundId };
}
