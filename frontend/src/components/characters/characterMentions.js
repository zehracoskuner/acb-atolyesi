// Wrap the first mention of each unambiguous public name without changing the
// text or the canonical paragraph IDs used by comments.
export function markCharacterMentions(blocks, characters) {
  if (!characters?.length) return blocks;
  const names = new Map();
  const canonical = text => text.toLocaleLowerCase("tr");
  for (const person of characters) {
    const name = canonical(person.name);
    names.set(name, names.has(name) ? null : person);
  }
  const escaped = [...names.values()].filter(Boolean).map(({ name }) => name)
    .sort((a, b) => b.length - a.length).map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return blocks;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join("|")})(?![\\p{L}\\p{N}])`, "giu");
  const seen = new Set();
  return blocks.map(html => {
    if (!html || seen.size === escaped.length) return html;
    const template = document.createElement("template");
    template.innerHTML = html;
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    const replacements = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest("a, button, code, pre, [contenteditable]")) continue;
      const fragment = document.createDocumentFragment();
      let start = 0;
      for (const match of node.data.matchAll(pattern)) {
        const person = names.get(canonical(match[0]));
        if (!person || seen.has(person.id)) continue;
        seen.add(person.id);
        fragment.append(node.data.slice(start, match.index));
        const button = document.createElement("button");
        button.type = "button";
        button.className = "rd-character-mention";
        button.dataset.guideCharacter = person.id;
        button.setAttribute("aria-haspopup", "dialog");
        button.textContent = match[0];
        fragment.append(button);
        start = match.index + match[0].length;
      }
      if (!start) continue;
      fragment.append(node.data.slice(start));
      replacements.push([node, fragment]);
    }
    if (!replacements.length) return html;
    for (const [node, fragment] of replacements) node.replaceWith(fragment);
    return template.innerHTML;
  });
}
