// Only reader-facing metadata. Studio notes and world-building stay private.
export const PUBLIC_WORK_FIELDS = "_id contentWarning title description preface coverImage isAnonymous user status universe.genres universe.genre publishedChapterIds customChapterTitles likeCount createdAt updatedAt";

export function serializeWorkAuthor(work) {
  if (work.isAnonymous || !work.user) return null;
  return {
    _id: work.user._id,
    username: work.user.kullaniciAdi ?? work.user.username ?? "Yazar",
    kullaniciAdi: work.user.kullaniciAdi ?? work.user.username ?? "Yazar",
    avatarUrl: work.user.avatarUrl ?? null,
  };
}

export function serializePublicWork(work, publishedIds = []) {
  const titles = work.customChapterTitles instanceof Map
    ? Object.fromEntries(work.customChapterTitles) : work.customChapterTitles ?? {};
  const author = serializeWorkAuthor(work);
  return {
    _id: work._id, id: work._id, title: work.title,
    requiresMatureAcknowledgement: !!work.contentWarning,
    description: work.description ?? "", preface: work.preface ?? "",
    coverImage: work.coverImage ?? null, isAnonymous: work.isAnonymous ?? false,
    author, status: "published", likeCount: work.likeCount ?? 0,
    universe: { genres: work.universe?.genres ?? [], genre: work.universe?.genre ?? "" },
    genres: work.universe?.genres ?? [], genre: work.universe?.genre ?? "",
    publishedChapterIds: publishedIds, chapterCount: publishedIds.length,
    customChapterTitles: Object.fromEntries(publishedIds
      .filter(id => Object.hasOwn(titles, String(id))).map(id => [String(id), titles[String(id)]])),
    createdAt: work.createdAt, updatedAt: work.updatedAt,
  };
}

export function serializePublicWorkCard(work, publishedIds = []) {
  const item = serializePublicWork(work, publishedIds);
  return {
    _id: item._id, id: item.id, title: item.title, description: item.description,
    coverImage: item.coverImage, isAnonymous: item.isAnonymous, author: item.author,
    status: item.status, universe: item.universe, genres: item.genres, genre: item.genre,
    chapterCount: item.chapterCount, likeCount: item.likeCount,
    createdAt: item.createdAt, updatedAt: item.updatedAt,
  };
}
