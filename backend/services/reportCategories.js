// Shared by list filters and pending badges so the categories never overlap.
export function reportCategoryFilter(category) {
  if (category === 'copyright') return { reason: 'telif_ihlali' };
  if (category === 'inappropriate') return { reason: 'uygunsuz_icerik', targetType: { $in: ['work', 'chapter', 'cover'] } };
  if (category === 'other') return { $nor: [reportCategoryFilter('copyright'), reportCategoryFilter('inappropriate')] };
  return {};
}
