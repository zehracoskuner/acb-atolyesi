import mongoose from "mongoose";
import express from "express";
import { once } from "node:events";
import { randomBytes, randomUUID } from "node:crypto";
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import User from "../models/User.js";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import ChapterVersion from "../models/ChapterVersion.js";
import AuthSession from "../models/AuthSession.js";
import Fingerprint from "../models/DevelopmentFingerprint.js";
import Sample from "../models/DevelopmentSample.js";
import { createNativeSession } from "../services/authSession.js";
import { newTermsAcceptance } from "../config/terms.js";
import { saveChapterVersion } from "../services/chapterHistory.js";
import { readBookSnapshot } from "../services/bookSnapshot.js";
import { chapterVersion } from "../services/contentModeration.js";
import { captureEvidence } from "../services/reportWorkflow.js";
import chapterRouter from "../routes/chapter.js";
import publicRouter from "../routes/public.js";
vi.mock("../services/emailService.js", () => ({ sendMail: vi.fn(), sendStaffMail: vi.fn(), SITE_URL: "https://example.test" }));
const uri = process.env.CHAPTER_TEST_MONGO_URI;
describe.skipIf(!uri)("private edits to published chapters", () => {
  let server, base, owner, token, work, chapter;
  const database = `acb_published_draft_${randomUUID().replaceAll("-", "")}`;
  beforeAll(async () => {
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\/?(?:\?.*)?$/.test(uri)) throw new Error("Loopback only");
    vi.stubEnv("JWT_SECRET", randomBytes(48).toString("hex"));
    await mongoose.connect(uri, { dbName: database });
    await Promise.all([User, Work, Chapter, ChapterVersion, AuthSession, Fingerprint, Sample].map(model => model.init()));
    const app = express(); app.use(express.json());
    app.use("/chapters", chapterRouter); app.use("/public", publicRouter);
    server = app.listen(0, "127.0.0.1"); await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
    await mongoose.disconnect(); vi.unstubAllEnvs();
  });
  beforeEach(async () => {
    owner = await User.create({ email: `${randomUUID()}@draft.test`, kullaniciAdi: randomUUID(), birthYear: 1990, ...newTermsAcceptance() });
    token = await createNativeSession(owner);
    work = await Work.create({ user: owner._id, title: "Book", status: "published" });
    chapter = await Chapter.create({ work: work._id, title: "Live title", content: "<p>Live text</p>", status: "published" });
    await Work.updateOne({ _id: work._id }, { publishedChapterIds: [chapter._id] });
  });
  async function request(path, method = "GET", body) {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  const save = (content, expectedRevision = 0, title) => saveChapterVersion({ id: chapter._id, userId: owner._id, expectedRevision, content, title });
  const publish = revision => request(`/chapters/${chapter._id}/status`, "PATCH", { status: "published", expectedRevision: revision });
  const read = () => request(`/public/works/${work._id}/chapters/${chapter._id}`);
  it("keeps live text/title private from draft edits, reloads the owner draft and exports it", async () => {
    const version = chapterVersion(chapter);
    const saved = await save("<div>Private <b>draft</b></div>", 0, "Private title");
    expect(saved.item).toMatchObject({ title: "Private title", status: "published", hasUnpublishedChanges: true, revision: 1 });
    expect(saved.draftedFromPublished).toBe(false);
    const stored = await Chapter.findById(chapter._id);
    expect(stored.content).toBe("<p>Live text</p>"); expect(stored.draftContent).toBeUndefined();
    expect(chapterVersion(stored)).toBe(version);
    expect((await read()).body.item).toMatchObject({ title: "Live title", content: "<p>Live text</p>" });
    expect((await request(`/public/works/${work._id}/chapters`)).body.items[0].title).toBe("Live title");
    expect((await request(`/chapters/${chapter._id}`)).body.item.content).toBe("<div>Private <b>draft</b></div>");
    expect((await readBookSnapshot(work._id, owner._id)).chapters[0]).toEqual({ title: "Private title", content: "<div>Private <b>draft</b></div>" });
    const evidence = (await captureEvidence("chapter", chapter._id)).evidenceSnapshot.target;
    expect(evidence.content).toBe("<p>Live text</p>"); expect(chapterVersion(evidence)).toBe(version);
    expect((await Work.findById(work._id)).status).toBe("published");
  });
  it("publishes only the current saved draft; rejects stale and non-owner publication", async () => {
    await save("<p>Draft one</p>");
    const writes = await Promise.allSettled([save("<p>Draft two</p>", 1), save("<p>Draft three</p>", 1)]);
    expect(writes.filter(value => value.status === "fulfilled")).toHaveLength(1);
    expect(writes.find(value => value.status === "rejected").reason.status).toBe(409);
    expect((await publish(1)).status).toBe(409);
    expect((await read()).body.item.content).toBe("<p>Live text</p>");
    const result = await publish(2);
    expect(result.status).toBe(200); expect(result.body.publicationUpdated).toBe(true);
    expect(result.body.item.hasUnpublishedChanges).toBe(false);
    expect((await read()).body.item.content).toBe(result.body.item.content);
    expect((await Chapter.findById(chapter._id).select("+draftContent")).draftContent).toBeUndefined();
    const other = await User.create({ email: `${randomUUID()}@draft.test`, kullaniciAdi: randomUUID(), birthYear: 1990, ...newTermsAcceptance() });
    token = await createNativeSession(other);
    expect((await publish(2)).status).toBe(403);
  });
  it("explicit unpublishing preserves the latest draft and removes reader access", async () => {
    await save("<p>Private text</p>");
    const result = await request(`/chapters/${chapter._id}/status`, "PATCH", { status: "draft", expectedRevision: 1 });
    expect(result.status).toBe(200); expect(result.body.item.content).toBe("<p>Private text</p>");
    expect((await read()).status).toBe(404);
    expect((await request(`/chapters/${chapter._id}`)).body.item.content).toBe("<p>Private text</p>");
  });
  it("returning to the live text clears pending changes without republishing", async () => {
    await save("<p>Draft</p>");
    const result = await save("<p>Live text</p>", 1);
    expect(result.item.hasUnpublishedChanges).toBe(false);
    expect(result.item.status).toBe("published");
  });
  it("publication restrictions still send the edited version to human review", async () => {
    await save("<p>Restricted edit</p>");
    await User.updateOne({ _id: owner._id }, { contentBanned: true });
    const result = await publish(1);
    expect(result.status).toBe(202);
    expect(result.body.item).toMatchObject({ status: "pending_review", content: "<p>Restricted edit</p>", moderationHold: true });
    expect((await read()).status).toBe(404);
  });
});
