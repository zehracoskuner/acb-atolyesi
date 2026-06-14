import {
  useState, useEffect, useCallback, useRef, useMemo, useReducer,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, MarkerType, Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { apiGet, apiPatch, apiPost, apiDelete } from "../lib/api";
import {
  CHAR_PALETTE, VOLUME_META,
  STRUCTURE_TEMPLATES, DEFAULT_TEMPLATE,
  buildActMeta, buildActOrder, calcTotalPages,
} from "../components/plotworld/constants";
import {
  layoutScenes, buildEdges,
  resolveCharIds, resolveCharNames,
} from "../components/plotworld/utils";
import SceneNode           from "../components/plotworld/SceneNode";
import DetailPanel         from "../components/plotworld/DetailPanel";
import SceneModal          from "../components/plotworld/SceneModal";
import PlotDrawArea        from "../components/plotworld/PlotDrawArea";
import CharacterArcPanel   from "../components/plotworld/CharacterArcPanel";
import StructureSetupModal from "../components/plotworld/StructureSetupModal";
import ButterflyModal      from "../components/plotworld/ButterflyModal";
import WorldEntryModal     from "../components/plotworld/WorldEntryModal";
import CausalEdge       from "../components/plotworld/CausalEdge";
import EdgeTypeSelector from "../components/plotworld/EdgeTypeSelector";
import { EDGE_TYPES as EDGE_TYPE_META, DEFAULT_EDGE_TYPE } from "../components/plotworld/constants";
import "../components/plotworld/SceneNode.css";
import "../components/plotworld/EdgeTypeSelector.css";
import AiAnalysisPanel    from "../components/plotworld/AiAnalysisPanel";

import "../styles/PlotWorldPage.css";
import "../components/plotworld/StructureSetupModal.css";
import "../styles/PlotWorldAiStyles.css";

/* ─── Sabitler ──────────────────────────────────────────── */
const NODE_TYPES = { sceneNode: SceneNode };
const EDGE_TYPES_MAP = { causal: CausalEdge };  

const WORLD_CATEGORIES = ["locations", "timeline", "rules", "notes"];

const SIDE_TABS = [
  { key: "characters", label: "Karakterler" },
  { key: "rules",      label: "Evren" },
  { key: "notes",      label: "Notlar" },
];

const MAIN_TABS = [
  { key: "plot", label: "Plot Board" },
  { key: "draw", label: "Çizim Alanı" },
  { key: "arc",  label: "Karakter Arkı" },
];

const WORLD_CAT_BY_TAB = { rules: "rules", notes: "notes" };

/* ─── Toast Reducer ─────────────────────────────────────── */
const toastReducer = (state, action) => {
  switch (action.type) {
    case "ADD":    return [...state, { id: Date.now(), ...action.payload }];
    case "REMOVE": return state.filter(t => t.id !== action.id);
    default:       return state;
  }
};

/* ─── Modal State Helpers ───────────────────────────────── */
const createAddModal    = (act, prefill = null) => ({ mode: "add",       act, prefill });
const createEditModal   = (node)                 => ({ mode: "edit",      node });
const createEntryModal  = (category)             => ({ mode: "add_entry", category });

/* ══════════════════════════════════════════════════════════
   TOAST BİLEŞENİ
══════════════════════════════════════════════════════════ */
function Toast({ toasts, dispatch }) {
  if (!toasts.length) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            padding: "10px 16px", borderRadius: 8, fontSize: 13,
            background: t.type === "error" ? "#fee2e2" : "#d1fae5",
            color:      t.type === "error" ? "#991b1b" : "#065f46",
            boxShadow:  "0 2px 8px rgba(0,0,0,.12)",
            animation:  "slideInRight .2s ease",
            pointerEvents: "auto",
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SIDEBAR İTEM BİLEŞENİ
══════════════════════════════════════════════════════════ */
function CharacterItem({ char, index, isActive, sceneCount, isDraggable, onToggleFilter }) {
  const color = char.color || CHAR_PALETTE[index % CHAR_PALETTE.length];
  const cId   = String(char._id);

  return (
    <div
      role={isDraggable ? undefined : "button"}
      aria-pressed={!isDraggable ? isActive : undefined}
      tabIndex={0}
      className={[
        "pw-sitem",
        !isDraggable && "pw-sitem--btn",
        isActive && "pw-sitem--active",
        isDraggable && "pw-sitem--draggable",
      ].filter(Boolean).join(" ")}
      onClick={() => !isDraggable && onToggleFilter(cId)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") !isDraggable && onToggleFilter(cId); }}
      draggable={isDraggable}
      onDragStart={e => {
        e.dataTransfer.setData("application/character", JSON.stringify({
          charId: cId, name: char.name, color, role: char.role || "",
        }));
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <span className="pw-sdot" style={{ background: color }} />
      <div className="pw-sitem-body">
        <div className="pw-sname">{char.name}</div>
        <div className="pw-ssub">{char.role || "—"}</div>
      </div>
      <span className="pw-sitem-count" aria-label={`${sceneCount} sahne`}>
        {sceneCount || ""}
      </span>
      {isActive && !isDraggable && (
        <span className="pw-sitem-filter-icon" aria-hidden="true">⊙</span>
      )}
      {isDraggable && (
        <span className="pw-sitem-drag-icon" aria-hidden="true">⠿</span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   WORLD ENTRY İTEM BİLEŞENİ
══════════════════════════════════════════════════════════ */
function WorldEntryItem({ item, dotColor, onDelete }) {
  return (
    <div className="pw-sitem" style={{ position: "relative" }}>
      <span className="pw-sdot" style={{ background: dotColor }} />
      <div style={{ flex: 1, paddingRight: 24 }}>
        <div className="pw-sname">{item.name}</div>
        {item.description && (
          <div className="pw-ssub">
            {item.description.length > 55
              ? `${item.description.slice(0, 55)}…`
              : item.description}
          </div>
        )}
      </div>
      <button
        className="pw-delete-btn"
        aria-label={`${item.name} sil`}
        title="Sil"
        onClick={() => onDelete(item._id)}
      >
        ✕
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SAHNE ARAMA KUTUSU
══════════════════════════════════════════════════════════ */
function SceneSearch({ value, onChange }) {
  return (
    <div className="pw-search">
      <span className="pw-search-icon" aria-hidden="true">⌕</span>
      <input
        type="search"
        placeholder="Sahne ara…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pw-search-input"
        aria-label="Sahne ara"
      />
      {value && (
        <button
          className="pw-search-clear"
          aria-label="Aramayı temizle"
          onClick={() => onChange("")}
        >
          ×
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ANA BİLEŞEN
══════════════════════════════════════════════════════════ */
export default function PlotWorldPage() {
  const { workId } = useParams();
  const navigate   = useNavigate();

  /* —— Temel veri —— */
  const [worldData,    setWorldData]    = useState(null);
  const [characters,   setCharacters]   = useState([]);
  const [characterMap, setCharacterMap] = useState({});
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [workTitle, setWorkTitle] = useState("");



  /* —— ReactFlow —— */
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  /* —— Yapı —— */
  const [structure,          setStructure]          = useState(null);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [showGapPanel,       setShowGapPanel]       = useState(false);

  /* —— UI —— */
  const [activeMain,   setActiveMain]   = useState("plot");
  const [sideTab,      setSideTab]      = useState("characters");
  const [selectedNode, setSelectedNode] = useState(null);
  const [modal,        setModal]        = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [pendingEdge,  setPendingEdge]  = useState(null); 

  /* —— Filtreler —— */
  const [filterCharId, setFilterCharId] = useState(null);
  const [filterActId,  setFilterActId]  = useState(null);
  const [sceneSearch,  setSceneSearch]  = useState("");

  /* —— Butterfly —— */
  const [butterflyNode, setButterflyNode] = useState(null);

  /* —— Bağlantı modu (sadece ref yeterli + UI state) —— */
  const [connecting,  setConnecting]  = useState(false);
  const [connectFrom, setConnectFrom] = useState(null);
  const connectingRef                 = useRef(false);

  /* —— Toast —— */
  const [toasts, dispatchToast] = useReducer(toastReducer, []);

  /* ── Toast helpers ── */
  const toast = useCallback((message, type = "success") => {
    const id = Date.now();
    dispatchToast({ type: "ADD", payload: { message, type } });
    setTimeout(() => dispatchToast({ type: "REMOVE", id }), 3500);
  }, []);

  /* ── Dinamik akt meta/order ── */
  const actOrder = useMemo(
    () => structure ? buildActOrder(structure.acts) : [],
    [structure],
  );

  const actMeta = useMemo(
    () => structure ? buildActMeta(structure.acts) : [],
    [structure],
  );

  /* ── Toplam sayfa tahmini ── */
  const totalPages = useMemo(() => calcTotalPages(nodes), [nodes]);

  /* ══════════════════════════════════════════════════════
     KLAVYE KISAYOLLARI
  ══════════════════════════════════════════════════════ */
  useEffect(() => {
    function handleKey(e) {
      // Escape — kapat / iptal
      if (e.key === "Escape") {
        if (connecting)        { stopConnect();      return; }
        if (modal)             { !saving && setModal(null); return; }
        if (butterflyNode)     { setButterflyNode(null); return; }
        if (selectedNode)      { setSelectedNode(null); return; }
        if (filterCharId || filterActId) {
          setFilterCharId(null);
          setFilterActId(null);
          return;
        }
      }
      // Ctrl/Cmd + F — arama odağı
      if ((e.ctrlKey || e.metaKey) && e.key === "f" && activeMain === "plot") {
        e.preventDefault();
        document.querySelector(".pw-search-input")?.focus();
      }
      // Ctrl/Cmd + Enter — yeni sahne
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && activeMain === "plot" && !modal) {
        e.preventDefault();
        setModal(createAddModal(filterActId || actOrder[0]));
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [connecting, modal, saving, butterflyNode, selectedNode,
      filterCharId, filterActId, activeMain, actOrder]);

  /* ══════════════════════════════════════════════════════
     VERİ YÜKLE
  ══════════════════════════════════════════════════════ */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [worldRes, plotRes, charRes, workRes] = await Promise.all([
          apiGet(`/world/${workId}`),
          apiGet(`/plots/${workId}`),
          apiGet(`/characters?workId=${workId}`),
          apiGet(`/works/${workId}`),
        ]);
        if (cancelled) return;

        setWorldData(worldRes);

        const chars = charRes.items || [];
        const cMap  = Object.fromEntries(chars.map(c => [String(c._id), c]));
        setCharacters(chars);
        setCharacterMap(cMap);
        setWorkTitle(workRes?.item?.title || "");

        /* Yapı çözümleme */
        const savedStructure = worldRes?.world?.structure;
        let currentStructure;
        let currentActOrder;

        if (savedStructure?.acts?.length) {
          currentStructure = savedStructure;
          currentActOrder  = buildActOrder(savedStructure.acts);
        } else {
          const defaultActs = STRUCTURE_TEMPLATES[DEFAULT_TEMPLATE].acts;
          currentStructure  = { templateId: DEFAULT_TEMPLATE, acts: defaultActs };
          currentActOrder   = buildActOrder(defaultActs);
          setShowStructureModal(true);
        }
        setStructure(currentStructure);

        /* Sahneleri çözümle (yeni flat format + eski nested fallback) */
        let scenes = [];
        if (plotRes.plot?.scenes?.length > 0) {
          scenes = plotRes.plot.scenes.map(s => ({
            ...s,
            act: s.act || currentActOrder[0],
          }));
        } else {
          const allActs = plotRes.plot?.acts || {};
          const ACT_MAP = {
            beginning: currentActOrder[0] || "giris",
            middle:    currentActOrder[1] || "gelisme",
            end:       currentActOrder[2] || "sonuc",
          };
          scenes = Object.entries(allActs).flatMap(([key, arr]) => {
            const act = ACT_MAP[key] || key;
            return (arr || []).map(s => ({ ...s, act }));
          });
        }

        const newNodes = layoutScenes(scenes, cMap, currentActOrder);
        const newEdges = buildEdges(scenes);
        setNodes(newNodes);
        setEdges(newEdges);
      } catch (err) {
        if (!cancelled) {
          console.error("Veri yükleme hatası:", err);
          setError("Veriler yüklenemedi. Lütfen tekrar deneyin.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [workId]);

useEffect(() => {
  window.__acbTourTrigger = window.__acbTourTrigger || {};
  window.__acbTourTrigger.openDrawTab = () => setActiveMain("draw");
  window.__acbTourTrigger.openArcTab  = () => setActiveMain("arc");
  return () => {
    delete window.__acbTourTrigger.openDrawTab;
    delete window.__acbTourTrigger.openArcTab;
  };
}); // dependency array YOK

  /* ══════════════════════════════════════════════════════
     STABLE CALLBACKS (node action'ları için)
     — displayNodes'ta closure yerine useCallback + nodeId
  ══════════════════════════════════════════════════════ */
  const handleEditRequest = useCallback((nodeId) => {
    setNodes(prev => {
      const n = prev.find(x => x.id === nodeId);
      if (n) setModal(createEditModal(n));
      return prev;
    });
  }, []);

  const handleButterflyRequest = useCallback((nodeId) => {
    setNodes(prev => {
      const n = prev.find(x => x.id === nodeId);
      if (n) setButterflyNode(n);
      return prev;
    });
  }, []);

  const handleConnectRequest = useCallback((nodeId) => {
    startConnectFrom(nodeId);
  }, []); // eslint-disable-line

  const handleDeleteSceneById = useCallback(async (nodeId) => {
    // Optimistic update
    const prevNodes = nodes;
    const prevEdges = edges;
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(prev => prev?.id === nodeId ? null : prev);

    try {
      await apiDelete(`/plots/${workId}/scenes/${nodeId}`);
      toast("Sahne silindi.");
    } catch {
      // Rollback
      setNodes(prevNodes);
      setEdges(prevEdges);
      toast("Sahne silinemedi.", "error");
    }
  }, [workId, nodes, edges, toast]);

  /* ══════════════════════════════════════════════════════
     DISPLAY NODES — filtre + stabil callback referansları
  ══════════════════════════════════════════════════════ */
  // PlotWorldPage.jsx — displayNodes useMemo'yu bununla değiştir

const displayNodes = useMemo(() => {
  const searchLower = sceneSearch.toLowerCase();

  return nodes.map(n => {
    const inActFilter    = !filterActId  || n.data.act === filterActId;
    const inCharFilter   = !filterCharId || (n.data.charIds || []).includes(filterCharId);
    const inSearchFilter = !sceneSearch  ||
      (n.data.label || "").toLowerCase().includes(searchLower) ||
      (n.data.goal  || "").toLowerCase().includes(searchLower) ||
      (n.data.desc  || "").toLowerCase().includes(searchLower);

    const visible  = inActFilter && inCharFilter && inSearchFilter;
    const actColor = actMeta[n.data.act]?.color || "#888";
    const actLabel = actMeta[n.data.act]?.label || n.data.act || "—";

    const charDots = (n.data.charIds || [])
      .map(id => {
        const c = characterMap[id];
        if (!c) return null;
        const idx = characters.findIndex(x => String(x._id) === id);
        return { name: c.name, color: c.color || CHAR_PALETTE[idx % CHAR_PALETTE.length] || "#94a3b8" };
      })
      .filter(Boolean);

    const connOut = edges.filter(e => e.source === n.id).length;
    const connIn  = edges.filter(e => e.target === n.id).length;

    return {
      ...n,
      data: {
        ...n.data,
        actColor,
        actLabel,
        charDots,
        connOut,
        connIn,
        dimmed:      !visible,
        highlighted: visible && (!!filterActId || !!filterCharId || !!sceneSearch),
        onEdit:      () => handleEditRequest(n.id),
        onConnect:   () => handleConnectRequest(n.id),
        onButterfly: () => handleButterflyRequest(n.id),
        onDelete:    () => handleDeleteSceneById(n.id),
      },
    };
  });
}, [
  nodes, edges, filterCharId, filterActId, sceneSearch, actMeta,
  characterMap, characters,
  handleEditRequest, handleConnectRequest, handleButterflyRequest, handleDeleteSceneById,
]);

  /* ══════════════════════════════════════════════════════
     REACT FLOW HANDLERS
  ══════════════════════════════════════════════════════ */
const onConnect = useCallback(({ source, target }) => {
  if (source === target) return;
  setPendingEdge({ source, target });
}, []);

  const onEdgesDelete = useCallback(async (deleted) => {
    const results = await Promise.allSettled(
      deleted.map(edge =>
        apiPatch(`/plots/${workId}/scenes/${edge.source}/disconnect`, { targetId: edge.target })
      )
    );
    const failed = results.filter(r => r.status === "rejected");
    if (failed.length) {
      toast(`${failed.length} bağlantı kaldırılamadı.`, "error");
    }
  }, [workId, toast]);
  const onNodesDelete = useCallback((deleted) => {
    deleted.forEach(n => {
      if (n.type === "sceneNode") handleDeleteSceneById(n.id);
    });
  }, [handleDeleteSceneById]);

const onNodeClick = useCallback((_, node) => {
  if (node.type !== "sceneNode") return;

  if (connectingRef.current && connectFrom && connectFrom !== node.id) {
    onConnect({ source: connectFrom, target: node.id });
    stopConnect();
    return;
  }

  const rawNode = nodes.find(n => n.id === node.id) || node;
  const resolvedChars = (rawNode.data.charIds || [])
    .map(id => characterMap[id]?.name)
    .filter(Boolean);

  setSelectedNode({
    ...rawNode,
    data: {
      ...rawNode.data,
      chars: resolvedChars,
    },
  });
}, [connectFrom, onConnect, nodes, characterMap]);  

  const onNodeDragStop = useCallback(async (_, node) => {
    if (node.type !== "sceneNode") return;

    // Perde ARTIK konumdan türetilmiyor — sürükleme yalnızca pozisyonu kaydeder.
    try {
      await apiPatch(`/plots/${workId}/scenes/${node.id}`, {
        position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
      });
    } catch {
      console.warn("Pozisyon kaydedilemedi:", node.id);
    }
  }, [workId]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    if (connecting) stopConnect();
  }, [connecting]);

  /* ══════════════════════════════════════════════════════
     BAĞLANTI MODU
  ══════════════════════════════════════════════════════ */
  function startConnectFrom(nodeId) {
    setConnectFrom(nodeId);
    setConnecting(true);
    connectingRef.current = true;
    setSelectedNode(null);
  }

  function stopConnect() {
    setConnecting(false);
    setConnectFrom(null);
    connectingRef.current = false;
  }

  /* ══════════════════════════════════════════════════════
     YAPI KAYDET
  ══════════════════════════════════════════════════════ */
  async function handleStructureSave(templateId, acts) {
    const newStructure = { templateId, acts };
    setStructure(newStructure);
    setShowStructureModal(false);
    try {
      await apiPatch(`/world/${workId}`, { structure: newStructure });
      toast("Perde yapısı kaydedildi.");
    } catch {
      toast("Yapı kaydedilemedi.", "error");
    }
  }

  /* ══════════════════════════════════════════════════════
     CRUD — SAHNE
  ══════════════════════════════════════════════════════ */
  async function handleAddScene(formData) {
    setSaving(true);
    try {
      const res = await apiPost(`/plots/${workId}/scenes`, {
        act:           formData.act,
        title:         formData.title,
        goal:          formData.goal          || "",
        volume:        formData.volume        || "",
        isAlternative: formData.isAlternative || false,
        description:   formData.description   || "",
        status:        formData.status        || "idea",
        characters:    formData.charIds       || [],
      });

      const newScene = { ...res.scene, act: formData.act };
      const actIdx   = actOrder.indexOf(formData.act);
      const sameActN = nodes.filter(n => n.data.act === formData.act).length;
      const actColor = actMeta[formData.act]?.color || "#888";

      setNodes(prev => [
        ...prev,
        {
          id:       String(newScene._id),
          type:     "sceneNode",
          position: { x: actIdx * 300 + 60, y: sameActN * 170 + 60 },
          data: {
            label:         newScene.title,
            goal:          newScene.goal          || formData.goal     || "",
            volume:        newScene.volume        || formData.volume   || "",
            isAlternative: newScene.isAlternative || formData.isAlternative || false,
            chapter:       newScene.chapter       || "",
            time:          newScene.time          || "",
            charIds:       formData.charIds       || [],
            chars:         (formData.charIds || [])
              .map(id => characterMap[id]?.name)
              .filter(Boolean),
            act:     formData.act,
            actColor,
            status:  newScene.status || formData.status || "idea",
            desc:    newScene.description || "",
            raw:     newScene,
          },
        },
      ]);

      setModal(null);
      toast(`"${newScene.title}" sahnesi eklendi.`);
    } catch {
      toast("Sahne eklenemedi.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditScene(formData) {
    if (!modal?.node) return;
    const nodeId = modal.node.id;
    setSaving(true);

    // Optimistic update
    const prevNodes = nodes;

    try {
      const res = await apiPatch(`/plots/${workId}/scenes/${nodeId}`, {
        title:         formData.title,
        goal:          formData.goal          || "",
        volume:        formData.volume        || "",
        isAlternative: formData.isAlternative || false,
        description:   formData.description   || "",
        status:        formData.status,
        characters:    formData.charIds,
        act:           formData.act,
      });

      const rawChars    = res.scene.characters || [];
      const updatedData = {
        label:         res.scene.title,
        goal:          res.scene.goal          || formData.goal     || "",
        volume:        res.scene.volume        || formData.volume   || "",
        isAlternative: res.scene.isAlternative || formData.isAlternative || false,
        chapter:       res.scene.chapter       || "",
        time:          res.scene.time          || "",
        charIds: rawChars.length
          ? resolveCharIds(rawChars)
          : formData.charIds,
        chars: rawChars.length
          ? resolveCharNames(rawChars, characterMap)
          : (formData.charIds || []).map(id => characterMap[id]?.name).filter(Boolean),
        status:  res.scene.status,
        desc:    res.scene.description || "",
        act:     res.scene.act,
        actColor: actMeta[res.scene.act]?.color || "#888",
        raw:     res.scene,
      };

      setNodes(prev => prev.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...updatedData } } : n
      ));
      setSelectedNode(prev =>
        prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...updatedData } } : prev
      );

      setModal(null);
      toast(`"${formData.title}" güncellendi.`);
    } catch {
      setNodes(prevNodes);
      toast("Sahne güncellenemedi.", "error");
    } finally {
      setSaving(false);
    }
  }

  /* ══════════════════════════════════════════════════════
     CRUD — DÜNYA GİRİŞLERİ
  ══════════════════════════════════════════════════════ */
  async function handleAddWorldEntry(formData) {
    setSaving(true);
    try {
      const res = await apiPost(`/world/${workId}/entries`, formData);
      const { entry, category } = res;

      setWorldData(prev => ({
        ...prev,
        world: {
          ...prev.world,
          [category]: [...(prev.world[category] || []), entry],
        },
      }));

      setModal(null);
      toast(`"${entry.name}" eklendi.`);
    } catch {
      toast("Giriş eklenemedi.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWorldEntry(entryId) {
    if (!window.confirm("Bu girişi silmek istediğine emin misin?")) return;

    // Optimistic update
    const prevWorldData = worldData;
    setWorldData(prev => {
      const newWorld = { ...prev.world };
      WORLD_CATEGORIES.forEach(cat => {
        if (newWorld[cat]) {
          newWorld[cat] = newWorld[cat].filter(e => e._id !== entryId);
        }
      });
      return { ...prev, world: newWorld };
    });

    try {
      await apiDelete(`/world/${workId}/entries/${entryId}`);
      toast("Giriş silindi.");
    } catch {
      setWorldData(prevWorldData);
      toast("Giriş silinemedi.", "error");
    }
  }

  async function handleEdgeTypeSelect(edgeType) {
  if (!pendingEdge) return;
  const { source, target } = pendingEdge;
  setPendingEdge(null);
 
  const resolvedType = edgeType || DEFAULT_EDGE_TYPE;
  const et = EDGE_TYPE_META[resolvedType] || EDGE_TYPE_META[DEFAULT_EDGE_TYPE];
 
  const newEdge = {
    id:        `e-${source}-${target}`,
    source,
    target,
    type:      "causal",
    data:      { edgeType: resolvedType },
    markerEnd: { type: MarkerType.ArrowClosed, color: et.color },
    style:     { stroke: `${et.color}99`, strokeWidth: 1.5 },
  };
 
  setEdges(eds => addEdge(newEdge, eds));
 
  try {
    await apiPatch(`/plots/${workId}/scenes/${source}/connect`, {
      targetId: target,
      edgeType: resolvedType,
    });
  } catch {
    setEdges(eds => eds.filter(e => e.id !== newEdge.id));
    toast("Bağlantı kurulamadı.", "error");
  }
}

  /* ══════════════════════════════════════════════════════
     YARDIMCILAR
  ══════════════════════════════════════════════════════ */
  const connCounts = useCallback((id) => ({
    out: edges.filter(e => e.source === id).length,
    in:  edges.filter(e => e.target === id).length,
  }), [edges]);

  const charSceneCount = useCallback(
    (charId) => nodes.filter(n => (n.data.charIds || []).includes(charId)).length,
    [nodes],
  );

  const actSceneCount = useCallback(
    (actId) => nodes.filter(n => n.data.act === actId).length,
    [nodes],
  );

  const toggleCharFilter = useCallback((charId) => {
    setFilterCharId(prev => prev === charId ? null : charId);
    setSelectedNode(null);
  }, []);

  const toggleActFilter = useCallback((actId) => {
    setFilterActId(prev => prev === actId ? null : actId);
    setSelectedNode(null);
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilterActId(null);
    setFilterCharId(null);
    setSceneSearch("");
  }, []);

  const world = worldData?.world;

  /* ══════════════════════════════════════════════════════
     SIDEBAR İÇERİK
  ══════════════════════════════════════════════════════ */
  function renderSideContent() {
    /* Karakterler sekmesi */
    if (sideTab === "characters") {
      if (!characters.length) {
        return (
          <p className="pw-empty-text">
            Henüz karakter eklenmemiş.
          </p>
        );
      }
      const isDraggable = activeMain === "draw";
      return (
        <>
          <div className="pw-section-label">Ana Karakterler</div>
          {characters.map((c, i) => (
            <CharacterItem
              key={String(c._id)}
              char={c}
              index={i}
              isActive={filterCharId === String(c._id)}
              sceneCount={charSceneCount(String(c._id))}
              isDraggable={isDraggable}
              onToggleFilter={toggleCharFilter}
            />
          ))}
          {filterCharId && (
            <button
              className="pw-filter-clear"
              onClick={() => setFilterCharId(null)}
            >
              × Filtreyi Kaldır
            </button>
          )}
        </>
      );
    }

    /* Evren / Notlar sekmeleri */
    const category = WORLD_CAT_BY_TAB[sideTab];
    if (!category) return null;

    const items    = world?.[category] || [];
    const dotColor = sideTab === "rules" ? "#0891b2" : "#8b5cf6";

    if (!items.length) {
      return <p className="pw-empty-text">Henüz giriş eklenmemiş.</p>;
    }

    return items.map(item => (
      <WorldEntryItem
        key={item._id}
        item={item}
        dotColor={dotColor}
        onDelete={handleDeleteWorldEntry}
      />
    ));
  }

  /* ══════════════════════════════════════════════════════
     LOADING / ERROR
  ══════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="pw-loading" role="status" aria-label="Hikaye evreni yükleniyor">
        <div className="pw-loading-ring">
          <div /><div /><div /><div />
        </div>
        <span className="pw-loading-text">Hikaye evreni yükleniyor…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pw-error" role="alert">
        <div className="pw-error-icon" aria-hidden="true">⚠</div>
        <div className="pw-error-msg">{error}</div>
        <button
          className="pw-btn pw-btn--ghost"
          onClick={() => window.location.reload()}
        >
          Yeniden Dene
        </button>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  const hasActiveFilters = filterCharId || filterActId || sceneSearch;

  return (
    <div className="pw-root">

      {/* ─── TOAST ─── */}
      <Toast toasts={toasts} dispatch={dispatchToast} />

      {/* ─── SOL PANEL ─── */}
      <aside className="pw-sidebar" aria-label="Yan panel">

        <div className="pw-sidebar-header">
          <div className="pw-world-eyebrow">Olay Örgüsü · Dünya</div>
          {workTitle && (
            <div className="pw-work-title">{workTitle}</div>
          )}
          <div className="pw-world-title"
          data-tour="plotworld-baslik">{world?.title || "Hikaye Evreni"}</div>
          <div className="pw-world-stats">
            <span className="pw-stat">
              <span className="pw-stat-n">{nodes.length}</span> sahne
            </span>
            <span className="pw-stat-sep">·</span>
            <span className="pw-stat">
              <span className="pw-stat-n">{characters.length}</span> karakter
            </span>
            {totalPages > 0 && (
              <>
                <span className="pw-stat-sep">·</span>
                <span className="pw-stat">
                  <span className="pw-stat-n">~{totalPages}</span> sayfa
                </span>
              </>
            )}
          </div>
        </div>

        {/* Perde filtre sekmeleri */}
        <nav className="pw-act-tabs" 
        data-tour="plotworld-perde-yapi"
        aria-label="Perde filtresi">
          <button
            className={`pw-act-tab ${!filterActId ? "pw-act-tab--all" : ""}`}
            aria-pressed={!filterActId}
            onClick={() => { setFilterActId(null); setSelectedNode(null); }}
          >
            Tümü
          </button>
          {actOrder.map(actId => {
            const meta     = actMeta[actId] || {};
            const isActive = filterActId === actId;
            return (
              <button
                key={actId}
                className={`pw-act-tab ${isActive ? "pw-act-tab--active" : ""}`}
                aria-pressed={isActive}
                style={isActive ? { borderBottomColor: meta.color, color: meta.color } : {}}
                onClick={() => toggleActFilter(actId)}
              >
                <span
                  className="pw-act-tab-dot"
                  style={{ background: meta.color }}
                  aria-hidden="true"
                />
                {meta.label}
                <span className="pw-act-tab-cnt" aria-label={`${actSceneCount(actId)} sahne`}>
                  {actSceneCount(actId)}
                </span>
              </button>
            );
          })}
        </nav>

        {/* İçerik sekmeleri */}
        <nav className="pw-stabs" role="tablist" aria-label="Sidebar sekmeleri">
          {SIDE_TABS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={sideTab === key}
              className={`pw-stab ${sideTab === key ? "pw-stab--active" : ""}`}
              onClick={() => setSideTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="pw-sidebar-body" role="tabpanel">
          {renderSideContent()}
        </div>

        {/* Footer butonları */}
        {sideTab === "characters" && (
          <>
            <button
              className="pw-structure-btn"
              aria-label="Perde yapısını düzenle"
              onClick={() => setShowStructureModal(true)}
            >
              ◈ {STRUCTURE_TEMPLATES[structure?.templateId]?.label || "Perde Yapısı"}
            </button>
            <button
              className="pw-add-btn"
              onClick={() => navigate(`/work/${workId}/characters`)}
            >
              + karakter ekle
            </button>
          </>
        )}

        {sideTab !== "characters" && (
          <button
            className="pw-add-btn"
            onClick={() => setModal(createEntryModal(WORLD_CAT_BY_TAB[sideTab]))}
          >
            + {sideTab === "rules" ? "yeni kural" : "yeni not"} ekle
          </button>
        )}

        {/* Gösterge */}
        <div className="pw-legend" aria-label="Renk göstergesi">
          <div className="pw-legend-title">Gösterge</div>
          {Object.entries(actMeta).map(([act, meta]) => (
            <div key={act} className="pw-legend-item">
              <span
                className="pw-legend-dot"
                style={{ background: meta.color }}
                aria-hidden="true"
              />
              <span className="pw-legend-label">
                {meta.roman ? `${meta.roman}. Perde — ` : ""}{meta.label}
              </span>
            </div>
          ))}
          <div className="pw-legend-item">
            <span className="pw-legend-dot" style={{ background: "#ca8a04" }} aria-hidden="true" />
            <span className="pw-legend-label">Alternatif Dal</span>
          </div>
          <div className="pw-legend-item">
            <span className="pw-legend-line" aria-hidden="true" />
            <span className="pw-legend-label">Nedensellik bağı</span>
          </div>
          <div className="pw-legend-item">
            <span className="pw-legend-dash" aria-hidden="true" />
            <span className="pw-legend-label">Alternatif bağlantı</span>
          </div>
        </div>

        {/* Klavye ipuçları */}
        <div className="pw-keyboard-hints" aria-label="Klavye kısayolları">
          <div className="pw-hint"><kbd>Esc</kbd> Kapat/İptal</div>
          <div className="pw-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> Yeni sahne</div>
          <div className="pw-hint"><kbd>Ctrl</kbd>+<kbd>F</kbd> Ara</div>
          <div className="pw-hint"><kbd>Del</kbd> Seçili öğeyi sil</div>
        </div>
      </aside>

      {/* ─── SAĞ ALAN ─── */}
      <div className="pw-main">

        {/* Tab bar */}
        <nav className="pw-tabbar" role="tablist" aria-label="Ana görünüm sekmeleri">
          {MAIN_TABS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeMain === key}
              className={`pw-mtab ${activeMain === key ? "pw-mtab--active" : ""}`}
              onClick={() => setActiveMain(key)}
              data-tour={key === "arc" ? "plotworld-ark-btn" : undefined}
            >
              {label}
            </button>
          ))}

          <button
            className={`pw-mtab pw-mtab--ai ${showGapPanel ? "pw-mtab--ai-active" : ""}`}
            data-tour="plotworld-ai-btn"
            aria-pressed={showGapPanel}
            aria-label="AI Analiz"
            onClick={() => setShowGapPanel(prev => !prev)}
          >
            {showGapPanel ? "× Kapat" : "✦ AI Analiz"}
          </button>

          {/* Arama — sadece plot board'da */}
          {activeMain === "plot" && (
            <SceneSearch value={sceneSearch} onChange={setSceneSearch} />
          )}

          <button
            className="pw-mtab pw-mtab--action"
            data-tour="plotworld-sahne-ekle"
            aria-label="Yeni sahne ekle (Ctrl+Enter)"
            onClick={() => setModal(createAddModal(filterActId || actOrder[0]))}
          >
            + Sahne
          </button>
        </nav>

        {/* AI Analiz Paneli */}
        {showGapPanel && activeMain === "plot" && (
          <AiAnalysisPanel
            nodes={nodes}
            actOrder={actOrder}
            actMeta={actMeta}
            characters={characters}
            workId={workId}
            onAddScene={(actId, suggestion) => {
              setModal(createAddModal(actId, {
                title: suggestion.title,
                goal:  suggestion.goal,
              }));
            }}
            onClose={() => setShowGapPanel(false)}
          />
        )}

        {/* Aktif filtre banner */}
        {hasActiveFilters && activeMain === "plot" && (
          <div className="pw-filter-banner" role="status" aria-live="polite">
            {filterActId && (
              <>
                <span
                  className="pw-filter-dot"
                  style={{ background: actMeta[filterActId]?.color }}
                  aria-hidden="true"
                />
                <strong>{actMeta[filterActId]?.label} Perdesi</strong>
                &nbsp;·&nbsp;
                {actSceneCount(filterActId)} sahne
              </>
            )}
            {filterCharId && (
              <>
                {filterActId && (
                  <span style={{ margin: "0 8px", color: "#c4b9ad" }} aria-hidden="true">
                    +
                  </span>
                )}
                <span
                  className="pw-filter-dot"
                  style={{
                    background: characters.find(c => String(c._id) === filterCharId)?.color
                      || CHAR_PALETTE[0],
                  }}
                  aria-hidden="true"
                />
                <strong>
                  {characters.find(c => String(c._id) === filterCharId)?.name}
                </strong>
              </>
            )}
            {sceneSearch && (
              <>
                {(filterActId || filterCharId) && (
                  <span style={{ margin: "0 8px", color: "#c4b9ad" }} aria-hidden="true">·</span>
                )}
                <span>"{sceneSearch}"</span>
              </>
            )}
            <span className="pw-filter-result-count">
              {displayNodes.filter(n => !n.data.dimmed).length} sonuç
            </span>
            <button onClick={clearAllFilters} aria-label="Tüm filtreleri temizle">
              × Temizle
            </button>
          </div>
        )}

        {/* ─── PLOT BOARD ─── */}
        {activeMain === "plot" && (
          <div
            className={`pw-canvas ${connecting ? "pw-canvas--connecting" : ""}`}
            aria-label="Plot board"
          >
            <ReactFlow
              nodes={displayNodes}
              edges={edges}
              edgeTypes={EDGE_TYPES_MAP}
              onNodesChange={onNodesChange}
              onNodeDragStop={onNodeDragStop}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgesDelete={onEdgesDelete}
              onNodesDelete={onNodesDelete}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={NODE_TYPES}
              snapToGrid
              snapGrid={[20, 20]}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              deleteKeyCode="Delete"
              proOptions={{ hideAttribution: true }}
              style={{ background: "#f5f0e8" }}
              aria-label={`Plot board — ${nodes.length} sahne`}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={22}
                size={1}
                color="#dbd3c6"
              />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={n => {
                  if (n.data?.isAlternative) return "#ca8a04";
                  return actMeta[n.data?.act]?.color || "#888";
                }}
                maskColor="rgba(245,240,232,0.78)"
                style={{ background: "#faf7f2" }}
                aria-label="Küçük harita"
              />

              {/* Perde özeti — sol üst */}
              <Panel position="top-left">
                <div className="pw-act-legend" aria-label="Perde özeti">
                  {Object.entries(actMeta).map(([k, v]) => (
                    <div key={k} className="pw-act-legend-item">
                      <span
                        className="pw-act-legend-dot"
                        style={{ background: v.color }}
                        aria-hidden="true"
                      />
                      <span className="pw-act-legend-label">{v.label}</span>
                      <span className="pw-act-legend-cnt">
                        {nodes.filter(n => n.data?.act === k).length}
                      </span>
                    </div>
                  ))}
                  {totalPages > 0 && (
                    <div className="pw-act-legend-total">
                      ~{totalPages} sayfa tahmini
                    </div>
                  )}
                </div>
              </Panel>

              {/* Bağlantı modu banner */}
              {connecting && (
                <Panel position="top-center">
                  <div className="pw-connect-banner" role="status">
                    <span className="pw-connect-pulse" aria-hidden="true" />
                    Hedef sahneye tıkla
                    <button onClick={stopConnect}>İptal (Esc)</button>
                  </div>
                </Panel>
              )}

              {/* Boş durum */}
              {nodes.length === 0 && !loading && (
                <Panel position="top-center">
                  <div className="pw-empty-state" aria-label="Boş plot board">
                    <div className="pw-empty-icon" aria-hidden="true">🗺️</div>
                    <div className="pw-empty-title">Harita henüz boş</div>
                    <div className="pw-empty-sub">
                      "+ Sahne" ile veya <kbd>Ctrl</kbd>+<kbd>Enter</kbd> ile ilk sahneyi ekle.
                    </div>
                    <button
                      className="pw-btn pw-btn--primary"
                      style={{ marginTop: 12 }}
                      onClick={() => setModal(createAddModal(actOrder[0]))}
                    >
                      + İlk Sahneyi Ekle
                    </button>
                  </div>
                </Panel>
              )}
            </ReactFlow>

            {/* Detail Panel */}
            {selectedNode && !connecting && (
              <DetailPanel
                node={selectedNode}
                counts={connCounts(selectedNode.id)}
                actMeta={actMeta} 
                onClose={() => setSelectedNode(null)}
                onConnect={() => startConnectFrom(selectedNode.id)}
                onEdit={() => setModal(createEditModal(selectedNode))}
                onDelete={() => handleDeleteSceneById(selectedNode.id)}
                onButterfly={() => setButterflyNode(selectedNode)}
                workId={workId}
              />
            )}
          </div>
        )}

        {activeMain === "draw" && (
          <div data-tour="plotworld-cizim-alani">
          <PlotDrawArea workId={workId} characters={characters}
           />
           </div>
        )}

        {activeMain === "arc" && (
          <div data-tour="plotworld-ark-panel">
          <CharacterArcPanel
            characters={characters}
            actOrder={actOrder}
            actMeta={actMeta}     
            workId={workId}       
            nodes={nodes}
            onSceneClick={sceneId => {
              setActiveMain("plot");
              const n = nodes.find(x => x.id === sceneId);
              if (n) setSelectedNode(n);
            }}
          />
          </div>
        )}
      </div>

      {/* ─── MODALLER ─── */}

      {/* Sahne ekle/düzenle */}
      {modal && (modal.mode === "add" || modal.mode === "edit") && (
        <SceneModal
          initial={modal.mode === "edit" ? modal.node?.data : modal.prefill || null}
          isEdit={modal.mode === "edit"}
          defaultAct={modal.act || actOrder[0]}
          actOrder={actOrder}
          actMeta={actMeta}
          onSave={modal.mode === "edit" ? handleEditScene : handleAddScene}
          onClose={() => !saving && setModal(null)}
          saving={saving}
          characters={characters}
        />
      )}

      {/* Dünya girişi ekle */}
      {modal?.mode === "add_entry" && (
        <WorldEntryModal
          category={modal.category}
          onClose={() => !saving && setModal(null)}
          onSave={handleAddWorldEntry}
          saving={saving}
        />
      )}

      {/* Kelebek etkisi */}
      {butterflyNode && (
        <ButterflyModal
          node={butterflyNode}
          edges={edges}
          nodes={nodes}
          characters={characters}
          actMeta={actMeta}
          onClose={() => setButterflyNode(null)}
        />
      )}

      {/* Perde yapısı */}
      {showStructureModal && (
        <StructureSetupModal
          currentTemplate={structure?.templateId}
          currentActs={structure?.acts}
          onSave={handleStructureSave}
          onClose={() => setShowStructureModal(false)}
          isFirstTime={!worldData?.world?.structure}
        />
      )}
       {pendingEdge && (
        <EdgeTypeSelector
          onSelect={handleEdgeTypeSelect}
          onClose={() => setPendingEdge(null)}
        />
      )}
    </div>
  );
}