// Uses the existing profile API, including older servers without a detail route.
export async function loadLogTarget(fetchPage, targetId, isActive = () => true) {
  const items = new Map();
  let page = 0, hasMore = true;
  while (hasMore && isActive()) {
    const result = await fetchPage(++page);
    if (!isActive()) return null;
    for (const item of result.items || []) items.set(String(item._id), item);
    hasMore = Boolean(result.hasMore) && Boolean(result.items?.length);
    if (!targetId || items.has(String(targetId))) break;
  }
  return { items: [...items.values()], page, hasMore, found: !targetId || items.has(String(targetId)) };
}
