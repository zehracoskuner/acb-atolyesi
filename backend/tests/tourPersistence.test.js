import { describe, it, expect, vi, afterEach } from 'vitest';
import router from '../routes/user.js';
import User from '../models/User.js';
const handler=router.stack.find(layer=>layer.route?.path==='/tour-complete').route.stack[0].handle;
async function call(body,user='account-a'){
 const res={status:vi.fn().mockReturnThis(),json:vi.fn()};await handler({body,user:{id:user}},res);return res;
}
afterEach(()=>vi.restoreAllMocks());
describe('versioned account tour persistence',()=>{
 it('updates only the authenticated account tour preference',async()=>{
  const update=vi.spyOn(User,'updateOne').mockResolvedValue({modifiedCount:1});
  await call({tour:'general',version:'2026-09-24',status:'completed',userId:'another-account'});
  expect(update).toHaveBeenCalledWith({_id:'account-a'},{$set:{'tourProgress.2026-09-24_general':'completed'}});
 });
 it.each([{tour:'$bad',version:'2026-09-24',status:'completed'},{tour:'plot',version:'a.b',status:'completed'},{tour:'plot',version:'2026-09-24',status:'published'}])('rejects unsafe or unknown keys before writing',async body=>{
  const update=vi.spyOn(User,'updateOne').mockResolvedValue({});const res=await call(body);expect(res.status).toHaveBeenCalledWith(400);expect(update).not.toHaveBeenCalled();
 });
 it('does not let late invitations or restarts overwrite completion',async()=>{
  const update=vi.spyOn(User,'updateOne').mockResolvedValue({});
  await call({tour:'general',version:'2026-09-24',status:'invited'});expect(update.mock.calls[0][0]['tourProgress.2026-09-24_general']).toEqual({$exists:false});
  await call({tour:'general',version:'2026-09-24',status:'started'});expect(update.mock.calls[1][0]['tourProgress.2026-09-24_general']).toEqual({$ne:'completed'});
 });
 it('keeps legacy clients and existing completion intact',async()=>{
  const update=vi.spyOn(User,'updateOne').mockResolvedValue({});await call({});expect(update).toHaveBeenCalledWith({_id:'account-a'},{$set:{tourCompleted:true}});
 });
 it('returns versioned choices through the existing safe session serializer',()=>{
  const user=new User({tourCompleted:true,tourProgress:{'2026-09-24_general':'skipped'}});
  expect(user.toSafeJSON()).toMatchObject({tourCompleted:true,tourProgress:{'2026-09-24_general':'skipped'}});
 });
});
