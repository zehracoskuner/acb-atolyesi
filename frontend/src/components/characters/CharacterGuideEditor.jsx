import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, X } from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, apiPut } from "../../lib/api";
import { UniverseDialog } from "./CharacterDialogs";
import { CharacterGuideCards, GuideLinkButton } from "./CharacterGuideCards";
import { ChaptersSelect, RelationshipMilestones } from "./RelationshipMilestones";
import { relationName } from "./graph";

const assetPattern = /^\/api\/characters\/[a-f\d]{24}\/portrait\/([a-f\d]{24})$/i;
const emptyEdge = id => ({ relationshipId: id, shared: false, label: "", milestones: [] });

function Toggle({ children, checked, onChange, disabled }) {
  return <label className="cg-toggle"><input type="checkbox" checked={Boolean(checked)} disabled={disabled}
    onChange={event => onChange(event.target.checked)} /> {children}</label>;
}

function CardSettings({ character, row, chapters, update }) {
  const availablePortrait = assetPattern.exec(character.imageUrl || "")?.[1];
  const addCard = checked => update(checked ? { characterId: character.id, name: character.name, summary: "" } : null);
  const change = (key, value) => update({ ...row, [key]: value });
  return <>
    <Toggle checked={row} onChange={addCard}>Karakteri rehbere ekle</Toggle>
    {row && <>
      <label>Okura görünen ad<input required maxLength={120} value={row.name} onChange={event => change("name", event.target.value)} /></label>
      <ChaptersSelect chapters={chapters} value={row.afterChapterId} onChange={value => change("afterChapterId", value)} label="Kart ne zaman açılsın?" />
      <label>Okura özel tanıtım<textarea rows={4} maxLength={1500} value={row.summary} onChange={event => change("summary", event.target.value)} /></label>
      {row.summary.trim() && <ChaptersSelect chapters={chapters} value={row.summaryAfterChapterId}
        onChange={value => change("summaryAfterChapterId", value)} label="Tanıtım ne zaman açılsın?" />}
      {availablePortrait ? <Toggle checked={row.portraitAssetId === availablePortrait} onChange={checked => change("portraitAssetId", checked ? availablePortrait : null)}>
        Bu portreyi okurla paylaş
      </Toggle> : <p className="cg-muted">Paylaşmak için karakter kartına bir portre yükle.</p>}
      {availablePortrait && row.portraitAssetId === availablePortrait && <ChaptersSelect chapters={chapters} value={row.portraitAfterChapterId}
        onChange={value => change("portraitAfterChapterId", value)} label="Portre ne zaman açılsın?" />}
    </>}
  </>;
}

function EdgeSettings({ row, chapters, workId, label, update }) {
  const change = (key, value) => update({ ...row, [key]: value });
  return <>
    <Toggle checked={row.shared} onChange={checked => update({ ...row, shared: checked, label: row.label || label })}>Bu bağı okurla paylaş</Toggle>
    {row.shared && <>
      <p className="cg-muted">Bağ, iki karakterin kartı da görünür olduğunda açılır.</p>
      <label>Okura görünen bağ adı<input required maxLength={120} value={row.label} onChange={event => change("label", event.target.value)} /></label>
      <ChaptersSelect chapters={chapters} value={row.afterChapterId} onChange={value => change("afterChapterId", value)} label="Bağ ne zaman açılsın?" />
    </>}
    <RelationshipMilestones notes={row.milestones} chapters={chapters} workId={workId}
      onChange={value => change("milestones", value)} sharing />
  </>;
}

export default function CharacterGuideEditor({ workId, characters, relationships, names, types, initialEdgeId, onClose }) {
  const path = `/works/${workId}/character-guide`;
  const publicPath = `/story/${workId}/character-guide`;
  const [source, setSource] = useState(null);
  const [guide, setGuide] = useState(null);
  const [tab, setTab] = useState(initialEdgeId ? "edges" : "cards");
  const [characterId, setCharacterId] = useState(characters[0]?.id || "");
  const [edgeId, setEdgeId] = useState(initialEdgeId || relationships[0]?.id || "");
  const [previewAfterChapterId, setPreviewChapter] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewCharacter, setPreviewCharacter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const character = characters.find(item => item.id === characterId);
  const edge = relationships.find(item => item.id === edgeId);
  const selectedEdge = guide?.relationships.find(row => row.relationshipId === edgeId) || emptyEdge(edgeId);
  const selectedCard = guide?.characters.find(row => row.characterId === characterId);

  useEffect(() => {
    let active = true;
    apiGet(path).then(data => {
      if (!active) return;
      setSource(data);
      setGuide(data.guide);
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [path, retry]);

  function update() {
    setPreview(null);
    setNotice("");
    setError("");
  }
  function replace(list, field, id, value) {
    update();
    setGuide(current => {
      const next = current[list].filter(row => row[field] !== id);
      return { ...current, [list]: value ? [...next, value] : next };
    });
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiPut(path, guide);
      setGuide(result.guide);
      setSource(previous => ({ ...previous, guide: result.guide }));
      setNotice(result.guide.enabled ? "Rehber yayında." : "Rehber taslağı kaydedildi.");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function showPreview(event) {
    event.preventDefault();
    setBusy(true);
    setPreview(null);
    setError("");
    try {
      const { item } = await apiPost(path + "/preview", { ...guide, previewAfterChapterId });
      setPreview(item);
      setPreviewCharacter("");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  function close() {
    if (guide !== source?.guide && guide && !window.confirm("Kaydedilmemiş rehber değişiklikleri silinsin mi?")) return;
    onClose();
  }

  return <UniverseDialog label="Karakter Rehberi ayarları" className="cg-dialog cg-dialog--editor" busy={busy} onClose={close}>
    <header className="cg-head">
      <div><BookOpen size={17} aria-hidden="true" /><h2>Karakter Rehberi</h2></div>
      <button type="button" className="cg-button" disabled={busy} onClick={close} aria-label="Rehber ayarlarını kapat"><X size={19} /></button>
    </header>
    <div className="cg-dialog-content">
      {!source ? <div>
        {error ? <><p role="alert">{error}</p><button className="cg-button" onClick={() => { setError(""); setRetry(value => value + 1); }}>Tekrar dene</button></>
          : <p role="status">Rehber yükleniyor…</p>}
      </div> : <>
        <div className="cg-publish">
          <Toggle checked={guide.enabled} disabled={busy} onChange={enabled => { update(); setGuide(current => ({ ...current, enabled })); }}>Rehberi okurlara aç</Toggle>
          <p className="cg-muted">{source.published ? "Seçtiğin bilgiler kitap sayfasından ve paylaşım bağlantısından açılır." : "Kitap yayımlanana kadar rehberi taslak olarak kaydedebilirsin."}</p>
          {source.guide.enabled && source.published && <div className="cg-actions">
            <GuideLinkButton path={publicPath} /><Link className="cg-text-link" to={publicPath} target="_blank" rel="noopener">Yayındaki rehberi aç <ArrowUpRight size={15} /></Link>
          </div>}
        </div>
        <div className="cg-tabs" aria-label="Rehber ayarları">
          {[["cards", "Karakterler"], ["edges", "Bağlar"], ["preview", "Okur olarak önizle"]].map(([id, label]) =>
            <button className="cg-button" type="button" key={id} aria-pressed={tab === id} disabled={busy} onClick={() => { setTab(id); setError(""); }}>{label}</button>)}
        </div>
        {tab === "preview" ? <>
          <form className="cg-form" onSubmit={showPreview}>
            <fieldset disabled={busy}>
              <ChaptersSelect chapters={source.chapters.filter(chapter => chapter.published)} value={previewAfterChapterId}
                onChange={id => { setPreviewChapter(id); setPreview(null); }} label="Okur hangi bölümü bitirdi?" />
              <button className="cg-button cg-primary" type="submit">Önizle</button>
            </fieldset>
          </form>
          {preview && <div className="cg-preview"><CharacterGuideCards item={preview} selected={previewCharacter}
            onSelect={setPreviewCharacter} workId={workId} preview /></div>}
        </> : <form className="cg-form" onSubmit={save}>
          <fieldset disabled={busy}>
            {tab === "cards" ? <>
              <label>Karakter<select value={characterId} onChange={event => setCharacterId(event.target.value)}>
                {!characters.length && <option value="">Haritada karakter yok</option>}
                {characters.map(person => <option value={person.id} key={person.id}>{person.name}</option>)}
              </select></label>
              {character && <CardSettings character={character} row={selectedCard} chapters={source.chapters}
                update={value => replace("characters", "characterId", characterId, value)} />}
            </> : <>
              <label>Bağ<select value={edgeId} onChange={event => setEdgeId(event.target.value)}>
                {!relationships.length && <option value="">Haritada bağ yok</option>}
                {relationships.map(item => <option value={item.id} key={item.id}>
                  {names.get(item.from)} {item.directed ? "→" : "↔"} {names.get(item.to)} · {relationName(item.type, types)}
                </option>)}
              </select></label>
              {edge && <EdgeSettings row={selectedEdge} chapters={source.chapters} workId={workId} label={relationName(edge.type, types)}
                update={value => replace("relationships", "relationshipId", edgeId, value)} />}
            </>}
            <button className="cg-button cg-primary" type="submit" disabled={guide.enabled && !source.published}>
              {busy ? "Kaydediliyor…" : guide.enabled ? source.guide.enabled ? "Rehberi güncelle" : "Rehberi yayımla"
                : source.guide.enabled ? "Rehberi yayından kaldır" : "Taslağı kaydet"}
            </button>
          </fieldset>
        </form>}
        {error && <p className="cg-error" role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
      </>}
    </div>
  </UniverseDialog>;
}
