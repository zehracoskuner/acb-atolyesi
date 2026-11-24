import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { message } from '../api';
import { deleteCharacterRelation, relationMeta, relationPerspective, saveCharacterPosition } from '../characters';
import type { CharacterRelation, MapCharacter } from '../characters';
import {
  NODE_H,
  NODE_W,
  WORLD,
  MAX_SCALE,
  MIN_SCALE,
  centerOf,
  centerOn,
  clamp,
  edgeShape,
  fitView,
  layoutPositions,
  strokeFor,
  svgBox,
  zoomAbout,
} from '../characterMapGeometry';
import type { Pt, View2D } from '../characterMapGeometry';
import { useResource } from '../useResource';

const C = {
  board: '#0f1724',
  panel: '#182234',
  panelHi: '#223250',
  line: '#2a3850',
  text: '#e8edf5',
  muted: '#8e9bb0',
  accent: '#7dd3fc',
  onAccent: '#0b1220',
  danger: '#f87171',
  card: '#e9edf2',
  cardInk: '#1a2233',
};
const ROTATIONS = [-2, 1.5, -1, 2, -1.5, 1, -2.5, 0.5];
const TOP_UI = 104;
const BOTTOM_UI = 96;
const noCharacters: MapCharacter[] = [];
const noRelations: CharacterRelation[] = [];

const colorOf = (c?: MapCharacter) => c?.color || '#7dd3fc';
const arrowOf = (direction: string) => (direction === 'Giden ilişki' ? '→' : direction === 'Gelen ilişki' ? '←' : '↔');

/* ── Küçük bileşenler ───────────────────────────────────── */

function Avatar({ name, color, size }: { name: string; color: string; size: number }) {
  const shape = { width: size, height: size, borderRadius: size / 2, backgroundColor: color };
  return (
    <View style={[shape, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: C.onAccent, userSelect: 'none', fontWeight: '700', fontSize: size * 0.42 }}>
        {name.trim().charAt(0).toLocaleUpperCase('tr') || '?'}
      </Text>
    </View>
  );
}

function Btn({ label, onPress, kind = 'ghost', disabled }: { label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, kind === 'primary' && styles.btnPrimary, kind === 'danger' && styles.btnDanger, disabled && { opacity: 0.4 }]}
    >
      <Text style={[styles.btnText, kind === 'primary' && { color: C.onAccent }, kind === 'danger' && { color: C.danger }]}>{label}</Text>
    </Pressable>
  );
}

/* ── Karakter kartı (kendi sürükleme hareketi) ──────────── */

type NodeProps = {
  char: MapCharacter;
  x: number;
  y: number;
  index: number;
  selected: boolean;
  opacity: number;
  scaleRef: { current: number };
  canDrag: (id: string) => boolean;
  onCancel: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onEnd: (id: string) => void;
  onTap: (id: string) => void;
};

const NodeCard = memo(function NodeCard(props: NodeProps) {
  const { char, x, y, index, selected, opacity } = props;
  const latest = useRef(props);
  latest.current = props;
  const origin = useRef<Pt>({ x: 0, y: 0 });
  const dragging = useRef(false);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: (event) => event.nativeEvent.touches.length >= 2,
        onPanResponderGrant: () => {
          origin.current = { x: latest.current.x, y: latest.current.y };
          dragging.current = false;
        },
        onPanResponderMove: (_e, g) => {
          if (!dragging.current && Math.hypot(g.dx, g.dy) < 6) return;
          dragging.current = true;
          const p = latest.current;
          if (!p.canDrag(p.char._id)) return;
          const s = p.scaleRef.current;
          p.onMove(p.char._id, origin.current.x + g.dx / s, origin.current.y + g.dy / s);
        },
        onPanResponderRelease: () => {
          const p = latest.current;
          if (dragging.current) p.onEnd(p.char._id);
          else p.onTap(p.char._id);
        },
        onPanResponderTerminate: () => {
          const p = latest.current;
          if (dragging.current) p.onCancel(p.char._id);
        },
      }),
    [],
  );

  const color = colorOf(char);
  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={char.name}
      accessibilityState={{ selected }}
      onAccessibilityTap={() => props.onTap(char._id)}
      style={[
        styles.node,
        { left: x, top: y, opacity, zIndex: selected ? 5 : 2, transform: [{ rotate: `${ROTATIONS[index % ROTATIONS.length]}deg` }] },
        selected && { borderColor: color, borderWidth: 2 },
      ]}
    >
      <View style={[styles.nodeStripe, { backgroundColor: color }]} />
      <Avatar name={char.name} color={color} size={34} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={styles.nodeName}>{char.name}</Text>
        {char.role ? <Text numberOfLines={1} style={styles.nodeRole}>{char.role}</Text> : null}
      </View>
    </View>
  );
});

export default function CharacterMapScreen({ workId }: { workId: string }) {
  const insets = useSafeAreaInsets();
  const characterPath = '/characters/' + encodeURIComponent(workId);
  const workQuery = '?workId=' + encodeURIComponent(workId);
  const people = useResource<{ items: MapCharacter[] }>('/characters' + workQuery);
  const relationships = useResource<{ items: CharacterRelation[] }>('/relationships' + workQuery);
  const { setData: setPeople } = people;
  const chars = people.data?.items ?? noCharacters;
  const rels = relationships.data?.items ?? noRelations;
  const status = people.error || relationships.error ? 'error' : people.data && relationships.data ? 'ready' : 'loading';

  const [view, setView] = useState<View2D>({ s: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  const scaleRef = useRef(1);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const offset = useRef<Pt>({ x: 0, y: 0 });
  const viewportRef = useRef<View>(null);
  const fitSize = useRef<typeof size | null>(null);

  const [dragging, setDragging] = useState<Record<string, Pt>>({});
  const dragPositions = useRef(dragging);
  const savingPositions = useRef(new Set<string>());
  const deletingRelation = useRef(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const basePositions = useMemo(() => layoutPositions(chars), [chars]);
  const pos = useMemo(() => ({ ...basePositions, ...dragging }), [basePositions, dragging]);

  const applyView = useCallback((v: View2D) => {
    viewRef.current = v;
    scaleRef.current = v.s;
    setView(v);
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const fit = useCallback(() => {
    const { w, h } = size;
    if (w && h) applyView(fitView(Object.values(pos), w, h, TOP_UI, BOTTOM_UI + insets.bottom));
  }, [applyView, pos, size, insets.bottom]);
  useEffect(() => {
    if (status === 'ready' && chars.length && size.w && size.h && fitSize.current !== size) {
      fitSize.current = size;
      fit();
    }
    if (!chars.length) fitSize.current = null;
  }, [status, chars.length, size, fit]);

  const charById = useMemo(() => new Map(chars.map((c) => [c._id, c])), [chars]);
  const visibleRels = useMemo(
    () => rels.filter((r) => !hiddenTypes.includes(r.type) && pos[r.from] && pos[r.to] && charById.has(r.from) && charById.has(r.to)),
    [rels, hiddenTypes, pos, charById],
  );
  const shapes = useMemo(
    () => visibleRels.flatMap((rel) => {
      const from = pos[rel.from];
      const to = pos[rel.to];
      return from && to ? [{ rel, shape: edgeShape(from, to, rel.directed !== false) }] : [];
    }),
    [visibleRels, pos],
  );
  const shapeById = useMemo(() => new Map(shapes.map((s) => [s.rel._id, s.shape])), [shapes]);
  const box = useMemo(() => svgBox(Object.values(pos)), [pos]);
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    rels.forEach((r) => {
      if (charById.has(r.from) && charById.has(r.to)) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    });
    return [...counts.entries()];
  }, [rels, charById]);
  const relatedIds = useMemo(() => {
    if (!selectedNode) return null;
    const ids = new Set([selectedNode]);
    visibleRels.forEach((r) => {
      if (r.from === selectedNode) ids.add(r.to);
      if (r.to === selectedNode) ids.add(r.from);
    });
    return ids;
  }, [selectedNode, visibleRels]);
  const matchIds = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return null;
    return new Set(
      chars.filter((c) => c.name.toLocaleLowerCase('tr').includes(q) || (c.role || '').toLocaleLowerCase('tr').includes(q)).map((c) => c._id),
    );
  }, [query, chars]);

  const nodeObj = selectedNode ? charById.get(selectedNode) : undefined;
  const edgeObj = selectedEdge ? visibleRels.find((r) => r._id === selectedEdge) : undefined;
  const nodeRels = useMemo(
    () => (selectedNode ? visibleRels.filter((r) => r.from === selectedNode || r.to === selectedNode) : []),
    [selectedNode, visibleRels],
  );

  const canDrag = useCallback((id: string) => !savingPositions.current.has(id), []);

  const moveNode = useCallback((id: string, x: number, y: number) => {
    const next = { ...dragPositions.current, [id]: { x: clamp(x, 0, WORLD - NODE_W), y: clamp(y, 0, WORLD - NODE_H) } };
    dragPositions.current = next;
    setDragging(next);
  }, []);

  const cancelDrag = useCallback((id: string) => {
    if (savingPositions.current.has(id) || !dragPositions.current[id]) return;
    const next = { ...dragPositions.current };
    delete next[id];
    dragPositions.current = next;
    setDragging(next);
  }, []);

  const endNodeDrag = useCallback(async (id: string) => {
    const point = dragPositions.current[id];
    if (!point || savingPositions.current.has(id)) return;
    savingPositions.current.add(id);
    try {
      const x = Math.round(point.x);
      const y = Math.round(point.y);
      await saveCharacterPosition(workId, id, x, y);
      setPeople(previous => previous && {
        items: previous.items.map(character => character._id === id ? { ...character, x, y } : character),
      });
    } catch (error) {
      showToast('Konum kaydedilemedi: ' + message(error));
    } finally {
      savingPositions.current.delete(id);
      cancelDrag(id);
    }
  }, [workId, setPeople, showToast, cancelDrag]);

  const tapNode = useCallback((id: string) => {
    setSelectedEdge(null);
    if (linkFrom) {
      if (linkFrom === id) return;
      setLinkFrom(null);
      router.push(characterPath + '/' + encodeURIComponent(linkFrom) + '/relation?target=' + encodeURIComponent(id));
      return;
    }
    setSelectedNode(id);
  }, [characterPath, linkFrom]);

  /* Tuval hareketleri: tek parmak kaydır, iki parmak yakınlaştır */

  const gesture = useRef({ count: 0, base: view, d0: 1, mid0: { x: 0, y: 0 } as Pt, origin: { x: 0, y: 0 } as Pt });

  const tapBackground = () => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setLinkFrom(null);
  };

  const background = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (e, state) => e.nativeEvent.touches.length >= 2 || Math.hypot(state.dx, state.dy) > 6,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const first = e.nativeEvent.touches[0];
          gesture.current.count = first ? 1 : 0;
          gesture.current.base = viewRef.current;
          if (first) gesture.current.origin = { x: first.pageX, y: first.pageY };
        },
        onPanResponderMove: (e) => {
          const t = e.nativeEvent.touches;
          const g = gesture.current;
          if (t.length >= 2) {
            const a = t[0]!;
            const b = t[1]!;
            const d = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) || 1;
            const mid = { x: (a.pageX + b.pageX) / 2 - offset.current.x, y: (a.pageY + b.pageY) / 2 - offset.current.y };
            if (g.count !== 2) {
              g.count = 2;
              g.base = viewRef.current;
              g.d0 = d;
              g.mid0 = mid;
            }
            const s = clamp((g.base.s * d) / g.d0, MIN_SCALE, MAX_SCALE);
            const wx = (g.mid0.x - g.base.tx) / g.base.s;
            const wy = (g.mid0.y - g.base.ty) / g.base.s;
            applyView({ s, tx: mid.x - s * wx, ty: mid.y - s * wy });
          } else if (t.length === 1) {
            if (g.count !== 1) {
              g.count = 1;
              g.base = viewRef.current;
              g.origin = { x: t[0]!.pageX, y: t[0]!.pageY };
            }
            applyView({ s: g.base.s, tx: g.base.tx + (t[0]!.pageX - g.origin.x), ty: g.base.ty + (t[0]!.pageY - g.origin.y) });
          }
        },
        onPanResponderRelease: () => {
          gesture.current.count = 0;
        },
        onPanResponderTerminate: () => {
          gesture.current.count = 0;
        },
      }),
    [applyView],
  );

  const onViewportLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width: w, height: h } = e.nativeEvent.layout;
      setSize(previous => previous.w === w && previous.h === h ? previous : { w, h });
      viewportRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
        offset.current = { x: pageX, y: pageY };
      });
    },
    [],
  );

  const zoomBy = (factor: number) =>
    applyView(zoomAbout(viewRef.current, { x: size.w / 2, y: size.h / 2 }, factor));

  const focusPoint = (p: Pt) => applyView(centerOn(viewRef.current, p, size.w, size.h - 40));

  /* Arama / filtre */

  const submitSearch = () => {
    const first = chars.find((c) => matchIds?.has(c._id));
    if (!first) return showToast('Eşleşen karakter yok.');
    setLinkFrom(null);
    setSelectedNode(first._id);
    setSelectedEdge(null);
    const p = pos[first._id];
    if (p) focusPoint(centerOf(p));
  };
  const toggleType = (type: string) => {
    if (edgeObj?.type === type) setSelectedEdge(null);
    setHiddenTypes((hidden) => hidden.includes(type) ? hidden.filter((item) => item !== type) : [...hidden, type]);
  };

  const openNew = () => router.push(characterPath + '/new');
  const openDetail = (id: string) => router.push(characterPath + '/' + encodeURIComponent(id));
  const openEdit = (id: string) => router.push(characterPath + '/' + encodeURIComponent(id) + '/edit');

  const confirmDeleteRelation = (rel: CharacterRelation) => {
    const a = charById.get(rel.from)?.name ?? '?';
    const b = charById.get(rel.to)?.name ?? '?';
    Alert.alert('İlişki silinsin mi?', a + ' – ' + b, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          if (deletingRelation.current) return;
          deletingRelation.current = true;
          try {
            await deleteCharacterRelation(workId, rel._id);
            relationships.setData(previous => previous && { items: previous.items.filter(item => item._id !== rel._id) });
            setSelectedEdge(current => current === rel._id ? null : current);
          } catch (error) {
            showToast(message(error));
          } finally {
            deletingRelation.current = false;
          }
        },
      },
    ]);
  };

  const selectEdge = (rel: CharacterRelation) => {
    setLinkFrom(null);
    setSelectedNode(null);
    setSelectedEdge(rel._id);
  };

  /* ── Çizim ─────────────────────────────────────────────── */

  const c0 = WORLD / 2;
  const worldStyle = {
    transform: [{ translateX: view.tx - c0 * (1 - view.s) }, { translateY: view.ty - c0 * (1 - view.s) }, { scale: view.s }],
  };
  const pinScale = 1 / clamp(view.s, 0.6, 1.6);
  const bottomPad = insets.bottom + 12;
  const showFab = status === 'ready' && !nodeObj && !edgeObj && !linkFrom;
  const edgeMeta = edgeObj ? relationMeta(edgeObj.type) : null;
  const edgeStrength = clamp(Math.round(edgeObj?.strength ?? 3), 1, 5);

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right']}>
      {/* Tuval */}
      <View ref={viewportRef} style={styles.viewport} onLayout={onViewportLayout} {...background.panHandlers}>
        <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={tapBackground} />
        <View style={[styles.world, worldStyle]} pointerEvents="box-none">
          <Svg
            pointerEvents="none"
            style={{ position: 'absolute', left: box.x, top: box.y }}
            width={box.w}
            height={box.h}
            viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
          >
            {shapes.map(({ rel, shape }) => {
              const meta = relationMeta(rel.type);
              const isSelected = selectedEdge === rel._id;
              const related = selectedNode ? rel.from === selectedNode || rel.to === selectedNode : false;
              const opacity = isSelected ? 1 : selectedNode ? (related ? 0.95 : 0.12) : selectedEdge ? 0.3 : 0.75;
              return (
                <Fragment key={rel._id}>
                  {isSelected ? (
                    <Path d={shape.d} stroke={meta.color} strokeWidth={strokeFor(rel.strength) + 5} strokeOpacity={0.18} strokeLinecap="round" fill="none" />
                  ) : null}
                  <Path d={shape.d} stroke={meta.color} strokeWidth={strokeFor(rel.strength)} strokeLinecap="round" fill="none" opacity={opacity} />
                  {shape.arrow ? <Path d={shape.arrow} fill={meta.color} opacity={opacity} /> : null}
                </Fragment>
              );
            })}
          </Svg>

          {chars.map((c, i) => {
            const p = pos[c._id];
            if (!p) return null;
            const dimmed = (relatedIds ? !relatedIds.has(c._id) : false) || (matchIds ? !matchIds.has(c._id) : false);
            return (
              <NodeCard
                key={c._id}
                char={c}
                x={p.x}
                y={p.y}
                index={i}
                selected={selectedNode === c._id || linkFrom === c._id}
                opacity={dimmed ? 0.3 : 1}
                scaleRef={scaleRef}
                canDrag={canDrag}
                onCancel={cancelDrag}
                onMove={moveNode}
                onEnd={endNodeDrag}
                onTap={tapNode}
              />
            );
          })}

          {shapes.map(({ rel, shape }) => {
            const meta = relationMeta(rel.type);
            const isSelected = selectedEdge === rel._id;
            const related = selectedNode ? rel.from === selectedNode || rel.to === selectedNode : false;
            const dim = !!selectedNode && !related;
            return (
              <Pressable
                key={`pin-${rel._id}`}
                accessibilityRole="button"
                accessibilityLabel={[charById.get(rel.from)?.name, charById.get(rel.to)?.name, meta.label].join(' · ')}
                onPress={() => selectEdge(rel)}
                hitSlop={8}
                style={[styles.pin, { left: shape.mid.x - 18, top: shape.mid.y - 18, opacity: dim ? 0.15 : 1, transform: [{ scale: pinScale }] }]}
              >
                <View style={[styles.pinDot, { backgroundColor: meta.color }, isSelected && styles.pinDotSelected]} />
                {isSelected || related ? (
                  <View pointerEvents="none" style={styles.pinChip}>
                    <Text numberOfLines={1} style={styles.pinChipText}>
                      {meta.emoji} {meta.label}
                      {rel.label ? ` · ${rel.label}` : ''}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Arama ve tür filtresi */}
      <View style={styles.top} pointerEvents="box-none">
        <View style={styles.search}>
          <TextInput
            accessibilityLabel="Karakter ara"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submitSearch}
            placeholder="Karakter ara"
            placeholderTextColor={C.muted}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle" onPress={() => setQuery('')} hitSlop={10}>
              <Text style={styles.clear}>✕</Text>
            </Pressable>
          ) : null}
        </View>
        {typeCounts.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }} keyboardShouldPersistTaps="handled">
            {typeCounts.map(([type, count]) => {
              const m = relationMeta(type);
              const off = hiddenTypes.includes(type);
              return (
                <Pressable key={type} accessibilityRole="button" accessibilityLabel={m.label} accessibilityState={{ selected: !off }} onPress={() => toggleType(type)} style={[styles.chip, { borderColor: m.color }, off && { opacity: 0.4 }]}>
                  <Text style={styles.chipText}>
                    {m.emoji} {m.label} {count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {/* Yakınlaştırma */}
      <View style={styles.tools}>
        <Pressable accessibilityRole="button" accessibilityLabel="Yakınlaştır" style={styles.tool} onPress={() => zoomBy(1.3)}>
          <Text style={styles.toolText}>+</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Uzaklaştır" style={styles.tool} onPress={() => zoomBy(1 / 1.3)}>
          <Text style={styles.toolText}>−</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Haritayı ekrana sığdır" style={styles.tool} onPress={fit}>
          <Text style={styles.toolText}>⤢</Text>
        </Pressable>
      </View>

      {/* Alt çubuk: bağ kurma / bağ / karakter */}
      {linkFrom ? (
        <View style={[styles.bar, { bottom: bottomPad }]}>
          <Text style={styles.barTitle}>Bağ kurulacak karakteri seç</Text>
          <Text style={styles.barSub}>{charById.get(linkFrom)?.name} ile</Text>
          <View style={styles.row}>
            <Btn label="Vazgeç" onPress={() => setLinkFrom(null)} />
          </View>
        </View>
      ) : edgeObj && edgeMeta ? (
        <View style={[styles.bar, { bottom: bottomPad }]}>
          <Text style={styles.barTitle}>
            {charById.get(edgeObj.from)?.name ?? '?'} {edgeObj.directed === false ? '↔' : '→'} {charById.get(edgeObj.to)?.name ?? '?'}
          </Text>
          <Text style={styles.barSub}>
            {edgeMeta.emoji} {edgeMeta.label}   {'●'.repeat(edgeStrength)}
            {'○'.repeat(5 - edgeStrength)}
          </Text>
          {edgeObj.label ? <Text style={styles.barNote}>{edgeObj.label}</Text> : null}
          <View style={styles.row}>
            <Btn label="Bağı sil" kind="danger" onPress={() => confirmDeleteRelation(edgeObj)} />
            <Btn label="Kapat" onPress={() => setSelectedEdge(null)} />
          </View>
        </View>
      ) : nodeObj ? (
        <View style={[styles.bar, { bottom: bottomPad }]}>
          <View style={styles.row}>
            <Avatar name={nodeObj.name} color={colorOf(nodeObj)} size={38} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.barTitle}>{nodeObj.name}</Text>
              <Text numberOfLines={1} style={styles.barSub}>
                {nodeObj.role ? nodeObj.role + ' · ' : ''} {nodeRels.length} ilişki
              </Text>
            </View>
          </View>
          {nodeRels.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
              {nodeRels.map((rel) => {
                const p = relationPerspective(rel, nodeObj._id);
                const m = relationMeta(rel.type);
                return (
                  <Pressable
                    key={rel._id}
                    style={[styles.chip, { borderColor: m.color }]}
                    onPress={() => {
                      selectEdge(rel);
                      const shape = shapeById.get(rel._id);
                      if (shape) focusPoint(shape.mid);
                    }}
                  >
                    <Text style={styles.chipText}>
                      {arrowOf(p.direction)} {charById.get(p.otherId)?.name ?? '?'} · {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          <View style={styles.actions}>
            <Btn label="Bağ kur" kind="primary" disabled={chars.length < 2} onPress={() => setLinkFrom(nodeObj._id)} />
            <Btn label="Detay" onPress={() => openDetail(nodeObj._id)} />
            <Btn label="Düzenle" onPress={() => openEdit(nodeObj._id)} />
          </View>
        </View>
      ) : null}

      {showFab ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Yeni karakter ekle" style={[styles.fab, { bottom: bottomPad }]} onPress={openNew}>
          <Text style={styles.fabText}>+ Karakter</Text>
        </Pressable>
      ) : null}

      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <View style={styles.toastPill}>
            <Text accessibilityLiveRegion="polite" style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      ) : null}

      {status === 'ready' && chars.length === 0 ? (
        <View style={styles.empty} pointerEvents="none">
          <Text style={styles.barTitle}>Henüz karakter yok</Text>
          <Text style={styles.barSub}>Sağ alttaki “+ Karakter” ile ilk karakteri ekle.</Text>
        </View>
      ) : null}

      {status !== 'ready' ? (
        <View style={styles.overlay}>
          {status === 'loading' ? (
            <ActivityIndicator color={C.accent} />
          ) : (
            <>
              <Text style={styles.barTitle}>Harita yüklenemedi</Text>
              <Text style={[styles.barSub, { textAlign: 'center' }]}>{message(people.error || relationships.error)}</Text>
              <Btn label="Tekrar dene" kind="primary" onPress={() => { void people.reload(); void relationships.reload(); }} />
            </>
          )}
        </View>
      ) : null}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.board },
  viewport: { flex: 1, overflow: 'hidden' },
  world: { position: 'absolute', left: 0, top: 0, width: WORLD, height: WORLD },

  node: {
    position: 'absolute',
    width: NODE_W,
    height: NODE_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: '#cfd6e0',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  nodeStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  nodeName: { color: C.cardInk, userSelect: 'none', fontWeight: '700', fontSize: 12.5 },
  nodeRole: { color: '#5b6779', userSelect: 'none', fontSize: 11 },

  pin: { position: 'absolute', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', zIndex: 6 },
  pinDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: C.board },
  pinDotSelected: { width: 18, height: 18, borderRadius: 9, borderColor: '#ffffff' },
  pinChip: {
    position: 'absolute',
    left: 30,
    top: 6,
    maxWidth: 190,
    backgroundColor: C.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pinChipText: { color: C.text, fontSize: 12 },

  top: { position: 'absolute', left: 12, right: 12, top: 8, gap: 8 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 15 },
  clear: { color: C.muted, fontSize: 16 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.panel },
  chipText: { color: C.text, fontSize: 13 },

  tools: { position: 'absolute', right: 12, top: TOP_UI + 8, gap: 8 },
  tool: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: { color: C.text, fontSize: 20 },

  fab: {
    position: 'absolute',
    right: 16,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: C.accent,
    justifyContent: 'center',
    elevation: 5,
  },
  fabText: { color: C.onAccent, userSelect: 'none', fontWeight: '700', fontSize: 15 },

  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 14,
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
    elevation: 8,
  },
  barTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  barSub: { color: C.muted, fontSize: 13 },
  barNote: { color: C.text, fontSize: 13 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  btn: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panelHi,
  },
  btnPrimary: { backgroundColor: C.accent, borderColor: C.accent },
  btnDanger: { backgroundColor: 'transparent', borderColor: C.danger },
  btnText: { color: C.text, fontWeight: '600' },

  toast: { position: 'absolute', left: 24, right: 24, top: TOP_UI, alignItems: 'center' },
  toastPill: { backgroundColor: C.panelHi, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 10 },
  toastText: { color: C.text, fontSize: 13 },

  empty: { position: 'absolute', left: 24, right: 24, top: '40%', alignItems: 'center', gap: 6 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: C.board },
});
