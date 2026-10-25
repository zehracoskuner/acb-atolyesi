import { useEffect, useId, useRef, useState } from "react";
import { apiGet } from "../lib/api";
import "../styles/Mentions.css";

export default function MentionInput({ as: Tag = "textarea", ref, value = "", onChange, onKeyDown, onSelect, ...props }) {
  const input = useRef(null);
  const listId = useId();
  const [token, setToken] = useState(null);
  const [users, setUsers] = useState([]);
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState("");
  const enabled = !props.disabled && !props.readOnly;
  function locate(element) {
    const end = element.selectionStart ?? element.value.length;
    const match = element.value.slice(0, end).match(/(?:^|[^\p{L}\p{N}_@])@([A-Za-z0-9_]{0,30})$/u);
    setToken(match ? { start: end - match[1].length - 1, end, query: match[1] } : null);
    setUsers([]); setActive(0); setMessage("");
  }
  useEffect(() => {
    if (!enabled || !token) return;
    let current = true;
    const timer = setTimeout(() => {
      apiGet(`/search/users?q=${encodeURIComponent(token.query)}&mentions=1`).then(result => {
        if (!current) return;
        const items = (result.items || []).filter(user => /^[A-Za-z0-9_]{3,30}$/.test(user.kullaniciAdi)).slice(0, 5);
        setUsers(items); setMessage(items.length ? "" : "Kullanıcı bulunamadı.");
      }).catch(() => { if (current) setMessage("Kullanıcılar yüklenemedi. Yeniden deneyebilirsin."); });
    }, 220);
    return () => { current = false; clearTimeout(timer); };
  }, [token, enabled]);
  function choose(user) {
    if (!token || !enabled) return;
    const replacement = `@${user.kullaniciAdi} `;
    const next = value.slice(0, token.start) + replacement + value.slice(token.end);
    const names = new Set([...next.matchAll(/(?:^|[^\p{L}\p{N}_@])@([A-Za-z0-9_]{3,30})(?![A-Za-z0-9_])/gu)].map(match => match[1]));
    if (names.size > 5) { setMessage("Bu alanda en fazla 5 farklı kişi etiketleyebilirsin."); return; }
    if (props.maxLength && next.length > props.maxLength) { setMessage("Etiket için yeterli karakter kalmadı."); return; }
    onChange({ target: { value: next } });
    setToken(null); setUsers([]); setMessage("");
    const caret = token.start + replacement.length;
    setTimeout(() => { input.current?.focus(); input.current?.setSelectionRange(caret, caret); }, 0);
  }
  const open = enabled && token && (users.length > 0 || message);
  return <div className="mention-input-wrap">
    <Tag {...props} ref={element => { input.current = element; if (typeof ref === "function") ref(element); else if (ref) ref.current = element; }}
      value={value} aria-autocomplete="list" aria-controls={open ? listId : undefined}
      aria-activedescendant={open && users[active] ? `${listId}-${active}` : undefined}
      onChange={event => { onChange(event); locate(event.target); }}
      onSelect={event => { locate(event.target); onSelect?.(event); }}
      onBlur={event => { if (!event.currentTarget.parentElement.contains(event.relatedTarget)) setToken(null); props.onBlur?.(event); }}
      onKeyDown={event => {
        if (open && event.key === "Escape") { event.preventDefault(); setToken(null); return; }
        if (open && users.length && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
          event.preventDefault();
          if (event.key === "Enter") choose(users[active]);
          else setActive(index => (index + (event.key === "ArrowDown" ? 1 : -1) + users.length) % users.length);
          return;
        }
        onKeyDown?.(event);
      }} />
    {open && <div className="mention-suggestions">
      <div id={listId} role="listbox" aria-label="Etiketlenecek kişi">
        {users.map((user, index) => <button type="button" role="option" aria-selected={index === active} id={`${listId}-${index}`} key={user._id}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(user)}>@{user.kullaniciAdi}</button>)}
      </div>
      {message && <p role="status">{message}</p>}
    </div>}
  </div>;
}
