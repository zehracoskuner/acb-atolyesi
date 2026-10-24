// Keep every conversation at one visual reply level, including replies to replies.
export function logCommentThreads(comments) {
  const byId = new Map(comments.map(comment => [comment._id, comment]));
  const groups = new Map();
  for (const comment of comments) {
    let root = comment;
    const visited = new Set([root._id]);
    while (root.threadId || root.parentId) {
      const id = root.threadId || root.parentId;
      if (visited.has(id)) break;
      visited.add(id);
      const parent = byId.get(id);
      if (!parent) { root = { _id: id }; break; }
      root = parent;
    }
    if (!groups.has(root._id)) groups.set(root._id, []);
    groups.get(root._id).push({ comment, parent: byId.get(comment.parentId), isReply: root._id !== comment._id });
  }
  return [...groups.values()].flatMap(group => group.sort((a, b) => Number(a.isReply) - Number(b.isReply)));
}
