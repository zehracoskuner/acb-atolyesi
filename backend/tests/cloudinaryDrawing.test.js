import { Writable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('cloudinary',()=>({v2:{config:vi.fn(),uploader:{upload_stream:vi.fn(),destroy:vi.fn()}}}));
import {v2 as cloudinary} from 'cloudinary';
import {uploadDrawingSnapshot} from '../services/cloudinaryDrawing.js';
let payloads;
beforeEach(()=>{
  vi.clearAllMocks();payloads=[];
  cloudinary.uploader.upload_stream.mockImplementation((options,callback)=>{
    const chunks=[]; return new Writable({write(chunk,encoding,next){chunks.push(chunk);next();},final(next){payloads.push(Buffer.concat(chunks).toString('utf8'));callback(null,{secure_url:'https://test/'+options.public_id,public_id:options.public_id});next();}});
  });
});
describe('Cloudinary drawing adapter with mocked upload transport',()=>{
  it('uses immutable distinct objects and preserves unicode and empty documents',async()=>{
    const snapshot={document:{schema:{},store:{name:'Çağrı Öykü'}}};
    const a=await uploadDrawingSnapshot(snapshot,'work');
    const b=await uploadDrawingSnapshot({document:{schema:{},store:{}}},'work');
    expect(a.publicId).not.toBe(b.publicId); expect(JSON.parse(payloads[0])).toEqual(snapshot);
    expect(JSON.parse(payloads[1]).document.store).toEqual({});
    expect(cloudinary.uploader.upload_stream.mock.calls[0][0]).toMatchObject({resource_type:'raw',overwrite:false});
  });
  it('rejects oversize data before opening a storage upload',async()=>{
    await expect(uploadDrawingSnapshot({document:{schema:{},store:{}},large:'x'.repeat(9*1024*1024)},'work')).rejects.toMatchObject({status:413});
    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  });
});
