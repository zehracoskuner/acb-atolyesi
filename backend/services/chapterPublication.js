// Only owner/editor/export paths opt into the private draft field.
export function ownerChapter(chapter) {
  const item = chapter.toObject ? chapter.toObject() : { ...chapter };
  if (item.draftContent) {
    item.title = item.draftContent.title;
    item.content = item.draftContent.content;
  }
  delete item.draftContent;
  return item;
}

export function applyChapterDraft(chapter) {
  if (chapter.draftContent) {
    chapter.title = chapter.draftContent.title;
    chapter.content = chapter.draftContent.content;
    chapter.draftContent = undefined;
  }
  chapter.hasUnpublishedChanges = false;
}
