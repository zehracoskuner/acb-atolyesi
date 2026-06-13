import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TourTooltip from "./TourTooltip";
import { apiPatch } from "../../lib/api";
import {
  TOUR_STEPS,
  WORK_TOUR_PAGES,
  EXPLORE_TOUR_PAGES,
  getTotalSteps,
} from "./TourSteps";

const TOUR_PENDING_KEY = "acb_tour_pending";
const TOUR_PROMPT_SEEN_KEY = "acb_tour_prompt_seen";

const matchPage = (pathname) => {
  const p = decodeURIComponent(pathname);
  if (p === "/keşfet")                        return "kesfet";
  if (p === "/profile/me")                    return "profil";
  if (/^\/profile\//.test(p))                 return "profil";
  if (/^\/work\/[^/]+$/.test(p))              return "atolyem";
  if (/^\/work\/[^/]+\/characters$/.test(p))  return "karakter";
  if (/^\/work\/[^/]+\/plot$/.test(p))        return "plotworld";
  if (/^\/work\/[^/]+\/chapters$/.test(p))    return "write";
  return null;
};

const getPageRoute = (page, firstWorkPath) => {
  switch (page) {
    case "atolyem":   return firstWorkPath || null;
    case "karakter":  return firstWorkPath ? `${firstWorkPath}/characters` : null;
    case "plotworld": return firstWorkPath ? `${firstWorkPath}/plot`        : null;
    case "write":     return firstWorkPath ? `${firstWorkPath}/chapters`    : null;
    case "kesfet":    return "/keşfet";
    case "profil":    return "/profile/me";
    default:          return null;
  }
};

// Element bekle — bulunamazsa skipIfMissing'e göre karar ver
const waitForElement = (target, { maxWait = 4000, skipIfMissing = false } = {}) => {
  return new Promise((resolve) => {
    // Hemen var mı?
    if (document.querySelector(`[data-tour="${target}"]`)) {
      resolve(true);
      return;
    }
    const interval = 150;
    let elapsed = 0;
    const id = setInterval(() => {
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (el) {
        clearInterval(id);
        resolve(true);
      } else {
        elapsed += interval;
        if (elapsed >= maxWait) {
          clearInterval(id);
          console.warn(`[Tour] Element bulunamadı: "${target}" (${maxWait}ms) skipIfMissing=${skipIfMissing}`);
          resolve(!skipIfMissing);
        }
      }
    }, interval);
  });
};

const createDemoWork = async () => {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: "İlk Eserim",
        description: "Bu eser ACB Atölyesi'nde başladı.",
        genres: ["Roman"],
        isPublic: false,
      }),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const slug = data.work?.slug || data.work?._id || data._id;
    return slug ? `/work/${slug}` : null;
  } catch { return null; }
};

function WelcomeModal({ onCreateWork, onExplore, loading }) {
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:1100,
      background:"rgba(45,35,25,0.5)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem",
    }}>
      <div style={{
        background:"linear-gradient(160deg,#faf8f3,#f5f0e8)",
        border:"1px solid #d4c9b0", borderRadius:"4px",
        maxWidth:"480px", width:"100%", padding:"2.5rem 3rem",
        boxShadow:"0 8px 40px rgba(80,60,30,0.2)",
        animation:"acbWelcomeUp 0.35s ease",
      }}>
        <style>{`
          @keyframes acbWelcomeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
          @keyframes acbSpin{to{transform:rotate(360deg)}}
        `}</style>
        <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"0.65rem", letterSpacing:"0.25em", color:"#9a8c78", textTransform:"uppercase", marginBottom:"1.2rem" }}>
          ACB Atölyesi · Hoş Geldin
        </div>
        <h2 style={{ fontFamily:"'Cormorant Garamond','DM Serif Display',Georgia,serif", fontSize:"1.6rem", fontWeight:600, color:"#3d3122", marginBottom:"1rem", lineHeight:1.3 }}>
          Atölyene hoş geldin ✦
        </h2>
        <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"1rem", lineHeight:1.8, color:"#5c4e3a", marginBottom:"2rem" }}>
          Hemen ilk eserini oluşturarak atölye araçlarını keşfedebilirsin.
          Ya da önce topluluğu ve profilini tanımak istersen kısa bir tur gösterelim.
        </p>
        <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap" }}>
          <button onClick={onCreateWork} disabled={loading} style={{
            fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"0.82rem",
            letterSpacing:"0.12em", textTransform:"uppercase", color:"#f5f0e8",
            background: loading ? "linear-gradient(135deg,#a89878,#8a7455)" : "linear-gradient(135deg,#7a6545,#5c4a2a)",
            border:"none", borderRadius:"2px", padding:"0.75rem 1.8rem",
            cursor: loading ? "not-allowed" : "pointer",
            display:"flex", alignItems:"center", gap:"0.5rem",
          }}>
            {loading ? (
              <><span style={{ display:"inline-block", width:"12px", height:"12px", border:"2px solid #f5f0e8", borderTopColor:"transparent", borderRadius:"50%", animation:"acbSpin 0.7s linear infinite" }} />Hazırlanıyor…</>
            ) : "İlk Eserimi Oluştur →"}
          </button>
          <button onClick={onExplore} disabled={loading} style={{
            fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"0.82rem", color:"#7a6545",
            background:"transparent", border:"1px solid #c8b99a", borderRadius:"2px",
            padding:"0.75rem 1.5rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
          }}>Önce Keşfet</button>
        </div>
      </div>
    </div>
  );
}

function ProjectToolsPromptModal({ onStart, onSkip }) {
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:1100,
      background:"rgba(45,35,25,0.5)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem",
    }}>
      <div style={{
        background:"linear-gradient(160deg,#faf8f3,#f5f0e8)",
        border:"1px solid #d4c9b0", borderRadius:"4px",
        maxWidth:"480px", width:"100%", padding:"2.5rem 3rem",
        boxShadow:"0 8px 40px rgba(80,60,30,0.2)",
        animation:"acbWelcomeUp 0.35s ease",
      }}>
        <style>{`@keyframes acbWelcomeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"0.65rem", letterSpacing:"0.25em", color:"#9a8c78", textTransform:"uppercase", marginBottom:"1.2rem" }}>
          ACB Atölyesi · Sıradaki Adım
        </div>
        <h2 style={{ fontFamily:"'Cormorant Garamond','DM Serif Display',Georgia,serif", fontSize:"1.6rem", fontWeight:600, color:"#3d3122", marginBottom:"1rem", lineHeight:1.3 }}>
          İlk hikâyeni oluşturmaya hazır mısın?
        </h2>
        <p style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"1rem", lineHeight:1.8, color:"#5c4e3a", marginBottom:"2rem" }}>
          Şimdi ilk eserini nereden oluşturacağını ve Eser Merkezi, Karakter Evreni, bölüm yazma alanı gibi proje araçlarını tanıyabilirsin.
        </p>
        <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap" }}>
          <button onClick={onStart} style={{
            fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"0.82rem",
            letterSpacing:"0.12em", textTransform:"uppercase", color:"#f5f0e8",
            background:"linear-gradient(135deg,#7a6545,#5c4a2a)",
            border:"none", borderRadius:"2px", padding:"0.75rem 1.8rem",
            cursor:"pointer",
          }}>Proje araçlarını tanıt</button>
          <button onClick={onSkip} style={{
            fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"0.82rem", color:"#7a6545",
            background:"transparent", border:"1px solid #c8b99a", borderRadius:"2px",
            padding:"0.75rem 1.5rem", cursor:"pointer",
          }}>Şimdilik geç</button>
        </div>
      </div>
    </div>
  );
}

export const TourManager = ({ currentPath, firstWorkPath, hasWorks, tourCompleted, onTourSeen, onWorkCreated }) => {
  const navigate = useNavigate();

  const [tourType,    setTourType]    = useState(null);
  const [isActive,    setIsActive]    = useState(false);
  const [currentPage, setCurrentPage] = useState("atolyem");
  const [stepIndex,   setStepIndex]   = useState(0);
  const [ready,       setReady]       = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [loading,     setLoading]     = useState(false);

  const startedRef  = useRef(false);
  const workPathRef = useRef(firstWorkPath);
  const mountedRef  = useRef(true);

  useEffect(() => { workPathRef.current = firstWorkPath; }, [firstWorkPath]);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const totalSteps = getTotalSteps(tourType || "work");

  const getGlobalStepIndex = useCallback(() => {
    const pages = tourType === "explore" ? EXPLORE_TOUR_PAGES : WORK_TOUR_PAGES;
    let count = 0;
    for (const page of pages) {
      if (page === currentPage) return count + stepIndex;
      count += (TOUR_STEPS[page]?.filter(s => !s.skipIfMissing).length || 0);
    }
    return count;
  }, [currentPage, stepIndex, tourType]);

  // ── İlk açılış: SADECE ilk kez kayıt olan kullanıcılar ───────────────────
  // Tek referans: kullanıcının hesabında tourCompleted=false olması
  // (sunucu taraflı, hesaba bağlı — tarayıcı/cihazdan bağımsız).
  useEffect(() => {
    if (startedRef.current)       return;
    if (hasWorks === undefined)   return;
    if (tourCompleted === undefined) return;
    if (tourCompleted)            return;
    if (!localStorage.getItem("token")) return;
    if (hasWorks !== false)       return;
    startedRef.current = true;
    setTimeout(() => setShowWelcome(true), 600);
  }, [hasWorks, tourCompleted]);

  // ── TOUR_PENDING ─────────────────────────────────────────────────────────
  useEffect(() => {
    const pending = localStorage.getItem(TOUR_PENDING_KEY);
    if (!pending || !firstWorkPath) return;
    localStorage.removeItem(TOUR_PENDING_KEY);
    setShowWelcome(false);
    setTourType("work");
    setCurrentPage("atolyem");
    setStepIndex(0);
    setReady(false);
    setIsActive(true);
    navigate(firstWorkPath);
  }, [firstWorkPath, navigate]);

  // ── Sayfa URL değişince currentPage güncelle ─────────────────────────────
  // Not: navigate() çağrısı henüz tamamlanmadan bu efekt eski currentPath ile
  // tetiklenebilir. Eşleşen sayfa aktif turun sayfa listesinde değilse (örn.
  // work turu /work/x'e geçerken hâlâ /keşfet'teyse) currentPage'i ezme.
  useEffect(() => {
    if (!isActive) return;
    const page  = matchPage(currentPath);
    const pages = tourType === "explore" ? EXPLORE_TOUR_PAGES : WORK_TOUR_PAGES;
    if (page && pages.includes(page) && page !== currentPage) {
      setCurrentPage(page);
      setStepIndex(0);
      setReady(false);
    }
  }, [currentPath, isActive, currentPage, tourType]);

  // ── Element bekle ─────────────────────────────────────────────────────────
useEffect(() => {
  if (!isActive) return;
  setReady(false);

  const steps = TOUR_STEPS[currentPage] || [];
  const step  = steps[stepIndex];
  if (!step) return;

  let cancelled = false;

  const run = async () => {
    if (step.triggerKey) {
      window.__acbTourTrigger?.[step.triggerKey]?.();
      // React state güncellemesi için render döngüsünü bekle
      await new Promise(r => setTimeout(r, 250));
    }
    if (cancelled) return;

    const baseWait = step.target === "kesfet-eser-kart" ? 6000 : 4000;
    const maxWait  = step.skipIfMissing ? Math.min(baseWait, 3000) : baseWait;

    const found = await waitForElement(step.target, { maxWait, skipIfMissing: !!step.skipIfMissing });

    if (cancelled || !mountedRef.current) return;
    if (!found) setStepIndex(s => s + 1);
    else setReady(true);
  };

  run();
  return () => { cancelled = true; };
}, [isActive, currentPage, stepIndex]);
  // ── Turu bitir ───────────────────────────────────────────────────────────
  const endTour = useCallback((goToStudio = false) => {
    setIsActive(false);
    setReady(false);
    setTourType(null);
    apiPatch("/user/tour-complete").catch(() => {});
    onTourSeen?.();
    if (goToStudio) {
      // Keşfet turu bitti — proje araçları turuna geçiş teklif edilmediyse göster
      if (!localStorage.getItem(TOUR_PROMPT_SEEN_KEY)) {
        setShowTransition(true);
      } else {
        navigate("/studio");
      }
    }
  }, [navigate, onTourSeen]);

  // ── Sonraki sayfaya geç ──────────────────────────────────────────────────
  const goNextPage = useCallback(() => {
    const pages    = tourType === "explore" ? EXPLORE_TOUR_PAGES : WORK_TOUR_PAGES;
    const nextPage = pages[pages.indexOf(currentPage) + 1] || null;

    if (nextPage) {
      const route = getPageRoute(nextPage, workPathRef.current);
      setCurrentPage(nextPage);
      setStepIndex(0);
      setReady(false);
      if (route) navigate(route);
    } else {
      endTour(tourType === "explore");
    }
  }, [currentPage, tourType, navigate, endTour]);

  // ── stepIndex aşımı → sonraki sayfa ─────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const steps = TOUR_STEPS[currentPage] || [];
    if (stepIndex >= steps.length) {
      goNextPage();
    }
  }, [stepIndex, isActive, currentPage, goNextPage]);

  // ── İleri ────────────────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    const steps = TOUR_STEPS[currentPage] || [];
    if (stepIndex < steps.length - 1) {
      setStepIndex(s => s + 1);
    } else {
      goNextPage();
    }
  }, [stepIndex, currentPage, goNextPage]);

  // ── Geri ────────────────────────────────────────────────────────────────
  const handlePrev = useCallback(() => {
    if (stepIndex > 0) { setStepIndex(s => s - 1); return; }
    const pages   = tourType === "explore" ? EXPLORE_TOUR_PAGES : WORK_TOUR_PAGES;
    const prevIdx = pages.indexOf(currentPage) - 1;
    if (prevIdx < 0) return;
    const prevPage  = pages[prevIdx];
    const prevSteps = (TOUR_STEPS[prevPage] || []).filter(s => !s.skipIfMissing);
    setCurrentPage(prevPage);
    setStepIndex(Math.max(0, prevSteps.length - 1));
    setReady(false);
    const route = getPageRoute(prevPage, workPathRef.current);
    if (route) navigate(route);
  }, [stepIndex, currentPage, tourType, navigate]);

  // ── Tur başlatıcılar ─────────────────────────────────────────────────────
  const startWorkTour = useCallback((workPath) => {
    setTourType("work"); setCurrentPage("atolyem");
    setStepIndex(0); setReady(false); setIsActive(true);
    if (workPath) navigate(workPath);
  }, [navigate]);

  const startExploreTour = useCallback(() => {
    navigate("/keşfet");
    setTimeout(() => {
      if (!mountedRef.current) return;
      setTourType("explore"); setCurrentPage("kesfet");
      setStepIndex(0); setReady(false); setIsActive(true);
    }, 120);
  }, [navigate]);

  // ── Karşılama aksiyonları ────────────────────────────────────────────────
  const handleCreateWork = useCallback(async () => {
    setLoading(true);
    const workPath = await createDemoWork();
    setLoading(false);
    if (workPath) {
      onWorkCreated?.(workPath);
      localStorage.setItem(TOUR_PENDING_KEY, "1");
      setShowWelcome(false);
      navigate(workPath);
    } else {
      setShowWelcome(false);
      localStorage.setItem(TOUR_PENDING_KEY, "1");
      navigate("/studio");
      setTimeout(() => window.__acbOpenCreateModal?.(), 400);
    }
  }, [navigate, onWorkCreated]);

  const handleExplore = useCallback(() => {
    setShowWelcome(false);
    startExploreTour();
  }, [startExploreTour]);

  // ── Geçiş modalı aksiyonları ─────────────────────────────────────────────
  const handleTransitionSkip = useCallback(() => {
    localStorage.setItem(TOUR_PROMPT_SEEN_KEY, "1");
    setShowTransition(false);
    navigate("/studio");
  }, [navigate]);

  const handleTransitionStart = useCallback(() => {
    localStorage.setItem(TOUR_PROMPT_SEEN_KEY, "1");
    setShowTransition(false);
    if (workPathRef.current) {
      startWorkTour(workPathRef.current);
    } else {
      handleCreateWork();
    }
  }, [startWorkTour, handleCreateWork]);

  // ── Soru işareti ─────────────────────────────────────────────────────────
  useEffect(() => {
    window.__acbRestartTour = () => {
      startedRef.current = true;
      setReady(false);
      const wp = workPathRef.current;
      if (wp) startWorkTour(wp);
      else    startExploreTour();
    };
    return () => { delete window.__acbRestartTour; };
  }, [startWorkTour, startExploreTour]);

  // ── Render ───────────────────────────────────────────────────────────────
  const steps  = TOUR_STEPS[currentPage] || [];
  const step   = steps[stepIndex];
  const pages  = tourType === "explore" ? EXPLORE_TOUR_PAGES : WORK_TOUR_PAGES;
  const isLast = currentPage === pages[pages.length - 1] && stepIndex === steps.length - 1;

  return (
    <>
      {showWelcome && (
        <WelcomeModal onCreateWork={handleCreateWork} onExplore={handleExplore} loading={loading} />
      )}
      {showTransition && (
        <ProjectToolsPromptModal onStart={handleTransitionStart} onSkip={handleTransitionSkip} />
      )}
      {isActive && step && ready && (
        <TourTooltip
          step={step}
          stepIndex={getGlobalStepIndex()}
          totalSteps={totalSteps}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={() => endTour(tourType === "explore")}
          isLastStep={isLast}
        />
      )}
    </>
  );
};

export const TourHelpButton = () => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      className="acb-tour-help-btn"
      onClick={() => window.__acbRestartTour?.()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Tanıtım turunu başlat"
      aria-label="Tanıtım turunu başlat"
      style={{
        background: hovered ? "#e7dfca" : "#f3ece0",
        border: `1px solid ${hovered ? "#8a7455" : "#c8b99a"}`,
        borderRadius:"50%", width:"32px", height:"32px",
        cursor:"pointer", display:"flex", alignItems:"center",
        justifyContent:"center", transition:"all 0.2s ease", flexShrink:0,
        boxShadow: hovered ? "0 2px 8px rgba(122,101,69,0.35)" : "0 1px 5px rgba(122,101,69,0.22)",
      }}
    >
      <span style={{ fontFamily:"Georgia,serif", fontWeight:700, fontSize:"0.85rem", color: hovered ? "#5c4a2a" : "#7a6545", lineHeight:1, transition:"color 0.2s ease" }}>?</span>
    </button>
  );
};