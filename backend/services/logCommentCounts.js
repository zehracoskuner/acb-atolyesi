import LogComment from "../models/LogComment.js";

export async function logCommentCounts(logs) {
  if (!logs.length) return new Map();
  const counts = await LogComment.aggregate([
    { $match: { log: { $in: logs.map(log => log._id) } } },
    { $group: { _id: "$log", count: { $sum: 1 } } },
  ]);
  return new Map(counts.map(row => [String(row._id), row.count]));
}
