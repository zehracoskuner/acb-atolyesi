const id = value => typeof value === "string" ? value : value?._id;
export function notificationTarget(n) {
  if (n.type === "report_update" && id(n.report)) return { path: '/basvurular/' + id(n.report), action: "Başvuruyu aç" };
  if (n.type === "follow" && id(n.sender)) return { path: '/profile/' + id(n.sender), action: "Profili gör" };
  if (id(n.log)) return { path: '/profile/' + (id(n.logContext?.author) || id(n.recipient) || 'me') + '?tab=log&log=' + encodeURIComponent(id(n.log)), label: "GÜNLÜK", title: n.logContext?.preview || "Günlük girdisi", action: "Günlüğü aç" };
  if (id(n.work)) {
    if (n.type.startsWith("chapter_")) return { path: '/work/' + id(n.work) + '/chapters', label: "ESER", title: n.work.title, action: "Bölümleri yönet" };
    const chapter = id(n.chapter);
    return { path: chapter ? '/read/' + id(n.work) + '?chapter=' + chapter : '/story/' + id(n.work),
      label: chapter ? "BÖLÜM" : "ESER", title: chapter ? [n.work.title, n.chapter.title || "Bölüm"].filter(Boolean).join(' · ') : n.work.title,
      action: chapter ? "Bölümü aç" : "Eseri aç" };
  }
  return null;
}
