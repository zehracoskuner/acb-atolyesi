import { TOUR_VERSION } from "./TourSteps";
export const tourKey = (userId, tour, version = TOUR_VERSION) => `acb:tour:${encodeURIComponent(userId)}:${version}:${tour}`;
// Local fallback for the existing account persistence endpoint; never share anonymous keys.
const memory = new Map();
export function readTour(userId, tour, storage) {
  const key = tourKey(userId, tour);
  try { return (storage || globalThis.localStorage).getItem(key) || memory.get(key); } catch { return memory.get(key); }
}
export function writeTour(userId, tour, value, storage) {
  const key = tourKey(userId, tour);
  memory.set(key, value);
  try { (storage || globalThis.localStorage).setItem(key, value); } catch { /* Keep this session usable. */ }
}
export function visibleTarget(target, doc = document) {
  const matches = [...doc.querySelectorAll(`[data-tour="${target}"]`)].filter(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) !== false;
  });
  return matches.length === 1 ? matches[0] : null;
}
export function clippedRect(element) {
  const r = element.getBoundingClientRect();
  let left = Math.max(0, r.left), top = Math.max(0, r.top);
  let right = Math.min(window.innerWidth, r.right), bottom = Math.min(window.innerHeight, r.bottom);
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const bounds = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
  }
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
}
export function waitForTarget(target, { signal, timeout = 5000, reveal = false } = {}) {
  return new Promise(resolve => {
    let observer, timer, frame, done = false;
    const finish = value => {
      if (done) return;
      done = true;
      observer?.disconnect(); clearTimeout(timer); cancelAnimationFrame(frame);
      signal?.removeEventListener("abort", abort); resolve(value);
    };
    const abort = () => finish(null);
    const check = () => {
      if (done) return;
      const element = visibleTarget(target);
      if (element && reveal && !clippedRect(element)) element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      if (element && (!reveal || clippedRect(element))) finish(element);
      else frame = requestAnimationFrame(check);
    };
    if (signal?.aborted) { resolve(null); return; }
    signal?.addEventListener("abort", abort, { once: true });
    observer = new MutationObserver(() => { cancelAnimationFrame(frame); check(); });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    timer = setTimeout(() => finish(null), timeout);
    check();
  });
}
export function transitionGate() {
  let locked = true;
  return { ready: () => { locked = false; }, take: () => { if (locked) return false; locked = true; return true; } };
}
