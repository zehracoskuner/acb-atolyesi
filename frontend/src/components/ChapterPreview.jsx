import DOMPurify from "dompurify";
import ChapterMedia from "./ChapterMedia";

export default function ChapterPreview({ title, content, media }) {
  return <section className="chapter-preview"><h3>{title}</h3><div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content || "") }} /><ChapterMedia media={media} /></section>;
}
