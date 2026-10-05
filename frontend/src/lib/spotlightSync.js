import { apiGet } from "./api";

// Independent expiry prevents a slow/failed refresh from extending an old slot.
export function subscribeSpotlight(onChange, get = apiGet) {
  let active = true;
  let request = 0;
  let timer;
  let expiry;
  async function refresh() {
    const current = ++request;
    const started = performance.now();
    clearTimeout(timer);
    try {
      const result = await get("/feed/spotlight", { timeoutMs: 10000 });
      if (!active || current !== request) return;
      const remaining = +new Date(result.slotEndsAt) - +new Date(result.serverNow) - (performance.now() - started);
      clearTimeout(expiry);
      onChange(remaining > 0 ? result.work : null);
      if (remaining > 0) expiry = setTimeout(() => onChange(null), remaining);
      timer = setTimeout(refresh, remaining > 0 ? Math.max(250, Math.min(60000, remaining)) : 10000);
    } catch {
      if (!active || current !== request) return;
      clearTimeout(expiry);
      onChange(null);
      timer = setTimeout(refresh, 10000);
    }
  }
  function onVisible() {
    if (document.visibilityState === "visible") {
      onChange(null);
      void refresh();
    }
  }
  void refresh();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    active = false;
    request++;
    clearTimeout(timer);
    clearTimeout(expiry);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
