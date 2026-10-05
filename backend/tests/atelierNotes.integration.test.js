import mongoose from "mongoose";
import express from "express";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import Work from "../models/Work.js";
import Note from "../models/Note.js";
vi.mock("../middlewares/ensureAuth.js", () => ({ default: (req, res, next) => { req.user = { id: req.get("x-test-user") }; next(); } }));
import notesRouter from "../routes/notes.js";

const uri = process.env.CHAPTER_TEST_MONGO_URI;
const database = "acb_atelier_test_" + randomUUID().replaceAll("-", "");
describe.skipIf(!uri)("Atelier notes through real routes and MongoDB", () => {
  let server, base;
  beforeAll(async () => {
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\/?(?:\?.*)?$/.test(uri)) throw Error("Only an isolated local replica-set URI is allowed");
    await mongoose.connect(uri, { dbName: database });
    const app = express(); app.use(express.json()); app.use("/notes", notesRouter);
    server = app.listen(0, "127.0.0.1"); await once(server, "listening");
    base = "http://127.0.0.1:" + server.address().port + "/notes";
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === database && database.startsWith("acb_atelier_test_")) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  it("persists the correct author/work/text, updates it, reloads it, and refuses another owner", async () => {
    const userId = new mongoose.Types.ObjectId(), other = new mongoose.Types.ObjectId();
    const work = await Work.create({ user: userId, title: "Egzersiz eseri" });
    const send = (path, method, body, user = userId) => fetch(base + path, {
      method, headers: { "Content-Type": "application/json", "x-test-user": String(user) }, body: body ? JSON.stringify(body) : undefined,
    });
    const created = await send("", "POST", { title: "Egzersiz", content: "İlk metin", workId: String(work._id) });
    expect(created.status).toBe(201);
    const { item } = await created.json();
    let row = await Note.findById(item._id);
    expect(String(row.user)).toBe(String(userId)); expect(String(row.workId)).toBe(String(work._id)); expect(row.content).toBe("İlk metin");
    const updated = await send("/" + item._id, "PATCH", { title: "Güncel başlık", content: "İkinci metin", workId: String(work._id) });
    expect(updated.status).toBe(200);
    const reloaded = await (await send("", "GET")).json();
    expect(reloaded.items).toEqual(expect.arrayContaining([expect.objectContaining({ _id: item._id, content: "İkinci metin", workId: String(work._id) })]));
    expect((await send("/" + item._id, "PATCH", { content: "Yetkisiz" }, other)).status).toBe(404);
    expect((await send("", "POST", { content: "Yetkisiz", workId: String(work._id) }, other)).status).toBe(403);
    row = await Note.findById(item._id); expect(row.content).toBe("İkinci metin");
    expect(await Note.countDocuments({ user: userId })).toBe(1);
  });
});
