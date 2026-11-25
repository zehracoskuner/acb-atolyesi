import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Clapperboard, Ellipsis, Link2, Moon, Pencil, Pin, Plus, Search, Sun, Trash2, Users, Workflow, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import CharacterMap from "../components/characters/CharacterMap";
import CharacterGuideEditor from "../components/characters/CharacterGuideEditor";
import { CharacterDetails, CharacterEditor, RelationshipEditor, UniverseDialog } from "../components/characters/CharacterDialogs";
import {
  arrangeCharacters, drawableRelationships, MAP_FIT_OPTIONS, NODE_WIDTH, PORTRAIT_RADIUS, readCustomTypes,
  relationName, RELATION_TYPES, relationshipTypeIdentity, storeCustomTypes, toCharacter, toRelationship, unpackPosition,
} from "../components/characters/graph";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";
import "../styles/CharactersUniverse.css";

const NO_SCENE = { a: null, b: null };
const NEW_POSITIONS = [[0, 0], [144, 0], [-144, 0], [0, 112], [0, -112], [144, 112], [-144, 112], [144, -112], [-144, -112]];
const positionOf = ({ id, x, y, positionMode }) => ({ id, x, y, positionMode });
const samePosition = (a, b) => a?.x === b.x && a?.y === b.y && a?.positionMode === b.positionMode;

function useCharacterPositions(workId, setCharacters) {
  const saved = useRef(new Map());
  const queues = useRef(new Map());
  const drafts = useRef(new Map());
  const [failed, setFailed] = useState(() => new Map());
  const remember = useCallback(items => {
    for (const item of items) saved.current.set(item.id, positionOf(item));
  }, []);

  const clearFailures = useCallback(ids => {
    setFailed(current => {
      if (!ids.some(id => current.has(id))) return current;
      const next = new Map(current);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const forget = useCallback(id => {
    saved.current.delete(id);
    drafts.current.delete(id);
    const queue = queues.current.get(id);
    if (queue) queue.next = null;
    clearFailures([id]);
  }, [clearFailures]);

  const update = useCallback(positions => {
    const changes = new Map(positions.map(position => [position.id, position]));
    setCharacters(current => current.map(character => {
      const position = changes.get(character.id);
      return position ? { ...character, ...unpackPosition(position), positionMode: position.positionMode ?? "manual" } : character;
    }));
    clearFailures([...changes.keys()]);
    for (const { dragging, ...position } of positions) {
      const intent = { ...position, positionMode: position.positionMode ?? "manual" };
      drafts.current.set(position.id, { ...intent, dragging });
      if (dragging) continue;
      const active = queues.current.get(position.id);
      if (active) { active.next = intent; continue; }
      if (samePosition(saved.current.get(position.id), intent)) continue;
      const queue = { next: intent };
      queues.current.set(position.id, queue);
      void (async () => {
        while (queue.next) {
          const next = queue.next;
          queue.next = null;
          if (samePosition(saved.current.get(next.id), next)) continue;
          try {
            const { x, y, positionMode } = next;
            await apiPatch(`/characters/${next.id}/position`, { workId, x, y, positionMode });
            saved.current.set(next.id, next);
          } catch {
            saved.current.delete(next.id);
            const draft = drafts.current.get(next.id);
            if (!queue.next && !draft?.dragging && samePosition(draft, next)) {
              setFailed(current => new Map(current).set(next.id, next));
            }
          }
        }
        queues.current.delete(position.id);
      })();
    }
  }, [clearFailures, workId, setCharacters]);
  return { remember, forget, update, failed };
}

export default function CharactersUniversePage() {
  const { workId } = useParams();
  return <CharacterUniverse key={workId} workId={workId} />;
}

function CharacterUniverse({ workId }) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const addRef = useRef(null);
  const searchRef = useRef(null);
  const toolsRef = useRef(null);
  const returnFocus = useRef(null);
  const noticeTimer = useRef(null);
  const sceneRequest = useRef(0);
  const overviewViewport = useRef(null);
  const fitFilteredMap = useRef(false);
  const [characters, setCharacters] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [customTypes, setCustomTypes] = useState(() => readCustomTypes(workId));
  const [flow, setFlow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(null);
  const [restoringFocus, setRestoringFocus] = useState(false);
  const [focusId, setFocusId] = useState(null);
  const [edgeId, setEdgeId] = useState(null);
  const [linkFrom, setLinkFrom] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [characterFilter, setCharacterFilter] = useState("");
  const [arranging, setArranging] = useState(false);
  const [sceneMode, setSceneMode] = useState(false);
  const [scenePick, setScenePick] = useState(NO_SCENE);
  const [sceneIdea, setSceneIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("acb_char_theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    } catch { return "light"; }
  });

  const showNotice = useCallback(message => {
    clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(""), 4500);
  }, []);
  const { remember, forget, update: updatePositions, failed: failedPositions } = useCharacterPositions(workId, setCharacters);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError("");
    Promise.all([apiGet(`/characters?workId=${workId}`), apiGet(`/relationships?workId=${workId}`)])
      .then(([people, links]) => {
        if (!current) return;
        const nodes = (people.items || []).map(toCharacter);
        remember(nodes);
        setCharacters(nodes);
        setRelationships((links.items || []).map(toRelationship));
      })
      .catch(error => { if (current) setLoadError(error.message || "Harita yüklenemedi."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [retry, workId, remember]);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const nodesById = useMemo(() => new Map(characters.map(item => [item.id, item])), [characters]);
  // Keep the edge metadata stable while React Flow moves a node.
  const members = JSON.stringify(characters.map(({ id, name }) => [id, name]));
  const names = useMemo(() => new Map(JSON.parse(members)), [members]);
  const characterOptions = useMemo(() => [...names].sort(([, a], [, b]) => a.localeCompare(b, "tr")), [names]);
  const drawable = useMemo(() => drawableRelationships(relationships, names), [relationships, names]);
  const allTypes = useMemo(() => {
    const types = new Map([...RELATION_TYPES, ...customTypes].map(type => [type.key, type]));
    for (const { type, typeName } of relationships) {
      if (types.has(type)) continue;
      const label = typeName && relationshipTypeIdentity(typeName) === relationshipTypeIdentity(type) ? typeName : relationName(type);
      types.set(type, { key: type, label });
    }
    return [...types.values()];
  }, [customTypes, relationships]);
  const representedTypes = useMemo(() => {
    const used = new Map();
    for (const { type } of drawable) {
      const label = relationName(type, allTypes);
      const key = relationshipTypeIdentity(label);
      if (!used.has(key)) used.set(key, allTypes.find(option => option.key === key)?.label || label);
    }
    return [...used].map(([key, label]) => ({ key, label }));
  }, [allTypes, drawable]);
  const searchTerm = query.trim().toLocaleLowerCase("tr");
  const matches = useMemo(() => searchTerm
    ? [...names].filter(([, name]) => name?.toLocaleLowerCase("tr").includes(searchTerm))
    : [], [names, searchTerm]);
  const matchIds = useMemo(() => searchTerm ? new Set(matches.map(([id]) => id)) : null, [matches, searchTerm]);
  const effectiveFilter = representedTypes.some(type => type.key === filter) ? filter : "";
  const filteredCharacter = nodesById.get(characterFilter);
  const filteredId = filteredCharacter?.id;
  const displayedRelationships = useMemo(() => filteredId ? drawable.filter(edge =>
    (edge.from === filteredId || edge.to === filteredId) &&
    (!effectiveFilter || relationshipTypeIdentity(relationName(edge.type, allTypes)) === effectiveFilter)
  ) : drawable, [allTypes, drawable, effectiveFilter, filteredId]);
  const displayedCharacters = useMemo(() => {
    if (!filteredId) return characters;
    const ids = new Set([filteredId]);
    for (const { from, to } of displayedRelationships) {
      ids.add(from);
      ids.add(to);
    }
    return characters.filter(character => ids.has(character.id));
  }, [characters, displayedRelationships, filteredId]);
  const selectedEdge = displayedRelationships.find(edge => edge.id === edgeId &&
    (!effectiveFilter || relationshipTypeIdentity(relationName(edge.type, allTypes)) === effectiveFilter));
  const profile = dialog?.id ? nodesById.get(dialog.id) : null;

  useEffect(() => {
    if (!flow || !filteredId || !fitFilteredMap.current) return;
    fitFilteredMap.current = false;
    void flow.fitView(MAP_FIT_OPTIONS);
  }, [effectiveFilter, filteredId, flow]);

  const open = useCallback((next, element = document.activeElement) => {
    returnFocus.current = element;
    setDialog(next);
  }, []);
  const close = useCallback(() => {
    setRestoringFocus(true);
    setDialog(null);
  }, []);
  useLayoutEffect(() => {
    if (!restoringFocus || dialog) return;
    const focusTarget = returnFocus.current;
    if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
    else addRef.current?.focus({ preventScroll: true });
    setRestoringFocus(false);
  }, [dialog, restoringFocus]);
  const resetSelection = useCallback(() => { setFocusId(null); setEdgeId(null); setLinkFrom(null); }, []);

  useEffect(() => {
    const onEscape = event => {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector(".cu-dialog[open]")) resetSelection();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [resetSelection]);

  useEffect(() => {
    function closeOutside(event) {
      const tools = toolsRef.current;
      if (tools?.open && !tools.contains(event.target)) tools.open = false;
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  function closeTools() {
    const tools = toolsRef.current;
    tools.open = false;
    const summary = tools.querySelector("summary");
    summary?.focus({ preventScroll: true });
    return summary;
  }

  const link = useCallback((from, to) => {
    if (!from || !to || from === to || sceneMode) return;
    setLinkFrom(null);
    open({ kind: "relationship", relationship: { from, to } });
  }, [open, sceneMode]);
  const arm = useCallback(id => {
    if (sceneMode) return;
    if (linkFrom && linkFrom !== id) { link(linkFrom, id); return; }
    setLinkFrom(linkFrom === id ? null : id);
  }, [link, linkFrom, sceneMode]);

  const chooseEdge = useCallback(id => {
    setLinkFrom(null);
    setEdgeId(id);
  }, []);

  const closeScene = useCallback(() => {
    sceneRequest.current += 1;
    setScenePick(NO_SCENE);
    setSceneIdea("");
    close();
  }, [close]);

  const startScene = useCallback(async (from, to, trigger) => {
    const a = nodesById.get(from), b = nodesById.get(to);
    if (!a || !b) return;
    const request = ++sceneRequest.current;
    const rel = drawable.find(edge => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from));
    const idea = `Karakterler: ${a.name} (${a.role || "?"}) ↔ ${b.name} (${b.role || "?"})\nİlişki: ${rel ? relationName(rel.type, allTypes) : "Belirsiz"}\n\nBu sahnede kim geri adım atarsa kaybeder? Bu kayıp hikâyeyi nereye iter?`;
    setSceneIdea(idea);
    open({ kind: "scene" }, trigger);
    try {
      const relationship = rel ? { type: rel.type, label: rel.label || "", strength: rel.strength, directed: rel.directed,
        fromName: names.get(rel.from), toName: names.get(rel.to) } : null;
      const data = await apiPost("/ai/scene-spark", { workId, relationship, characters: [a, b].map(({ name, role, notes }) => ({ name, role, notes })) });
      if (data.scene && request === sceneRequest.current) setSceneIdea(`${idea}\n\nAI taslağı\n${data.scene}`);
    } catch {
      if (request === sceneRequest.current) setSceneIdea(`${idea}\n\nAI taslağı alınamadı.`);
    }
  }, [allTypes, drawable, names, nodesById, open, workId]);

  const activate = useCallback((id, trigger) => {
    if (sceneMode) {
      if (scenePick.a && scenePick.a !== id) {
        setScenePick({ a: scenePick.a, b: id });
        void startScene(scenePick.a, id, trigger);
      } else setScenePick({ a: scenePick.a === id ? null : id, b: null });
      return;
    }
    if (linkFrom) {
      if (linkFrom === id) setLinkFrom(null);
      else link(linkFrom, id);
      return;
    }
    setFocusId(id);
    setEdgeId(null);
    const thumbnail = trigger?.querySelector(".cu-node-portrait");
    const image = thumbnail?.querySelector("img");
    const portraitRatio = image?.naturalHeight ? image.naturalWidth / image.naturalHeight : undefined;
    open({ kind: "details", id, origin: thumbnail?.getBoundingClientRect(), portraitRatio }, trigger);
  }, [sceneMode, scenePick.a, startScene, linkFrom, link, open]);

  const jumpToSearch = id => {
    const character = nodesById.get(id);
    if (!character) return;
    setQuery("");
    if (filteredCharacter) showCharacter(id);
    else flow?.setCenter(character.x + NODE_WIDTH / 2, character.y + PORTRAIT_RADIUS, { zoom: 1 });
    activate(id, searchRef.current);
  };

  function showCharacter(id) {
    const character = nodesById.get(id);
    setCharacterFilter(character?.id ?? "");
    resetSelection();
    if (character) {
      if (!overviewViewport.current) overviewViewport.current = flow?.getViewport();
      if (filteredId === character.id) void flow?.fitView(MAP_FIT_OPTIONS);
      else fitFilteredMap.current = true;
      return;
    }
    fitFilteredMap.current = false;
    if (overviewViewport.current) flow?.setViewport(overviewViewport.current);
    overviewViewport.current = null;
  }

  function newPosition() {
    const rect = canvasRef.current?.getBoundingClientRect();
    const point = rect && flow?.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    if (!point) return { x: 240, y: 200, positionMode: "auto" };
    const x = point.x - NODE_WIDTH / 2;
    const y = point.y - PORTRAIT_RADIUS;
    const zoom = flow.getZoom();
    const [dx, dy] = NEW_POSITIONS.find(([dx, dy]) =>
      (Math.abs(dx) + NODE_WIDTH / 2) * zoom < rect.width / 2 &&
      (Math.abs(dy) + PORTRAIT_RADIUS + 26) * zoom < rect.height / 2 &&
      !characters.some(character => Math.abs(character.x - x - dx) < 98 && Math.abs(character.y - y - dy) < 2 * PORTRAIT_RADIUS + 24)
    ) ?? NEW_POSITIONS[0];
    return { x: Math.round(x + dx), y: Math.round(y + dy), positionMode: "auto" };
  }

  async function saveCharacter(fields, { blob, remove }) {
    let id = dialog.id;
    if (!id) {
      const { item } = await apiPost("/characters", { workId, ...fields, ...newPosition() });
      const node = toCharacter(item);
      id = node.id;
      remember([node]);
      setCharacters(current => [...current, node]);
      if (filteredCharacter) setCharacterFilter(id);
      setDialog(current => ({ ...current, id }));
    } else {
      const { item } = await apiPatch(`/characters/${id}`, { workId, ...fields });
      setCharacters(current => current.map(node => node.id === id ? { ...node, ...fields, name: item.name } : node));
    }
    if (blob || remove) {
      const path = `/characters/${id}/portrait?workId=${workId}`;
      try {
        let result;
        if (blob) {
          const form = new FormData();
          form.append("file", blob, blob.name || "karakter.webp");
          result = await apiPost(path, form);
        } else result = await apiDelete(path);
        setCharacters(current => current.map(node => node.id === id ? { ...node, imageUrl: result.item.imageUrl } : node));
      } catch (error) {
        throw new Error(`Karakter bilgileri kaydedildi. Fotoğraf güncellenemedi. ${error.message}`);
      }
    }
    setFocusId(id);
    setDialog({ kind: "details", id });
    showNotice("Karakter kaydedildi.");
  }

  async function deleteCharacter(id) {
    await apiDelete(`/characters/${id}?workId=${workId}`);
    forget(id);
    setCharacters(current => current.filter(node => node.id !== id));
    if (characterFilter === id) showCharacter("");
    setFocusId(null);
    close();
    showNotice("Karakter silindi.");
  }

  async function saveDescription(id, notes) {
    const { item } = await apiPatch(`/characters/${id}`, { workId, notes });
    setCharacters(current => current.map(character => character.id === id ? { ...character, notes: item.notes } : character));
  }

  async function saveRelationship(edge, customLabel) {
    const { id, from, to, type, label, strength, directed } = edge;
    const fields = { workId, type, label, strength, directed };
    const { item, updated } = id ? await apiPatch(`/relationships/${id}`, fields) : await apiPost("/relationships", { ...fields, from, to, upsert: true });
    const saved = toRelationship(item);
    setRelationships(current => current.some(record => record.id === saved.id)
      ? current.map(record => record.id === saved.id ? saved : record) : [...current, saved]);
    if (customLabel && !allTypes.some(record => record.key === saved.type)) {
      const types = [...customTypes, { key: saved.type, label: saved.typeName || customLabel }];
      setCustomTypes(types);
      storeCustomTypes(workId, types);
    }
    if (effectiveFilter && effectiveFilter !== relationshipTypeIdentity(relationName(saved.type, allTypes))) setFilter("");
    setEdgeId(saved.id);
    close();
    showNotice(id || updated || relationships.some(record => record.id === saved.id) ? "Bağ güncellendi." : "Bağ kuruldu.");
  }

  async function deleteRelationships(ids) {
    setBusy(true);
    const removed = new Set();
    try {
      for (let start = 0; start < ids.length; start += 6) {
        await Promise.allSettled(ids.slice(start, start + 6).map(async id => {
          try { await apiDelete(`/relationships/${id}?workId=${workId}`); }
          catch (error) { if (error.status !== 404) throw error; }
          removed.add(id);
        }));
      }
      setRelationships(current => current.filter(item => !removed.has(item.id)));
      if (removed.has(edgeId)) setEdgeId(null);
      const failed = ids.length - removed.size;
      showNotice(failed ? `${failed} bağ silinemedi.` : removed.size === 1 ? "Bağ silindi." : `${removed.size} bağ silindi.`);
      close();
    } finally { setBusy(false); }
  }

  async function arrange() {
    if (!characters.some(node => node.positionMode === "auto")) {
      showNotice("Konumlar sabit. Haritada bir karakter seçip otomatik yerleşime dahil edebilirsin.");
      return;
    }
    setArranging(true);
    try {
      const arranged = await arrangeCharacters(characters, drawable);
      updatePositions(arranged.map(node => ({ id: node.id, ...unpackPosition(node), positionMode: "auto" })));
      showNotice("Otomatik yerleşim uygulandı.");
    } catch (error) { showNotice(error.message || "Otomatik yerleşim uygulanamadı."); }
    finally { setArranging(false); }
  }

  async function saveScene(destination) {
    setBusy(true);
    const name = `${names.get(scenePick.a)} ↔ ${names.get(scenePick.b)}`;
    try {
      if (destination === "plot") await apiPost(`/plots/${workId}/scenes`, { act: "middle", title: `${name} Sahnesi`, description: sceneIdea, status: "idea" });
      else await apiPost(`/works/${workId}/notes`, { content: `Sahne Kıvılcımı — ${name}\n\n${sceneIdea}`, source: "sceneSpark" });
      closeScene();
      showNotice(destination === "plot" ? "Sahne Gelişme perdesine eklendi." : "Sahne notlara kaydedildi.");
    } catch (error) { showNotice(error.message || "Sahne kaydedilemedi."); }
    finally { setBusy(false); }
  }

  const focus = nodesById.get(focusId);
  return (
    <main className="universe-root" data-theme={theme}>
      <header className="cu-top">
        <div className="cu-heading">
          <button className="cu-icon cu-back" type="button" aria-label="Çalışmaya dön" title="Çalışmaya dön" onClick={() => navigate(`/work/${workId}`)}><ArrowLeft size={20} /></button>
          <div>
            <h1 data-tour="karakter-baslik">Karakter Evreni</h1>
            {!loading && !loadError && <p>{characters.length} karakter <span aria-hidden="true">·</span> {drawable.length} bağ</p>}
          </div>
        </div>
        <div className="cu-toolbar">
          <div className="cu-search">
            <form role="search" onSubmit={event => { event.preventDefault(); if (matches.length) jumpToSearch(matches[0][0]); }}>
              <Search size={17} aria-hidden="true" />
              <input ref={searchRef} type="search" aria-label="Karakter ara" placeholder="Karakter ara" value={query} onChange={event => setQuery(event.target.value)} disabled={!characters.length} />
            </form>
            {searchTerm && <div className="cu-search-results">
              {matches.length ? matches.slice(0, 8).map(([id, name]) => (
                <button key={id} type="button" onClick={() => jumpToSearch(id)}>{name}</button>
              )) : <p>Karakter bulunamadı.</p>}
            </div>}
          </div>
          <select aria-label="İlişki türüne göre filtrele" value={effectiveFilter} onChange={event => {
            fitFilteredMap.current = Boolean(filteredId);
            setFilter(event.target.value);
            setEdgeId(null);
          }} disabled={!representedTypes.length}>
            <option value="">Tüm ilişkiler</option>
            {representedTypes.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select aria-label="Karaktere göre filtrele" value={filteredCharacter?.id ?? ""} onChange={event => showCharacter(event.target.value)}
            disabled={!characters.length || sceneMode}>
            <option value="">Tüm karakterler</option>
            {characterOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div className="cu-top-actions">
          <button className="cu-icon cu-theme" type="button" aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
            title={theme === "dark" ? "Açık tema" : "Koyu tema"} onClick={() => {
              const next = theme === "dark" ? "light" : "dark";
              setTheme(next);
              try { localStorage.setItem("acb_char_theme", next); } catch { /* Theme remains active for this session. */ }
            }}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button className="cu-button cu-scene-toggle" type="button" aria-label="Sahne Modu" title="Sahne Modu" aria-pressed={sceneMode}
            data-tour="karakter-sahne-modu" disabled={characters.length < 2} onClick={() => {
              if (filteredCharacter) showCharacter("");
              setSceneMode(!sceneMode); setScenePick(NO_SCENE); resetSelection();
            }}><Clapperboard size={17} /> <span>Sahne Modu</span></button>
          <button className="cu-button cu-primary cu-add" type="button" ref={addRef} data-tour="karakter-ekle-btn" aria-label="Karakter ekle" title="Karakter ekle"
            disabled={loading || Boolean(loadError)} onClick={event => open({ kind: "character" }, event.currentTarget)}><Plus size={18} /> <span>Karakter ekle</span></button>
          <details className="cu-tools" ref={toolsRef} onBlur={event => {
            if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
          }} onKeyDown={event => {
            if (event.key === "Escape" && event.currentTarget.open) {
              event.preventDefault();
              event.stopPropagation();
              closeTools();
            }
          }}>
            <summary className="cu-icon" aria-label="Harita seçenekleri" title="Harita seçenekleri"><Ellipsis size={20} /></summary>
            <div className="cu-tools-panel">
              <button className="cu-button" type="button" disabled={loading || Boolean(loadError)}
                onClick={() => open({ kind: "guide" }, closeTools())}><BookOpen size={16} /> Karakter Rehberi</button>
              <button className="cu-button" type="button" disabled={arranging || !characters.length} onClick={() => { closeTools(); void arrange(); }}>
                <Workflow size={16} /> Otomatik düzenle
              </button>
              <button className="cu-button cu-danger" type="button" disabled={!drawable.length}
                onClick={() => open({ kind: "clear", ids: drawable.map(edge => edge.id) }, closeTools())}>
                <Trash2 size={16} /> Bağları Temizle
              </button>
            </div>
          </details>
        </div>
      </header>

      <section className="cu-board" aria-label="İlişki haritası" aria-busy={loading}>
        <div className={`cu-canvas${sceneMode ? " is-scene" : ""}`} ref={canvasRef}>
          {!loading && !loadError && <CharacterMap canvasRef={canvasRef} flow={flow} onInit={setFlow} characters={displayedCharacters}
            relationships={displayedRelationships} names={names} types={allTypes} focusId={filteredId ?? focusId} selectedEdgeId={edgeId}
            matchIds={filteredCharacter ? null : matchIds} sceneMode={sceneMode} scenePick={scenePick} linkFrom={linkFrom}
            canConnect={!sceneMode && (!filteredId || displayedCharacters.length > 1)}
            onActivate={activate} onSelectEdge={chooseEdge} onArm={arm} onLink={link} onPositions={updatePositions}
            onBlank={resetSelection} filter={effectiveFilter} theme={theme} suspendFocusPan={Boolean(dialog) || restoringFocus} />}
          {loading && <div className="cu-state cu-skeleton" role="status"><span /><span /><span /><p>Harita yükleniyor…</p></div>}
          {loadError && <div className="cu-state" role="alert"><h2>Harita yüklenemedi</h2><p>{loadError}</p><button className="cu-button" onClick={() => setRetry(count => count + 1)}>Tekrar dene</button></div>}
          {!loading && !loadError && !characters.length && <div className="cu-state">
            <div className="cu-empty-icon"><Users size={30} /></div>
            <h2>İlk karakterini ekle</h2><p>Portresini ekle, hikâyeni bağlarla büyüt.</p>
            <button className="cu-button cu-primary" type="button" onClick={event => open({ kind: "character" }, event.currentTarget)}><Plus size={17} /> Karakter ekle</button>
          </div>}
          <div className="cu-bottom-left">
            {selectedEdge && !sceneMode && <div className="cu-selection">
              <div><strong>{names.get(selectedEdge.from)} {selectedEdge.directed ? "→" : "↔"} {names.get(selectedEdge.to)}</strong>
                <span>{relationName(selectedEdge.type, allTypes)}{selectedEdge.label ? ` · ${selectedEdge.label}` : ""} · Güç {selectedEdge.strength}/5</span></div>
              <button className="cu-icon" type="button" aria-label="Bağı düzenle" onClick={event => open({ kind: "relationship", relationship: selectedEdge }, event.currentTarget)}><Pencil size={16} /></button>
              <button className="cu-icon" type="button" aria-label="Bağın dönüm noktaları" title="Bağın dönüm noktaları"
                onClick={event => open({ kind: "guide", edgeId: selectedEdge.id }, event.currentTarget)}><BookOpen size={16} /></button>
              <button className="cu-icon cu-danger" type="button" aria-label="Bağı sil" onClick={event => open({ kind: "clear", ids: [selectedEdge.id] }, event.currentTarget)}><Trash2 size={16} /></button>
              <button className="cu-icon" type="button" aria-label="Bağ seçimini kaldır" onClick={() => setEdgeId(null)}><X size={16} /></button>
            </div>}
            <footer className="cu-footer">
              <p aria-live="polite">{sceneMode ? scenePick.a ? `${names.get(scenePick.a)} seçildi. İkinci karakteri seç.` : "Sahne için iki karakter seç."
                : linkFrom ? `${names.get(linkFrom)} için bağ kurulacak karakteri seç.`
                  : filteredCharacter ? `${filteredCharacter.name} · ${displayedRelationships.length} doğrudan bağ`
                  : <><Link2 size={14} /> <span>Tutamaç veya <kbd>Shift</kbd> + sürükle ile bağ kur.</span></>}</p>
              {!sceneMode && focus && <button className="cu-text-button cu-pin" type="button" onClick={() =>
                updatePositions([{ ...positionOf(focus), positionMode: focus.positionMode === "auto" ? "manual" : "auto" }])}>
                <Pin size={14} /> {focus.positionMode === "auto" ? "Konumu sabitle" : "Otomatik yerleşime dahil et"}
              </button>}
            </footer>
          </div>
          {(notice || failedPositions.size > 0) && <div className="cu-feedback">
            {failedPositions.size > 0 && <div className="cu-position-retry">
              <span role="status">{failedPositions.size === 1 ? "Konum kaydedilemedi." : `${failedPositions.size} karakterin konumu kaydedilemedi.`}</span>
              <button className="cu-button" type="button" onClick={() => updatePositions([...failedPositions.values()])}>Yeniden dene</button>
            </div>}
            {notice && <div className="cu-notice" role="status">{notice}</div>}
          </div>}
        </div>
      </section>

      {dialog?.kind === "details" && profile && <CharacterDetails workId={workId} character={profile} origin={dialog.origin}
        portraitRatio={dialog.portraitRatio} nodesById={nodesById} types={allTypes}
        relationships={drawable.filter(edge => edge.from === profile.id || edge.to === profile.id)}
        onSaveDescription={notes => saveDescription(profile.id, notes)}
        onNavigate={id => { setFocusId(id); setDialog({ kind: "details", id }); }}
        onClose={close} onEdit={() => setDialog({ kind: "character", id: profile.id, fromDetails: true })}
        onDelete={() => deleteCharacter(profile.id)}
        onPhoto={() => setDialog({ kind: "character", id: profile.id, fromDetails: true, photoFirst: true })} />}
      {dialog?.kind === "character" && <CharacterEditor character={profile || { name: "" }} creating={!dialog.id} photoFirst={dialog.photoFirst}
        onClose={() => dialog.fromDetails ? setDialog({ kind: "details", id: dialog.id }) : close()}
        onSave={saveCharacter} onDelete={() => deleteCharacter(dialog.id)}
        onQuestion={async fields => {
          const result = await apiPost("/ai/chaos", { characterName: fields.name, role: fields.role, notes: fields.notes, mode: "question" });
          return `Karakter Sorusu: ${result.question}${result.answer ? `\nOlası Cevap: ${result.answer}` : ""}`;
        }} />}
      {dialog?.kind === "relationship" && <RelationshipEditor relationship={dialog.relationship} relationships={drawable}
        names={names} types={allTypes} onClose={close} onSave={saveRelationship} />}
      {dialog?.kind === "guide" && <CharacterGuideEditor workId={workId} characters={characters} relationships={drawable}
        names={names} types={allTypes} initialEdgeId={dialog.edgeId} onClose={close} />}
      {dialog?.kind === "clear" && <UniverseDialog label="Bağları sil" className="cu-dialog--small" onClose={close} busy={busy}>
        <div className="cu-dialog-shell cu-form-shell">
          <h2>{dialog.ids.length === 1 ? "Bağ silinsin mi?" : `${dialog.ids.length} bağ silinsin mi?`}</h2>
          <p className="cu-muted">Silinen bağlar geri alınamaz.</p>
          <div className="cu-dialog-actions">
            <button className="cu-button cu-action-spacer" onClick={close} disabled={busy} autoFocus>Vazgeç</button>
            <button className="cu-button cu-danger-solid" onClick={() => deleteRelationships(dialog.ids)} disabled={busy}>{busy ? "Siliniyor…" : "Sil"}</button>
          </div>
        </div>
      </UniverseDialog>}
      {dialog?.kind === "scene" && <UniverseDialog label="Sahne Kıvılcımı" className="cu-dialog--scene" onClose={closeScene} busy={busy}>
        <div className="cu-dialog-shell cu-form-shell">
          <h2>Sahne Kıvılcımı</h2><p className="cu-notes">{sceneIdea}</p>
          {notice && <p className="cu-form-error" role="status">{notice}</p>}
          <div className="cu-dialog-actions">
            <button className="cu-button" onClick={closeScene} disabled={busy} autoFocus>Kapat</button>
            <button className="cu-button cu-action-spacer" onClick={() => saveScene("notes")} disabled={busy}>Notlara kaydet</button>
            <button className="cu-button cu-primary" onClick={() => saveScene("plot")} disabled={busy}>Plot’a ekle</button>
          </div>
        </div>
      </UniverseDialog>}
    </main>
  );
}
