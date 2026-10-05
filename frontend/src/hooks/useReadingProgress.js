import { useEffect } from "react";
import { trackReadingProgress } from "../services/readingProgressService";
export { clearProgressForStory } from "../services/readingProgressService";

export function useReadingProgress(storyId, chapter, scrollRef, currentUser) {
  useEffect(() => {
    const element = scrollRef?.current;
    if (!storyId || !chapter?._id || !element) return;
    let timer;
    let last = null;
    let position = null;
    const capture = () => {
      const total = element.scrollHeight - element.clientHeight;
      position = total > 0 ? Math.min(100, Math.max(0, Math.round(element.scrollTop / total * 100))) : 100;
    };
    const save = () => {
      if (position === null || position === last) return;
      last = position;
      void trackReadingProgress(storyId, chapter._id, chapter.order ?? chapter.chapterNumber, chapter.title, position, currentUser);
    };
    const scroll = () => { capture(); clearTimeout(timer); timer = setTimeout(save, 500); };
    const flush = () => { clearTimeout(timer); save(); };
    const visibility = () => { if (document.visibilityState === "hidden") flush(); };
    // Wait for restoration/layout; capture the chapter even if the reader never scrolls.
    timer = setTimeout(() => { capture(); save(); }, 500);
    element.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      flush();
      element.removeEventListener("scroll", scroll);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [storyId, chapter?._id, chapter?.order, chapter?.chapterNumber, chapter?.title, currentUser, scrollRef]);
}
