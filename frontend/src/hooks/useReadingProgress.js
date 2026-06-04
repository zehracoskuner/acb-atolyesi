import { useEffect, useRef, useCallback } from "react";
import { trackReadingProgress } from "../services/readingProgressService";
import { apiDelete } from "../lib/api";

export function useReadingProgress(storyId, chapter, scrollRef, currentUser) {
  const saveTimerRef       = useRef(null);
  const lastSavedScrollRef = useRef(-1);

  const getScrollPercent = useCallback(() => {
    const el = scrollRef?.current;
    if (!el) return 0;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const total = scrollHeight - clientHeight;
    return total > 0 ? Math.round((scrollTop / total) * 100) : 0;
  }, [scrollRef]);

  const saveProgress = useCallback((scrollPercent) => {
    if (!storyId || !chapter?._id) return;
    if (Math.abs(scrollPercent - lastSavedScrollRef.current) < 3) return;
    lastSavedScrollRef.current = scrollPercent;
    console.log("KAYIT:", { storyId, chapterId: chapter._id, scrollPercent });
    trackReadingProgress(
      storyId, chapter._id, chapter.chapterNumber,
      chapter.title, scrollPercent, currentUser
    );
  }, [storyId, chapter, currentUser]);

  useEffect(() => {
    lastSavedScrollRef.current = -1;
  }, [chapter?._id]);

  // ref hazır olana kadar polling yap
  useEffect(() => {
    if (!storyId || !chapter?._id) return;

    let el = scrollRef?.current;
    let cleanup = null;

    function attach(element) {
      const handleScroll = () => {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          saveProgress(getScrollPercent());
        }, 1500);
      };
      const handleBeforeUnload = () => saveProgress(getScrollPercent());

      element.addEventListener("scroll", handleScroll, { passive: true });
      window.addEventListener("beforeunload", handleBeforeUnload);

      cleanup = () => {
        clearTimeout(saveTimerRef.current);
        element.removeEventListener("scroll", handleScroll);
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }

    if (el) {
      attach(el);
    } else {
      // ref henüz bağlı değil — her 100ms'de bir kontrol et
      const interval = setInterval(() => {
        el = scrollRef?.current;
        if (el) {
          clearInterval(interval);
          attach(el);
        }
      }, 100);
      cleanup = () => clearInterval(interval);
    }

    return () => cleanup?.();
  }, [storyId, chapter?._id, saveProgress, getScrollPercent, scrollRef]);
}
export async function clearProgressForStory(workId, user) {
  if (user?.id || user?._id) {
    await apiDelete(`/reading-progress/${workId}`);
  }
}