import { beforeAll, afterAll, afterEach, expect, it, vi } from "vitest";
import express from "express";
import { once } from "node:events";
import User from "../models/User.js";
import userRouter from "../routes/user.js";
import chapterRouter from "../routes/chapter.js";
import { CHAPTER_HISTORY_ENABLED } from "../../shared/features.js";
vi.mock("../services/emailService.js", () => ({ sendMail: vi.fn(), sendStaffMail: vi.fn(), SITE_URL: "https://example.test" }));
vi.mock("../../shared/features.js", async importOriginal => ({ ...await importOriginal(), DEVELOPMENT_COACH_LAUNCH_ENABLED: true }));
vi.mock("../middlewares/ensureAuth.js", () => ({ default: (req, _res, next) => { req.user = { id: "507f1f77bcf86cd799439011" }; next(); }, optionalAuth: (_req, _res, next) => next() }));
let server, base;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use("/user", userRouter); app.use("/chapters", chapterRouter);
  server = app.listen(0, "127.0.0.1"); await once(server, "listening"); base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await new Promise(resolve => server.close(resolve)); });
it("defaults to undecided and accepts only explicit boolean choices", async () => {
  vi.spyOn(User, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ settings: {} }) }) });
  expect(await (await fetch(base + "/user/development-coach")).json()).toEqual({ preference: "undecided" });
  const update = vi.spyOn(User, "updateOne").mockResolvedValue({ matchedCount: 1 });
  for (const preference of ["enabled", "disabled"]) {
    const response = await fetch(base + "/user/development-coach", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preference }) });
    expect(response.status).toBe(200); expect((await response.json()).preference).toBe(preference);
    expect(update).toHaveBeenLastCalledWith({ _id: "507f1f77bcf86cd799439011" }, { $set: { "settings.developmentCoach": preference } });
  }
  const response = await fetch(base + "/user/development-coach", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: '{"preference":true}' });
  expect(response.status).toBe(400); expect(update).toHaveBeenCalledTimes(2);
});
it("keeps every public history/checkpoint/restore operation disabled", async () => {
  expect(CHAPTER_HISTORY_ENABLED).toBe(false);
  for (const [method, path] of [["GET", "versions"], ["GET", "VERSIONS/1"], ["POST", "checkpoint"], ["POST", "versions/1/restore"]]) {
    expect((await fetch(base + "/chapters/507f1f77bcf86cd799439011/" + path, { method })).status).toBe(404);
  }
});
