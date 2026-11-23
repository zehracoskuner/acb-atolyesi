import mongoose from 'mongoose';
import Plot from '../models/Plot.js';
import Work from '../models/Work.js';
import User from '../models/User.js';
export const validPushToken = value => typeof value === 'string' && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/.test(value);
const fail = (status, message) => Object.assign(new Error(message), { status });
export async function verifyMobileEmail(token) {
  if (typeof token !== 'string' || !/^[a-f\d]{64}$/i.test(token)) throw fail(400, 'Doğrulama bağlantısı geçersiz.');
  const result = await User.updateOne({ emailVerifyToken: token, emailVerifyExpires: { $gt: new Date() } }, {
    $set: { emailVerified: true }, $unset: { emailVerifyToken: '', emailVerifyExpires: '' },
  });
  if (!result.matchedCount) throw fail(400, 'Doğrulama bağlantısı kullanılmış veya süresi dolmuş. Yeni bir kod iste.');
}
export async function reorderMobileScenes(workId, userId, { expectedUpdatedAt, sceneIds, act } = {}) {
  if (!mongoose.isValidObjectId(workId) || typeof act !== 'string' || !act || !Array.isArray(sceneIds) ||
      !sceneIds.length || sceneIds.length > 1000 || sceneIds.some(id => typeof id !== 'string' || !mongoose.isValidObjectId(id)) ||
      new Set(sceneIds).size !== sceneIds.length || typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
    throw fail(400, 'Geçersiz sahne sıralaması.');
  }
  if (!await Work.exists({ _id: workId, user: userId })) throw fail(403, 'Bu esere erişimin yok.');
  const plot = await Plot.findOne({ work: workId }).lean();
  if (!plot) throw fail(404, 'Olay örgüsü bulunamadı.');
  const actual = plot.scenes.filter(s => s.act === act).map(s => String(s._id));
  if (actual.length !== sceneIds.length || actual.some(id => !sceneIds.includes(id))) throw fail(409, 'Sahneler değişmiş. Listeyi yenile.');
  const update = Object.fromEntries(sceneIds.map((id, index) => [`scenes.$[s${index}].order`, index]));
  const result = await Plot.updateOne({ _id: plot._id, updatedAt: new Date(expectedUpdatedAt) }, { $set: update, $inc: { __v: 1 } }, {
    arrayFilters: sceneIds.map((id, index) => ({ [`s${index}._id`]: new mongoose.Types.ObjectId(id) })),
  });
  if (!result.matchedCount) throw fail(409, 'Olay örgüsü başka bir cihazda değişti. Listeyi yenile.');
}

// A single compare-and-swap updates both affected acts, including hidden scenes.
export async function moveMobileScene(workId, userId, { sceneId, act, beforeId = null, expectedUpdatedAt } = {}) {
  if (!mongoose.isValidObjectId(workId) || !mongoose.isValidObjectId(sceneId) ||
      typeof act !== 'string' || !act.trim() || act.length > 200 ||
      (beforeId !== null && !mongoose.isValidObjectId(beforeId)) ||
      typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt))) throw fail(400, 'Geçersiz taşıma isteği.');
  if (!await Work.exists({ _id: workId, user: userId })) throw fail(403, 'Bu esere erişimin yok.');
  const plot = await Plot.findOne({ work: workId }).lean();
  const scene = plot?.scenes.find(s => String(s._id) === sceneId);
  if (!scene) throw fail(404, 'Sahne bulunamadı.');
  const targetAct = act.trim();
  const sort = (a, b) => a.order - b.order || String(a._id).localeCompare(String(b._id));
  const target = plot.scenes.filter(s => s.act === targetAct && String(s._id) !== sceneId).sort(sort);
  const index = beforeId === null ? target.length : target.findIndex(s => String(s._id) === beforeId);
  if (index < 0) throw fail(409, 'Hedef sahne değişmiş. Haritayı yenile.');
  target.splice(index, 0, scene);
  const groups = scene.act === targetAct ? [target] : [plot.scenes.filter(s => s.act === scene.act && String(s._id) !== sceneId).sort(sort), target];
  const patch = {};
  for (const group of groups) group.forEach((s, order) => {
    const i = plot.scenes.findIndex(item => String(item._id) === String(s._id));
    patch[`scenes.${i}.order`] = order;
    patch[`scenes.${i}.updatedAt`] = new Date();
    if (String(s._id) === sceneId) patch[`scenes.${i}.act`] = targetAct;
  });
  patch.updatedAt = new Date(Math.max(Date.now(), new Date(plot.updatedAt).getTime() + 1));
  const result = await Plot.updateOne({ _id: plot._id, updatedAt: new Date(expectedUpdatedAt), __v: plot.__v }, { $set: patch, $inc: { __v: 1 } }, { timestamps: false });
  if (!result.matchedCount) throw fail(409, 'Olay örgüsü başka bir cihazda değişti. Harita yenilendi; taşımayı tekrar seç.');
}
