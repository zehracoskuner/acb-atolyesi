import { useEffect, useId, useRef, useState } from "react";
import { useMembership } from "../../lib/membershipContext";
import { apiPost } from "../../lib/api";
import { Avatar } from "./FeedCards";
import MentionInput from "../MentionInput";
import "../../styles/FeedComposer.css";

// POST /logs and the Log model enforce this existing limit.
const MAX_CHARS = 800;

export default function FeedComposer({ onPost }) {
  const { status, user, requireMember } = useMembership();
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const postingRef = useRef(false);
  const composerRef = useRef(null);
  const textareaRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const formId = useId();
  const helpId = formId + "-help";
  const isMember = status === "authenticated";
  const editorOpen = expanded && isMember;
  const displayName = user?.kullaniciAdi || user?.username || "Senin paylaşımın";
  const canPost = content.trim().length > 0 && content.length <= MAX_CHARS;

  useEffect(() => {
    if (editorOpen && !posting) textareaRef.current?.focus();
    else if (restoreFocusRef.current) {
      composerRef.current?.focus();
      restoreFocusRef.current = false;
    }
  }, [editorOpen, posting]);

  useEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(240, Math.max(editorOpen ? 104 : 52, field.scrollHeight))}px`;
  }, [content, editorOpen]);

  function openComposer() {
    if (postingRef.current) return;
    if (!isMember) { requireMember(); return; }
    if (expanded) return;
    setExpanded(true);
    setError("");
    setNotice("");
  }

  function cancel() {
    if (postingRef.current) return;
    restoreFocusRef.current = true;
    setContent("");
    setError("");
    setNotice("");
    setExpanded(false);
  }

  async function share(event) {
    event.preventDefault();
    if (postingRef.current || !canPost) return;
    if (!isMember) { requireMember(); return; }
    postingRef.current = true;
    setPosting(true);
    setError("");
    let item;
    try {
      const response = await apiPost("/logs", { content: content.trim(), visibility: "public" });
      item = response.item;
    } catch (err) {
      setError(err.message || "Paylaşım gönderilemedi. Lütfen yeniden dene.");
      return;
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
    restoreFocusRef.current = true;
    setContent("");
    setExpanded(false);
    setNotice("Paylaşımın kaydedildi.");
    onPost?.(item);
  }

  return <div ref={composerRef} tabIndex={-1} role="group" aria-label="Paylaşım alanı"
    className={`feed-composer${editorOpen ? " is-expanded" : ""}`} aria-busy={posting}>
    <form id={formId} onSubmit={share} className="feed-composer-form">
      <div className="feed-composer-header">
        <Avatar user={user} size={40} />
        <MentionInput ref={textareaRef} value={content}
          onFocus={openComposer}
          onChange={event => { if (isMember && !postingRef.current) setContent(event.target.value); }}
          rows={editorOpen ? 4 : 2} maxLength={MAX_CHARS}
          readOnly={!isMember} disabled={posting || (status !== "authenticated" && status !== "guest")}
          aria-label="Paylaşım metni" aria-describedby={editorOpen ? helpId : undefined}
          placeholder="Bugün ne paylaşmak istersin?" />
      </div>
      {editorOpen && <div className="feed-composer-footer">
        <span className="feed-composer-audience">{displayName} · Herkese açık</span>
        <div className="feed-composer-actions">
          <span className="feed-composer-count" id={helpId} data-near-limit={content.length >= MAX_CHARS - 40}
            aria-label={`${MAX_CHARS - content.length} karakter kaldı`}>
            {MAX_CHARS - content.length}
          </span>
          <button type="button" className="feed-composer-cancel" onClick={cancel} disabled={posting}>Vazgeç</button>
          <button type="submit" className="feed-composer-submit" disabled={!canPost || posting}>
            {posting ? "Paylaşılıyor…" : "Paylaş"}
          </button>
        </div>
      </div>}
      {error && <p className="feed-composer-error" role="alert">{error}</p>}
    </form>
    {notice && <p className="feed-composer-notice" role="status">{notice}</p>}
  </div>;
}
