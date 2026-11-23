import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Scene } from '../src/types';

const state = vi.hoisted(() => ({ lists: [] as { data: Scene[]; initialNumToRender: number; windowSize: number }[] }));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>, Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Modal: ({ visible, children }: React.PropsWithChildren<{ visible: boolean }>) => visible ? <div>{children}</div> : null,
  KeyboardAvoidingView: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  // Simulate the initial viewport; assert that actual component uses the virtualized list.
  FlatList: (props: { data: Scene[]; initialNumToRender: number; windowSize: number; ListHeaderComponent?: React.ReactNode; ListEmptyComponent?: React.ReactNode; renderItem: (arg: { item: Scene }) => React.ReactNode }) => {
    state.lists.push(props);
    return <div>{props.ListHeaderComponent}{props.data.length ? props.data.slice(0, props.initialNumToRender).map(item => <div key={item._id}>{props.renderItem({ item })}</div>) : props.ListEmptyComponent}</div>;
  },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock('../src/ui', () => ({
  useUI: () => ({ styles: {} }), Button: ({ title }: { title: string }) => <button>{title}</button>, Field: () => null, ErrorBox: () => null,
  Empty: ({ title }: { title: string }) => <p>{title}</p>, useAction: () => ({ busy: false, error: null, run: vi.fn() }),
}));
import { SceneList } from '../src/components/SceneList';
const scenes: Scene[] = Array.from({ length: 100 }, (_, i) => ({ _id: String(i), title: `Sahne ${i}`, act: i < 50 ? 'giris' : 'sonuc', description: '', goal: '', order: i, status: 'idea', connections: i === 0 ? [{ target: '99', edgeType: 'sonuc' }] : [] }));
const props = { scenes, acts: [{ id: 'giris', label: 'Giriş' }], header: <p>Hikâye araçları</p>, busy: false, editing: false, onEdit: vi.fn(), onDelete: vi.fn(), onReorder: vi.fn(), onConnection: vi.fn() };
beforeEach(() => { state.lists = []; });
it('renders a bounded viewport for a hundred scenes and only existing links, without mounting the target panel', () => {
  const markup = renderToStaticMarkup(<SceneList {...props} filter=""/>);
  expect(state.lists).toHaveLength(1); expect(state.lists[0]?.data).toHaveLength(100);
  expect(state.lists[0]?.initialNumToRender).toBe(6); expect(state.lists[0]?.windowSize).toBe(5);
  expect(markup.match(/Bağlantı ekle/g)).toHaveLength(6);
  expect(markup).toContain('Sahne 99'); expect(markup).not.toContain('Sahne 98');
  expect(markup).not.toContain('Sahne ara'); expect(markup).not.toContain('Bu sahneye bağla');
});
it('keeps act filtering and empty states inside the virtualized list', () => {
  renderToStaticMarkup(<SceneList {...props} filter="sonuc"/>);
  expect(state.lists[0]?.data).toHaveLength(50); expect(state.lists[0]?.data[0]?._id).toBe('50');
  const markup = renderToStaticMarkup(<SceneList {...props} filter="missing"/>);
  expect(markup).toContain('Bu perdede henüz sahne yok.'); expect(markup).toContain('Hikâye araçları');
});
