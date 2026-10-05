import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { once } from "node:events";
import express from "express";
import Note from "../models/Note.js";
import Work from "../models/Work.js";
vi.mock("../middlewares/ensureAuth.js", () => ({ default: (req, res, next) => { req.user = { id: "000000000000000000000001" }; next(); } }));
import notesRouter from "../routes/notes.js";
let server, base, row;
const user = "000000000000000000000001", noteId = "000000000000000000000002", workId = "000000000000000000000003";
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use("/notes", notesRouter);
  server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}/notes`;
});
afterAll(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => {
  row = { _id: noteId, user, title: "Deneme", content: "Deneme metni", workId: null };
  vi.spyOn(Work, "exists").mockResolvedValue({ _id: workId });
  vi.spyOn(Note, "findOneAndUpdate").mockImplementation(async (filter, update) => {
    expect(filter).toEqual({ _id: noteId, user });
    row = { ...row, ...update.$set };
    return Note.hydrate(row);
  });
  vi.spyOn(Note, "find").mockImplementation(filter => {
    expect(filter).toEqual({ user });
    return { sort: async () => [Note.hydrate(row)] };
  });
});
afterEach(() => vi.restoreAllMocks());
const patch = body => fetch(`${base}/${noteId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
describe("general note work links (isolated storage)", () => {
  it("creates an exercise note with its owned work link and rejects another work", async () => {
    const create = vi.spyOn(Note, "create").mockImplementation(async value => Note.hydrate({ ...value, _id: noteId }));
    const post = () => fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Egzersiz", content: "metin", workId }) });
    const response = await post();
    expect(response.status).toBe(201);
    expect((await response.json()).item).toMatchObject({ workId, content: "metin" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ workId, user }));
    Work.exists.mockResolvedValue(null); create.mockClear();
    expect((await post()).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });
  it("returns the saved link after reloading and supports unlinking without moving content", async () => {
    expect((await patch({ workId })).status).toBe(200);
    expect(Work.exists).toHaveBeenCalledWith({ _id: workId, user });
    let result = await (await fetch(base)).json();
    expect(result.items[0]).toMatchObject({ workId, content: "Deneme metni" });
    expect((await patch({ workId: null })).status).toBe(200);
    result = await (await fetch(base)).json();
    expect(result.items[0]).toMatchObject({ workId: null, content: "Deneme metni" });
  });
  it("preserves the existing link when only text is changed", async () => {
    row.workId = workId;
    expect((await patch({ content: "" })).status).toBe(200);
    expect(row).toMatchObject({ workId, content: "" });
  });
  it("rejects linking someone else's work without saving text", async () => {
    Work.exists.mockResolvedValue(null);
    expect((await patch({ workId, content: "change" })).status).toBe(403);
    expect(Note.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it("rejects malformed work IDs", async () => {
    expect((await patch({ workId: "bad-id" })).status).toBe(403);
    expect(Note.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
