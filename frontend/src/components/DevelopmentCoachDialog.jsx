import { useEffect, useRef } from "react";
import "../styles/DevelopmentCoach.css";

function Traits({ title, items }) {
  if (!items?.length) return null;
  return <section className="development-section"><h3>{title}</h3><ul>{items.map((item, index) =>
    <li key={index}><strong>{item.trait}</strong><p>{item.evidence}</p></li>)}</ul></section>;
}
function Changes({ title, items }) {
  if (!items?.length) return null;
  return <section className="development-section"><h3>{title}</h3><ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul></section>;
}
export default function DevelopmentCoachDialog({ state, onClose }) {
  const close = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  const result = state.result;
  return <div className="development-coach-veil" role="dialog" aria-modal="true" aria-labelledby="development-title"
    onKeyDown={event => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") { event.preventDefault(); close.current?.focus(); }
    }}>
    <article className="development-coach-dialog" aria-busy={state.status === "loading"}>
      <header><h2 id="development-title">{state.kind === "comparison" ? "Gelişim Karşılaştırması" : "İlk Yazar Profili"}</h2><button ref={close} onClick={onClose}>Kapat</button></header>
      {state.message && <p role="status">{state.message}</p>}
      {result && <>
        <h3 className="development-headline">{result.headline}</h3>
        {state.analyzedAt && <p className="development-date">{new Date(state.analyzedAt).toLocaleDateString("tr-TR")}</p>}
        <p>{result.summary}</p>
        <Traits title="Sesinin belirgin özellikleri" items={result.voiceProfile?.signatureTraits} />
        <Traits title="Gelişen özellikler" items={result.voiceProfile?.developingTraits} />
        <Traits title="Dikkat isteyen örüntüler" items={result.voiceProfile?.frictions} />
        <Changes title="Korunan özellikler" items={result.progress?.preserved} />
        <Changes title="Güçlenen özellikler" items={result.progress?.improved} />
        <Changes title="Yeni beliren özellikler" items={result.progress?.emerging} />
        <Changes title="Devam eden gelişim alanları" items={result.progress?.persistent} />
        {!!result.focus?.length && <section className="development-section"><h3>Bir sonraki dönem için odak</h3>{result.focus.map((focus, index) =>
          <div key={index} className="development-focus"><h4>{focus.title}</h4><p>{focus.reason}</p><p>{focus.practice}</p></div>)}</section>}
        {result.coachNote && <p className="development-note">{result.coachNote}</p>}
      </>}
    </article>
  </div>;
}
