import { createNativeSession } from "../services/authSession.js";
import { beforeAll, afterAll, beforeEach, it, expect, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import Library from "../models/Library.js";
import Log from "../models/Log.js";
import Quote from "../models/Quote.js";
import ReadingProgress from "../models/ReadingProgress.js";
import ReadingList from "../models/ReadingList.js";
import publicRouter from "../routes/public.js";
import searchRouter from "../routes/search.js";
import feedRouter from "../routes/feed.js";
import libraryRouter from "../routes/library.js";
import worksRouter from "../routes/works.js";
import quotesRouter from "../routes/quotes.js";
import progressRouter from "../routes/readingProgress.js";
import listsRouter from "../routes/readingLists.js";
import { newTermsAcceptance } from "../config/terms.js";
import { readerContext, validBirthYear } from "../services/matureAccess.js";

let mongo, server, base, adult, minor, unknown, mature, ordinary, chapter;
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", "isolated-mature-access-test-secret-abcdefghijklmnopqrstuvwxyz");
  mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14", downloadDir: fileURLToPath(new URL("../node_modules/.cache/mongodb-binaries", import.meta.url)) } });
  await mongoose.connect(mongo.getUri(), { dbName: "mature_access_test" });
  const app = express(); app.use(express.json());
  for (const [path, router] of [["public", publicRouter], ["search", searchRouter], ["feed", feedRouter], ["library", libraryRouter], ["works", worksRouter], ["quotes", quotesRouter], ["reading-progress", progressRouter], ["reading-lists", listsRouter]]) app.use(`/api/${path}`, router);
  server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}/api`;
}, 120000);
afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo?.stop(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  await Promise.all([User, Work, Chapter, Library, Log, Quote, ReadingProgress, ReadingList].map(model => model.deleteMany({})));
  [adult, minor, unknown] = await User.create([2007, 2008, null].map((birthYear, i) => ({ email: `u${i}@mature.test`, kullaniciAdi: `user${i}`, birthYear, ...newTermsAcceptance() })));
  [mature, ordinary] = await Work.create([true, false].map(contentWarning => ({ user: adult._id, title: contentWarning ? "Restricted story" : "Ordinary story", contentWarning, status: "published" })));
  for (const work of [mature, ordinary]) {
    const ch = await Chapter.create({ work: work._id, title: "Chapter", content: "PRIVATE STORY TEXT", status: "published" });
    await Work.updateOne({ _id: work._id }, { publishedChapterIds: [ch._id] });
    if (work === mature) chapter = ch;
  }
});
async function request(path, user = minor, method = "GET", body) {
  const headers = { "Content-Type": "application/json" };
  if (user) headers.Authorization = `Bearer ${await createNativeSession(user)}`;
  const res = await fetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: await res.json(), headers: res.headers };
}
it("filters explore, search, recommendations, profile and published lists before serialization", async () => {
  for (const path of ["/public/explore", "/search/works?q=story", "/feed/discover", `/public/profile/${adult._id}/works`, "/works/discover"]) {
    const res = await request(path);
    expect(res.status, path).toBe(200);
    expect(JSON.stringify(res.body), path).not.toContain("Restricted story");
    expect(JSON.stringify(res.body), path).toContain("Ordinary story");
  }
});
it("denies direct metadata, chapter list, chapter text and acknowledgement to 2008 viewers", async () => {
  for (const path of [`/public/works/${mature._id}`, `/public/works/${mature._id}/chapters`, `/public/works/${mature._id}/chapters/${chapter._id}`, `/public/works/${mature._id}/reading-access`]) {
    const res = await request(path); expect(res.status).toBe(404); expect(JSON.stringify(res.body)).not.toContain("PRIVATE STORY TEXT");
  }
  expect((await request(`/public/works/${mature._id}/mature-acknowledgement`, minor, "POST", { userId: adult._id })).status).toBe(404);
});
it("fails closed for guests and unknown years but allows 2007 metadata without a card badge", async () => {
  for (const user of [null, unknown]) expect((await request(`/public/works/${mature._id}`, user)).status).toBe(404);
  expect((await request(`/public/works/${mature._id}`, adult)).status).toBe(200);
  const res = await request("/public/explore", adult);
  expect(res.body.items).toHaveLength(2);
  expect(res.body.items.every(item => !Object.hasOwn(item, "contentWarning") && !Object.hasOwn(item, "requiresMatureAcknowledgement"))).toBe(true);
  expect(res.headers.get("cache-control")).toContain("no-store");
});
it("requires durable acknowledgement once per user/work and ignores a forged userId", async () => {
  const path = `/public/works/${mature._id}/chapters/${chapter._id}`;
  expect((await request(path, adult)).status).toBe(428);
  expect((await request(`/public/works/${mature._id}/mature-acknowledgement`, adult, "POST", { userId: minor._id })).status).toBe(200);
  expect((await request(path, adult)).body.item.content).toBe("PRIVATE STORY TEXT");
  expect((await request(`/public/works/${mature._id}/reading-access`, adult)).status).toBe(200);
  await request(`/public/works/${mature._id}/mature-acknowledgement`, adult, "POST");
  expect((await User.findById(adult._id)).matureAcknowledgements).toHaveLength(1);
  expect((await User.findById(minor._id)).matureAcknowledgements).toHaveLength(0);
  const secondAdult = await User.create({ email: "second@mature.test", birthYear: 2006, ...newTermsAcceptance() });
  expect((await request(path, secondAdult)).status).toBe(428);
});
it("filters populated library entries and aggregate feed shelves/related works", async () => {
  await Library.create({ user: minor._id, work: mature._id });
  await Log.create({ author: adult._id, visibility: "public", content: "Update", relatedWork: mature._id });
  expect((await request("/library")).body.items).toHaveLength(0);
  const res = await request("/feed?scope=public");
  expect(res.status).toBe(200); expect(JSON.stringify(res.body)).not.toContain("Restricted story");
  expect(res.body.items[0].relatedWork).toBeNull();
});
it("isolates concurrent viewer queries and preserves chapter work predicates", async () => {
  const [a, b] = await Promise.all([request("/public/explore", adult), request("/public/explore", minor)]);
  expect(a.body.items).toHaveLength(2); expect(b.body.items).toHaveLength(1);
  const hidden = await readerContext.run({ birthYear: 2008 }, () => Chapter.find({ work: mature._id }).exec());
  expect(hidden).toHaveLength(0);
});
it("validates integer birth years without changing the fixed cutoff", () => {
  for (const value of [null, "2007", 2007.5, 1899, 9999]) expect(validBirthYear(value)).toBe(false);
  expect(validBirthYear(2007)).toBe(true); expect(validBirthYear(2008)).toBe(true);
});
it("hides quote and progress snapshots and removes restricted entries from reading lists", async () => {
  await Quote.create({ user: minor._id, work: mature._id, text: "Restricted quotation", workTitle: mature.title, authorName: "Writer" });
  await ReadingProgress.create({ user: minor._id, story: mature._id, chapter: chapter._id, chapterNumber: 1, chapterTitle: "Restricted chapter title" });
  const list = await ReadingList.create({ owner: minor._id, name: "Books", works: [{ work: mature._id, note: "Private note" }, { work: ordinary._id }] });
  for (const path of ["/quotes/my", `/quotes/user/${minor._id}`, "/reading-progress"]) {
    const res = await request(path); expect(res.status).toBe(200); expect(res.body.items).toHaveLength(0);
  }
  const res = await request(`/reading-lists/${list._id}`);
  expect(res.status).toBe(200); expect(res.body.list.works).toHaveLength(1);
  expect(JSON.stringify(res.body)).not.toContain("Private note");
});
it("persists the existing contentWarning field and requires separate acknowledgements for separate works", async () => {
  const update = await request(`/works/${ordinary._id}`, adult, "PATCH", { contentWarning: true });
  expect(update.status).toBe(200); expect((await Work.findById(ordinary._id)).contentWarning).toBe(true);
  expect((await request(`/public/works/${ordinary._id}`)).status).toBe(404);
  await request(`/public/works/${mature._id}/mature-acknowledgement`, adult, "POST");
  expect((await request(`/public/works/${ordinary._id}/reading-access`, adult)).status).toBe(428);
  await User.updateOne({ _id: adult._id }, { birthYear: 2008 });
  expect((await request(`/public/works/${mature._id}/chapters/${chapter._id}`, adult)).status).toBe(404);
});
