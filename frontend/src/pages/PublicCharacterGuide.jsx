import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CharacterGuideCards, GuideLinkButton } from "../components/characters/CharacterGuideCards";
import { apiGet } from "../lib/api";
import { useSession } from "../lib/session";

export default function PublicCharacterGuide() {
  const { workId } = useParams();
  const { user } = useSession();
  const viewer = user?._id || user?.id;
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const current = result?.workId === workId && result.viewer === viewer && result.retry === retry ? result : null;

  useEffect(() => {
    let active = true;
    apiGet(`/public/works/${workId}/character-guide`)
      .then(({ item }) => { if (active) setResult({ item, workId, viewer, retry }); })
      .catch(error => { if (active) setResult({ error, workId, viewer, retry }); });
    return () => { active = false; };
  }, [workId, viewer, retry]);

  return <main className="cg-page">
    <Link className="cg-text-link" to={`/story/${workId}`}><ArrowLeft size={16} /> Kitaba dön</Link>
    <header className="cg-page-header">
      <div><p>{current?.item?.title}</p><h1>Karakter Rehberi</h1></div>
      {current?.item && <GuideLinkButton path={`/story/${workId}/character-guide`} />}
    </header>
    {!current ? <p role="status">Rehber yükleniyor…</p> : current.error ? <div role="alert">
      <p>{current.error.status === 404 ? "Bu kitabın paylaşılmış bir karakter rehberi yok." : "Karakter Rehberi açılamadı."}</p>
      {current.error.status !== 404 && <button className="cg-button" type="button" onClick={() => setRetry(value => value + 1)}>Tekrar dene</button>}
    </div> : <>
      <p className="cg-muted"><BookOpen size={16} aria-hidden="true" /> Kartlar ve ilişkiler okuma ilerlemene göre açılır.</p>
      <CharacterGuideCards item={current.item} selected={params.get("character")} workId={workId}
        onSelect={id => setParams(id ? { character: id } : {})} />
    </>}
  </main>;
}
