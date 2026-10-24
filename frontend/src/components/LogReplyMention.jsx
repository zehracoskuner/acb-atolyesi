import { Link } from "react-router-dom";

export default function LogReplyMention({ comment, parent }) {
  if (!comment.parentId) return null;
  const author = comment.replyToAuthor || parent?.author;
  return author?._id
    ? <><Link className="log-reply-mention" to={`/profile/${author._id}`}>@{author.kullaniciAdi || "Yazar"}</Link>{" "}</>
    : <span className="log-reply-missing">Silinen yoruma yanıt · </span>;
}
