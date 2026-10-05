import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

export function BookCover({ work }) {
  const [failed, setFailed] = useState(null);
  return <span className="atelier-book-cover">
    {work.coverImage && failed !== work.coverImage
      ? <img src={work.coverImage} alt="" loading="lazy" onError={() => setFailed(work.coverImage)} />
      : <span className="atelier-book-fallback"><BookOpen size={16} aria-hidden="true" /><span>{work.title}</span></span>}
  </span>;
}

export default function WriterShelf({ shelf, author }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const toggle = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const dismiss = event => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const escape = event => {
      if (event.key !== "Escape") return;
      if (root.current?.contains(document.activeElement)) toggle.current?.focus();
      setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const works = shelf?.works?.slice(0, 3) || [];
  if (!works.length) return null;
  const name = author?.kullaniciAdi || "Yazar";
  return <aside ref={root} className={`writer-shelf${open ? " is-open" : ""}`} aria-label={`${name}: yazarın rafı`}
    onPointerEnter={event => { if (event.pointerType === "mouse") setOpen(true); }}
    onPointerLeave={event => { if (event.pointerType === "mouse" && !event.currentTarget.contains(document.activeElement)) setOpen(false); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={toggle} type="button" className="writer-shelf-toggle" aria-label={`${name}: yazarın rafı`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <BookOpen size={15} strokeWidth={1.5} aria-hidden="true" />
    </button>
    <div id={id} className="writer-shelf-popover" hidden={!open}>
      <div className="writer-shelf-heading"><span>Yazarın rafı</span><strong>{name}</strong></div>
      <div className="writer-shelf-books">
      {works.map(work => <Link key={work._id} to={`/story/${work._id}`} className="writer-shelf-book" aria-label={`${work.title}: eseri incele`}>
        <BookCover work={work} /><span className="writer-shelf-title">{work.title}</span>
      </Link>)}
      </div>
    {shelf.total > 3 && author?._id && <Link className="writer-shelf-more" to={`/profile/${author._id}`} aria-label={`${name}: diğer ${shelf.total - 3} eseri gör`}>+{shelf.total - 3} <span>eser daha</span></Link>}
    </div>
  </aside>;
}
