import { beforeEach, describe, it, expect, vi } from 'vitest';
vi.mock('../models/ReadingProgress.js',()=>({default:{findOneAndUpdate:vi.fn(),findOne:vi.fn(),deleteOne:vi.fn()}}));
vi.mock('../models/Chapter.js',()=>({default:{findOne:vi.fn()}}));
vi.mock('../models/Work.js',()=>({default:{findById:vi.fn()}}));
import Progress from '../models/ReadingProgress.js';import Chapter from '../models/Chapter.js';import Work from '../models/Work.js';
import {trackProgress,getProgressByStory,clearProgress} from '../controllers/readingProgressController.js';
const storyId='000000000000000000000001',chapterId='000000000000000000000002';
const query=value=>({select:()=>({lean:async()=>value}),lean:async()=>value});const response=()=>({status:vi.fn().mockReturnThis(),json:vi.fn().mockReturnThis()});
beforeEach(()=>{vi.clearAllMocks();Work.findById.mockReturnValue(query({publishedChapterIds:[chapterId]}));Chapter.findOne.mockReturnValue(query({order:2,title:'Chapter'}));});
describe('Reading progress API',()=>{
 it('validates work/chapter membership and scopes writes to user',async()=>{const req={user:{id:'a'},body:{storyId,chapterId,scrollPosition:43}};await trackProgress(req,response());expect(Chapter.findOne).toHaveBeenCalledWith({_id:chapterId,work:storyId,status:'published'});expect(Progress.findOneAndUpdate.mock.calls[0][0]).toEqual({user:'a',story:storyId});Work.findById.mockReturnValue(query({publishedChapterIds:[]}));await trackProgress(req,response());expect(Progress.findOneAndUpdate).toHaveBeenCalledTimes(1);});
 it('rejects invalid positions without writes',async()=>{const res=response();await trackProgress({user:{id:'a'},body:{storyId,chapterId,scrollPosition:'NaN'}},res);expect(res.status).toHaveBeenCalledWith(400);expect(Progress.findOneAndUpdate).not.toHaveBeenCalled();});
 it('returns chapter metadata and rejects missing chapters',async()=>{Progress.findOne.mockReturnValue(query({chapter:chapterId,scrollPosition:74,updatedAt:'today'}));const res=response();await getProgressByStory({user:{id:'b'},params:{storyId}},res);expect(Progress.findOne).toHaveBeenCalledWith({user:'b',story:storyId});expect(res.json).toHaveBeenCalledWith({found:true,chapterId,scrollPosition:74,chapterNumber:2,chapterTitle:'Chapter',updatedAt:'today'});Chapter.findOne.mockReturnValue(query(null));await getProgressByStory({user:{id:'b'},params:{storyId}},res);expect(res.json).toHaveBeenLastCalledWith({found:false});});
 it('deletes only the requested user/work',async()=>{await clearProgress({user:{id:'b'},params:{storyId}},response());expect(Progress.deleteOne).toHaveBeenCalledWith({user:'b',story:storyId});});
});
