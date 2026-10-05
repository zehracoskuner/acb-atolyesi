export async function saveBeforeBookDownload(getChapters, saveChapter) {
  const start = getChapters().map(ch => ({ id: ch._id, edit: ch._edit }));
  // Sequential saves avoid competing transactions updating the same Work.
  for (const ch of start) {
    if (!await saveChapter(ch.id)) throw new Error("Kayıt tamamlanamadı. İndirme başlatılmadı; lütfen tekrar deneyin.");
  }
  const current = getChapters();
  if (current.length !== start.length || start.some((ch, i) =>
    current[i]?._id !== ch.id || current[i]?._edit !== ch.edit || current[i]?._dirty || current[i]?._saving || current[i]?._saveError || current[i]?._conflict)) {
    throw new Error("Kayıt sırasında metin değişti veya kaydedilmemiş değişiklik var. İndirme başlatılmadı; lütfen tekrar deneyin.");
  }
}
