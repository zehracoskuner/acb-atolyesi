import { readDevelopment } from "../services/developmentProgress.js";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from "vitest";
import Chapter from "../models/Chapter.js";
import ChapterVersion from "../models/ChapterVersion.js";
import Work from "../models/Work.js";
import { saveChapterVersion, createChapterVersion, markChapterCheckpoint } from "../services/chapterHistory.js";

// Opt-in, loopback only, never reads .env or the application's MONGO_URI.
const uri = process.env.CHAPTER_TEST_MONGO_URI;
const database = `acb_chapter_test_${randomUUID().replaceAll("-", "")}`;
describe.skipIf(!uri)("MongoDB replica-set chapter history integration", () => {
  beforeAll(async () => {
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\/?(?:\?.*)?$/.test(uri)) throw new Error("Only a loopback replica-set URI without database or credentials is allowed.");
    await mongoose.connect(uri, { dbName: database, serverSelectionTimeoutMS: 5000 });
    await Promise.all([Chapter.init(), ChapterVersion.init(), Work.init()]);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    if (mongoose.connection.name === database && database.startsWith("acb_chapter_test_")) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  async function fixture() {
    const userId = new mongoose.Types.ObjectId();
    const work = await Work.create({ user: userId, title: "Test work" });
    const chapter = await Chapter.create({ work: work._id, title: "Test chapter", content: "original" });
    return { id: chapter._id, userId, expectedRevision: 0 };
  }
  it("counts committed organic words across chapters, excludes import/restore, and stays eligible after deletion", async () => {
    const base = await fixture();
    const chapter = await Chapter.findById(base.id);
    const workId = chapter.work;
    expect((await readDevelopment({ workId, userId: base.userId })).eligibleForDevelopmentReview).toBe(false);
    await saveChapterVersion({ ...base, content: "word ".repeat(3000), eligibleWordDelta: 3000 });
    expect((await Work.findById(workId)).eligibleForDevelopmentReview).toBe(false);
    const second = await createChapterVersion({ workId, userId: base.userId, title: "second" });
    await saveChapterVersion({ id: second.item._id, userId: base.userId, expectedRevision: 0, content: "last", eligibleWordDelta: 1 });
    expect((await Work.findById(workId)).eligibleForDevelopmentReview).toBe(true);
    await saveChapterVersion({ ...base, expectedRevision: 1, content: "deleted" });
    await saveChapterVersion({ ...base, expectedRevision: 2, content: "import ".repeat(20000) });
    await saveChapterVersion({ ...base, expectedRevision: 3, restoreRevision: 1, eligibleWordDelta: 20000 });
    const work = await Work.findById(workId);
    expect(work.developmentNewWords).toBe(3000);
    expect(work.eligibleForDevelopmentReview).toBe(true);
    expect(work.developmentAnalysisCount).toBe(0);
    expect((await ChapterVersion.findOne({ chapter: base.id, revision: 4 })).restoredFromRevision).toBe(1);
    expect(await ChapterVersion.countDocuments({ chapter: base.id })).toBe(5);
  });
  it("serializes organic progress from different chapters without losing increments", async () => {
    const base = await fixture(), chapter = await Chapter.findById(base.id);
    const other = await createChapterVersion({ workId: chapter.work, userId: base.userId, title: "other" });
    await Promise.all([base.id, other.item._id].map(id => saveChapterVersion({ ...base, id, content: String(id) + " text ".repeat(2500), eligibleWordDelta: 2500 })));
    const work = await Work.findById(chapter.work);
    expect(work.developmentNewWords).toBe(5000); expect(work.eligibleForDevelopmentReview).toBe(true);
  });
  it("initializes a legacy 20,000-word work only once and authorizes its owner", async () => {
    const base = await fixture(), chapter = await Chapter.findById(base.id);
    await Chapter.updateOne({ _id: base.id }, { $set: { content: "word ".repeat(20000) } });
    await Work.collection.updateOne({ _id: chapter.work }, { $unset: { developmentInitializedAt: "" } });
    const args = { workId: chapter.work, userId: base.userId };
    const statuses = await Promise.all([readDevelopment(args), readDevelopment(args)]);
    expect(statuses.every(s => s.eligibleForDevelopmentReview)).toBe(true);
    const work = await Work.findById(chapter.work);
    expect(work.developmentNewWords).toBe(20000); expect(work.developmentAnalysisCount).toBe(0);
    await expect(readDevelopment({ ...args, userId: new mongoose.Types.ObjectId() })).rejects.toMatchObject({ status: 403 });
  });
  it("does not count failed, stale, repeated or title-only saves", async () => {
    const base = await fixture(), chapter = await Chapter.findById(base.id);
    const saved = await saveChapterVersion({ ...base, content: "typed words", eligibleWordDelta: 2 });
    await expect(saveChapterVersion({ ...base, content: "stale", eligibleWordDelta: 9000 })).rejects.toMatchObject({ status: 409 });
    await saveChapterVersion({ ...base, expectedRevision: saved.revision, content: "typed words", eligibleWordDelta: 2 });
    await saveChapterVersion({ ...base, expectedRevision: saved.revision, title: "new title", eligibleWordDelta: 9000 });
    expect((await Work.findById(chapter.work)).developmentNewWords).toBe(1);
    await expect(saveChapterVersion({ ...base, eligibleWordDelta: -1 })).rejects.toMatchObject({ status: 400 });
    vi.spyOn(ChapterVersion, "create").mockRejectedValueOnce(new Error("snapshot fails"));
    await expect(saveChapterVersion({ ...base, expectedRevision: 2, content: "uncommitted", eligibleWordDelta: 5000 })).rejects.toThrow();
    expect((await Work.findById(chapter.work)).developmentNewWords).toBe(1);
  });
  it("concurrent same-base writes cannot both commit; restore appends", async () => {
    const base = await fixture();
    const writes = await Promise.allSettled(["one", "two"].map(content => saveChapterVersion({ ...base, content })));
    expect(writes.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(writes.find(r => r.status === "rejected").reason.status).toBe(409);
    expect(await ChapterVersion.countDocuments({ chapter: base.id })).toBe(2);
    const restored = await saveChapterVersion({ ...base, expectedRevision: 1, restoreRevision: 0 });
    expect(restored.item.content).toBe("original");
    expect(restored.item.status).toBe("draft");
    expect(restored.revision).toBe(2);
    expect(await ChapterVersion.countDocuments({ chapter: base.id })).toBe(3);
  });
  it("checkpoints mark the saved revision without changing text, revision or publication", async () => {
    const base = await fixture();
    const saved = await saveChapterVersion({ ...base, content: "checkpoint text" });
    const count = await ChapterVersion.countDocuments({ chapter: base.id });
    const before = (await Chapter.findById(base.id)).toObject();
    const marked = await markChapterCheckpoint({ ...base, expectedRevision: saved.revision, label: "  Edit öncesi  " });
    expect(marked.item).toMatchObject({ revision: saved.revision, isCheckpoint: true, label: "Edit öncesi", content: "checkpoint text" });
    await markChapterCheckpoint({ ...base, expectedRevision: saved.revision, label: "İlk taslak" });
    expect(await ChapterVersion.countDocuments({ chapter: base.id })).toBe(count);
    const after = (await Chapter.findById(base.id)).toObject();
    expect(after).toEqual(before);
    await expect(markChapterCheckpoint({ ...base, label: "stale" })).rejects.toMatchObject({ status: 409 });
    await expect(markChapterCheckpoint({ ...base, userId: new mongoose.Types.ObjectId() })).rejects.toMatchObject({ status: 403 });
    await expect(markChapterCheckpoint({ ...base, label: "x".repeat(81) })).rejects.toMatchObject({ status: 400 });
  });
  it("a legacy checkpoint captures the saved baseline once and remains restorable", async () => {
    const base = await fixture();
    await markChapterCheckpoint(base);
    await markChapterCheckpoint(base);
    expect(await ChapterVersion.countDocuments({ chapter: base.id })).toBe(1);
    await saveChapterVersion({ ...base, content: "new text" });
    const restored = await saveChapterVersion({ ...base, expectedRevision: 1, restoreRevision: 0 });
    expect(restored.item.content).toBe("original");
    expect(restored.revision).toBe(2);
    expect((await ChapterVersion.findOne({ chapter: base.id, revision: 0 })).isCheckpoint).toBe(true);
  });
  it("new chapter and its initial version commit together", async () => {
    const base = await fixture();
    const old = await Chapter.findById(base.id);
    const result = await createChapterVersion({ workId: old.work, userId: base.userId, title: "New" });
    expect(result.revision).toBe(0);
    expect((await ChapterVersion.findOne({ chapter: result.item._id, revision: 0 })).title).toBe("New");
    vi.spyOn(ChapterVersion, "create").mockRejectedValueOnce(new Error("fail initial history"));
    await expect(createChapterVersion({ workId: old.work, userId: base.userId, title: "Must not exist" })).rejects.toThrow();
    expect(await Chapter.countDocuments({ title: "Must not exist" })).toBe(0);
  });
  it("concurrent new chapters append after sparse stored orders without renumbering", async () => {
    const base = await fixture();
    const old = await Chapter.findById(base.id);
    old.order = 17; await old.save();
    const created = await Promise.all(["A", "B", "C"].map(title =>
      createChapterVersion({ workId: old.work, userId: base.userId, title })));
    expect(created.map(r => r.item.order).sort((a, b) => a - b)).toEqual([18, 19, 20]);
    expect((await Chapter.findById(base.id)).order).toBe(17);
    expect((await Chapter.findById(base.id)).content).toBe("original");
  });
  it("version insertion failure rolls back the actual chapter write", async () => {
    const base = await fixture();
    const create = ChapterVersion.create.bind(ChapterVersion);
    let calls = 0;
    vi.spyOn(ChapterVersion, "create").mockImplementation((...args) => {
      if (++calls === 2) throw new Error("Injected version failure");
      return create(...args);
    });
    await expect(saveChapterVersion({ ...base, content: "must roll back" })).rejects.toThrow("Injected");
    expect((await Chapter.findById(base.id)).content).toBe("original");
    expect(await ChapterVersion.countDocuments({ chapter: base.id })).toBe(0);
  });
});
