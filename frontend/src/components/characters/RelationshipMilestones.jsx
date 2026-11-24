import { ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

export function ChaptersSelect({ chapters, value, label, onChange, required }) {
  return <label>{label}
    <select value={value || ""} onChange={event => onChange(event.target.value)} required={required}>
      <option value="">{required ? "Bölüm seç" : "Başlangıçtan itibaren"}</option>
      {value && !chapters.some(chapter => chapter.id === value) &&
        <option value={value} disabled>Silinen bölüm · okura kapalı</option>}
      {chapters.map(chapter => <option key={chapter.id} value={chapter.id}>
        {chapter.order}. {chapter.title}{chapter.published ? "" : " (yayında değil)"}
      </option>)}
    </select>
  </label>;
}

export function RelationshipMilestones({ notes, chapters, workId, onChange, sharing = false }) {
  const ordered = new Map(chapters.map((chapter, index) => [chapter.id, index]));
  const milestones = [...notes].sort((a, b) => (ordered.get(a.chapterId) ?? Infinity) - (ordered.get(b.chapterId) ?? Infinity));
  const edit = (id, changes) => onChange(notes.map(note => note._id === id ? {
    ...note, ...changes, ...(!sharing && { shared: false }),
  } : note));
  function add() {
    const random = crypto.getRandomValues(new Uint8Array(12));
    const _id = Array.from(random, value => value.toString(16).padStart(2, "0")).join("");
    onChange([...notes, { _id, text: "", chapterId: chapters[0].id, shared: false }]);
  }
  return <>
    <h3 className="cg-section-title">Dönüm noktaları</h3>
    {!chapters.length && <p className="cg-muted">Bir dönüm noktası eklemek için önce bir bölüm oluştur.</p>}
    {milestones.map(note => <div className="cg-note" key={note._id}>
      <ChaptersSelect chapters={chapters} value={note.chapterId} required
        onChange={chapterId => edit(note._id, { chapterId })} label="Olayın bölümü" />
      <label>Dönüm noktası<textarea required rows={3} maxLength={1000} value={note.text}
        onChange={event => edit(note._id, { text: event.target.value })} /></label>
      {sharing ? <label className="cg-toggle"><input type="checkbox" checked={Boolean(note.shared)}
        onChange={event => edit(note._id, { shared: event.target.checked })} /> Okura bu bölüm bittikten sonra göster</label>
        : note.shared && <p className="cg-muted">Okur rehberi için seçildi. Düzenlersen yeniden paylaşım seçmen gerekir.</p>}
      <div className="cg-actions">
        {ordered.has(note.chapterId) && <Link className="cg-text-link" to={`/work/${workId}/chapters?chapter=${note.chapterId}`}
          target="_blank" rel="noopener">Bölümü aç <ArrowUpRight size={15} /></Link>}
        <button type="button" className="cg-button" onClick={() => onChange(notes.filter(item => item._id !== note._id))}>
          <Trash2 size={15} aria-hidden="true" /> Notu kaldır
        </button>
      </div>
    </div>)}
    <button className="cg-button" type="button" onClick={add} disabled={!chapters.length || notes.length >= 60}>
      <Plus size={16} aria-hidden="true" /> Dönüm noktası ekle
    </button>
  </>;
}
