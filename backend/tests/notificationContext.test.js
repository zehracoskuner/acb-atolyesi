import { describe, it, expect, vi, beforeEach } from "vitest";
import { notificationTarget } from "../../frontend/src/lib/notificationTarget.js";
vi.mock("../models/Notification.js", () => ({ default: { create: vi.fn() } }));
vi.mock("../models/User.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../models/Work.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../models/Chapter.js", () => ({ default: { findById: vi.fn() } }));
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import { notifyLike, notifyComment, notifyReply } from "../services/notificationService.js";
const query = value => ({ select: () => ({ lean: async () => value }) });
beforeEach(() => {
  vi.clearAllMocks();
  User.findById.mockReturnValue(query({ kullaniciAdi: "Deniz" }));
  Work.findById.mockReturnValue(query({ title: "Yol", user: "owner" }));
  Chapter.findById.mockReturnValue(query({ title: "İlk adım" }));
});
describe("notification context", () => {
  it("preserves the exact liked chapter and its title", async () => {
    await notifyLike({ senderId: "reader", workId: "work", chapterId: "chapter" });
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({ chapter: "chapter", work: "work", text: 'Deniz, "Yol · İlk adım" bölümünü beğendi.' }));
  });
  it("preserves chapter context for comments and replies", async () => {
    await notifyComment({ senderId: "reader", workId: "work", chapterId: "chapter", commentPreview: "Harika" });
    await notifyReply({ senderId: "reader", recipientId: "owner", workId: "work", chapterId: "chapter" });
    for (const [notification] of Notification.create.mock.calls) expect(notification.chapter).toBe("chapter");
    expect(Notification.create.mock.calls).toHaveLength(2);
  });
  it("does not notify the author about their own like", async () => {
    await notifyLike({ senderId: "owner", workId: "work", chapterId: "chapter" });
    expect(Notification.create).not.toHaveBeenCalled();
  });
  it("opens exact chapters while legacy notifications fall back to the work", () => {
    expect(notificationTarget({ type: "like", work: { _id: "w" }, chapter: { _id: "c" } }).path).toBe("/read/w?chapter=c");
    expect(notificationTarget({ type: "like", work: { _id: "w" } }).path).toBe("/story/w");
  });
  it("opens a specific log regardless of its position in the feed", () => {
    expect(notificationTarget({ type: "log_comment", log: "l", logContext: { preview: "Bugün" } })).toMatchObject({ path: "/gunluk/l", title: "Bugün" });
  });
  it("retains report and profile destinations and tolerates deleted targets", () => {
    expect(notificationTarget({ type: "report_update", report: "r" }).path).toBe("/basvurular/r");
    expect(notificationTarget({ type: "follow", sender: { _id: "u" } }).path).toBe("/profile/u");
    expect(notificationTarget({ type: "like", work: null })).toBeNull();
  });
});
