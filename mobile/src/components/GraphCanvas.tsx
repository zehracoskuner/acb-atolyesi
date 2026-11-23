import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { fonts, IconButton, useUI } from '../ui';
import { focusNode, zoomAt, type Camera, type Point } from '../plotMap';

export type GraphNode = Point & { id: string; width: number; height: number; title: string; eyebrow?: string; detail?: string; kind?: 'person' };
export type GraphEdge = { id: string; from: string; to: string; label: string; type?: string; directed?: boolean };
export function GraphCanvas({ nodes, edges, selected, onSelect, focus, bands, footer, overview = false }: {
  nodes: GraphNode[]; edges: GraphEdge[]; selected?: string; onSelect: (id: string) => void; focus?: string;
  bands?: { id: string; label: string; x: number; width: number }[]; footer?: ReactNode; overview?: boolean;
}) {
  const { colors, styles } = useUI();
  const [camera, updateCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const current = useRef(camera); const origin = useRef(camera);
  const [size, setSize] = useState({ width: 320, height: 400 });
  const viewport = useRef<View>(null); const offset = useRef({ x: 0, y: 0 });
  const pinch = useRef<{ distance: number; center: Point } | null>(null);
  const dragged = useRef(false);
  const initialized = useRef(false);
  const move = (next: Camera) => { current.current = next; updateCamera(next); };
  const fit = (area: { width: number; height: number }) => {
    if (!nodes.length) return;
    const left = Math.min(...nodes.map(n => n.x)); const top = Math.min(...nodes.map(n => n.y));
    const width = Math.max(...nodes.map(n => n.x + n.width)) - left; const height = Math.max(...nodes.map(n => n.y + n.height)) - top;
    const zoom = Math.max(.55, Math.min(1, (area.width - 40) / width, (area.height - 70) / height));
    move({ zoom, x: (area.width - width * zoom) / 2 - left * zoom, y: (area.height - height * zoom) / 2 - top * zoom });
  };
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (event, gesture) => event.nativeEvent.touches.length > 1 || Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8,
    onMoveShouldSetPanResponderCapture: (event, gesture) => event.nativeEvent.touches.length > 1 || Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8,
    onPanResponderGrant: () => {
      origin.current = current.current; pinch.current = null; dragged.current = true;
      viewport.current?.measureInWindow((x, y) => { offset.current = { x, y }; });
    },
    onPanResponderMove: (event, gesture) => {
      const touches = event.nativeEvent.touches;
      const first = touches[0]; const second = touches[1];
      if (first && second) {
        const center = { x: (first.pageX + second.pageX) / 2 - offset.current.x, y: (first.pageY + second.pageY) / 2 - offset.current.y };
        const distance = Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
        if (!pinch.current) { pinch.current = { distance: Math.max(1, distance), center }; origin.current = current.current; }
        const next = zoomAt(origin.current, origin.current.zoom * distance / pinch.current.distance, pinch.current.center);
        move({ ...next, x: next.x + center.x - pinch.current.center.x, y: next.y + center.y - pinch.current.center.y });
      } else if (!pinch.current) move({ ...origin.current, x: origin.current.x + gesture.dx, y: origin.current.y + gesture.dy });
    },
    onPanResponderRelease: () => { pinch.current = null; },
    onPanResponderTerminate: () => { pinch.current = null; },
  }), []);
  const indexed = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
  // Search/act navigation moves the viewport without changing saved scene positions.
  const lastFocus = useRef('');
  useEffect(() => {
    const node = focus ? indexed.get(focus) : undefined;
    const key = node ? `${focus}:${node.x}:${node.y}:${size.width}:${size.height}` : '';
    if (!node) { lastFocus.current = ''; return; }
    if (lastFocus.current !== key) {
      lastFocus.current = key;
      const next = focusNode(node, size); current.current = next; updateCamera(next);
    }
  }, [focus, indexed, size]);
  const screen = (point: Point) => ({ x: point.x * camera.zoom + camera.x, y: point.y * camera.zoom + camera.y });
  const line = (a: Point, b: Point, color: string, key: string, dashed = false) => {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    return <View key={key} style={{ position: 'absolute', left: (a.x + b.x - length) / 2, top: (a.y + b.y) / 2, width: length, height: 0, borderTopWidth: 1.5, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid', transform: [{ rotate: `${Math.atan2(b.y - a.y, b.x - a.x)}rad` }] }}/>;
  };
  return <View style={{ flex: 1, minHeight: 0, backgroundColor: colors.soft }}>
    <View ref={viewport} testID="graph-canvas" onLayout={event => { setSize(event.nativeEvent.layout); if (overview && !initialized.current && nodes.length) { initialized.current = true; fit(event.nativeEvent.layout); } }} {...responder.panHandlers} style={{ flex: 1, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
        {bands?.map(band => <View key={band.id} style={{ position: 'absolute', left: band.x * camera.zoom + camera.x, top: 0, width: band.width * camera.zoom, height: '100%', borderRightWidth: 1, borderColor: colors.line }}><Text style={[styles.label, { margin: 16 }]}>{band.label}</Text></View>)}
        {edges.map(edge => {
          const from = indexed.get(edge.from); const to = indexed.get(edge.to); if (!from || !to) return null;
          const sameColumn = from.x === to.x;
          const backwards = to.x < from.x;
          const a = screen({ x: backwards ? from.x : from.x + from.width, y: from.y + from.height / 2 });
          const b = screen({ x: sameColumn || backwards ? to.x + to.width : to.x, y: to.y + to.height / 2 });
          const elbow = sameColumn ? a.x + 26 * camera.zoom : (a.x + b.x) / 2;
          const color = selected === edge.from || selected === edge.to ? colors.accent : colors.muted;
          const points = [a, { x: elbow, y: a.y }, { x: elbow, y: b.y }, b];
          const dashed = edge.type === 'kacis' || edge.type === 'zorunluluk';
          return <View key={edge.id} style={{ position: 'absolute', inset: 0, opacity: selected && selected !== edge.from && selected !== edge.to ? .22 : .8 }}>
            {points.slice(1).map((p, i) => line(points[i]!, p, color, `${edge.id}:${i}`, dashed))}
            {edge.directed !== false && <>{line(b, { x: b.x + (sameColumn || backwards ? 7 : -7), y: b.y - 5 }, color, 'arrow1')}{line(b, { x: b.x + (sameColumn || backwards ? 7 : -7), y: b.y + 5 }, color, 'arrow2')}</>}
            {(selected === edge.from || selected === edge.to) && <Text numberOfLines={1} style={{ position: 'absolute', left: elbow - 35, top: (a.y + b.y) / 2 - 9, maxWidth: 100, paddingHorizontal: 5, backgroundColor: colors.soft, color, fontFamily: fonts.medium, fontSize: 11 }}>{edge.label}</Text>}
          </View>;
        })}
      </View>
      {nodes.filter(node => {
        const p = screen(node); return p.x + node.width * camera.zoom > -20 && p.x < size.width + 20 && p.y + node.height * camera.zoom > 0 && p.y < size.height + 20;
      }).map(node => {
        const p = screen(node); const related = !selected || selected === node.id || edges.some(e => e.from === selected && e.to === node.id || e.to === selected && e.from === node.id);
        return <View key={node.id} style={{ position: 'absolute', left: p.x, top: p.y, width: node.width * camera.zoom, height: node.height * camera.zoom }}>
          <Pressable accessibilityRole="button" accessibilityLabel={node.title} accessibilityHint="Ayrıntıları ve bağlantıları aç" accessibilityState={{ selected: selected === node.id }} onPressIn={() => { dragged.current = false; }} onPress={() => { if (!dragged.current) onSelect(node.id); }} style={{ width: node.width, height: node.height, transformOrigin: 'top left', transform: [{ scale: camera.zoom }], padding: 16, gap: 7, borderWidth: selected === node.id ? 2 : 1, borderColor: selected === node.id ? colors.accent : colors.line, borderRadius: node.kind === 'person' ? node.width / 2 : 6, justifyContent: node.kind === 'person' ? 'center' : undefined, alignItems: node.kind === 'person' ? 'center' : undefined, backgroundColor: selected === node.id ? colors.pale : colors.card, opacity: related ? 1 : .5 }}>
            {!!node.eyebrow && <Text numberOfLines={1} style={styles.label}>{node.eyebrow}</Text>}
            <Text numberOfLines={2} style={{ fontFamily: fonts.display, fontSize: 19, lineHeight: 25, textAlign: node.kind === 'person' ? 'center' : 'left', color: colors.ink }}>{node.title}</Text>
            {!!node.detail && <Text numberOfLines={1} style={styles.muted}>{node.detail}</Text>}
          </Pressable>
        </View>;
      })}
    </View>
    <View style={{ position: 'absolute', right: 12, ...(size.height < 240 ? { bottom: 8, flexDirection: 'row' as const } : { top: 10 }), borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}>
      <IconButton icon="add-outline" label="Haritayı yakınlaştır" onPress={() => move(zoomAt(current.current, current.current.zoom + .2, { x: size.width / 2, y: size.height / 2 }))}/>
      <IconButton icon="remove-outline" label="Haritayı uzaklaştır" onPress={() => move(zoomAt(current.current, current.current.zoom - .2, { x: size.width / 2, y: size.height / 2 }))}/>
      <IconButton icon="locate-outline" label="Seçime odaklan" onPress={() => { const node = indexed.get(selected || '') || nodes[0]; if (node) move(focusNode(node, size)); }}/>
      <IconButton icon="scan-outline" label="Haritayı ortala" onPress={() => fit(size)}/>
    </View>
    {footer}
  </View>;
}
