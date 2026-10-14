import { beforeAll, afterAll, beforeEach, afterEach, it, expect, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import Like from "../models/Likes.js";
import ChapterLike from "../models/ChapterLike.js";
import Comment from "../models/Comment.js";
import Log from "../models/Log.js";
import likesRouter from "../routes/likes.js";
import chapterLikesRouter from "../routes/chapterLikes.js";
import commentsRouter from "../routes/comments.js";
import logRouter from "../routes/log.js";
import feedRouter from "../routes/feed.js";
import publicRouter from "../routes/public.js";
import { createNativeSession } from "../services/authSession.js";
import { newTermsAcceptance } from "../config/terms.js";
import { notifyLike, notifyLogLike } from "../services/notificationService.js";
import { writeLimiter } from "../middlewares/rateLimiter.js";
import { deleteLikedChapter } from "../services/likes.js";

vi.mock("../services/notificationService.js", () => ({ notifyLike: vi.fn(async () => {}), notifyLogLike: vi.fn(async () => {}), notifyLogComment: vi.fn(async () => {}), notifyComment: vi.fn(), notifyReply: vi.fn(), notifyCommentRemoved: vi.fn() }));
let mongo, server, base, users, tokens, work, chapter;
const models = [User, Work, Chapter, Like, ChapterLike, Comment, Log];
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", randomBytes(48).toString("hex"));
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14", downloadDir: fileURLToPath(new URL("../node_modules/.cache/mongodb-binaries", import.meta.url)) } });
  await mongoose.connect(mongo.getUri(), { dbName: "likes_isolated_test" });
  await Promise.all(models.map(model => model.init()));
  const app = express(); app.use(express.json());
  app.use("/likes", likesRouter); app.use("/chapters", chapterLikesRouter);
  app.use("/comments", commentsRouter); app.use("/logs", logRouter);
  app.use("/feed", feedRouter); app.use("/public", publicRouter);
  server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
}, 120000);
afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo?.stop(); vi.unstubAllEnvs(); });
afterEach(() => vi.restoreAllMocks());
beforeEach(async () => {
  vi.clearAllMocks();
  writeLimiter.resetKey("127.0.0.1");
  await Promise.all(models.map(model => model.deleteMany({})));
  users = await User.create(Array.from({ length: 7 }, (_, i) => ({ email: `user${i}@likes.test`, kullaniciAdi: `user${i}`, birthYear: i === 6 ? 2012 : 1990, ...newTermsAcceptance() })));
  tokens = await Promise.all(users.map(createNativeSession));
  work = await Work.create({ user: users[0]._id, title: "Published work", status: "published" });
  chapter = await Chapter.create({ work: work._id, title: "Chapter", status: "published" });
  await Work.updateOne({ _id: work._id }, { publishedChapterIds: [chapter._id] });
});
async function request(path, { method = "GET", user = 1, body } = {}) {
  const headers = { "Content-Type": "application/json", ...(user === null ? {} : { Authorization: `Bearer ${tokens[user]}` }) };
  const res = await fetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: await res.json() };
}
const workLike = (liked, user = 1) => request("/likes", { method: "POST", user, body: { workId: String(work._id), liked } });
const chapterLike = (liked, user = 1) => request(`/chapters/${chapter._id}/like`, { method: "POST", user, body: { liked } });
async function assertTotal(total) {
  expect((await Work.findById(work._id)).likeCount).toBe(total);
  expect(await Like.countDocuments({ work: work._id }) + await ChapterLike.countDocuments({ work: work._id })).toBe(total);
}

it("work and chapter likes share a total without overwriting each other", async () => {
  expect((await workLike(true)).body).toEqual({ liked: true, likeCount: 1 });
  expect((await chapterLike(true)).body).toMatchObject({ liked: true, likedByMe: true, likeCount: 1, workLikeCount: 2 });
  expect((await workLike(true)).body.likeCount).toBe(2);
  expect((await request(`/likes/check/${work._id}`)).body).toEqual({ liked: true, likeCount: 2 });
  expect((await chapterLike(false)).body).toMatchObject({ liked: false, likeCount: 0, workLikeCount: 1 });
  expect((await request(`/likes/${work._id}`, { method: "DELETE" })).body.likeCount).toBe(0);
  await assertTotal(0);
  expect(notifyLike).toHaveBeenCalledTimes(2);
});
it("repeated and parallel DELETE never decrement someone else's like or go negative", async () => {
  await workLike(true, 2);
  const results = await Promise.all(Array.from({ length: 5 }, () => request(`/likes/${work._id}`, { method: "DELETE" })));
  expect(results.every(result => result.status === 200 && result.body.likeCount === 1)).toBe(true);
  await assertTotal(1);
});
it("parallel identical requests are idempotent with only one notification", async () => {
  const results = await Promise.all(Array.from({ length: 5 }, () => chapterLike(true)));
  expect(results.every(result => result.status === 200 && result.body.liked && result.body.likeCount === 1)).toBe(true);
  expect(notifyLike).toHaveBeenCalledTimes(1); await assertTotal(1);
  await Promise.all(Array.from({ length: 5 }, () => chapterLike(false))); await assertTotal(0);
});
it("concurrent different users and both sources keep all counts", async () => {
  const results = await Promise.all([1, 2, 3, 4, 5].flatMap(user => [workLike(true, user), chapterLike(true, user)]));
  expect(results.map(result => result.status)).toEqual(Array(10).fill(200));
  await assertTotal(10);
  expect((await request(`/chapters/${chapter._id}/like/check`)).body.likeCount).toBe(5);
  await Promise.all([1, 2, 3, 4, 5].flatMap(user => [workLike(false, user), chapterLike(false, user)]));
  await assertTotal(0);
});
it("a reader's like does not invalidate the author's pending metadata save", async () => {
  const authorCopy = await Work.findById(work._id);
  authorCopy.description = "Author's new description";
  await workLike(true);
  await authorCopy.save();
  expect((await Work.findById(work._id)).description).toBe("Author's new description");
  await assertTotal(1);
});
it("a failed count write rolls back the like and emits no notification", async () => {
  const update = Work.updateOne.bind(Work);
  vi.spyOn(Work, "updateOne").mockImplementation((filter, changes, options) => {
    if (changes.$set?.likeCount !== undefined) throw new Error("simulated storage failure");
    return update(filter, changes, options);
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await workLike(true)).status).toBe(500);
  await assertTotal(0); expect(notifyLike).not.toHaveBeenCalled();
});
it("repairs a stale or negative historical work count from both sources", async () => {
  await Like.create({ user: users[2]._id, work: work._id });
  await ChapterLike.create({ user: users[3]._id, chapter: chapter._id, work: work._id });
  await Work.collection.updateOne({ _id: work._id }, { $set: { likeCount: -8 } });
  expect((await workLike(false)).body.likeCount).toBe(2); await assertTotal(2);
});
it("deleting a chapter removes its likes, keeps work likes, and updates publication status atomically", async () => {
  await workLike(true); await chapterLike(true); await chapterLike(true, 2);
  await expect(deleteLikedChapter({ chapterId: chapter._id, userId: users[1]._id })).rejects.toMatchObject({ status: 403 });
  await assertTotal(3);
  await deleteLikedChapter({ chapterId: chapter._id, userId: users[0]._id });
  expect(await Chapter.exists({ _id: chapter._id })).toBeNull();
  expect(await ChapterLike.countDocuments({ chapter: chapter._id })).toBe(0);
  expect((await Work.findById(work._id)).status).toBe("draft");
  await assertTotal(1);
});
it("a like racing with chapter deletion cannot leave orphan likes", async () => {
  await Promise.all([
    chapterLike(true),
    deleteLikedChapter({ chapterId: chapter._id, userId: users[0]._id }),
  ]);
  expect(await ChapterLike.countDocuments({ chapter: chapter._id })).toBe(0);
  await assertTotal(0);
});
it("legacy toggle clients and supplied wrong workId stay compatible", async () => {
  const path = `/chapters/${chapter._id}/like`;
  expect((await request(path, { method: "POST", body: { workId: String(new mongoose.Types.ObjectId()) } })).body.liked).toBe(true);
  expect((await request(path, { method: "POST" })).body.liked).toBe(false);
  expect((await request("/likes", { method: "POST", body: { workId: String(work._id) } })).body.liked).toBe(true);
  expect((await request("/likes", { method: "POST", body: { workId: String(work._id) } })).body.liked).toBe(false);
  await assertTotal(0);
});
it("guests can read public counts but cannot change them", async () => {
  await chapterLike(true);
  expect((await request(`/chapters/${chapter._id}/like/check`, { user: null })).body).toMatchObject({ liked: false, likeCount: 1 });
  expect((await request(`/likes/check/${work._id}`, { user: null })).body).toEqual({ liked: false, likeCount: 1 });
  expect((await workLike(true, null)).status).toBe(401);
  expect((await chapterLike(true, null)).status).toBe(401);
});
it.each(["draft", "unlisted", "held", "missing", "mature"])("blocks %s targets on read and write endpoints", async mode => {
  if (mode === "draft") await Work.updateOne({ _id: work._id }, { status: "draft" });
  if (mode === "unlisted") await Work.updateOne({ _id: work._id }, { publishedChapterIds: [] });
  if (mode === "held") await Chapter.updateOne({ _id: chapter._id }, { moderationHold: true });
  if (mode === "missing") await Chapter.deleteOne({ _id: chapter._id });
  if (mode === "mature") await Work.updateOne({ _id: work._id }, { contentWarning: true });
  const user = mode === "mature" ? 6 : 1;
  expect((await chapterLike(true, user)).status).toBe(404);
  expect((await request(`/chapters/${chapter._id}/like/check`, { user })).status).toBe(404);
  if (["draft", "mature"].includes(mode)) expect((await workLike(true, user)).status).toBe(404);
  expect(await ChapterLike.countDocuments({})).toBe(0); expect(notifyLike).not.toHaveBeenCalled();
});
it("validates IDs and desired state before touching data", async () => {
  expect((await request("/likes", { method: "POST", body: { workId: "invalid" } })).status).toBe(400);
  expect((await request("/chapters/invalid/like", { method: "POST" })).status).toBe(400);
  expect((await request("/likes", { method: "POST", body: { workId: String(work._id), liked: "true" } })).status).toBe(400);
  expect((await request(`/chapters/${chapter._id}/like`, { method: "POST", body: { liked: 1 } })).status).toBe(400);
  await assertTotal(0);
});
it("comment concurrent writes return the count actually stored by each atomic update", async () => {
  const comment = await Comment.create({ work: work._id, author: users[0]._id, content: "Comment" });
  const path = `/comments/${comment._id}/like`;
  const results = await Promise.all([1, 2, 3, 4, 5].map(user => request(path, { method: "POST", user, body: { liked: true } })));
  expect(results.map(result => result.body.likeCount).sort()).toEqual([1, 2, 3, 4, 5]);
  expect((await Comment.findById(comment._id)).likeCount).toBe(5);
  await Promise.all(Array.from({ length: 4 }, () => request(path, { method: "POST", body: { liked: false } })));
  expect((await Comment.findById(comment._id)).likeCount).toBe(4);
  expect((await request(`/comments/work/${work._id}`)).body.items[0]).toMatchObject({ isLiked: false, likeCount: 4 });
});
it.each(["deleted", "pending", "withdrawn", "mature"])("blocks likes on %s comments", async mode => {
  const comment = await Comment.create({ work: work._id, chapter: chapter._id, author: users[0]._id, content: "Comment", ...(mode === "deleted" ? { isDeleted: true } : mode === "pending" ? { status: "pending_review" } : {}) });
  if (mode === "withdrawn") await Work.updateOne({ _id: work._id }, { publishedChapterIds: [] });
  if (mode === "mature") await Work.updateOne({ _id: work._id }, { contentWarning: true });
  expect((await request(`/comments/${comment._id}/like`, { method: "POST", user: mode === "mature" ? 6 : 1, body: { liked: true } })).status).toBe(mode === "deleted" ? 410 : 404);
  expect((await Comment.findById(comment._id)).likes).toHaveLength(0);
});
it("log concurrent requests keep counts and notify once per newly added user", async () => {
  const log = await Log.create({ author: users[0]._id, content: "Entry" });
  const path = `/logs/${log._id}/like`;
  const results = await Promise.all([1, 2, 3, 4, 5].map(user => request(path, { method: "POST", user, body: { liked: true } })));
  expect(results.map(result => result.body.likeCount).sort()).toEqual([1, 2, 3, 4, 5]);
  await Promise.all(Array.from({ length: 5 }, () => request(path, { method: "POST", body: { liked: true } })));
  expect((await Log.findById(log._id)).likes).toHaveLength(5); expect(notifyLogLike).toHaveBeenCalledTimes(5);
  const profile = await request(`/logs/${users[0]._id}`);
  expect(profile.body.items[0]).toMatchObject({ likeCount: 5, likedByMe: true });
  expect((await request("/feed/top-logs")).body.items[0]).toMatchObject({ likeCount: 5, likedByMe: true });
  expect((await request(`/public/profile/${users[0]._id}/logs`)).body.items[0]).toMatchObject({ likeCount: 5, likedByMe: true });
});
it("log privacy and invalid input are enforced", async () => {
  const log = await Log.create({ author: users[0]._id, content: "Private", visibility: "private" });
  expect((await request(`/logs/${log._id}/like`, { method: "POST", body: { liked: true } })).status).toBe(403);
  expect((await request("/logs/invalid/like", { method: "POST" })).status).toBe(400);
  expect((await request(`/logs/${log._id}/like`, { method: "POST", body: { liked: "true" } })).status).toBe(400);
  expect(notifyLogLike).not.toHaveBeenCalled();
});
it("the current user's log list is reachable and preserves their own like state", async () => {
  const log = await Log.create({ author: users[1]._id, content: "My entry", likes: [users[1]._id] });
  const result = await request("/logs/my");
  expect(result.status).toBe(200);
  expect(result.body.items[0]).toMatchObject({ _id: String(log._id), likedByMe: true, likeCount: 1 });
});
