// One request per button, explicit desired state, and authoritative receipts.
// The controller is independent of React so races can be exercised directly.
export function createLikeState({ liked = false, count = 0, send, load }) {
  let state = { liked, likeCount: Math.max(0, count), busy: false, error: "" };
  let generation = 0;
  let active = true;
  let touched = false;
  let writing = false;
  const listeners = new Set();
  const publish = next => { state = { ...state, ...next }; listeners.forEach(fn => fn()); };
  function receipt(result) {
    const liked = result.liked ?? result.likedByMe;
    if (typeof liked !== "boolean" || !Number.isSafeInteger(result.likeCount) || result.likeCount < 0)
      throw new Error("Geçersiz beğeni yanıtı.");
    return { liked, likeCount: result.likeCount };
  }
  return {
    getSnapshot: () => state,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    activate() { active = true; },
    dispose() { active = false; generation++; },
    syncInitial(liked, count) {
      if (!touched && !load && !state.busy) publish({ liked, likeCount: Math.max(0, count) });
    },
    async refresh(loader = load) {
      if (!loader || writing) return;
      const version = ++generation;
      publish({ busy: true, error: "" });
      try {
        const result = receipt(await loader());
        if (active && version === generation) { touched = true; publish(result); }
      } catch {
        if (active && version === generation) publish({ error: "Beğeni durumu yüklenemedi. Yeniden deneyebilirsin." });
      } finally {
        if (active && version === generation) publish({ busy: false });
      }
    },
    async toggle() {
      if (!active || state.busy) return;
      writing = true;
      touched = true;
      const version = ++generation;
      const before = state;
      const next = !before.liked;
      publish({ liked: next, likeCount: Math.max(0, before.likeCount + (next ? 1 : -1)), busy: true, error: "" });
      try {
        const result = receipt(await send(next));
        if (active && version === generation) publish(result);
      } catch {
        if (active && version === generation) publish({ ...before, error: "Beğeni kaydedilemedi. Yeniden deneyebilirsin." });
      } finally {
        writing = false;
        if (active && version === generation) publish({ busy: false });
      }
    },
  };
}

// Duplicate cards for the same item/account share state and their request lock.
const stores = new Map();
export function getLikeState(key, options) {
  if (!stores.has(key)) stores.set(key, { controller: createLikeState(options), owners: 0 });
  return stores.get(key).controller;
}
export function retainLikeState(key, controller) {
  const entry = stores.get(key);
  if (!entry || entry.controller !== controller) return () => {};
  entry.owners++;
  controller.activate();
  return () => {
    entry.owners--;
    // React StrictMode reattaches effects before this microtask runs.
    queueMicrotask(() => {
      if (entry.owners === 0 && stores.get(key) === entry) {
        controller.dispose();
        stores.delete(key);
      }
    });
  };
}
