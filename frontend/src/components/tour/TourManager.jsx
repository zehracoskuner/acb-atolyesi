import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import TourTooltip from "./TourTooltip";
import { TOUR_STEPS, TOUR_VERSION, contextTour } from "./TourSteps";
import { apiPatch } from "../../lib/api";
import { readTour, writeTour, waitForTarget, transitionGate, visibleTarget } from "./tourRuntime";
import "./tour.css";
import { useWritingFocus } from "../../lib/writingFocus";

export function TourManager({ userId, currentPath, routeKey, legacyCompleted, serverProgress }) {
  const writingFocus = useWritingFocus();
  const [view, setView] = useState(null);
  const [run, setRun] = useState(null);
  const [target, setTarget] = useState(null);
  const [phase, setPhase] = useState("waiting");
  const [retry, setRetry] = useState(0);
  const controller = useRef(null);
  const gate = useRef(transitionGate());
  const offered = useRef(false);
  const saves = useRef(new Map());
  const [syncFailed, setSyncFailed] = useState(false);
  const persist = useCallback((tour, status) => {
    writeTour(userId, tour, status);
    saves.current.get(tour)?.abort();
    const abort = new AbortController();
    saves.current.set(tour, abort);
    const timeout = setTimeout(() => { setSyncFailed(true); abort.abort(); }, 5000);
    abort.signal.addEventListener("abort", () => clearTimeout(timeout), { once: true });
    apiPatch("/user/tour-complete", { tour, version: TOUR_VERSION, status }, { signal: abort.signal })
      .catch(() => { if (!abort.signal.aborted) setSyncFailed(true); })
      .finally(() => { clearTimeout(timeout); if (saves.current.get(tour) === abort) saves.current.delete(tour); });
  }, [userId]);
  const close = useCallback(() => {
    controller.current?.abort();
    setView(null); setRun(null); setTarget(null);
  }, []);
  useEffect(() => { close(); }, [routeKey, currentPath, close]);
  useEffect(() => { if (writingFocus) close(); }, [writingFocus, close]);
  useEffect(() => {
    const pending = saves.current;
    return () => { controller.current?.abort(); pending.forEach(abort => abort.abort()); pending.clear(); };
  }, []);

  // Wait for the real navigation to mount after page loading. Never interrupt work screens.
  useEffect(() => {
    if (offered.current || legacyCompleted !== false || readTour(userId, "general") || serverProgress?.[`${TOUR_VERSION}_general`]) return;
    if (!["/keşfet", "/kesfet", "/studio", "/library"].includes(decodeURI(currentPath))) return;
    const abort = new AbortController();
    controller.current = abort;
    waitForTarget("tour-page-ready", { signal: abort.signal, timeout: 15000 }).then(el => {
      if (!el || abort.signal.aborted || offered.current) return;
      offered.current = true;
      persist("general", "invited");
      setView("invite");
    });
    return () => abort.abort();
  }, [userId, legacyCompleted, currentPath, serverProgress, persist]);

  useEffect(() => {
    const show = () => { close(); setView("help"); };
    window.addEventListener("acb-tour-help", show);
    return () => window.removeEventListener("acb-tour-help", show);
  }, [close]);

  const start = (type, atelier = false) => {
    controller.current?.abort();
    persist(type, "started");
    setTarget(null); setPhase("waiting"); setView("tour");
    gate.current.take();
    if (type === "chapters") {
      if (atelier) window.__acbTourTrigger?.openAtelier?.();
      else window.__acbTourTrigger?.openChapters?.();
    }
    setRun({ type, index: 0, steps: atelier ? TOUR_STEPS.atelier : TOUR_STEPS[type] });
  };
  const finish = () => {
    if (run) persist(run.type, "completed");
    close();
  };
  useEffect(() => {
    if (!run) return;
    const abort = new AbortController();
    controller.current = abort;
    setTarget(null); setPhase("waiting");
    const step = run.steps[run.index];
    if (step.target.startsWith("atelier-")) {
      window.__acbTourTrigger?.openAtelier?.();
      window.__acbTourTrigger?.prepareAtelierTool?.(step.target);
    }
    // This preparation only reveals the chapter sidebar, without changing its tab or content.
    const restore = step.target === "write-chapters" ? window.__acbTourTrigger?.openChapterSidebar?.() : null;
    waitForTarget(step.target, { signal: abort.signal, reveal: true }).then(el => {
      if (abort.signal.aborted) return;
      if (!el && step.optional) {
        const steps = run.steps.filter((_, i) => i !== run.index);
        if (!steps.length || run.index >= steps.length) { persist(run.type, "completed"); close(); }
        else setRun({ ...run, steps });
        return;
      }
      el?.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      setTarget(el); setPhase(el ? "ready" : "missing"); gate.current.ready();
    });
    return () => { abort.abort(); restore?.(); };
  }, [run, retry, persist, close]);

  const move = delta => {
    if (phase !== "ready" || !gate.current.take()) return;
    controller.current?.abort(); setTarget(null); setPhase("waiting");
    setRun(previous => ({ ...previous, index: previous.index + delta }));
  };
  if (writingFocus) return null;
  if (!view) return ["chapters", "plot", "characters"].includes(contextTour(currentPath)) ? <TourHelpButton floating /> : null;
  const context = contextTour(currentPath);
  const hasGeneral = !!document.querySelector('[data-tour="topbar-atolyem"]');
  const step = run?.steps[run.index];
  return <TourTooltip target={phase === "ready" ? target : null} onClose={close}
    onTargetLost={() => { setTarget(null); setPhase("missing"); gate.current.ready(); }}
    title={view === "invite" ? "Atölyeyi birlikte gezelim mi?" : view === "help" ? "Kısa rehberler" : step?.title}
    stepKey={view + (run?.index ?? "") + phase}>
    {view === "invite" ? <>
      <p>Birkaç kısa adımda etrafı tanıyalım. İstediğin an kapatabilirsin.</p>
      <div className="acb-tour-actions"><button onClick={() => { persist("general", "skipped"); close(); }}>Şimdi değil</button><button onClick={() => start("general")}>Başlayalım</button></div>
    </> : view === "help" ? <>
      <p>Bu ekrandan ayrılmadan etrafı tanıyalım.</p>
      <div className="acb-tour-actions">
        {hasGeneral && <button onClick={() => start("general")}>Genel tanıtım</button>}
        {context && <button onClick={() => start(context, context === "chapters" && !!visibleTarget("atelier-intro"))}>Bu ekranın rehberi</button>}
        {context === "chapters" && <button onClick={() => start("chapters", true)}>Atölye rehberi</button>}
      </div>
      <p className="acb-tour-note">{syncFailed ? "Tercihin bu tarayıcıda saklandı; hesabına kaydedilemedi." : "Rehber tercihlerin hesabına kaydedilir. Bağlantı kurulamazsa bu tarayıcıda hatırlanır."}</p>
    </> : <>
      <p className="acb-tour-count" aria-live="polite">Adım {run.index + 1} / {run.steps.length}</p>
      <p role="status">{phase === "waiting" ? "Alan hazırlanıyor…" : phase === "missing" ? "Bu alan şu anda görünmüyor. Sayfanın yüklenmesini bekleyip yeniden deneyebilir veya turu kapatabilirsin." : step.text}</p>
      <div className="acb-tour-actions">
        <button disabled={run.index === 0 || phase === "waiting"} onClick={() => { if (phase === "missing") { if (!gate.current.take()) return; setPhase("waiting"); setRun({ ...run, index: run.index - 1 }); } else move(-1); }}>Geri</button>
        {phase === "missing" ? <button onClick={() => { if (!gate.current.take()) return; setPhase("waiting"); setRetry(n => n + 1); }}>Yeniden dene</button> : run.index < run.steps.length - 1 && <button disabled={phase !== "ready"} onClick={() => move(1)}>İleri</button>}
        <button onClick={finish}>Turu bitir</button>
      </div>
    </>}
  </TourTooltip>;
}

export function TourHelpButton({ floating = false }) {
  const location = useLocation();
  const writingFocus = useWritingFocus();
  if (writingFocus) return null;
  return <button type="button" className={`acb-tour-help-btn${floating ? " acb-tour-help-floating" : ""}`}
    data-tour="tour-help" title="Yardım ve tanıtım turları" aria-label="Yardım ve tanıtım turları"
    onClick={() => window.dispatchEvent(new CustomEvent("acb-tour-help", { detail: location.pathname }))}>?</button>;
}
