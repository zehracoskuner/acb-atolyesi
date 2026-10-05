import { beforeAll, afterAll, beforeEach, it, expect, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import User from "../models/User.js";
import { SpotlightRotation, SpotlightHistory, SpotlightShowing } from "../models/Spotlight.js";
import { prepareSpotlight, advanceSpotlight, readSpotlight } from "../services/spotlight.js";
import { HALF_HOUR, exposureBetween } from "../services/spotlightSchedule.js";

const clock = vi.hoisted(() => ({ now: new Date("2026-10-01T00:00:00+03:00") }));
vi.mock("../services/databaseClock.js", () => ({ databaseNow: async () => new Date(clock.now) }));
let replica;
beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14", downloadDir: fileURLToPath(new URL("../node_modules/.cache/mongodb-binaries", import.meta.url)) } });
  await mongoose.connect(replica.getUri(), { dbName: "spotlight_isolated_test" });
  await Promise.all([Work.init(), Chapter.init(), User.init()]);
}, 120000);
afterAll(async () => { await mongoose.disconnect(); await replica?.stop(); });
beforeEach(async () => {
  for (const model of [SpotlightRotation, SpotlightHistory, SpotlightShowing, Work, Chapter, User]) await model.deleteMany({});
  clock.now = new Date("2026-10-01T00:00:00+03:00");
  await prepareSpotlight();
});

async function works(count, offset = 0) {
  const entries = Array.from({ length: count }, (_, index) => {
    const _id = new mongoose.Types.ObjectId(), chapter = new mongoose.Types.ObjectId();
    return { _id, chapter, user: new mongoose.Types.ObjectId(), title: `Work ${offset + index}`, status: "published", publishedChapterIds: [chapter], firstPublishedAt: new Date(1700000000000 + (offset + index) * 1000), lastPublishedChapterAt: new Date(1700000000000 + (offset + index) * 1000) };
  });
  await Work.insertMany(entries);
  await Chapter.insertMany(entries.map(work => ({ _id: work.chapter, work: work._id, title: "Public chapter", status: "published", firstPublishedAt: work.firstPublishedAt })));
  return entries;
}

// Seed an almost-finished slot to test boundary commits without waiting 24 hours.
async function nearBoundary() {
  const state = await SpotlightRotation.findById("main").lean();
  const tick = new Date(+state.slotEndsAt - 1000);
  await SpotlightRotation.updateOne({ _id: "main" }, { $set: { lastTickAt: tick, slotServedMs: state.slotDuration - 1000, slotExposureMs: exposureBetween(state.slotStartedAt, tick) } });
  clock.now = new Date(state.slotEndsAt);
  return state;
}

it("uses all eligible works, freezes the order, and appends new publications", async () => {
  const entries = await works(24);
  const initial = await advanceSpotlight();
  expect(initial.roundOrder.map(String)).toEqual(entries.map(work => String(work._id)));
  expect(initial.slotDuration).toBe(60 * 60000);
  await Work.updateOne({ _id: entries[20]._id }, { $set: { lastPublishedChapterAt: clock.now, title: "An edit cannot jump the queue" } });
  const [newcomer] = await works(1, 30);
  clock.now = new Date(+clock.now + 10000);
  const next = await advanceSpotlight();
  expect(next.roundOrder.map(String)).toEqual([...initial.roundOrder.map(String), String(newcomer._id)]);
  expect(String(next.currentWorkId)).toBe(String(initial.currentWorkId));
  expect(+next.slotEndsAt).toBe(+initial.slotEndsAt);
});

it("concurrent server instances complete a boundary exactly once", async () => {
  await works(3);
  const initial = await advanceSpotlight();
  await nearBoundary();
  const states = await Promise.all(Array.from({ length: 12 }, () => advanceSpotlight()));
  expect(new Set(states.map(state => String(state.currentWorkId))).size).toBe(1);
  expect(await SpotlightShowing.countDocuments()).toBe(1);
  expect((await SpotlightHistory.findById(initial.currentWorkId)).completedShows).toBe(1);
  expect((await SpotlightRotation.findById("main")).cursor).toBe(1);
  const receipt = await SpotlightShowing.findOne();
  expect(receipt.servedMs).toBe(initial.slotDuration);
});

it("rolls back both fairness history and the queue if completion cannot be saved", async () => {
  await works(2);
  const initial = await advanceSpotlight();
  await nearBoundary();
  const failure = vi.spyOn(SpotlightShowing, "create").mockRejectedValueOnce(new Error("receipt unavailable"));
  try {
    await expect(advanceSpotlight()).rejects.toThrow("receipt unavailable");
    expect((await SpotlightHistory.findById(initial.currentWorkId)).completedShows).toBe(0);
    expect((await SpotlightRotation.findById("main")).cursor).toBe(0);
  } finally { failure.mockRestore(); }
  await advanceSpotlight();
  expect(await SpotlightShowing.countDocuments()).toBe(1);
});

it("a late worker gives the next work a full slot instead of backdating its start", async () => {
  await works(48);
  const initial = await advanceSpotlight();
  await nearBoundary();
  clock.now = new Date(+clock.now + 9000);
  const next = await advanceSpotlight();
  expect(+next.slotStartedAt).toBe(+clock.now);
  expect(+next.slotEndsAt - +clock.now).toBe(HALF_HOUR);
  expect(String(next.currentWorkId)).not.toBe(String(initial.currentWorkId));
});

it("reads the real MongoDB clock even if the process clock is wrong", async () => {
  const { databaseNow } = await vi.importActual("../services/databaseClock.js");
  const localClock = vi.spyOn(Date, "now").mockReturnValue(0);
  try {
    const databaseTime = await databaseNow();
    expect(databaseTime).toBeInstanceOf(Date);
    expect(databaseTime.getUTCFullYear()).toBeGreaterThan(2020);
  } finally { localClock.mockRestore(); }
});

it("never repeats within a round and recalculates duration only at the next round", async () => {
  const entries = await works(3);
  const shown = [];
  for (let i = 0; i < 3; i++) {
    const state = await advanceSpotlight();
    shown.push(String(state.currentWorkId));
    await nearBoundary();
  }
  const next = await advanceSpotlight();
  expect(new Set(shown).size).toBe(entries.length);
  expect(next.roundId).toBe(2);
  expect(await SpotlightShowing.countDocuments({ roundId: 1 })).toBe(3);
});

it("permanently locks at 30 minutes, including after a restart and withdrawal", async () => {
  const entries = await works(48);
  const initial = await advanceSpotlight();
  expect(initial.minimumDurationLocked).toBe(true);
  await Work.updateMany({ _id: { $ne: entries[0]._id } }, { $set: { status: "draft" } });
  await nearBoundary();
  await prepareSpotlight();
  const next = await advanceSpotlight();
  expect(next.roundId).toBe(2);
  expect(next.slotDuration).toBe(HALF_HOUR);
  expect(next.minimumDurationLocked).toBe(true);
});

it("does not skip through unserved slots during a server outage", async () => {
  await works(48);
  const initial = await advanceSpotlight();
  clock.now = new Date(+clock.now + 10000);
  await advanceSpotlight();
  clock.now = new Date(+clock.now + 3 * 86400000);
  const resumed = await advanceSpotlight();
  expect(String(resumed.currentWorkId)).toBe(String(initial.currentWorkId));
  expect(+resumed.slotEndsAt - +clock.now).toBe(HALF_HOUR - 10000);
  expect(await SpotlightShowing.countDocuments()).toBe(0);
});

it("a withdrawn work cannot reset history or re-enter the same round", async () => {
  const entries = await works(4);
  await advanceSpotlight();
  await Work.updateOne({ _id: entries[0]._id }, { $set: { status: "draft" } });
  clock.now = new Date(+clock.now + 10000);
  const state = await advanceSpotlight();
  expect(String(state.currentWorkId)).toBe(String(entries[1]._id));
  await Work.updateOne({ _id: entries[0]._id }, { $set: { status: "published" } });
  clock.now = new Date(+clock.now + 10000);
  const returned = await advanceSpotlight();
  expect(returned.roundOrder.map(String).filter(id => id === String(entries[0]._id))).toHaveLength(1);
  expect(returned.cursor).toBe(1);
  expect((await SpotlightHistory.findById(entries[0]._id)).completedShows).toBe(0);
  expect((await SpotlightShowing.findOne()).status).toBe("withdrawn");
});

it("only includes genuinely readable publications and never exposes anonymous identity", async () => {
  const entries = await works(4);
  await Work.updateOne({ _id: entries[0]._id }, { $set: { status: "draft" } });
  await Chapter.updateOne({ _id: entries[1].chapter }, { $set: { status: "draft" } });
  await Work.updateOne({ _id: entries[2]._id }, { $set: { publishedChapterIds: [entries[3].chapter] } });
  await Work.updateOne({ _id: entries[3]._id }, { $set: { isAnonymous: true, "universe.rules": "private studio notes" } });
  const result = await readSpotlight();
  expect(String(result.work._id)).toBe(String(entries[3]._id));
  expect(result.work.author).toBeNull();
  expect(JSON.stringify(result)).not.toContain("private studio notes");
  expect(JSON.stringify(result)).not.toContain(String(entries[3].user));
  await Chapter.updateOne({ _id: entries[3].chapter }, { $set: { status: "draft" } });
  expect((await readSpotlight()).work).toBeNull();
});

it("only the first publication of a distinct chapter updates activity dates", async () => {
  const work = await Work.create({ user: new mongoose.Types.ObjectId(), title: "Publication dates" });
  const chapter = await Chapter.create({ work: work._id, title: "One", status: "published" });
  const first = await Work.findById(work._id);
  expect(+first.firstPublishedAt).toBe(+clock.now);
  clock.now = new Date(+clock.now + 86400000);
  chapter.status = "draft"; await chapter.save();
  chapter.status = "published"; chapter.content = "Revised"; await chapter.save();
  await Work.updateOne({ _id: work._id }, { $set: { title: "A new cover or title" } });
  expect(+(await Work.findById(work._id)).lastPublishedChapterAt).toBe(+first.firstPublishedAt);
  await Chapter.create({ work: work._id, title: "Two", status: "published" });
  const after = await Work.findById(work._id);
  expect(+after.firstPublishedAt).toBe(+first.firstPublishedAt);
  expect(+after.lastPublishedChapterAt).toBe(+clock.now);
});

it("backfills legacy dates once and leaves them stable across later edits", async () => {
  const [entry] = await works(1);
  await Chapter.updateOne({ _id: entry.chapter }, { $unset: { firstPublishedAt: 1 } });
  await Work.updateOne({ _id: entry._id }, { $unset: { firstPublishedAt: 1, lastPublishedChapterAt: 1 } });
  await SpotlightRotation.updateOne({ _id: "main" }, { $set: { publicationBackfillDone: false } });
  await prepareSpotlight();
  const before = await Work.findById(entry._id);
  expect(before.firstPublishedAt).toBeInstanceOf(Date);
  expect((await Chapter.findById(entry.chapter)).publicationDateEstimated).toBe(true);
  await Work.updateOne({ _id: entry._id }, { $set: { description: "Changed" } });
  await prepareSpotlight();
  expect(+(await Work.findById(entry._id)).firstPublishedAt).toBe(+before.firstPublishedAt);
});
