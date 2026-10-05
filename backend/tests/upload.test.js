import { createNativeSession } from "../services/authSession.js";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { once } from "node:events";
import { Writable } from "node:stream";
import { randomBytes } from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import sharp from "sharp";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { fileURLToPath } from "node:url";
import { fork } from "node:child_process";
import { prepareUploadRateLimits, UploadRateStore } from "../services/uploadRateStore.js";
import { v2 as cloudinary } from "cloudinary";
import User from "../models/User.js";
import uploadRouter from "../routes/upload.js";
import userRouter from "../routes/user.js";
import worksRouter from "../routes/works.js";
import Work from "../models/Work.js";
import { moderateCover } from "../utils/aiModerator.js";
import { TERMS_VERSION } from "../config/terms.js";

vi.mock("../utils/aiModerator.js", () => ({ moderateCover: vi.fn() }));
let server, base, id, ip, role, uploaded, replica;
let sequence = 0;
let url = "https://res.cloudinary.com/test/image/upload/cover.png";
let assetSequence = 0;
const fixtures = {};
beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: {
    version: "7.0.14", downloadDir: fileURLToPath(new URL("../node_modules/.cache/mongodb-binaries", import.meta.url)),
  } });
  await mongoose.connect(replica.getUri(), { dbName: "upload_security_test" });
  await prepareUploadRateLimits();
  for (const format of ["jpeg", "png", "webp", "gif"]) {
    fixtures[format] = await sharp({ create: { width: 16, height: 16, channels: 3, background: "red" } })
      .toFormat(format).toBuffer();
  }
  const app = express();
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use("/api/upload", uploadRouter);
  app.use("/api/user", userRouter);
  app.use("/api/works", express.json(), worksRouter);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
}, 120000);
afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await replica?.stop();
});
beforeEach(() => {
  sequence++;
  id = sequence.toString(16).padStart(24, "0");
  ip = `192.0.2.${sequence}`;
  role = "user";
  uploaded = [];
  vi.stubEnv("JWT_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("CLIENT_URL", "https://app.example.test");
  vi.spyOn(User, "findById").mockImplementation(() => ({ select: () => ({ lean: async () => ({
    _id: id, role, profileComplete: true, birthYear: 1990, termsVersion: TERMS_VERSION, termsAcceptedAt: new Date(),
  }) }) }));
  vi.spyOn(User, "findByIdAndUpdate").mockImplementation((id, data) => ({ select: async () => data }));
  moderateCover.mockResolvedValue({ severity: "clean" });
  vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation((options, callback) => {
    const chunks = [];
    return new Writable({
      write(chunk, encoding, done) { chunks.push(chunk); done(); },
      final(done) { uploaded.push(Buffer.concat(chunks)); url = `https://res.cloudinary.com/test/image/upload/cover-${++assetSequence}.png`; callback(null, { secure_url: url, public_id: `cover-${assetSequence}` }); done(); },
    });
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllEnvs(); });

async function upload({ path = "/api/upload", field = "file", buffer = fixtures.png,
  mime = "image/png", auth = "bearer", address = ip, extra = false,
  origin = auth === "cookie" ? "https://app.example.test" : undefined, referer, cookieAndBearer = false } = {}) {
  const body = new FormData();
  if (buffer !== null) body.append(field, new Blob([buffer], { type: mime }), "image.png");
  if (extra) body.append(field, new Blob([fixtures.png], { type: mime }), "second.png");
  const headers = { "X-Forwarded-For": address };
  if (origin !== undefined) headers.Origin = origin;
  if (referer !== undefined) headers.Referer = referer;
  const token = await createNativeSession({ _id: id });
  if (auth === "bearer") headers.Authorization = `Bearer ${token}`;
  if (auth === "cookie") headers.Cookie = `token=${token}`;
  if (cookieAndBearer) headers.Cookie = `token=${token}`;
  if (auth === "invalid") headers.Authorization = "Bearer invalid";
  const response = await fetch(base + path, { method: "POST", headers, body });
  return { status: response.status, data: await response.json() };
}
function noExternalCalls() {
  expect(moderateCover).not.toHaveBeenCalled();
  expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
}

it.each(["none", "invalid"])("rejects %s sessions before processing uploads", async auth => {
  expect((await upload({ auth, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) })).status).toBe(401);
  noExternalCalls();
});
it("rejects banned accounts", async () => {
  role = "banned";
  expect((await upload()).status).toBe(403);
  noExternalCalls();
});
it.each(["jpeg", "png", "webp", "gif"])("decodes and uploads real %s via cookie and bearer sessions", async format => {
  for (const auth of ["cookie", "bearer"]) {
    const response = await upload({ auth, buffer: fixtures[format], mime: `image/${format}` });
    expect(response.status).toBe(200);
    expect(response.data.url).toBe(url);
    expect((await sharp(uploaded.at(-1)).metadata()).format).toBe(format);
    expect(moderateCover).not.toHaveBeenCalled();
  }
});
it("rejects spoofed MIME, non-images, truncated images and missing/extra files", async () => {
  for (const options of [
    { buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') },
    { buffer: Buffer.from("not an image") },
    { buffer: fixtures.jpeg, mime: "image/png" },
    { buffer: fixtures.png, mime: "text/plain" },
    { buffer: fixtures.png.subarray(0, 40) },
    { buffer: fixtures.jpeg.subarray(0, fixtures.jpeg.length - 30), mime: "image/jpeg" },
    { buffer: null }, { field: "wrong" }, { extra: true },
  ]) expect((await upload(options)).status).toBe(400);
  noExternalCalls();
});
it("rejects files over 5 MB before external services", async () => {
  expect((await upload({ buffer: Buffer.alloc(5 * 1024 * 1024 + 1) })).status).toBe(400);
  noExternalCalls();
});
it("removes appended payloads before moderation and storage", async () => {
  const payload = Buffer.from("<script>untrusted payload</script>");
  expect((await upload({ buffer: Buffer.concat([fixtures.png, payload]) })).status).toBe(200);
  expect(uploaded[0].includes(payload)).toBe(false);
});
it("preserves animated GIF frames", async () => {
  const gif = await sharp(Buffer.concat([Buffer.alloc(12, 0), Buffer.alloc(12, 255)]), {
    raw: { width: 2, height: 4, channels: 3, pageHeight: 2 },
  }).gif({ delay: [100, 200], loop: 0 }).toBuffer();
  expect((await upload({ buffer: gif, mime: "image/gif" })).status).toBe(200);
  expect((await sharp(uploaded[0], { animated: true }).metadata()).pages).toBe(2);
});
it("does not ask AI to approve technically valid images", async () => {
  moderateCover.mockResolvedValue({ severity: "reject", reason: "test" });
  expect((await upload()).status).toBe(200);
  expect(moderateCover).not.toHaveBeenCalled();
  expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(1);
});
it("uses uploaded URLs for work creation and subsequent cover changes", async () => {
  const workId = "000000000000000000001234";
  let work;
  vi.spyOn(Work, "create").mockImplementation(async data => {
    const isArray = Array.isArray(data);
    work = { ...(isArray ? data[0] : data), _id: workId, populate: async () => {}, save: async () => {} };
    return isArray ? [work] : work;
  });
  vi.spyOn(Work, "findOne").mockImplementation(async filter =>
    filter._id === workId && filter.user === id ? work : null);
  const headers = { "Content-Type": "application/json", Origin: 'https://app.example.test', Cookie: `token=${await createNativeSession({ _id: id })}` };
  const first = await upload({ auth: "cookie" });
  expect(first.status).toBe(200);
  const created = await fetch(base + "/api/works", { method: "POST", headers,
    body: JSON.stringify({ title: "Test work", coverImage: first.data.url }) });
  expect(created.status).toBe(201);
  expect((await created.json()).item.coverImage).toBe(url);
  const second = await upload();
  expect(second.status).toBe(200);
  work.coverImage = "https://example.test/old.png";
  const updated = await fetch(base + `/api/works/${workId}`, { method: "PATCH", headers,
    body: JSON.stringify({ coverImage: second.data.url }) });
  expect(updated.status).toBe(200);
  expect((await updated.json()).item.coverImage).toBe(url);
});
it("rejects excessive decoded pixel counts and animation frame counts", async () => {
  const large = await sharp({ create: { width: 6400, height: 6400, channels: 3, background: "white" } }).png().toBuffer();
  expect(large.length).toBeLessThan(5 * 1024 * 1024);
  expect((await upload({ buffer: large })).status).toBe(400);
  const frames = Buffer.alloc(201 * 3);
  for (let i = 0; i < 201; i++) frames.fill(i % 2 ? 255 : 0, i * 3, i * 3 + 3);
  const animated = await sharp(frames, { raw: { width: 1, height: 201, channels: 3, pageHeight: 1 } }).gif().toBuffer();
  expect((await upload({ buffer: animated, mime: "image/gif" })).status).toBe(400);
  noExternalCalls();
});
it("keeps a 20/hour account quota across changing IPs", async () => {
  for (let i = 0; i < 20; i++) {
    expect((await upload({ buffer: null, address: `198.51.100.${i + 1}` })).status).toBe(400);
  }
  expect((await upload({ address: "198.51.100.21" })).status).toBe(429);
  noExternalCalls();
});
it("keeps the existing 20/hour IP quota across different accounts", async () => {
  for (let i = 0; i < 20; i++) {
    id = (1000 + i).toString(16).padStart(24, "0");
    expect((await upload({ buffer: null })).status).toBe(400);
  }
  id = "000000000000000000009999";
  expect((await upload()).status).toBe(429);
  noExternalCalls();
});
it.each([["avatar", "avatarUrl"], ["banner", "bannerImage"]])("preserves %s profile response and authentication", async (field, property) => {
  const options = { path: `/api/user/${field}?userId=000000000000000000009999`, field };
  expect((await upload({ ...options, auth: "none" })).status).toBe(401);
  expect((await upload({ ...options, buffer: Buffer.from("fake") })).status).toBe(400);
  expect((await upload({ ...options, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) })).status).toBe(400);
  noExternalCalls();
  for (const auth of ["cookie", "bearer"]) {
    const response = await upload({ ...options, auth });
    expect(response.status).toBe(200);
    expect(response.data[property]).toBe(url);
    expect(User.findByIdAndUpdate).toHaveBeenLastCalledWith(id, expect.objectContaining({ [property]: url }), expect.objectContaining({ new: true, session: expect.anything() }));
  }
});

it.each(["/api/upload", "/api/user/avatar", "/api/user/banner"])("rejects CSRF before external processing on %s", async path => {
  const field = path === "/api/upload" ? "file" : path.split("/").at(-1);
  for (const options of [
    { auth: "cookie", origin: "https://evil.example.test" },
    { auth: "cookie", origin: "null" },
    { auth: "cookie", origin: "" },
    { auth: "cookie", origin: "", referer: "https://app.example.test.evil.test/x" },
    { auth: "bearer", cookieAndBearer: true },
    { auth: "bearer", origin: "https://evil.example.test" },
  ]) {
    const response = await upload({ path, field, ...options });
    expect(response.status).toBe(403);
    expect(response.data.code).toBe("UPLOAD_ORIGIN_REJECTED");
  }
  noExternalCalls();
  expect(await mongoose.connection.db.collection("upload_rate_limits").findOne({ _id: `upload:user:${id}` })).toBeNull();
  expect((await upload({ path, field, auth: "cookie", origin: "", referer: "https://app.example.test/profile" })).status).toBe(200);
});

it("does not change another owner's cover, including an admin's request", async () => {
  const workId = "000000000000000000001234";
  const save = vi.fn();
  const work = { user: "000000000000000000009999", coverImage: "original", save };
  vi.spyOn(Work, "findOne").mockImplementation(async filter => filter.user === work.user ? work : null);
  for (const accountRole of ["user", "admin"]) {
    role = accountRole;
    const response = await fetch(base + `/api/works/${workId}`, { method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await createNativeSession({ _id: id })}` },
      body: JSON.stringify({ coverImage: url, user: work.user }),
    });
    expect(response.status).toBe(404);
    expect(Work.findOne).toHaveBeenLastCalledWith({ _id: workId, user: id });
  }
  expect(work.coverImage).toBe("original");
  expect(save).not.toHaveBeenCalled();
});

it("atomically admits only 20 concurrent attempts for one user", async () => {
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => upload({ buffer: null, address: `203.0.113.${i + 1}` })));
  expect(results.filter(result => result.status === 400)).toHaveLength(20);
  expect(results.filter(result => result.status === 429)).toHaveLength(20);
  noExternalCalls();
});

it("counts validation, successful uploads and provider failures without refund, across all upload paths", async () => {
  expect((await upload({ buffer: Buffer.from("invalid") })).status).toBe(400);
  moderateCover.mockResolvedValueOnce({ severity: "reject" });
  expect((await upload()).status).toBe(200);
  cloudinary.uploader.upload_stream.mockImplementationOnce(() => { throw new Error("provider unavailable"); });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await upload()).status).toBe(500);
  log.mockRestore();
  for (let i = 0; i < 17; i++) {
    const field = i % 2 ? "avatar" : "banner";
    expect((await upload({ path: `/api/user/${field}`, field, buffer: null })).status).toBe(400);
  }
  expect((await upload({ address: "203.0.113.100" })).status).toBe(429);
  const counter = await mongoose.connection.db.collection("upload_rate_limits").findOne({ _id: `upload:user:${id}` });
  expect(counter.hits).toBe(21);
  expect(moderateCover).not.toHaveBeenCalled();
  expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(2);
});

it("fails closed on quota database errors", async () => {
  vi.spyOn(UploadRateStore.prototype, "increment").mockRejectedValue(new Error("database unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  // Express's default error response is HTML; inspect status directly.
  const response = await fetch(base + "/api/upload", { method: "POST" });
  expect(response.status).toBe(500);
  noExternalCalls();
  log.mockRestore();
});

it("shares both quotas across independent Node processes and process restarts", async () => {
  const workers = [];
  async function worker() {
    const child = fork(fileURLToPath(new URL("./fixtures/uploadRateWorker.mjs", import.meta.url)), [replica.getUri()], {
      stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true,
    });
    workers.push(child);
    const { port } = await new Promise((resolve, reject) => {
      child.once("message", resolve);
      child.once("error", reject);
      child.once("exit", code => reject(new Error(`Worker exited early: ${code}`)));
    });
    return `http://127.0.0.1:${port}/attempt`;
  }
  async function attempt(endpoint, user, address) {
    const result = await fetch(endpoint, { method: "POST", headers: { "X-Test-User": user, "X-Forwarded-For": address } });
    await result.text();
    return result.status;
  }
  try {
    const endpoints = await Promise.all([worker(), worker()]);
    const userResults = await Promise.all(Array.from({ length: 40 }, (_, i) =>
      attempt(endpoints[i % 2], "multiprocess-user", `198.18.0.${i + 1}`)));
    expect(userResults.filter(status => status === 200)).toHaveLength(20);
    expect(userResults.filter(status => status === 429)).toHaveLength(20);
    const ipResults = await Promise.all(Array.from({ length: 40 }, (_, i) =>
      attempt(endpoints[i % 2], `multiprocess-ip-user-${i}`, "198.18.1.1")));
    expect(ipResults.filter(status => status === 200)).toHaveLength(20);
    expect(ipResults.filter(status => status === 429)).toHaveLength(20);
    const exited = once(workers[0], "exit");
    workers[0].send("stop");
    await exited;
    const restarted = await worker();
    expect(await attempt(restarted, "multiprocess-user", "198.18.2.1")).toBe(429);
    expect(await attempt(restarted, "another-user", "198.18.1.1")).toBe(429);
  } finally {
    await Promise.all(workers.filter(child => child.exitCode === null).map(async child => {
      const exited = once(child, "exit");
      child.send("stop");
      await exited;
    }));
  }
}, 30000);

it("resets expired counters atomically without waiting for TTL deletion", async () => {
  const store = new UploadRateStore("test:expiry:");
  store.init({ windowMs: 3600000 });
  await mongoose.connection.db.collection("upload_rate_limits").insertOne({
    _id: "test:expiry:key", hits: 20, expiresAt: new Date(0),
  });
  const results = await Promise.all(Array.from({ length: 40 }, () => store.increment("key")));
  expect(results.map(result => result.totalHits).sort((a, b) => a - b)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  expect(new Set(results.map(result => +result.resetTime)).size).toBe(1);
  const indexes = await mongoose.connection.db.collection("upload_rate_limits").indexes();
  expect(indexes).toEqual(expect.arrayContaining([expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 })]));
});

it("rejects combined animation pixel bombs before external services", async () => {
  const pixels = Buffer.alloc(4500 * 4500 * 3 * 2);
  pixels.fill(255, pixels.length / 2);
  const gif = await sharp(pixels, {
    raw: { width: 4500, height: 9000, channels: 3, pageHeight: 4500 },
  }).gif().toBuffer();
  // Each frame fits the limit; both decoded frames together exceed it.
  expect((await sharp(gif, { animated: true }).metadata()).pages).toBe(2);
  expect(gif.length).toBeLessThan(5 * 1024 * 1024);
  expect((await upload({ buffer: gif, mime: "image/gif" })).status).toBe(400);
  noExternalCalls();
}, 15000);
