import { it, expect, vi } from "vitest";
import { loadLogTarget } from "../../frontend/src/lib/loadLogTarget.js";
import { notificationTarget } from "../../frontend/src/lib/notificationTarget.js";
it("uses the log owner's profile, never the liking reader's profile", () => {
  const target = notificationTarget({ type: "log_like", log: "entry", recipient: "owner", sender: { _id: "reader" } });
  expect(target.path).toBe("/profile/owner?tab=log&log=entry");
  expect(notificationTarget({ type: "log_comment", log: { _id: "entry" }, logContext: { author: "owner" } }).path).toBe(target.path);
});
it("finds an older entry beyond the first page and retains pagination", async () => {
  const fetchPage = vi.fn().mockResolvedValueOnce({ items: [{ _id: "new" }], hasMore: true })
    .mockResolvedValueOnce({ items: [{ _id: "target" }], hasMore: true });
  expect(await loadLogTarget(fetchPage, "target")).toMatchObject({ page: 2, found: true, hasMore: true, items: [{ _id: "new" }, { _id: "target" }] });
  expect(fetchPage.mock.calls).toEqual([[1], [2]]);
});
it("reports missing only after exhausting the profile's visible entries", async () => {
  const result = await loadLogTarget(async () => ({ items: [{ _id: "other" }], hasMore: false }), "deleted");
  expect(result.found).toBe(false);
  expect(result.items).toHaveLength(1);
});
it("propagates network failure instead of claiming the log was deleted", async () => {
  await expect(loadLogTarget(async () => { throw new Error("offline"); }, "target")).rejects.toThrow("offline");
});
it("ignores an in-flight result after another notification is opened", async () => {
  let active = true;
  const fetchPage = vi.fn(async () => { active = false; return { items: [{ _id: "old-target" }], hasMore: true }; });
  expect(await loadLogTarget(fetchPage, "target", () => active)).toBeNull();
  expect(fetchPage).toHaveBeenCalledTimes(1);
});
it("normal profile visits load only the first page", async () => {
  const fetchPage = vi.fn(async () => ({ items: [{ _id: "new" }], hasMore: true }));
  expect((await loadLogTarget(fetchPage)).page).toBe(1);
  expect(fetchPage).toHaveBeenCalledTimes(1);
});
