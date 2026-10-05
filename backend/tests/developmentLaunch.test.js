import { beforeAll, afterAll, expect, it, vi } from "vitest";
import express from "express";
import { once } from "node:events";
import chapterRouter from "../routes/chapter.js";
import userRouter from "../routes/user.js";
import User from "../models/User.js";
import { runDevelopmentCoach } from "../services/developmentCoach.js";
import { DEVELOPMENT_COACH_LAUNCH_ENABLED, PLOTWORLD_SCENE_AI_ENABLED } from "../../shared/features.js";
vi.mock("../middlewares/ensureAuth.js", () => ({ default: (req, _res, next) => { req.user = { id: "507f1f77bcf86cd799439011" }; next(); }, optionalAuth: (_req, _res, next) => next() }));
vi.mock("../services/emailService.js", () => ({ sendMail: vi.fn(), sendStaffMail: vi.fn(), SITE_URL: "http://localhost.test" }));
let server, base;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use("/api/chapters", chapterRouter); app.use("/api/user", userRouter);
  server = app.listen(0, "127.0.0.1"); await once(server, "listening"); base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { await new Promise(resolve => server.close(resolve)); vi.restoreAllMocks(); });
it("blocks all coach routes and enabling consent while beta is locked", async () => {
  expect(DEVELOPMENT_COACH_LAUNCH_ENABLED).toBe(false); expect(PLOTWORLD_SCENE_AI_ENABLED).toBe(false);
  const update = vi.spyOn(User, "updateOne");
  for (const [method, suffix] of [["POST", ""], ["GET", ""], ["GET", "/latest"], ["GET", "/analyses"]]) {
    const response = await fetch(base + "/api/chapters/development/507f1f77bcf86cd799439011" + suffix, { method });
    expect(response.status).toBe(503); expect((await response.json()).code).toBe("DEVELOPMENT_COMING_SOON");
  }
  const response = await fetch(base + "/api/user/development-coach", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: '{"preference":"enabled"}' });
  expect(response.status).toBe(503); expect(update).not.toHaveBeenCalled();
});
it("blocks internal analysis invocations before provider or database work", async () => {
  const generate = vi.fn();
  await expect(runDevelopmentCoach({ workId: "507f1f77bcf86cd799439011", userId: "507f1f77bcf86cd799439011" }, { config: { enabled: true, dailyLimit: 2 }, provider: { generate } })).rejects.toMatchObject({ code: "DEVELOPMENT_COMING_SOON" });
  expect(generate).not.toHaveBeenCalled();
});
