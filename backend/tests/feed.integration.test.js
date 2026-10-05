import { createNativeSession } from "../services/authSession.js";
import { beforeAll, afterAll, beforeEach, afterEach, it, expect, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import Log from "../models/Log.js";
import LogComment from "../models/LogComment.js";
import ChapterLike from "../models/ChapterLike.js";
import feedRouter from "../routes/feed.js";
import logRouter from "../routes/log.js";
import { newTermsAcceptance } from "../config/terms.js";

vi.mock("../services/notificationService.js", () => ({ notifyLogLike: vi.fn(async () => {}), notifyLogComment: vi.fn(async () => {}) }));
let mongo, server, base, viewer, followed, stranger;
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", randomBytes(48).toString("hex"));
  mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14", downloadDir: fileURLToPath(new URL("../node_modules/.cache/mongodb-binaries", import.meta.url)) } });
  await mongoose.connect(mongo.getUri(), { dbName: "feed_isolated_test" });
  const app = express();
  app.use(express.json()); app.use("/api/feed", feedRouter); app.use("/api/logs", logRouter);
  server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}/api`;
}, 120000);
afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo?.stop(); vi.unstubAllEnvs(); });
afterEach(() => vi.restoreAllMocks());
beforeEach(async () => {
  await Promise.all([User, Work, Chapter, Log, LogComment, ChapterLike].map(model => model.deleteMany({})));
  [viewer, followed, stranger] = await User.create(["viewer", "followed", "stranger"].map(name => ({ email: `${name}@feed.test`, kullaniciAdi: name, birthYear: 1990, ...newTermsAcceptance() })));
  await User.updateOne({ _id: viewer._id }, { following: [followed._id] });
});
async function request(path, { user = viewer, method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (user) headers.Authorization = `Bearer ${await createNativeSession(user)}`;
  const res = await fetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: await res.json(), headers: res.headers };
}
async function log(author, visibility, content = `${author.kullaniciAdi}-${visibility}`, extras = {}) {
  return Log.create({ author: author._id, visibility, content, ...extras });
}
async function book(user, title, extras = {}) {
  return Work.create({ user: user._id, title, status: "published", ...extras });
}

it("public includes every author's public log, never followers/private, even for the owner", async () => {
  for (const author of [viewer, followed, stranger]) for (const visibility of ["public", "followers", "private"]) await log(author, visibility);
  const res = await request("/feed?scope=public");
  expect(res.status).toBe(200); expect(res.body.total).toBe(3);
  expect(res.body.items.map(item => item.content).sort()).toEqual(["viewer-public", "followed-public", "stranger-public"].sort());
  expect(res.headers.get("cache-control")).toContain("no-store");
});
it("following includes only followed public/followers logs and public non-anonymous chapters", async () => {
  for (const author of [viewer, followed, stranger]) for (const visibility of ["public", "followers", "private"]) await log(author, visibility);
  const visible = await book(followed, "Visible");
  const hidden = await book(followed, "Anonymous");
  await Work.updateOne({ _id: hidden._id }, { isAnonymous: true });
  const other = await book(stranger, "Other");
  const draft = await book(followed, "Draft", { status: "draft" });
  await Chapter.insertMany([visible, hidden, other, draft].map(work => ({ work: work._id, title: work.title, status: "published" })));
  await Chapter.create({ work: visible._id, title: "Unpublished chapter", status: "draft" });
  const res = await request("/feed?scope=following");
  expect(res.body.items.filter(item => item.type === "log").map(item => item.content).sort()).toEqual(["followed-followers", "followed-public"]);
  expect(res.body.items.filter(item => item.type === "chapter").map(item => item.work.title)).toEqual(["Visible"]);
  expect(JSON.stringify(res.body)).not.toContain("Anonymous");
});
it("following stays empty without follows and responds to an unfollow immediately", async () => {
  await log(followed, "followers");
  expect((await request("/feed?scope=following")).body.items).toHaveLength(1);
  await User.updateOne({ _id: viewer._id }, { following: [] });
  expect((await request("/feed?scope=following")).body.items).toEqual([]);
});
it("chapter like counts and viewer state load in one batch", async () => {
  const work = await book(followed, "Liked book");
  const chapters = await Chapter.insertMany(["First", "Second"].map(title => ({ work: work._id, title, status: "published" })));
  await ChapterLike.create([{ chapter: chapters[0]._id, work: work._id, user: viewer._id }, { chapter: chapters[0]._id, work: work._id, user: stranger._id }]);
  const spy = vi.spyOn(ChapterLike, "aggregate");
  const res = await request("/feed?scope=following");
  expect(spy).toHaveBeenCalledTimes(1);
  expect(res.body.items.find(item => item._id === String(chapters[0]._id))).toMatchObject({ likeCount: 2, likedByMe: true });
  expect(res.body.items.find(item => item._id === String(chapters[1]._id))).toMatchObject({ likeCount: 0, likedByMe: false });
});
it.each(["public", "following"])("%s paginates past 50 records without duplicates at equal timestamps", async scope => {
  const createdAt = new Date();
  await Log.insertMany(Array.from({ length: 67 }, (_, index) => ({ author: followed._id, visibility: "public", content: `Entry ${index}`, createdAt })));
  const ids = [];
  for (let page = 1; page <= 5; page++) {
    const res = await request(`/feed?scope=${scope}&page=${page}`);
    expect(res.body.total).toBe(67); expect(res.body.hasMore).toBe(page < 5);
    ids.push(...res.body.items.map(item => item._id));
  }
  expect(ids).toHaveLength(67); expect(new Set(ids).size).toBe(67);
  expect((await request(`/feed?scope=${scope}&page=6`)).body.items).toEqual([]);
});
it("merges chapter and log streams before pagination", async () => {
  const work = await book(followed, "Mixed");
  await Log.insertMany(Array.from({ length: 20 }, (_, index) => ({ author: followed._id, content: `Log ${index}`, createdAt: new Date(Date.now() - index * 2000) })));
  await Chapter.insertMany(Array.from({ length: 20 }, (_, index) => ({ work: work._id, title: `Chapter ${index}`, status: "published", createdAt: new Date(Date.now() - index * 2000 - 1000) })));
  const items = [];
  for (let page = 1; page <= 3; page++) items.push(...(await request(`/feed?scope=following&page=${page}`)).body.items);
  expect(items).toHaveLength(40); expect(new Set(items.map(item => item._id)).size).toBe(40);
  expect(items.some(item => item.type === "chapter")).toBe(true);
  expect(items.map(item => +new Date(item.createdAt))).toEqual(items.map(item => +new Date(item.createdAt)).sort((a,b) => b-a));
});
it("shelves batch visible authors, return three titles/count, exclude drafts/anonymous and internal fields", async () => {
  await Promise.all(Array.from({ length: 5 }, (_, index) => book(followed, `Public ${index}`)));
  await book(followed, "Secret draft", { status: "draft" });
  const anon = await book(followed, "Secret anonymous"); await Work.updateOne({ _id: anon._id }, { isAnonymous: true });
  await log(followed, "public", "One"); await log(followed, "public", "Two");
  const spy = vi.spyOn(Work, "aggregate");
  const res = await request("/feed?scope=public");
  expect(spy).toHaveBeenCalledTimes(1);
  for (const item of res.body.items) {
    expect(item.authorShelf.total).toBe(5); expect(item.authorShelf.works).toHaveLength(3);
    for (const work of item.authorShelf.works) expect(Object.keys(work).sort()).toEqual(["_id", "coverImage", "title"]);
  }
  expect(JSON.stringify(res.body)).not.toContain("Secret");
});
it("relatedWork is a public book projection; drafts, anonymous and deleted books disappear", async () => {
  const visible = await book(followed, "Related");
  const draft = await book(followed, "Private title", { status: "draft" });
  const anon = await book(followed, "Anonymous title"); await Work.updateOne({ _id: anon._id }, { isAnonymous: true });
  for (const relatedWork of [visible._id, draft._id, anon._id, new mongoose.Types.ObjectId(), null]) await log(followed, "public", String(relatedWork), { relatedWork });
  const res = await request("/feed?scope=public");
  expect(res.body.items.map(item => item.relatedWork).filter(Boolean)).toEqual([{ _id: String(visible._id), title: "Related", coverImage: null }]);
});
it.each(["scope=all", "scope=private", "scope[]=public", "page=0", "page=-1", "page=1x", "page=1.2", "page=100001", "page[]=1"])("rejects invalid query %s", async query => {
  expect((await request(`/feed?${query}`)).status).toBe(400);
});
it("keeps authentication required for feed and atelier", async () => {
  expect((await request("/feed?scope=public", { user: null })).status).toBe(401);
  expect((await request("/feed/atelier", { user: null })).status).toBe(401);
});
it("latest work uses chapter saves and only the current user's works", async () => {
  const old = await book(viewer, "Resumed draft", { status: "draft" });
  await book(viewer, "Newer metadata"); await book(stranger, "Someone else's draft", { status: "draft" });
  const savedAt = new Date(Date.now() + 60000);
  await Chapter.create({ work: old._id, title: "Saved just now", savedAt, content: "PRIVATE CHAPTER" });
  const res = await request("/feed/atelier");
  expect(res.body.work._id).toBe(String(old._id)); expect(res.body.work.lastWorkedAt).toBe(savedAt.toISOString());
  expect(JSON.stringify(res.body)).not.toContain("PRIVATE CHAPTER");
  await Work.deleteMany({ user: viewer._id });
  expect((await request("/feed/atelier")).body.work).toBeNull();
});
it("private/followers comments and likes enforce the same visibility boundary", async () => {
  const secret = await log(followed, "private"), restricted = await log(followed, "followers");
  for (const item of [secret, restricted]) await LogComment.create({ log: item._id, author: followed._id, content: "HIDDEN COMMENT" });
  for (const item of [secret, restricted]) {
    expect((await request(`/logs/${item._id}/comments`, { user: null })).status).toBe(404);
    expect((await request(`/logs/${item._id}/comments`, { user: stranger })).status).toBe(404);
    expect((await request(`/logs/${item._id}/comments`, { user: stranger, method: "POST", body: { content: "No" } })).status).toBe(403);
    expect((await request(`/logs/${item._id}/like`, { user: stranger, method: "POST" })).status).toBe(403);
  }
  expect((await request(`/logs/${secret._id}/comments`)).status).toBe(404);
  expect((await request(`/logs/${restricted._id}/comments`)).body.items).toHaveLength(1);
  expect((await request(`/logs/${restricted._id}/like`, { method: "POST" })).body.likedByMe).toBe(true);
  expect((await request(`/logs/${restricted._id}/like`, { method: "POST" })).body.likedByMe).toBe(false);
  const posted = await request(`/logs/${restricted._id}/comments`, { method: "POST", body: { content: "Visible reply" } });
  expect(posted.status).toBe(201);
  expect((await request(`/logs/${restricted._id}/comments/${posted.body.item._id}`, { method: "DELETE" })).status).toBe(200);
});
