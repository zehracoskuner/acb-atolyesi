import Chapter from "../models/Chapter.js";

// Eski/hatalı listelerden de yalnızca eserin kendi yayındaki bölümlerini döndür.
// Birden fazla eser için tek sorgu kullanılır; kayıtlar değiştirilmez.
export async function getPublishedChapterIdsByWork(works) {
  const chapterIds = works.flatMap((work) => work.publishedChapterIds ?? []);
  const chapters = chapterIds.length ? await Chapter.find({
    _id: { $in: chapterIds },
    work: { $in: works.map((work) => work._id) },
    status: "published",
  }).select("_id work").lean() : [];
  const chapterWork = new Map(chapters.map((chapter) => [String(chapter._id), String(chapter.work)]));

  return new Map(works.map((work) => {
    const workId = String(work._id);
    const ids = [...new Set((work.publishedChapterIds ?? []).map(String))]
      .filter((id) => chapterWork.get(id) === workId);
    return [workId, ids];
  }));
}
