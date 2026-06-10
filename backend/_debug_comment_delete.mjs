import "dotenv/config";
import mongoose from "mongoose";
import Comment from "./models/Comment.js";
import User from "./models/User.js";
import { deleteComment, updateComment } from "./controllers/commentController.js";

await mongoose.connect(process.env.MONGO_URI);

// Find any existing user to act as author
const user = await User.findOne({});
if (!user) { console.log("No user found"); process.exit(1); }

const comment = await Comment.create({
  author: user._id,
  work: new mongoose.Types.ObjectId(), // dummy work id, just for the test
  content: "DEBUG TEST COMMENT - safe to delete",
});

console.log("Created comment:", comment._id.toString(), "author:", comment.author.toString());
console.log("user._id:", user._id.toString(), typeof user._id);

const req = {
  params: { commentId: comment._id.toString() },
  body: {},
  user: { id: user._id.toString(), role: user.role || "user" },
};

let statusCode = null, jsonBody = null;
const res = {
  status(code) { statusCode = code; return this; },
  json(body) { jsonBody = body; return this; },
};

try {
  await deleteComment(req, res);
  console.log("deleteComment status:", statusCode, "body:", jsonBody);
} catch (e) {
  console.log("deleteComment threw:", e);
}

const stillExists = await Comment.findById(comment._id);
console.log("Still exists after delete:", !!stillExists);

if (stillExists) await Comment.deleteOne({ _id: comment._id });

await mongoose.disconnect();
