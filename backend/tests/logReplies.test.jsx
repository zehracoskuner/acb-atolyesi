import { beforeEach, expect, it, vi } from "vitest";
import { logCommentThreads } from "../../frontend/src/components/logCommentThreads.js";
vi.mock("../models/User.js", () => ({ default: { findById: () => ({ select: () => ({ lean: async () => ({ kullaniciAdi: "Kalem" }) }) }) } }));
vi.mock("../models/Notification.js", () => ({ default: { create: vi.fn(async () => {}) } }));
import Notification from "../models/Notification.js";
import { notifyLogComment } from "../services/notificationService.js";
beforeEach(() => vi.clearAllMocks());

it("keeps replies together at one level and retains threads when their root is deleted", () => {
  const comments = [{ _id: "a" }, { _id: "b" }, { _id: "c", parentId: "a", threadId: "a" }, { _id: "d", parentId: "c", threadId: "a" }];
  expect(logCommentThreads(comments).map(({ comment, isReply }) => [comment._id, isReply])).toEqual([["a", false], ["c", true], ["d", true], ["b", false]]);
  expect(logCommentThreads(comments.slice(1)).filter(row => row.isReply).map(row => row.comment._id)).toEqual(["c", "d"]);
});
it("notifies the person being replied to even when the sender owns the log", async () => {
  await notifyLogComment({ senderId: "owner", logAuthorId: "owner", replyAuthorId: "reader", logId: "log", commentPreview: "Merhaba" });
  expect(Notification.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ recipient: "reader", log: "log", text: 'Kalem yorumuna yanıt verdi: "Merhaba"' }));
});
it("deduplicates the log owner and reply recipient and skips self replies", async () => {
  await notifyLogComment({ senderId: "writer", logAuthorId: "reader", replyAuthorId: "reader", logId: "log", commentPreview: "Selam" });
  expect(Notification.create).toHaveBeenCalledTimes(1);
  Notification.create.mockClear();
  await notifyLogComment({ senderId: "reader", logAuthorId: "reader", replyAuthorId: "reader", logId: "log", commentPreview: "Selam" });
  expect(Notification.create).not.toHaveBeenCalled();
});
