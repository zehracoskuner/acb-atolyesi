import Comment from '../models/Comment.js';
import InlineComment from '../models/InlineComment.js';

// Both existing collections use the general report targetType "comment".
export async function commentTarget(id) {
  return await Comment.findById(id) || await InlineComment.findById(id);
}
