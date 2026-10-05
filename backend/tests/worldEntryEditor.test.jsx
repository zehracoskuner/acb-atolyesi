import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const hooks = vi.hoisted(() => ({ values: [], cursor: 0 }));
vi.mock("../../frontend/node_modules/react/index.js", async original => {
  const React = await original();
  globalThis.React = React;
  return { ...React, useEffect: () => {},
    useState(initial) {
      const i = hooks.cursor++;
      if (!(i in hooks.values)) hooks.values[i] = typeof initial === "function" ? initial() : initial;
      return [hooks.values[i], value => { hooks.values[i] = typeof value === "function" ? value(hooks.values[i]) : value; }];
    },
    useRef(initial) {
      const i = hooks.cursor++;
      if (!(i in hooks.values)) hooks.values[i] = { current: initial };
      return hooks.values[i];
    },
  };
});
import WorldEntryModal from "../../frontend/src/components/plotworld/WorldEntryModal.jsx";
const all = node => Array.isArray(node) ? node.flatMap(all) : node?.props ? [node, ...all(node.props.children)] : [];
let props;
const render = () => { hooks.cursor = 0; return all(WorldEntryModal(props)); };
const closeButton = tree => tree.find(n => n.type === "button" && n.props.children === "← Listeye dön");
beforeEach(() => {
  hooks.values = [];
  props = { category: "notes", initial: { name: "Deneme", description: "Eski metin" }, onSave: vi.fn(), onClose: vi.fn(), saving: false };
});
afterEach(() => vi.restoreAllMocks());
describe("world entry editor save-on-close", () => {
  it("closes an unchanged entry without a write", async () => {
    await closeButton(render()).props.onClick();
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledOnce();
  });
  it("waits for server success before closing", async () => {
    let resolve;
    props.onSave.mockImplementation(() => new Promise(r => { resolve = r; }));
    render().find(n => n.type === "textarea").props.onChange({ target: { value: "Uzun yeni metin" } });
    const closing = closeButton(render()).props.onClick();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ description: "Uzun yeni metin" }));
    expect(props.onClose).not.toHaveBeenCalled();
    resolve(true); await closing;
    expect(props.onClose).toHaveBeenCalledOnce();
  });
  it("retains edited text after failure and permits retry", async () => {
    props.onSave.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render().find(n => n.type === "textarea").props.onChange({ target: { value: "Korunacak metin" } });
    await closeButton(render()).props.onClick();
    expect(props.onClose).not.toHaveBeenCalled();
    const tree = render();
    expect(tree.find(n => n.type === "textarea").props.value).toBe("Korunacak metin");
    expect(tree.find(n => n.props.role === "status").props.children).toContain("Kaydedilemedi");
    await closeButton(tree).props.onClick();
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
