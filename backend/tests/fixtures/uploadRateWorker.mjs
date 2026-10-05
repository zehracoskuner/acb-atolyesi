// Test-only HTTP process: never registered by the application server.
import express from "express";
import mongoose from "mongoose";
import { uploadLimiter, uploadUserLimiter } from "../../middlewares/rateLimiter.js";

const [uri] = process.argv.slice(2);
if (!/^mongodb:\/\/127\.0\.0\.1:/.test(uri)) throw new Error("Local test DB required");
await mongoose.connect(uri, { dbName: "upload_security_test" });
const app = express();
app.set("trust proxy", 1);
app.post("/attempt", uploadLimiter, (req, res, next) => {
  req.user = { id: req.get("X-Test-User") };
  next();
}, uploadUserLimiter, (req, res) => res.json({ ok: true }));
const server = app.listen(0, "127.0.0.1", () => process.send({ port: server.address().port }));
process.on("message", async message => {
  if (message === "stop") {
    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    process.exit(0);
  }
});
