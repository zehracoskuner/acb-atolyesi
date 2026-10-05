import { createNativeSession } from "../services/authSession.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import express from "express";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { Packer } from "docx";
import mammoth from "mammoth";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import User from "../models/User.js";
import AuthSession from "../models/AuthSession.js";
import worksRouter from "../routes/works.js";
import { readBookSnapshot } from "../services/bookSnapshot.js";
import { newTermsAcceptance } from "../config/terms.js";

// Explicit opt-in: the first run downloads a temporary mongod binary.
describe.runIf(process.env.BOOK_DB_TEST === "1")("private book download with a real replica set", () => {
  let replica, server, base, work, chapters;
  const owner = new mongoose.Types.ObjectId(), other = new mongoose.Types.ObjectId();
  const previousSecret = process.env.JWT_SECRET;
  beforeAll(async () => {
    process.env.JWT_SECRET = randomBytes(48).toString("hex");
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14" } });
    await mongoose.connect(replica.getUri());
    // Match server readiness: index creation must finish before snapshot reads.
    await Promise.all([Work.init(), Chapter.init(), AuthSession.init()]);
    const app = express(); app.use(express.json()); app.use("/api/works", worksRouter);
    server = app.listen(0, "127.0.0.1"); await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}/api/works`;
  }, 900000);
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); await replica?.stop();
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  });
  beforeEach(async () => {
    vi.spyOn(User, "findById").mockImplementation(id => ({ select: () => ({ lean: async () => ({ _id: id, profileComplete: true, role: "user", birthYear: 1990, ...newTermsAcceptance() }) }) }));
    await Chapter.deleteMany({}); await Work.deleteMany({});
    work = await Work.create({ user: owner, title: 'Çığ & Şüphe "Kitap"', description: "SECRET_DESCRIPTION", universe: { rules: "SECRET_RULE" } });
    chapters = await Chapter.create([
      { work: work._id, title: "Üçüncü", content: "<p>Son metin</p>", order: 3, status: "rejected", reviewNote: "SECRET_AI", revision: 7 },
      { work: work._id, title: "İlk", content: "<p>Başlangıç</p>", order: 1, status: "published", revision: 2 },
      { work: work._id, title: "İkinci", content: "<p>Özel taslak</p>", order: 2, status: "draft", revision: 4 },
    ]);
  });
  afterEach(() => vi.restoreAllMocks());
  async function request(user = owner, format = "txt", id = work._id, extra = {}) {
    return fetch(`${base}/${id}/download?format=${format}`, { headers: user ? { Authorization: `Bearer ${await createNativeSession({ _id: user })}` } : {}, ...extra });
  }
  it("requires authentication and actual ownership, even for public work", async () => {
    expect((await request(null)).status).toBe(401);
    const denied = await request(other);
    expect(denied.status).toBe(404); expect(await denied.text()).not.toContain("Özel taslak");
    expect((await request(owner, "pdf")).status).toBe(400);
    expect((await request(owner, "txt", "invalid")).status).toBe(400);
  });
  it("returns private UTF-8 attachments, sorted chapters and all publication states", async () => {
    const res = await request(); expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-disposition")).toContain("filename*=UTF-8''%C3%87");
    const text = await res.text();
    expect(text).toBe(work.title + "\n\nİlk\n\nBaşlangıç\n\nİkinci\n\nÖzel taslak\n\nÜçüncü\n\nSon metin\n");
    expect(text).not.toContain("SECRET_");
    const docx = await request(owner, "docx"); expect(docx.status).toBe(200);
    expect((await mammoth.extractRawText({ buffer: Buffer.from(await docx.arrayBuffer()) })).value).toContain("Özel taslak");
  });
  it("pins revisions and membership before concurrent edits, insertion and deletion", async () => {
    const originalExec = mongoose.Query.prototype.exec;
    let intercepted = false;
    vi.spyOn(mongoose.Query.prototype, "exec").mockImplementation(async function (...args) {
      const result = await originalExec.apply(this, args);
      if (!intercepted && this.model === Chapter && this.op === "find" && this._fields?.revision && !this._fields?.content) {
        intercepted = true;
        await Chapter.updateOne({ _id: chapters[1]._id }, { $set: { content: "NEW VERSION", title: "NEW TITLE" }, $inc: { revision: 1 } });
        await Chapter.deleteOne({ _id: chapters[0]._id });
        await Chapter.create({ work: work._id, title: "NEW CHAPTER", content: "NEW CONTENT", order: 9 });
      }
      return result;
    });
    const snapshot = await readBookSnapshot(work._id, owner);
    expect(intercepted).toBe(true);
    expect(snapshot.chapters.map(ch => ch.title)).toEqual(["İlk", "İkinci", "Üçüncü"]);
    expect(snapshot.chapters[0].content).toBe("<p>Başlangıç</p>");
    expect(Object.isFrozen(snapshot.chapters[0])).toBe(true);
  });
  it("fails a missing chapter read rather than sending a partial book", async () => {
    const originalExec = mongoose.Query.prototype.exec;
    vi.spyOn(mongoose.Query.prototype, "exec").mockImplementation(async function (...args) {
      const result = await originalExec.apply(this, args);
      return this.model === Chapter && this.op === "find" && this._fields?.content ? result.slice(1) : result;
    });
    const res = await request(); expect(res.status).toBe(500);
    expect(res.headers.get("content-disposition")).toBeNull();
    expect(res.headers.get("content-type")).toContain("application/json");
  });
  it("fails generation without an attachment", async () => {
    vi.spyOn(Packer, "toBuffer").mockRejectedValue(new Error("disk or compression failure"));
    const res = await request(owner, "docx"); expect(res.status).toBe(500);
    expect(res.headers.get("content-disposition")).toBeNull();
  });
  it("disables reordering and preserves the stored order", async () => {
    const ids = chapters.map(ch => String(ch._id));
    const reorder = async (chapterIds, user = owner) => fetch(`${base}/${work._id}/chapter-order`, { method: "PUT", headers: {
      "Content-Type": "application/json", Authorization: `Bearer ${await createNativeSession({ _id: user })}`,
    }, body: JSON.stringify({ chapterIds }) });
    for (const values of [ids, ids.slice(1), [ids[0], ids[0]]]) {
      const response = await reorder(values);
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("CHAPTER_ORDER_DISABLED");
    }
    expect((await reorder(ids, other)).status).toBe(403);
    expect((await readBookSnapshot(work._id, owner)).chapters.map(ch => ch.title)).toEqual(["İlk", "İkinci", "Üçüncü"]);
  });
});
