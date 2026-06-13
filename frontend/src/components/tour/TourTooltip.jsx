import { useState, useEffect, useRef } from "react";

const TourTooltip = ({ step, stepIndex, totalSteps, onNext, onPrev, onSkip, isLastStep }) => {
  const tooltipRef = useRef(null);
  const [pos, setPos]       = useState({ top: 0, left: 0, arrowSide: "top" });
  const [visible, setVisible] = useState(false);

  // ── Pozisyon hesapla ──────────────────────────────────────────────────────
  useEffect(() => {
    setVisible(false);
    if (!step) return;

    const target = document.querySelector(`[data-tour="${step.target}"]`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });

    const timer = setTimeout(() => {
      const rect     = target.getBoundingClientRect();
      const tooltipW = 300;
      const tooltipH = 180;
      const gap      = 14;
      let top, left, arrowSide;

      const position = step.position || "bottom";

      if (position === "bottom") {
        top = rect.bottom + gap;  left = rect.left + rect.width / 2 - tooltipW / 2; arrowSide = "top";
      } else if (position === "top") {
        top = rect.top - tooltipH - gap; left = rect.left + rect.width / 2 - tooltipW / 2; arrowSide = "bottom";
      } else if (position === "right") {
        top = rect.top + rect.height / 2 - tooltipH / 2; left = rect.right + gap; arrowSide = "left";
      } else {
        top = rect.top + rect.height / 2 - tooltipH / 2; left = rect.left - tooltipW - gap; arrowSide = "right";
      }

      left = Math.max(12, Math.min(left, window.innerWidth  - tooltipW - 12));
      top  = Math.max(12, Math.min(top,  window.innerHeight - tooltipH - 12));

      setPos({ top, left, arrowSide });
      setVisible(true);
      target.setAttribute("data-tour-active", "true");
    }, 350);

    return () => {
      clearTimeout(timer);
      document.querySelector("[data-tour-active]")?.removeAttribute("data-tour-active");
    };
  }, [step]);

  // ── Ekrana tıklayınca ilerle ──────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    const handleClick = (e) => {
      // Tooltip'in kendisine, butonlarına tıklanırsa sayma
      if (tooltipRef.current?.contains(e.target)) return;
      onNext();
    };

    // Küçük gecikme: tooltip render'ı tıklamayı yutmasın
    const id = setTimeout(() => {
      document.addEventListener("click", handleClick);
    }, 100);

    return () => {
      clearTimeout(id);
      document.removeEventListener("click", handleClick);
    };
  }, [visible, onNext]);

  if (!step) return null;

  const arrowStyles = {
    top:    { top:"-7px",   left:"50%",  transform:"translateX(-50%)", borderLeft:"7px solid transparent", borderRight:"7px solid transparent", borderBottom:"7px solid #f5f0e8" },
    bottom: { bottom:"-7px",left:"50%",  transform:"translateX(-50%)", borderLeft:"7px solid transparent", borderRight:"7px solid transparent", borderTop:"7px solid #f5f0e8" },
    left:   { left:"-7px",  top:"50%",   transform:"translateY(-50%)", borderTop:"7px solid transparent",  borderBottom:"7px solid transparent", borderRight:"7px solid #f5f0e8" },
    right:  { right:"-7px", top:"50%",   transform:"translateY(-50%)", borderTop:"7px solid transparent",  borderBottom:"7px solid transparent", borderLeft:"7px solid #f5f0e8" },
  };

  return (
    <>
      {/* Yarı saydam overlay — yalnızca görsel, tıklamayı geçiriyor */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 998, pointerEvents: "none",
        background: "rgba(45,35,25,0.08)",
      }} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="acb-tour-tooltip"
        style={{
          position: "fixed", top: pos.top, left: pos.left,
          width: 300, zIndex: 1000,
          background: "linear-gradient(160deg,#faf8f3 0%,#f5f0e8 100%)",
          border: "2px solid #b8a47e", borderRadius: "6px",
          padding: "1.2rem 1.4rem 1rem",
          boxShadow: "0 10px 36px rgba(80,60,30,0.32), 0 0 0 1px rgba(80,60,30,0.05)",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        {/* Üst aksan çizgisi */}
        <div style={{
          position:"absolute", top:"-2px", left:"-2px", right:"-2px", height:"4px",
          background:"linear-gradient(90deg,#8b2500,#c44a00,#8b2500)",
          borderRadius:"6px 6px 0 0",
        }} />

        {/* Ok */}
        <div style={{ position:"absolute", width:0, height:0, ...arrowStyles[pos.arrowSide] }} />

        {/* Adım sayacı */}
        <div style={{
          fontFamily:"'Cormorant Garamond',Georgia,serif",
          fontSize:"0.65rem", letterSpacing:"0.2em",
          color:"#9a8c78", textTransform:"uppercase", marginBottom:"0.5rem",
        }}>
          {stepIndex + 1} / {totalSteps}
          <span style={{ marginLeft:"0.8rem", opacity:0.6, fontSize:"0.6rem" }}>
            · tıklayarak ilerleyebilirsin
          </span>
        </div>

        {/* Başlık */}
        <div style={{
          fontFamily:"'Cormorant Garamond','DM Serif Display',Georgia,serif",
          fontSize:"1rem", fontWeight:600,
          color:"#3d3122", marginBottom:"0.4rem", lineHeight:1.3,
        }}>{step.title}</div>

        {/* Metin */}
        <p style={{
          fontFamily:"'Cormorant Garamond',Georgia,serif",
          fontSize:"0.9rem", lineHeight:1.7,
          color:"#5c4e3a", margin:"0 0 0.9rem 0",
        }}>{step.text}</p>

        {/* Butonlar */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <button onClick={(e) => { e.stopPropagation(); onSkip(); }} style={btnSkipStyle}>
            Turu Atla
          </button>

          <div style={{ display:"flex", gap:"0.5rem" }}>
            {stepIndex > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onPrev(); }}
                style={btnSecStyle}
                onMouseEnter={e => e.currentTarget.style.background = "#f0e8d8"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >← Geri</button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              style={isLastStep ? btnPrimaryLastStyle : btnPrimaryStyle}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              {isLastStep ? "Yazmaya Başla ✦" : "İleri →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Stil sabitleri ────────────────────────────────────────────────────────────
const baseBtn = {
  cursor:"pointer",
  fontFamily:"'Cormorant Garamond',Georgia,serif",
  fontSize:"0.8rem",
  border:"none",
  borderRadius:"2px",
  transition:"opacity 0.2s, background 0.2s",
};

const btnSkipStyle = {
  ...baseBtn,
  background:"none", color:"#9a8c78",
  padding:0, textDecoration:"underline", textUnderlineOffset:"3px",
};

const btnSecStyle = {
  ...baseBtn,
  background:"none",
  border:"1px solid #c8b99a",
  color:"#7a6545",
  padding:"0.35rem 0.9rem",
};

const btnPrimaryStyle = {
  ...baseBtn,
  background:"linear-gradient(135deg,#8a7455 0%,#6a5535 100%)",
  color:"#f5f0e8",
  padding:"0.35rem 1rem",
};

const btnPrimaryLastStyle = {
  ...btnPrimaryStyle,
  background:"linear-gradient(135deg,#7a6545 0%,#5c4a2a 100%)",
};

export default TourTooltip;