import express from 'express';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
vi.mock('../middlewares/ensureAuth.js',()=>({default:(req,res,next)=>{ if(req.headers.authorization!=='test') return res.sendStatus(401); req.user={id:'owner'}; next(); }}));
vi.mock('../models/Work.js',()=>({default:{findById:vi.fn()}}));
vi.mock('../models/Drawing.js',()=>({default:{findOne:vi.fn(),create:vi.fn(),findOneAndUpdate:vi.fn()}}));
vi.mock('../services/cloudinaryDrawing.js',()=>({uploadDrawingSnapshot:vi.fn(),deleteDrawingSnapshot:vi.fn(async()=>{})}));
import Work from '../models/Work.js';
import Drawing from '../models/Drawing.js';
import {uploadDrawingSnapshot,deleteDrawingSnapshot} from '../services/cloudinaryDrawing.js';
import router from '../routes/drawing.js';
import {DRAWING_BODY_LIMIT} from '../../shared/drawingProtocol.js';
let server,url,row;
const work='507f1f77bcf86cd799439011';
const snapshot={document:{schema:{},store:{}}};
const body=(revision=0,id='mutation-00000001')=>({snapshot,expectedRevision:revision,mutationId:id});
async function request(method='PATCH',payload=body(),auth='test') {
  const r=await fetch(url+'/'+work,{method,headers:{authorization:auth,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(payload)})});
  return {status:r.status,data:await r.json().catch(()=>null)};
}
beforeAll(async()=>{const app=express();app.use(express.json({limit:DRAWING_BODY_LIMIT}),router); server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));url=`http://127.0.0.1:${server.address().port}`;});
afterAll(()=>new Promise(r=>server.close(r)));
beforeEach(()=>{
  vi.clearAllMocks();row=null;
  Work.findById.mockReturnValue({select:()=>({lean:async()=>({user:'owner'})})});
  Drawing.findOne.mockImplementation(()=>({lean:async()=>row?{...row}:null}));
  Drawing.create.mockImplementation(async value=>{if(row)throw Object.assign(new Error(),{code:11000});return row={_id:'drawing',...value};});
  Drawing.findOneAndUpdate.mockImplementation(async(filter,update)=>{const rev=filter.revision??0;if((row.revision||0)!==rev)return null;return row={...row,...update.$set};});
  uploadDrawingSnapshot.mockImplementation(async()=>({url:'https://example.test/new',publicId:'new'}));
});
describe('drawing HTTP routes with mocked MongoDB and Cloudinary',()=>{
  it('distinguishes no drawing, saves and returns metadata; retry is idempotent',async()=>{
    expect((await request('GET')).data).toMatchObject({snapshotUrl:null,revision:0,userId:'owner'});
    expect((await request()).data).toMatchObject({ok:true,workId:work,revision:1});
    expect((await request()).status).toBe(200);expect(uploadDrawingSnapshot).toHaveBeenCalledTimes(1);
    expect((await request('GET')).data.snapshotUrl).toContain('/new');
  });
  it('rejects old revisions and keeps current storage untouched',async()=>{
    await request();expect((await request('PATCH',body(0,'mutation-00000002'))).status).toBe(409);
    expect(uploadDrawingSnapshot).toHaveBeenCalledTimes(1);expect(row.revision).toBe(1);
  });
  it('upload failure does not replace the current drawing',async()=>{
    await request();const prior={...row};uploadDrawingSnapshot.mockRejectedValueOnce(new Error('offline'));
    expect((await request('PATCH',body(1,'mutation-00000002'))).status).toBe(500);expect(row).toEqual(prior);
  });
  it('two concurrent initial writes cannot both commit',async()=>{
    let release;const gate=new Promise(r=>release=r);let count=0;
    uploadDrawingSnapshot.mockImplementation(async()=>{if(++count===2)release();await gate;return {url:'unique',publicId:'unique'+count};});
    const results=await Promise.all([request(),request('PATCH',body(0,'mutation-00000002'))]);
    expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect(row.revision).toBe(1);
  });
  it('requires authorization and ownership',async()=>{
    expect((await request('PATCH',body(),'bad')).status).toBe(401);
    Work.findById.mockReturnValue({select:()=>({lean:async()=>({user:'other'})})});
    expect((await request()).status).toBe(403);expect(uploadDrawingSnapshot).not.toHaveBeenCalled();
  });
  it('validates snapshot and UTF-8 size before uploading',async()=>{
    expect((await request('PATCH',{...body(),snapshot:{}})).status).toBe(400);
    expect((await request('PATCH',{...body(),snapshot:{...snapshot,extra:'x'.repeat(9*1024*1024)}})).status).toBe(413);
    expect(uploadDrawingSnapshot).not.toHaveBeenCalled();
  });
  it('deletes with a revision, so an earlier write cannot resurrect it',async()=>{
    await request();expect((await request('DELETE',body(1,'mutation-00000002'))).status).toBe(200);
    expect(row.snapshotUrl).toBeNull();expect(row.revision).toBe(2);
    expect((await request('PATCH',body(1,'mutation-00000003'))).status).toBe(409);
  });
});
