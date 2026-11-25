import { readDevelopment } from "../services/developmentProgress.js";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from "vitest";
import Chapter from "../models/Chapter.js";
import Work from "../models/Work.js";
import ImageAsset from "../models/ImageAsset.js";
import Fingerprint from "../models/DevelopmentFingerprint.js";
import { applyChapterDraft } from "../services/chapterPublication.js";
import { saveChapter, createChapter, updateChapterOrder } from "../services/chapterEditing.js";
import { migrateChapterDevelopment } from "../scripts/migrate-chapter-development.mjs";
import { textHash } from "../services/developmentWriting.js";

// Opt-in, loopback only, never reads .env or the application's MONGO_URI.
const uri = process.env.CHAPTER_TEST_MONGO_URI;
const database = `acb_chapter_test_${randomUUID().replaceAll("-", "")}`;
describe.skipIf(!uri)("MongoDB replica-set chapter editing integration", () => {
  beforeAll(async () => {
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\/?(?:\?.*)?$/.test(uri)) throw new Error("Only a loopback replica-set URI without database or credentials is allowed.");
    await mongoose.connect(uri, { dbName: database, serverSelectionTimeoutMS: 5000 });
    await Promise.all([Chapter.init(), Work.init()]);
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
  it("persists media-only revisions privately, publishes, removes and reinstates media with text", async () => {
    const base = await fixture();
    const chapter = await Chapter.findById(base.id);
    chapter.status = "published"; await chapter.save();
    await Work.updateOne({ _id: chapter.work }, { $set: { status: "published", publishedChapterIds: [chapter._id] } });
    const media = [{ type: "spotify", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", caption: "Şarkı" }];
    const saved = await saveChapter({ ...base, media });
    expect(saved.item.media).toEqual(media);
    expect(saved.item.hasUnpublishedChanges).toBe(true);
    expect(saved.revision).toBe(1);
    expect((await Chapter.findById(base.id)).media.toObject()).toEqual([]);
    const publish = await Chapter.findById(base.id).select("+draftContent");
    applyChapterDraft(publish); await publish.save();
    expect((await Chapter.findById(base.id)).media.toObject()).toEqual(media);
    const removed = await saveChapter({ ...base, expectedRevision: 1, media: [] });
    expect(removed.item.media).toEqual([]);
    expect((await Chapter.findById(base.id)).media.toObject()).toEqual(media);
    const restored = await saveChapter({ ...base, expectedRevision: 2, media });
    expect(restored.item.media).toEqual(media);
    expect(restored.item.content).toBe("original");
    expect(restored.item.hasUnpublishedChanges).toBe(false);
    expect((await Work.findById(chapter.work)).developmentNewWords).toBe(0);
  });
  it("rejects foreign, removed and arbitrary images without changing the chapter", async () => {
    const base = await fixture();
    const image = { type: "image", url: "https://res.cloudinary.com/test/image/upload/v1/media.jpg", caption: "Görsel" };
    await ImageAsset.create({ owner: new mongoose.Types.ObjectId(), url: image.url, state: "active" });
    await expect(saveChapter({ ...base, media: [image] })).rejects.toMatchObject({ status: 400 });
    await ImageAsset.updateOne({ url: image.url }, { $set: { owner: base.userId } });
    expect((await saveChapter({ ...base, media: [image] })).item.media).toEqual([image]);
    await ImageAsset.updateOne({ url: image.url }, { $set: { state: "removed" } });
    await expect(saveChapter({ ...base, expectedRevision: 1, media: [image] })).rejects.toMatchObject({ status: 400 });
    await expect(saveChapter({ ...base, expectedRevision: 1, media: [{ ...image, url: "https://example.com/image.png" }] })).rejects.toMatchObject({ status: 400 });
    expect((await Chapter.findById(base.id)).revision).toBe(1);
  });
  it("counts committed organic words across chapters, excludes imports and repeated text, and stays eligible after deletion", async () => {
    const base = await fixture();
    const chapter = await Chapter.findById(base.id);
    const workId = chapter.work;
    expect((await readDevelopment({ workId, userId: base.userId })).eligibleForDevelopmentReview).toBe(false);
    await saveChapter({ ...base, content: "word ".repeat(3000), eligibleWordDelta: 3000 });
    expect((await Work.findById(workId)).eligibleForDevelopmentReview).toBe(false);
    const second = await createChapter({ workId, userId: base.userId, title: "second" });
    await saveChapter({ id: second.item._id, userId: base.userId, expectedRevision: 0, content: "last", eligibleWordDelta: 1 });
    expect((await Work.findById(workId)).eligibleForDevelopmentReview).toBe(true);
    await saveChapter({ ...base, expectedRevision: 1, content: "deleted" });
    await saveChapter({ ...base, expectedRevision: 2, content: "import ".repeat(20000) });
    await saveChapter({ ...base, expectedRevision: 3, restoreRevision: 1, eligibleWordDelta: 20000 });
    const work = await Work.findById(workId);
    expect(work.developmentNewWords).toBe(3000);
    expect(work.eligibleForDevelopmentReview).toBe(true);
    expect(work.developmentAnalysisCount).toBe(0);
  });
  it("serializes organic progress from different chapters without losing increments", async () => {
    const base = await fixture(), chapter = await Chapter.findById(base.id);
    const other = await createChapter({ workId: chapter.work, userId: base.userId, title: "other" });
    await Promise.all([base.id, other.item._id].map(id => saveChapter({ ...base, id, content: String(id) + " text ".repeat(2500), eligibleWordDelta: 2500 })));
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
    const saved = await saveChapter({ ...base, content: "typed words", eligibleWordDelta: 2 });
    await expect(saveChapter({ ...base, content: "stale", eligibleWordDelta: 9000 })).rejects.toMatchObject({ status: 409 });
    await saveChapter({ ...base, expectedRevision: saved.revision, content: "typed words", eligibleWordDelta: 2 });
    await saveChapter({ ...base, expectedRevision: saved.revision, title: "new title", eligibleWordDelta: 9000 });
    expect((await Work.findById(chapter.work)).developmentNewWords).toBe(1);
    await expect(saveChapter({ ...base, eligibleWordDelta: -1 })).rejects.toMatchObject({ status: 400 });
    vi.spyOn(Work.prototype, "save").mockRejectedValueOnce(new Error("work save fails"));
    await expect(saveChapter({ ...base, expectedRevision: 2, content: "uncommitted", eligibleWordDelta: 5000 })).rejects.toThrow();
    expect((await Work.findById(chapter.work)).developmentNewWords).toBe(1);
  });
  it("rejects stale writes and never creates the retired collection", async () => {
    const base = await fixture();
    const chapter = await Chapter.findById(base.id);
    const created = await createChapter({ workId: chapter.work, userId: base.userId, title: "New" });
    expect(created).toMatchObject({ revision: 0, item: { title: "New", content: "" } });
    const writes = await Promise.allSettled(["one", "two"].map(content => saveChapter({ ...base, content })));
    const saved = writes.find(r => r.status === "fulfilled").value;
    expect(writes.find(r => r.status === "rejected").reason).toMatchObject({
      status: 409, code: "CHAPTER_CONFLICT", current: { content: saved.item.content, revision: 1 },
    });
    expect((await Chapter.findById(base.id)).content).toBe(saved.item.content);
    const same = await saveChapter({ ...base, expectedRevision: 1, content: saved.item.content });
    expect(same).toMatchObject({ revision: 1, savedAt: saved.savedAt });
    expect(await mongoose.connection.db.listCollections({ name: "chapterversions" }).toArray()).toEqual([]);
  });
  it("concurrent new chapters append after sparse stored orders without renumbering", async () => {
    const base = await fixture();
    const old = await Chapter.findById(base.id);
    old.order = 17; await old.save();
    const created = await Promise.all(["A", "B", "C"].map(title =>
      createChapter({ workId: old.work, userId: base.userId, title })));
    expect(created.map(r => r.item.order).sort((a, b) => a - b)).toEqual([18, 19, 20]);
    expect((await Chapter.findById(base.id)).order).toBe(17);
    expect((await Chapter.findById(base.id)).content).toBe("original");
  });

  it("reordering preserves publication, text and saved revision", async () => {
    const base = await fixture();
    const chapter = await Chapter.findById(base.id);
    chapter.status = "published";
    chapter.reviewNote = "Existing review";
    await chapter.save();
    const before = chapter.toObject();
    await Work.updateOne({ _id: chapter.work }, { $set: {
      status: "published", publishedChapterIds: [chapter._id],
    } });
    const result = await updateChapterOrder({ ...base, order: 2 });
    expect(result.item.order).toBe(2);
    expect(result.revision).toBe(0);
    const after = (await Chapter.findById(base.id)).toObject();
    for (const key of ["title", "content", "status", "reviewNote", "revision", "savedAt"])
      expect(after[key]).toEqual(before[key]);
    expect((await Work.findById(chapter.work)).publishedChapterIds.map(String)).toEqual([String(chapter._id)]);
    const renamed = await saveChapter({ ...base, title: "Renamed after reorder" });
    expect(renamed.revision).toBe(1);
    expect(renamed.item.order).toBe(2);
  });
  it("concurrent text save and reorder both survive transaction retries", async () => {
    const base = await fixture();
    await Promise.all([
      updateChapterOrder({ ...base, order: 3 }),
      saveChapter({ ...base, content: "Concurrent new text" }),
    ]);
    const chapter = await Chapter.findById(base.id);
    expect(chapter.order).toBe(3);
    expect(chapter.content).toBe("Concurrent new text");
    expect(chapter.revision).toBe(1);
  });
  it("failed reorder rolls back its order and work lock", async () => {
    const base = await fixture();
    const before = await Chapter.findById(base.id);
    const workBefore = await Work.findById(before.work);
    vi.spyOn(Chapter.prototype, "save").mockRejectedValueOnce(new Error("Injected reorder failure"));
    await expect(updateChapterOrder({ ...base, order: 4 })).rejects.toThrow("Injected reorder failure");
    expect((await Chapter.findById(base.id)).order).toBe(before.order);
    expect((await Work.findById(before.work)).__v).toBe(workBefore.__v);
  });
  it("failure after a chapter save rolls the write back", async () => {
    const base = await fixture();
    vi.spyOn(Work.prototype, "save").mockRejectedValueOnce(new Error("Injected work save failure"));
    await expect(saveChapter({ ...base, content: "must roll back" })).rejects.toThrow("Injected");
    expect((await Chapter.findById(base.id)).content).toBe("original");
  });
  it("migrates historical word baselines once and preserves current content and progress", async () => {
    const base = await fixture();
    const chapters = Chapter.collection;
    const historical = "one two three four five";
    await chapters.updateOne({ _id: base.id }, { $set: {
      status: "published", draftContent: { title: "Private", content: "private draft" },
      reviewSubmission: { title: "Review", content: "review text", revision: 0 },
    } });
    const chapter = await chapters.findOne({ _id: base.id });
    const work = await Work.collection.findOne({ _id: chapter.work });
    const versions = mongoose.connection.db.collection("chapterversions");
    await versions.insertOne({ chapter: base.id, work: chapter.work, revision: 0, content: historical });

    expect(await migrateChapterDevelopment(mongoose.connection)).toEqual({ chaptersWithHistory: 1, initialized: 0 });
    expect(await chapters.findOne({ _id: base.id })).toEqual(chapter);
    expect(await migrateChapterDevelopment(mongoose.connection, { apply: true })).toEqual({ chaptersWithHistory: 1, initialized: 1 });
    expect(await migrateChapterDevelopment(mongoose.connection, { apply: true })).toEqual({ chaptersWithHistory: 0, initialized: 0 });
    expect(await chapters.findOne({ _id: base.id })).toEqual({ ...chapter, developmentWordHighWater: 5 });
    expect(await Work.collection.findOne({ _id: chapter.work })).toEqual(work);
    expect(await Fingerprint.distinct("hash", { workId: chapter.work })).toEqual(
      expect.arrayContaining([textHash(historical), textHash("private draft")]));

    await versions.drop();
    await saveChapter({ ...base, content: historical, eligibleWordDelta: 5 });
    expect((await Work.findById(chapter.work)).developmentNewWords).toBe(0);
    expect(await mongoose.connection.db.listCollections({ name: "chapterversions" }).toArray()).toEqual([]);
  });
});
