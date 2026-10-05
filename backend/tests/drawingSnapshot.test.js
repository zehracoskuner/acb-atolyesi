import { describe, it, expect } from "vitest";
import { createTLStore, defaultShapeUtils, loadSnapshot, PageRecordType } from "../../frontend/node_modules/tldraw/dist-esm/index.mjs";
import { CharacterShapeUtil } from "../../frontend/src/components/plotworld/CharacterShape.jsx";
describe('installed tldraw 4.5.10 snapshots', () => {
  it('roundtrips custom character and deletion with legacy and document snapshots', () => {
    const make = () => createTLStore({ shapeUtils: [...defaultShapeUtils, CharacterShapeUtil] });
    const store=make();
    store.put([PageRecordType.create({id:'page:page',name:'Page',index:'a1'})]);
    store.put([{id:'shape:character',typeName:'shape',type:'character',x:1,y:2,rotation:0,index:'a1',parentId:'page:page',isLocked:false,opacity:1,meta:{},props:{name:'Çağrı Şen',color:'#ff0000',role:'Başrol',charId:'abc',w:80,h:96}}]);
    const old=store.getStoreSnapshot(); const next=make(); loadSnapshot(next,old);
    expect(next.get('shape:character').props.name).toBe('Çağrı Şen');
    const character = next.get('shape:character');
    next.put([{ ...character, x: 200, props: { ...character.props, name: 'Öykü', role: 'Yeni rol' } }]);
    const again=make(); loadSnapshot(again,{document:next.getStoreSnapshot()}); expect(again.get('shape:character')).toEqual(next.get('shape:character'));
    next.remove(['shape:character']); loadSnapshot(again,{document:next.getStoreSnapshot()}); expect(again.get('shape:character')).toBeUndefined();
  });
});
