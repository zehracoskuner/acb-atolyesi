import { useEffect, useRef, useState } from "react";
import { apiGet, apiPatch } from "../lib/api";
import "../styles/DevelopmentCoach.css";
import { DEVELOPMENT_COACH_LAUNCH_ENABLED } from "../../../shared/features.js";

export const COACH_INTRO = "Yazdığın veya yapıştırdığın metinlerden anlatımına dair geri bildirim al. 3.000 yeni kelime birikince analizi sen başlatırsın; seçilen metinler yapay zekaya gönderilir.";

export default function DevelopmentCoachPreference(props) {
  if (!DEVELOPMENT_COACH_LAUNCH_ENABLED) return props.initialOnly ? null : <section className="development-preference development-preference-settings development-coming-soon" aria-label="Gelişim Koçu beta">
    <div className="development-coming-title"><svg width="22" height="24" viewBox="0 0 24 26" aria-hidden="true"><path d="M12 2 22 6v7c0 6-10 11-10 11S2 19 2 13V6Z" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="m8 13 3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg><h3>Yapay Zeka Gelişim Koçu</h3><span className="development-beta-badge">Beta</span></div>
    <p>Yazılarına dair gelişim değerlendirmeleri. <strong>Çok yakında.</strong></p>
  </section>;
  return <ActiveDevelopmentCoachPreference {...props} />;
}
function ActiveDevelopmentCoachPreference({ onChange, initialOnly = false }) {
  const [preference, setPreference] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    const read = () => {
      const request = ++generation.current;
      return apiGet("/user/development-coach").then(data => {
        if (active && request === generation.current) { setPreference(data.preference); onChange?.(data.preference); }
      }).catch(() => { if (active && request === generation.current) setMessage("Koç tercihin yüklenemedi. Aşağıdan seçimini yeniden kaydedebilirsin; başarılı kayıt olmadan koç açılmaz."); })
        .finally(() => { if (active && request === generation.current) setLoading(false); });
    };
    read(); window.addEventListener("focus", read); window.addEventListener("development-preference-changed", read);
    return () => { active = false; window.removeEventListener("focus", read); window.removeEventListener("development-preference-changed", read); };
  }, [onChange]);
  const choose = async value => {
    generation.current++;
    setBusy(true); setMessage("");
    try {
      const data = await apiPatch("/user/development-coach", { preference: value });
      setPreference(data.preference); onChange?.(data.preference); setMessage(data.message);
      window.dispatchEvent(new Event("development-preference-changed"));
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); setLoading(false); }
  };
  const promptOpen = initialOnly && preference === "undecided";
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!promptOpen) return;
    const previous = document.activeElement;
    dialogRef.current?.querySelector("button")?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [promptOpen]);
  if (initialOnly && !promptOpen) return null;
  const content = <section ref={dialogRef} className={`development-preference${initialOnly ? " development-coach-dialog" : " development-preference-settings"}`} role={initialOnly ? "dialog" : undefined} aria-modal={initialOnly ? true : undefined} aria-label="Yapay Zeka Gelişim Koçu tercihi" onKeyDown={event => {
    if (!initialOnly || event.key !== "Tab") return;
    const buttons = [...dialogRef.current.querySelectorAll("button:not(:disabled)")];
    if (!buttons.length) { event.preventDefault(); return; }
    const target = event.shiftKey ? buttons.at(-1) : buttons[0];
    if (document.activeElement === (event.shiftKey ? buttons[0] : buttons.at(-1))) { event.preventDefault(); target.focus(); }
  }}>
    {(!initialOnly || preference === "undecided") && <>
      <h3>Yapay Zeka Gelişim Koçu</h3><p>{COACH_INTRO}</p>
      <p>{loading ? "Koç tercihin yükleniyor…" : !preference ? "Mevcut tercihin doğrulanamadı." : preference === "undecided" ? "Yapay Zeka Gelişim Koçu’nu kullanmak ister misin?" : preference === "enabled" ? "Gelişim Koçu açık." : "Gelişim Koçu kapalı."}</p>
      {initialOnly && <p>Hayır dersen metinlerin koça gönderilmez. Seçimini istediğin zaman Ayarlar’dan değiştirebilirsin.</p>}
      {(!initialOnly || preference) && <div className="development-preference-actions">
        <button disabled={busy || preference === "enabled"} onClick={() => choose("enabled")}>{initialOnly ? "Evet, kullanmak istiyorum" : "Gelişim Koçunu Aç"}</button>
        <button disabled={busy || preference === "disabled"} onClick={() => choose("disabled")}>{initialOnly ? "Hayır, istemiyorum" : "Gelişim Koçunu Kapat"}</button>
      </div>}
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
  return initialOnly ? <div className="development-coach-veil">{content}</div> : content;
}
