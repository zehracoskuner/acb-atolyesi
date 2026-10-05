import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { subscribeSpotlight } from "../../frontend/src/lib/spotlightSync.js";

let stop;
let events;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "performance"] });
  vi.setSystemTime(new Date("2040-01-01"));
  events = new EventTarget();
  events.visibilityState = "visible";
  vi.stubGlobal("document", events);
});
afterEach(() => { stop?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const result = (id, seconds) => ({ work: { _id: id }, serverNow: "2026-10-01T00:00:00Z", slotEndsAt: new Date(+new Date("2026-10-01T00:00:00Z") + seconds * 1000).toISOString() });

it("changes automatically at the server deadline despite a wrong browser clock", async () => {
  const get = vi.fn().mockResolvedValueOnce(result("one", 30)).mockResolvedValue(result("two", 1800));
  const changed = vi.fn();
  stop = subscribeSpotlight(changed, get);
  await vi.advanceTimersByTimeAsync(0);
  expect(changed).toHaveBeenLastCalledWith({ _id: "one" });
  await vi.advanceTimersByTimeAsync(30000);
  expect(changed).toHaveBeenLastCalledWith({ _id: "two" });
});
it("expires an old card even while the next request is hung", async () => {
  const get = vi.fn().mockResolvedValueOnce(result("one", 61)).mockImplementation(() => new Promise(() => {}));
  const changed = vi.fn();
  stop = subscribeSpotlight(changed, get);
  await vi.advanceTimersByTimeAsync(61000);
  expect(changed).toHaveBeenLastCalledWith(null);
  expect(get).toHaveBeenCalledTimes(2);
});
it("ignores an older response after a tab becomes visible and cleans up timers", async () => {
  let resolveFirst;
  const get = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; })).mockResolvedValue(result("new", 1800));
  const changed = vi.fn();
  stop = subscribeSpotlight(changed, get);
  events.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  resolveFirst(result("old", 1800));
  await vi.advanceTimersByTimeAsync(0);
  expect(changed).toHaveBeenLastCalledWith({ _id: "new" });
  stop();
  expect(vi.getTimerCount()).toBe(0);
});
it("fails closed and retries without locally inventing a selection", async () => {
  const get = vi.fn().mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue(result("recovered", 1800));
  const changed = vi.fn();
  stop = subscribeSpotlight(changed, get);
  await vi.advanceTimersByTimeAsync(0);
  expect(changed).toHaveBeenLastCalledWith(null);
  await vi.advanceTimersByTimeAsync(10000);
  expect(changed).toHaveBeenLastCalledWith({ _id: "recovered" });
});
