// src/pages/CharactersUniversePage.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/CharactersUniverse.css";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";

/* ── Varsayılan ilişki türleri ── */
const DEFAULT_REL_TYPES = [
  { key: "love",      label: "❤️ Aşk",          color: "#fb7185" },
  { key: "conflict",  label: "⚡ Çatışma",       color: "#f97316" },
  { key: "manip",     label: "🧠 Manipülasyon",  color: "#a78bfa" },
  { key: "protect",   label: "🛡️ Koruma",        color: "#22c55e" },
  { key: "trauma",    label: "💔 Travma",         color: "#60a5fa" },
  { key: "alliance",  label: "🤝 İttifak",        color: "#facc15" },
  { key: "secret",    label: "🤫 Sır",            color: "#e879f9" },
  { key: "rivalry",   label: "🗡️ Rekabet",        color: "#fb923c" },
  { key: "unknown",   label: "❓ Belirsiz",       color: "#94a3b8" },
];

/* ── Custom types: workId bazlı localStorage ── */
function getCustomLsKey(workId) { return `acb_custom_rel_types_${workId}`; }
function getCustomTypes(workId) {
  try { return JSON.parse(localStorage.getItem(getCustomLsKey(workId))) || []; }
  catch { return []; }
}
function saveCustomTypes(workId, types) {
  localStorage.setItem(getCustomLsKey(workId), JSON.stringify(types));
}

function typeColor(typeKey, customTypes = []) {
  return [...DEFAULT_REL_TYPES, ...customTypes].find(t => t.key === typeKey)?.color || "#94a3b8";
}
function typeLabel(typeKey, customTypes = []) {
  return [...DEFAULT_REL_TYPES, ...customTypes].find(t => t.key === typeKey)?.label || typeKey;
}

/* ── Kart rotasyonları — inline style ile, DOM sırasından bağımsız ── */
const ROTATIONS = [-1.6, 1.1, -2.3, 0.7, 1.8, -0.9, 2.1, -1.4, 0.5, -2.0, 1.3, -0.6];
function getRotation(idx) { return ROTATIONS[idx % ROTATIONS.length]; }

/* ── strength → stroke-width ── */
function strengthToWidth(s) { return 0.8 + (s ?? 3) * 0.55; } // 1→1.35  3→2.45  5→3.55

/* ════════════════════════════════════════════════
   ANA SAYFA
════════════════════════════════════════════════ */
export default function CharactersUniversePage() {
  const { workId } = useParams();
  const navigate   = useNavigate();
  const canvasRef  = useRef(null);

  /* ── Veri ── */
  const [nodes,   setNodes]   = useState([]);
  const [edges,   setEdges]   = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── Custom ilişki türleri ── */
  const [customTypes, setCustomTypes] = useState([]);

  /* ── UI ── */
  const [editing,           setEditing]           = useState(null);
  const connectingFromRef = useRef(null);
  const [connectMouse,      setConnectMouse]       = useState({ x: 0, y: 0 });
  const [isConnecting,      setIsConnecting]       = useState(false);
  const [pendingLink,       setPendingLink]        = useState(null);
  const [relationPickerPos, setRelationPickerPos]  = useState(null);
  const [customRelInput,    setCustomRelInput]     = useState("");
  const [customRelColor,    setCustomRelColor]     = useState("#dc2626");
  const [toast,             setToast]              = useState(null); // { msg, key, leaving }
  const [draggingId,        setDraggingId]         = useState(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [theme, setTheme] = useState(() => localStorage.getItem("acb_char_theme") || "light");

  /* ── İlişki seçici extras ── */
  const [pickerStrength, setPickerStrength] = useState(3);
  const [pickerLabel,    setPickerLabel]    = useState("");

  /* ── Sahne modu ── */
  const [sceneMode,  setSceneMode]  = useState(false);
  const [scenePick,  setScenePick]  = useState({ a: null, b: null });
  const [sceneIdea,  setSceneIdea]  = useState("");
  const [savingTo,   setSavingTo]   = useState(null);

  /* ── Clear confirmation ── */
  const [clearConfirm, setClearConfirm] = useState(false);
  const clearTimer = useRef(null);

  const toggleTheme = () => setTheme(t => {
    const next = t === "light" ? "dark" : "light";
    localStorage.setItem("acb_char_theme", next);
    return next;
  });

  /* ── Toast — giriş + çıkış animasyonlu ── */
  const toastTimer  = useRef(null);
  const toastOutRef = useRef(null);
  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current);
    clearTimeout(toastOutRef.current);
    setToast({ msg, key: Date.now(), leaving: false });
    toastTimer.current = setTimeout(() => {
      setToast(t => t ? { ...t, leaving: true } : t);
      toastOutRef.current = setTimeout(() => setToast(null), 320);
    }, 2600);
  }, []);

  /* ── Yükle ── */
  useEffect(() => {
    if (!workId) return;
    setCustomTypes(getCustomTypes(workId));
    (async () => {
      try {
        setLoading(true);
        const [charRes, relRes] = await Promise.all([
          apiGet(`/characters?workId=${workId}`),
          apiGet(`/relationships?workId=${workId}`),
        ]);
        setNodes((charRes.items || []).map((c, i) => ({
          id:       c._id || c.id,
          name:     c.name,
          role:     c.role || "",
          color:    c.color || "#7dd3fc",
          notes:    c.notes || "",
          x:        typeof c.x === "number" ? c.x : 160 + (i % 4) * 160,
          y:        typeof c.y === "number" ? c.y : 120 + Math.floor(i / 4) * 160,
          rotation: getRotation(i),
        })));
        setEdges((relRes.items || []).map(r => ({
          id:       r._id || r.id,
          from:     String(r.from),
          to:       String(r.to),
          type:     r.type,
          strength: r.strength ?? 3,
          label:    r.label || "",
        })));
      } catch (e) {
        showToast(e?.message || "Yükleme hatası");
      } finally {
        setLoading(false);
      }
    })();
  }, [workId, showToast]);

  /* ── Yardımcılar ── */
  const nodeById = useMemo(() => {
    const m = new Map();
    nodes.forEach(n => m.set(n.id, n));
    return m;
  }, [nodes]);

  const nodeCenter = useCallback((id) => {
    const n = nodeById.get(id);
    if (!n) return { x: 0, y: 0 };
    return { x: n.x + 63, y: n.y + 28 };
  }, [nodeById]);

  const updateNode = useCallback((id, patch) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
  }, []);

  const cancelPicker = useCallback(() => {
    setPendingLink(null);
    setRelationPickerPos(null);
    setCustomRelInput("");
    setCustomRelColor("#dc2626");
  }, []);

  const resetPickerExtras = useCallback(() => {
    setPickerStrength(3);
    setPickerLabel("");
  }, []);

  /* ── ESC ── */
  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") {
        cancelPicker();
        resetPickerExtras();
        setEditing(null);
        setSceneIdea("");
        setClearConfirm(false);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [cancelPicker, resetPickerExtras]);

  /* ── Global mouse handlers ── */
  useEffect(() => {
    const onMove = (e) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (connectingFromRef.current) setConnectMouse({ x, y });
      if (draggingId) {
        updateNode(draggingId, {
          x: x - dragOffsetRef.current.x,
          y: y - dragOffsetRef.current.y,
        });
      }
    };
    const onUp = () => {
      if (draggingId) {
        setNodes(prev => {
          const n = prev.find(n => n.id === draggingId);
          if (n) apiPatch(`/characters/${draggingId}/position`, { workId, x: n.x, y: n.y }).catch(() => {});
          return prev;
        });
        setDraggingId(null);
      }
      if (connectingFromRef.current) {
        connectingFromRef.current = null;
        setIsConnecting(false);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, [draggingId, updateNode, workId]);

  /* ── Yeni karakter ── */
  const createCharacter = useCallback(async () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width  / 2 - 63 : 240;
    const cy = rect ? rect.height / 2 - 28 : 200;
    const tempId   = "temp-" + Date.now();
    const rotation = getRotation(nodes.length);
    setNodes(p => [...p, { id: tempId, name: "Yeni Karakter", role: "", color: "#7dd3fc", notes: "", x: cx, y: cy, rotation }]);
    try {
      const d = await apiPost("/characters", { workId, name: "Yeni Karakter", x: cx, y: cy });
      const c = d.item;
      setNodes(p => p.map(n => n.id === tempId ? {
        id: c._id, name: c.name, role: c.role || "", color: c.color || "#7dd3fc",
        notes: c.notes || "", x: c.x, y: c.y, rotation,
      } : n));
      showToast("✨ Karakter eklendi.");
    } catch (e) {
      setNodes(p => p.filter(n => n.id !== tempId));
      showToast(e?.message || "Eklenemedi.");
    }
  }, [workId, nodes.length, showToast]);

  /* ── Karakter sil ── */
  const removeCharacter = useCallback(async (id) => {
    const prevNodes = nodes, prevEdges = edges;
    setNodes(p => p.filter(n => n.id !== id));
    setEdges(p => p.filter(e => e.from !== id && e.to !== id));
    if (editing?.id === id) setEditing(null);
    try {
      await apiDelete(`/characters/${id}?workId=${workId}`);
      showToast("Karakter silindi.");
    } catch (e) {
      setNodes(prevNodes); setEdges(prevEdges);
      showToast(e?.message || "Silinemedi.");
    }
  }, [workId, nodes, edges, editing, showToast]);

  /* ── AI ── */
  const runChaos = useCallback(async () => {
    if (!editing) return;
    try {
      const d = await apiPost("/ai/chaos", { characterName: editing.name, role: editing.role, notes: editing.notes, mode: "question" });
      const line = d.answer
        ? `Karakter Sorusu: ${d.question}\nOlası Cevap: ${d.answer}`
        : `Karakter Sorusu: ${d.question}`;
      setEditing(p => ({ ...p, notes: (p.notes ? p.notes + "\n\n" : "") + line }));
      showToast("✨ Soru eklendi.");
    } catch (e) { showToast(e?.message || "AI yanıt veremedi."); }
  }, [editing, showToast]);

  const saveEditor = useCallback(async () => {
    if (!editing?.id) return;
    try {
      const d = await apiPatch(`/characters/${editing.id}`, { workId, name: editing.name, role: editing.role, color: editing.color, notes: editing.notes });
      const c = d.item;
      setNodes(p => p.map(n => n.id === editing.id
        ? { ...n, name: c.name, role: c.role || "", color: c.color || n.color, notes: c.notes || "" } : n));
      showToast("Kaydedildi ✓");
      setEditing(null);
    } catch (e) { showToast(e?.message || "Kaydedilemedi."); }
  }, [editing, workId, showToast]);

  /* ── Bağ ekle — strength + label ── */
  const addEdge = useCallback(async ({ from, to, type, label = "", strength = 3 }) => {
    if (!from || !to || String(from) === String(to)) return;
    const fromStr = String(from), toStr = String(to);
    const tempId = "temp-edge-" + Date.now();
    setEdges(p => [...p, { id: tempId, from: fromStr, to: toStr, type, strength, label }]);
    try {
      const d = await apiPost("/relationships", { workId, from: fromStr, to: toStr, type, strength, label });
      const r = d.item;
      setEdges(p => p.map(e => e.id === tempId
        ? { id: r._id, from: String(r.from), to: String(r.to), type: r.type, strength: r.strength ?? 3, label: r.label || "" } : e));
      showToast("Bağ kuruldu.");
    } catch (e) {
      setEdges(p => p.filter(x => x.id !== tempId));
      if (e?.code === "REL_DUPLICATE" || e?.message?.includes("zaten var")) showToast("⚠️ Bu bağ zaten kurulmuş.");
      else showToast(e?.message || "Bağ kurulamadı.");
    }
  }, [workId, showToast]);

  /* ── Bağ sil ── */
  const removeEdge = useCallback(async (edgeId) => {
    const prev = edges;
    setEdges(p => p.filter(e => e.id !== edgeId));
    try {
      await apiDelete(`/relationships/${edgeId}?workId=${workId}`);
      showToast("Bağ silindi.");
    } catch (e) { setEdges(prev); showToast(e?.message || "Silinemedi."); }
  }, [workId, edges, showToast]);

  /* ── Tüm bağları temizle ── */
  const clearAllEdges = useCallback(async () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      clearTimer.current = setTimeout(() => setClearConfirm(false), 3500);
      showToast("⚠️ Emin misin? Tekrar tıkla → tüm bağlar silinir.");
      return;
    }
    clearTimeout(clearTimer.current);
    setClearConfirm(false);
    const toDelete = [...edges];
    setEdges([]);
    const results = await Promise.allSettled(toDelete.map(e => apiDelete(`/relationships/${e.id}?workId=${workId}`)));
    const failed = results.filter(r => r.status === "rejected").length;
    showToast(failed > 0 ? `${failed} bağ silinemedi.` : "Tüm bağlar silindi.");
  }, [edges, workId, clearConfirm, showToast]);

  /* ── Node mouse handlers ── */
  const onNodeMouseDown = (e, nodeId) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (e.shiftKey) {
      connectingFromRef.current = nodeId;
      setIsConnecting(true);
      setConnectMouse({ x, y });
      cancelPicker();
      return;
    }
    const n = nodeById.get(nodeId);
    if (!n) return;
    setDraggingId(nodeId);
    dragOffsetRef.current = { x: x - n.x, y: y - n.y };
  };

  const onNodeMouseUp = useCallback((e, targetId) => {
    if (!connectingFromRef.current || targetId === connectingFromRef.current) {
      connectingFromRef.current = null;
      setIsConnecting(false);
      return;
    }
    const from = connectingFromRef.current;
    connectingFromRef.current = null;
    setIsConnecting(false);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPendingLink({ from, to: targetId });
    setRelationPickerPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  /* ── Picker handlers ── */
  const chooseRelation = (typeKey) => {
    if (!pendingLink) return;
    addEdge({ from: pendingLink.from, to: pendingLink.to, type: typeKey, strength: pickerStrength, label: pickerLabel.trim() });
    cancelPicker(); resetPickerExtras();
  };

  const addCustomRelation = () => {
    const raw = customRelInput.trim();
    if (!raw || !pendingLink) return;
    const key = "custom_" + raw.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") + "_" + Date.now();
    const newType = { key, label: raw, color: customRelColor };
    const updated = [...customTypes, newType];
    setCustomTypes(updated);
    saveCustomTypes(workId, updated);
    addEdge({ from: pendingLink.from, to: pendingLink.to, type: key, strength: pickerStrength, label: pickerLabel.trim() });
    cancelPicker(); resetPickerExtras();
  };

  /* ── Sahne kıvılcımı ── */
  const buildSceneIdea = useCallback(async (aId, bId) => {
    const a = nodeById.get(aId), b = nodeById.get(bId);
    if (!a || !b) return;
    const rel = edges.find(r => (r.from === aId && r.to === bId) || (r.from === bId && r.to === aId));
    const relText = rel ? typeLabel(rel.type, customTypes) : "Belirsiz";
    const localIdea = `Karakterler: ${a.name} (${a.role || "?"}) ↔ ${b.name} (${b.role || "?"})\nİlişki: ${relText}\n\nBu sahnede kim geri adım atarsa "kaybeder"? Ve bu kayıp hikâyeyi nereye iter?`;
    setSceneIdea(localIdea);
    try {
      const d = await apiPost("/ai/scene-spark", { workId, characters: [
        { name: a.name, role: a.role, notes: a.notes || "" },
        { name: b.name, role: b.role, notes: b.notes || "" },
      ]});
      if (d?.scene) setSceneIdea(localIdea + "\n\n── AI Taslağı ──\n" + d.scene);
    } catch { showToast("AI sahne üretemedi, yerel kıvılcım gösterildi."); }
  }, [nodeById, edges, customTypes, workId, showToast]);

  const closeSceneIdea = useCallback(() => {
    setSceneIdea(""); setScenePick({ a: null, b: null });
  }, []);

  const saveToPlot = async () => {
    const a = nodeById.get(scenePick.a), b = nodeById.get(scenePick.b);
    const title = a && b ? `${a.name} ↔ ${b.name} Sahnesi` : "Sahne Kıvılcımı";
    setSavingTo("plot");
    try {
      await apiPost(`/plots/${workId}/scenes`, { act: "middle", title, description: sceneIdea, status: "idea" });
      showToast("✅ Sahne Gelişme perdesine eklendi!");
      closeSceneIdea();
    } catch (e) { showToast(e?.message || "Plot'a eklenemedi."); }
    finally { setSavingTo(null); }
  };

  const saveToNotes = async () => {
    const a = nodeById.get(scenePick.a), b = nodeById.get(scenePick.b);
    const header = a && b ? `🔥 Sahne Kıvılcımı — ${a.name} ↔ ${b.name}` : "🔥 Sahne Kıvılcımı";
    setSavingTo("notes");
    try {
      await apiPost(`/works/${workId}/notes`, { content: `${header}\n\n${sceneIdea}`, source: "sceneSpark" });
      showToast("✅ Notlara kaydedildi!");
      closeSceneIdea();
    } catch (e) { showToast(e?.message || "Notlara kaydedilemedi."); }
    finally { setSavingTo(null); }
  };

  if (loading) return (
    <div className="universe-root" data-theme={theme} style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="universe-loading">Yükleniyor…</div>
    </div>
  );

  return (
    <div className="universe-root" data-theme={theme}>

      {/* ── Topbar ── */}
      <div className="universe-topbar">
        <div className="universe-title">
          <div className="u-title"  data-tour="karakter-baslik">🔍 Karakter Evreni</div>
          <div className="u-sub">Shift + sürükle: bağ kur · Çift tıkla: düzenle</div>
        </div>
        <div className="universe-actions">
          <button className="u-btn" onClick={() => navigate(-1)}>← Geri</button>
          <button className="u-theme-toggle" onClick={toggleTheme}>
            {theme === "dark" ? "☀ Açık" : "🌙 Koyu"}
          </button>
          <button className="u-btn" onClick={createCharacter} data-tour="karakter-ekle-btn">➕ Karakter</button>
          <button
            className={`u-btn ${sceneMode ? "u-btn--on" : ""}`}
            data-tour="karakter-sahne-modu"
            onClick={() => {
              const next = !sceneMode;
              setSceneMode(next);
              if (!next) closeSceneIdea();
              showToast(next ? "🎭 2 karaktere tıkla → sahne kıvılcımı!" : "Sahne Modu kapandı.");
            }
          }
          >
            🎭 {sceneMode ? "Sahne ▶" : "Sahne Modu"}
          </button>
          <button
            className={`u-btn u-btn--destructive ${clearConfirm ? "u-btn--confirm" : ""}`}
            onClick={clearAllEdges}
          >
            {clearConfirm ? "⚠️ Evet, sil" : "🧹 Bağları Temizle"}
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div
        className={`universe-canvas${sceneMode ? " universe-canvas--scene" : ""}`}
        ref={canvasRef}
        onMouseDown={() => { if (relationPickerPos) cancelPicker(); }}
      >
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <defs>
            <filter id="thread-filter" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="3" result="noise" seed="2"/>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G"/>
            </filter>
          </defs>
        </svg>

        {/* İpler */}
        <svg className="edges-layer">
          {edges.map(e => {
            const a    = nodeCenter(e.from);
            const b    = nodeCenter(e.to);
            const c    = typeColor(e.type, customTypes);
            const lbl  = typeLabel(e.type, customTypes);
            const mx   = (a.x + b.x) / 2;
            const my   = (a.y + b.y) / 2 - 35;
            const path = `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
            const sw   = strengthToWidth(e.strength);
            return (
              <g key={e.id} className="edge-group">
                <path d={path} className="edge-shadow" stroke={c} strokeWidth={sw + 3} />
                <path d={path} className="edge-path"   stroke={c} strokeWidth={sw} />
                <text x={mx} y={my - 10} className="edge-label edge-label--type">{lbl}</text>
                {e.label && <text x={mx} y={my + 3} className="edge-label edge-label--custom">{e.label}</text>}
                <circle
                  cx={mx} cy={my} r="5"
                  className="edge-pin" fill={c} opacity=".85"
                  style={{ pointerEvents: "all", cursor: "pointer" }}
                  onClick={ev => { ev.stopPropagation(); removeEdge(e.id); }}
                />
              </g>
            );
          })}
          {isConnecting && connectingFromRef.current && (() => {
            const a  = nodeCenter(connectingFromRef.current);
            const mx = (a.x + connectMouse.x) / 2;
            const my = (a.y + connectMouse.y) / 2 - 20;
            return <path d={`M ${a.x} ${a.y} Q ${mx} ${my} ${connectMouse.x} ${connectMouse.y}`} className="edge-path edge-path--preview" />;
          })()}
        </svg>

        {/* Karakter kartları */}
        {nodes.map((n) => (
          <div
            key={n.id}
            className={[
              "character-node",
              scenePick.a === n.id || scenePick.b === n.id ? "character-node--selected" : "",
              draggingId === n.id ? "character-node--dragging" : "",
            ].filter(Boolean).join(" ")}
            style={{
              left: n.x,
              top:  n.y,
              "--node-color":    n.color,
              "--node-rotation": `${n.rotation ?? 0}deg`,
              zIndex: draggingId === n.id ? 100 : 10,
            }}
            onDoubleClick={e => {
              e.stopPropagation();
              setEditing({ id: n.id, name: n.name, role: n.role, color: n.color, notes: n.notes });
            }}
            onClick={e => {
              e.stopPropagation();
              if (!sceneMode) return;
              setScenePick(p => {
                if (!p.a)         return { a: n.id, b: null };
                if (p.a === n.id) return { a: null, b: null };
                if (!p.b)         { buildSceneIdea(p.a, n.id); return { a: p.a, b: n.id }; }
                return { a: n.id, b: null };
              });
            }}
            onMouseDown={e => onNodeMouseDown(e, n.id)}
            onMouseUp={e   => onNodeMouseUp(e, n.id)}
          >
            <div className="node-name">{n.name}</div>
            <div className="node-role">
              {n.role || <span style={{ opacity: .35, fontStyle: "italic" }}>rol yok</span>}
            </div>
          </div>
        ))}

        {/* İlişki seçici */}
        {relationPickerPos && pendingLink && (
          <div
            className="relation-picker"
            data-tour="karakter-bag-btn"
            style={{
              left: Math.min(relationPickerPos.x + 12, (canvasRef.current?.offsetWidth  || 600) - 255),
              top:  Math.min(relationPickerPos.y + 12, (canvasRef.current?.offsetHeight || 500) - 390),
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="rp-title">
              <span>{nodeById.get(pendingLink.from)?.name} → {nodeById.get(pendingLink.to)?.name}</span>
              <span className="rp-mini">ESC: kapat</span>
            </div>

            {/* Strength */}
            <div className="rp-strength-row">
              <span className="rp-strength-label">Güç</span>
              <input
                type="range" min="1" max="5" step="1"
                value={pickerStrength}
                onChange={e => setPickerStrength(Number(e.target.value))}
                className="rp-slider"
              />
              <span className="rp-strength-val">
                {"●".repeat(pickerStrength)}{"○".repeat(5 - pickerStrength)}
              </span>
            </div>

            {/* Not */}
            <input
              className="rp-custom-input rp-label-input"
              placeholder="Not (opsiyonel)…"
              value={pickerLabel}
              onChange={e => setPickerLabel(e.target.value)}
              maxLength={80}
            />

            {/* Tür listesi */}
            <div className="rp-list">
              {[...DEFAULT_REL_TYPES, ...customTypes].map(t => (
                <button key={t.key} className="rp-item" onClick={() => chooseRelation(t.key)}>
                  <span className="rp-dot" style={{ background: t.color }} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Custom tür */}
            <div className="rp-custom-wrap">
              <input
                type="color" value={customRelColor}
                onChange={e => setCustomRelColor(e.target.value)}
                style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", padding: 0, flexShrink: 0, borderRadius: 4 }}
                title="İp rengi seç"
              />
              <input
                className="rp-custom-input"
                placeholder="Kendi türünü yaz…"
                value={customRelInput}
                onChange={e => setCustomRelInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addCustomRelation(); }}
              />
              <button className="rp-custom-btn" onClick={addCustomRelation}>Ekle</button>
            </div>

            <button className="rp-cancel" onClick={() => { cancelPicker(); resetPickerExtras(); }}>Vazgeç</button>
          </div>
        )}

        {/* Karakter editörü */}
        {editing && (
          <div className="char-editor-overlay" onMouseDown={() => setEditing(null)}>
            <div className="char-editor" onMouseDown={e => e.stopPropagation()}>
              <div className="ce-title">Karakteri Düzenle</div>
              <label className="ce-label">İsim</label>
              <input className="ce-input" value={editing.name}
                onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder="Karakter adı" />
              <label className="ce-label">Rol / Arketip</label>
              <input className="ce-input" value={editing.role}
                onChange={e => setEditing(p => ({ ...p, role: e.target.value }))} placeholder="Örn: Anti-hero, Akıl Hocası…" />
              <label className="ce-label">Renk</label>
              <div className="ce-row">
                <input className="ce-color" type="color" value={editing.color}
                  onChange={e => setEditing(p => ({ ...p, color: e.target.value }))} />
                <input className="ce-input" value={editing.color}
                  onChange={e => setEditing(p => ({ ...p, color: e.target.value }))} placeholder="#7dd3fc" />
              </div>
              <label className="ce-label">Notlar</label>
              <textarea className="ce-textarea" rows={4} value={editing.notes}
                onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))}
                placeholder="Motivasyonlar, korkular, sırlar…" />
              <div className="ce-actions">
                <button className="ce-btn ce-btn--danger"  onClick={() => removeCharacter(editing.id)}>Sil</button>
                <button className="ce-btn ce-btn--ghost"   onClick={runChaos} data-tour="karakter-detay-btn">✨ Derinleştir</button>
                <button className="ce-btn ce-btn--ghost"   onClick={() => setEditing(null)}>İptal</button>
                <button className="ce-btn ce-btn--primary" onClick={saveEditor}>Kaydet</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Sahne Kıvılcımı ── */}
      {sceneIdea && (
        <div className="scene-overlay" onMouseDown={closeSceneIdea}>
          <div className="scene-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="scene-head">
              <span className="scene-title">✨ Sahne Kıvılcımı</span>
              <button className="scene-close" onClick={closeSceneIdea}>✕</button>
            </div>
            <div className="scene-body">
              <pre className="scene-pre">{sceneIdea}</pre>
            </div>
            <div className="scene-actions">
              <button className="s-btn s-btn--primary" onClick={saveToPlot} disabled={savingTo === "plot"}>
                {savingTo === "plot" ? "Ekleniyor…" : "📌 Plot'a Ekle"}
              </button>
              <button className="s-btn s-btn--gold" onClick={saveToNotes} disabled={savingTo === "notes"}>
                {savingTo === "notes" ? "Kaydediliyor…" : "📝 Notlara Kaydet"}
              </button>
              <button className="s-btn s-btn--ghost" onClick={() => { closeSceneIdea(); setSceneMode(false); }}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div key={toast.key} className={`universe-toast${toast.leaving ? " universe-toast--out" : ""}`}>
          {toast.msg}
        </div>
      )}

      <div className="universe-hint">
        <b>Shift</b> + sürükle → bağ kur &nbsp;·&nbsp; Çift tık → düzenle &nbsp;·&nbsp; İğneye tıkla → bağı sil
      </div>
    </div>
  );
}