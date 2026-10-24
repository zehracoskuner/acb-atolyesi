import { Link } from "react-router-dom";
import "../styles/Mentions.css";

export default function MentionText({ content = "", mentions = [] }) {
  const users = new Map(mentions.map(mention => [mention.name, mention.user]));
  const parts = [];
  let cursor = 0;
  for (const match of content.matchAll(/(?:^|[^\p{L}\p{N}_@])@([A-Za-z0-9_]{3,30})(?![A-Za-z0-9_])/gu)) {
    const id = users.get(match[1]);
    if (!id) continue;
    const start = match.index + match[0].lastIndexOf("@");
    parts.push(content.slice(cursor, start));
    parts.push(<Link className="comment-mention" key={start} to={`/profile/${id}`}>@{match[1]}</Link>);
    cursor = start + match[1].length + 1;
  }
  parts.push(content.slice(cursor));
  return <>{parts}</>;
}
