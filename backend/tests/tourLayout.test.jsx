import React from '../../frontend/node_modules/react/index.js';
import { renderToStaticMarkup } from '../../frontend/node_modules/react-dom/server.node.js';
import { MemoryRouter } from '../../frontend/node_modules/react-router-dom/dist/index.mjs';
import { beforeEach, describe, it, expect, vi } from 'vitest';
const data=vi.hoisted(()=>({session:{}}));
vi.mock('../../frontend/src/lib/session',()=>({useSession:()=>data.session}));
vi.mock('../../frontend/src/components/tour/TourManager',()=>({TourManager:props=><span>tour:{props.userId}</span>}));
import Layout from '../../frontend/src/components/Layout.jsx';
beforeEach(()=>{globalThis.React=React;});
const render=()=>renderToStaticMarkup(<MemoryRouter><Layout/></MemoryRouter>);
describe('tour session boundary',()=>{
 it.each(['guest','checking','error'])('never mounts a tour while %s',status=>{data.session={status,user:null};expect(render()).not.toContain('tour:');});
 it.each([{profileComplete:false,requiresTermsAcceptance:false},{profileComplete:true,requiresTermsAcceptance:true}])('waits for membership prerequisites',user=>{data.session={status:'authenticated',user:{_id:'a',...user}};expect(render()).not.toContain('tour:');});
 it('uses the current account identity without needing works',()=>{for(const id of ['a','b']){data.session={status:'authenticated',user:{_id:id,profileComplete:true,birthYear:1990,requiresTermsAcceptance:false}};expect(render()).toContain(`tour:${id}`);}});
 it('waits for the missing birth year after restoring a legacy session',()=>{data.session={status:'authenticated',user:{_id:'legacy',profileComplete:true,requiresTermsAcceptance:false}};expect(render()).not.toContain('tour:');});
});
