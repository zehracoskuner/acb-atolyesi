import { it, expect, vi } from "vitest";
import { createLikeState, getLikeState, retainLikeState } from "../../frontend/src/lib/likeState.js";
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

it("ignores rapid clicks, sends an explicit state, and uses the server count", async () => {
  const pending = deferred();
  const send = vi.fn(() => pending.promise);
  const button = createLikeState({ count: 4, send });
  const first = button.toggle();
  await button.toggle(); await button.toggle();
  expect(send).toHaveBeenCalledExactlyOnceWith(true);
  expect(button.getSnapshot()).toMatchObject({ liked: true, likeCount: 5, busy: true });
  pending.resolve({ liked: true, likeCount: 7 }); await first;
  expect(button.getSnapshot()).toMatchObject({ liked: true, likeCount: 7, busy: false });
});
it("restores the exact count on errors and lets the user retry", async () => {
  const send = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ liked: false, likeCount: 0 });
  const button = createLikeState({ liked: true, count: 0, send });
  await button.toggle();
  expect(button.getSnapshot()).toMatchObject({ liked: true, likeCount: 0, busy: false });
  expect(button.getSnapshot().error).toBeTruthy();
  await button.toggle();
  expect(send).toHaveBeenLastCalledWith(false);
  expect(button.getSnapshot()).toEqual({ liked: false, likeCount: 0, busy: false, error: "" });
});
it.each([{ liked: true }, { liked: true, likeCount: -1 }, { likeCount: 3 }, { liked: true, likeCount: 1.5 }])("rejects malformed receipts: %j", async receipt => {
  const button = createLikeState({ count: 2, send: async () => receipt });
  await button.toggle();
  expect(button.getSnapshot()).toMatchObject({ liked: false, likeCount: 2, busy: false });
  expect(button.getSnapshot().error).toBeTruthy();
});
it("loads guest counts and legacy likedByMe responses", async () => {
  const button = createLikeState({ load: async () => ({ likedByMe: false, likeCount: 6 }) });
  await button.refresh();
  expect(button.getSnapshot()).toMatchObject({ liked: false, likeCount: 6, busy: false });
});
it("ignores late load responses after a resource/account switch or StrictMode cleanup", async () => {
  const old = deferred();
  const load = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue({ liked: true, likeCount: 9 });
  const button = createLikeState({ load });
  const first = button.refresh();
  button.dispose(); button.activate(); await button.refresh();
  old.resolve({ liked: false, likeCount: 2 }); await first;
  expect(button.getSnapshot()).toMatchObject({ liked: true, likeCount: 9, busy: false });
});
it("blocks clicks during initial state loading and ignores disposed writes", async () => {
  const pending = deferred(); const send = vi.fn();
  const button = createLikeState({ load: () => pending.promise, send });
  const refreshing = button.refresh(); await button.toggle();
  expect(send).not.toHaveBeenCalled();
  button.dispose(); pending.resolve({ liked: true, likeCount: 9 }); await refreshing;
  expect(button.getSnapshot().likeCount).toBe(0);
});
it("new list props cannot overwrite a successful like", async () => {
  const button = createLikeState({ send: async () => ({ liked: true, likeCount: 5 }) });
  button.syncInitial(false, 4);
  expect(button.getSnapshot().likeCount).toBe(4);
  await button.toggle(); button.syncInitial(false, 4);
  expect(button.getSnapshot()).toMatchObject({ liked: true, likeCount: 5 });
});
it("duplicate cards share receipts and a pending lock while accounts/resources stay separate", async () => {
  const pending = deferred(); const send = vi.fn(() => pending.promise);
  const first = getLikeState("log-1:user-1", { send });
  const second = getLikeState("log-1:user-1", { send });
  const anotherUser = getLikeState("log-1:user-2", { send });
  const releaseFirst = retainLikeState("log-1:user-1", first);
  const releaseSecond = retainLikeState("log-1:user-1", second);
  expect(first).toBe(second); expect(first).not.toBe(anotherUser);
  const writing = first.toggle(); await second.toggle();
  expect(send).toHaveBeenCalledTimes(1);
  releaseFirst();
  pending.resolve({ liked: true, likeCount: 8 }); await writing;
  expect(second.getSnapshot()).toMatchObject({ liked: true, likeCount: 8, busy: false });
  releaseSecond(); await Promise.resolve();
  expect(getLikeState("log-1:user-1", { send })).not.toBe(first);
});
it("a second card's refresh cannot overtake an in-flight like", async () => {
  const pending = deferred(); const load = vi.fn(async () => ({ liked: false, likeCount: 0 }));
  const button = createLikeState({ send: () => pending.promise });
  const writing = button.toggle(); await button.refresh(load);
  expect(load).not.toHaveBeenCalled();
  pending.resolve({ liked: true, likeCount: 1 }); await writing;
  expect(button.getSnapshot()).toMatchObject({ liked: true, likeCount: 1, busy: false });
});
it("StrictMode effect reattachment preserves the shared controller", async () => {
  const button = getLikeState("strict:user", { send: async () => ({ liked: true, likeCount: 1 }) });
  const release = retainLikeState("strict:user", button); release();
  const releaseAgain = retainLikeState("strict:user", button);
  await Promise.resolve();
  expect(getLikeState("strict:user", {})).toBe(button);
  await button.toggle();
  expect(button.getSnapshot()).toMatchObject({ liked: true, likeCount: 1 });
  releaseAgain(); await Promise.resolve();
});
