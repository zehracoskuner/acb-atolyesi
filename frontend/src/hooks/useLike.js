import { useEffect, useMemo, useSyncExternalStore } from "react";
import { apiGet, apiPost } from "../lib/api";
import { useSession } from "../lib/session";
import { getLikeState, retainLikeState } from "../lib/likeState";

export function useLike({ path, body, checkPath, initialLiked = false, initialCount = 0 }) {
  const { user, status } = useSession();
  const userKey = user?.id || user?._id || status;
  const key = JSON.stringify([path, body?.workId || null, userKey]);
  // Each resource/account owns its own controller; late responses cannot reach
  // a different chapter or the next user's buttons.
  const controller = useMemo(() => getLikeState(key, {
    liked: status === "guest" ? false : initialLiked,
    count: initialCount,
    send: liked => apiPost(path, { ...body, liked }),
  // Initial list data is synchronized below, without recreating pending requests.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [key]);
  useEffect(() => {
    const release = retainLikeState(key, controller);
    if (checkPath) controller.refresh(() => apiGet(checkPath));
    return release;
  }, [controller, key, checkPath]);
  useEffect(() => {
    controller.syncInitial(status === "guest" ? false : initialLiked, initialCount);
  }, [controller, initialLiked, initialCount, status]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return { ...state, toggle: controller.toggle, refresh: () => controller.refresh(checkPath ? () => apiGet(checkPath) : undefined) };
}
