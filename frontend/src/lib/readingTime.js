import { cleanHtml } from "./sanitize";

const WORDS_PER_MINUTE = 200;

export function visibleWordCount(html = "") {
  const node = document.createElement("div");
  node.innerHTML = cleanHtml(html);
  node.querySelectorAll("br").forEach(element => element.replaceWith(document.createTextNode(" ")));
  // Block boundaries separate words; inline formatting must not split them.
  node.querySelectorAll("p, div, li, h1, h2, h3, blockquote, ul, ol").forEach(element => {
    element.prepend(" ");
    element.append(" ");
  });
  return (node.textContent || "").trim().split(/\s+/).filter(Boolean).length;
}

export function readTime(wordCount) {
  const minutes = Math.ceil(wordCount / WORDS_PER_MINUTE);
  return minutes < 1 ? "<1 dk" : `${minutes} dk`;
}

export function readingTime(html = "") {
  return readTime(visibleWordCount(html));
}
