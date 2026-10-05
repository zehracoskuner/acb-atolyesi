import { createNativeSession } from "../services/authSession.js";
import { randomUUID, randomBytes } from "node:crypto";
import { once } from "node:events";
import express from "express";
import mongoose from "mongoose";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import userRouter from "../routes/user.js";
import User from "../models/User.js";
import { newTermsAcceptance } from "../config/terms.js";
vi.mock("../../shared/features.js", async importOriginal => ({ ...await importOriginal(), DEVELOPMENT_COACH_LAUNCH_ENABLED: true }));

const uri = process.env.CHAPTER_TEST_MONGO_URI;
const database = `acb_preference_test_${randomUUID().replaceAll("-", "")}`;
describe.skipIf(!uri)("development preference HTTP persistence with real authentication", () => {
  let server, base, id, headers;
  beforeAll(async () => {
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\/?(?:\?.*)?$/.test(uri)) throw Error("Loopback only");
    vi.stubEnv("JWT_SECRET", randomBytes(32).toString("hex"));
    await mongoose.connect(uri, { dbName: database });
    id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, email: "preference@example.test", profileComplete: true, role: "user", birthYear: 1990, ...newTermsAcceptance() });
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${await createNativeSession({ _id: id })}` };
    const app = express(); app.use(express.json()); app.use("/api/user", userRouter);
    server = app.listen(0, "127.0.0.1"); await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}/api/user/development-coach`;
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
    await mongoose.disconnect(); vi.unstubAllEnvs();
  });
  it("requires login and persists both choices across subsequent requests", async () => {
    expect((await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: '{"preference":"enabled"}' })).status).toBe(401);
    expect(await (await fetch(base, { headers })).json()).toEqual({ preference: "undecided" });
    for (const preference of ["disabled", "enabled", "disabled"]) {
      const response = await fetch(base, { method: "PATCH", headers, body: JSON.stringify({ preference }) });
      expect(response.status).toBe(200);
      expect((await response.json()).preference).toBe(preference);
      expect((await User.findById(id).lean()).settings.developmentCoach).toBe(preference);
      expect(await (await fetch(base, { headers })).json()).toEqual({ preference });
    }
    expect((await fetch(base, { method: "PATCH", headers, body: '{"preference":"undecided"}' })).status).toBe(400);
    expect((await User.findById(id).lean()).settings.developmentCoach).toBe("disabled");
  });
});
