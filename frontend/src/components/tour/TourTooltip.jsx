import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { visibleTarget, clippedRect } from "./tourRuntime";

export default function TourTooltip({ target, title, children, onClose, onTargetLost, stepKey }) {
  const card = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const lostRef = useRef(onTargetLost);
  lostRef.current = onTargetLost;
  const [geometry, setGeometry] = useState(null);
  useEffect(() => {
    const previous = document.activeElement;
    const focusables = () => [...card.current.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
    card.current.focus({ preventScroll: true });
    const key = e => {
      e.stopImmediatePropagation(); // Do not let editor delete/create shortcuts run behind the tour.
      if (e.key === "Escape") { e.preventDefault(); closeRef.current(); }
      if (e.key === "Tab") {
        const items = focusables();
        const index = items.indexOf(document.activeElement);
        e.preventDefault();
        const next = index < 0 ? (e.shiftKey ? items.length - 1 : 0) : (index + (e.shiftKey ? -1 : 1) + items.length) % items.length;
        items[next]?.focus();
      }
    };
    const block = e => { if (!card.current?.contains(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); } };
    const focus = e => { if (!card.current?.contains(e.target)) card.current?.focus({ preventScroll: true }); };
    window.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", block, true);
    document.addEventListener("click", block, true);
    document.addEventListener("focusin", focus);
    return () => {
      window.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", block, true);
      document.removeEventListener("click", block, true);
      document.removeEventListener("focusin", focus);
      const fallback = document.querySelector('[data-tour="tour-help"]');
      (previous?.isConnected ? previous : fallback)?.focus?.({ preventScroll: true });
    };
  }, []);
  useLayoutEffect(() => {
    let frame;
    const update = () => {
      const width = window.innerWidth, height = window.innerHeight;
      const c = card.current.getBoundingClientRect();
      const valid = target?.isConnected && visibleTarget(target.dataset.tour) === target;
      if (target && !valid) { lostRef.current?.(); return; }
      const r = valid ? target.getBoundingClientRect() : null;
      const left = r ? Math.max(12, Math.min(r.left, width - c.width - 12)) : Math.max(12, (width - c.width) / 2);
      const top = r ? Math.max(12, Math.min(r.bottom + c.height + 24 < height ? r.bottom + 12 : r.top - c.height - 12, height - c.height - 12)) : Math.max(12, (height - c.height) / 2);
      const next = { left, top, rect: valid ? clippedRect(target) : null };
      setGeometry(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [target, stepKey]);
  return createPortal(<div className="acb-tour-layer">
    <div className="acb-tour-shade" />
    {geometry?.rect && <div className="acb-tour-highlight" style={geometry.rect} />}
    <section ref={card} className="acb-tour-tooltip" role="dialog" aria-modal="true" aria-labelledby="acb-tour-title" tabIndex={-1}
      style={{ left: geometry?.left ?? 12, top: geometry?.top ?? 12 }}>
      <button className="acb-tour-close" aria-label="Turu kapat" onClick={onClose}>×</button>
      <h2 id="acb-tour-title">{title}</h2>
      {children}
    </section>
  </div>, document.body);
}
