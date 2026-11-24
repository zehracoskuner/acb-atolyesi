import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, BookOpen, Link2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { UniverseDialog } from "./CharacterDialogs";
import Portrait from "./Portrait";
import "../../styles/CharacterGuide.css";

const focusTitle = element => element?.focus({ preventScroll: true });

export function GuideLinkButton({ path, label = "Bağlantıyı kopyala" }) {
  const [notice, setNotice] = useState("");
  const [showLink, setShowLink] = useState(false);
  const url = new URL(path, window.location.origin).href;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Bağlantı kopyalandı.");
      setShowLink(false);
    } catch {
      setNotice("Bağlantıyı seçip kopyalayabilirsin.");
      setShowLink(true);
    }
  }
  return <span className="cg-copy">
    <button className="cg-button" type="button" onClick={copy}><Link2 size={15} aria-hidden="true" /> {label}</button>
    {showLink && <input readOnly aria-label="Paylaşım bağlantısı" value={url} onFocus={event => event.target.select()} />}
    {notice && <small role="status">{notice}</small>}
  </span>;
}

export function CharacterGuideCards({ item, selected, onSelect, workId, preview = false }) {
  if (!item.characters.length) return <p className="cg-muted">Bu noktada açık bir karakter kartı yok.</p>;
  const byId = new Map(item.characters.map(character => [character.id, character]));
  const character = selected && byId.get(selected);
  if (!character) return <>
    {selected && <p className="cg-muted">Bu karakter henüz görünür değil.</p>}
    <ul className="cg-roster">
      {item.characters.map(person => <li key={person.id}>
        <button type="button" onClick={() => onSelect(person.id)}>
          <Portrait className="cg-avatar" character={person} lazy />
          <span>{person.name}</span>
        </button>
      </li>)}
    </ul>
  </>;

  const relationships = item.relationships.filter(edge => edge.from === selected || edge.to === selected);
  return <>
    <button className="cg-button" type="button" onClick={() => onSelect("")}>← Tüm karakterler</button>
    <article className="cg-profile">
      <Portrait className="cg-profile-portrait" character={character} />
      <div className="cg-profile-body">
        <h2 key={selected} tabIndex={-1} ref={focusTitle}>{character.name}</h2>
        {character.summary && <p className="cg-summary">{character.summary}</p>}
        {!preview && <GuideLinkButton key={selected} path={`/story/${workId}/character-guide?character=${selected}`} label="Karakter kartını paylaş" />}
        {relationships.length > 0 && <>
          <h3>İlişkiler</h3>
          <ul className="cg-edges">
            {relationships.map(edge => {
              const other = byId.get(edge.from === selected ? edge.to : edge.from);
              const Arrow = edge.from === selected ? ArrowUpRight : ArrowDownLeft;
              return <li key={edge.id}>
                <button className="cg-related" type="button" onClick={() => onSelect(other.id)}>
                  <Portrait className="cg-avatar" character={other} lazy />
                  <span><strong>{other.name}</strong><small>{edge.label}</small></span>
                  {edge.directed && <Arrow size={16} aria-label={edge.from === selected ? "Giden bağ" : "Gelen bağ"} />}
                </button>
                {edge.milestones.length > 0 && <ol className="cg-timeline">{edge.milestones.map(({ id, text, chapter }) => <li key={id}>
                  <small>{chapter.order}. bölüm · {chapter.title}</small><p>{text}</p>
                </li>)}</ol>}
              </li>;
            })}
          </ul>
        </>}
      </div>
    </article>
  </>;
}

export function ReaderCharacterGuide({ item, selected, onSelect, onClose, workId, theme, pending }) {
  return <UniverseDialog label="Karakter Rehberi" className={`cg-dialog cg-dialog--${theme || "light"}`} onClose={onClose}>
    <header className="cg-head">
      <div><BookOpen size={17} aria-hidden="true" /><h2>Karakter Rehberi</h2></div>
      <button type="button" className="cg-button" onClick={onClose} aria-label="Karakter Rehberini kapat"><X size={19} /></button>
    </header>
    <div className="cg-dialog-content">
      {item ? <CharacterGuideCards item={item} selected={selected} onSelect={onSelect} workId={workId} />
        : <p role="status">{pending ? "Rehber yükleniyor…" : "Karakter Rehberi şu anda açılamıyor."}</p>}
      {item && <Link className="cg-text-link" to={`/story/${workId}/character-guide`}>Rehberi ayrı sayfada aç</Link>}
    </div>
  </UniverseDialog>;
}
