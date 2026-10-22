import PushDevice from '../models/PushDevice.js';
import PushDelivery from '../models/PushDelivery.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import { passwordFingerprint } from './authSession.js';
export function pushMessage(token, notificationId) {
  // Lock screens never expose private drafts, authors, or moderation details.
  return { to: token, title: 'ACB Atölyesi', body: 'Atölyeden yeni bir bildirimin var.', sound: 'default', channelId: 'atelier', data: { notificationId: String(notificationId) } };
}
const headers = () => ({ 'Content-Type': 'application/json', ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) });
async function request(path, body) {
  const result = await fetch(`https://exp.host/--/api/v2/push/${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  if (!result.ok) throw new Error(`Expo push HTTP ${result.status}`);
  const value = await result.json();
  if (!value.data) throw new Error('Expo returned no delivery data');
  return value.data;
}
export async function drainPush() {
  // Run one worker per environment. Scanning is durable across outages; overlap covers late inserts.
  for (const device of await PushDevice.find().limit(10000)) {
    const account = await User.findOne({ _id: device.user, role: { $ne: 'banned' } }).select('sifreHash').lean();
    if (!account || !await AuthSession.exists({ tokenHash: device.sessionHash, user: device.user, expiresAt: { $gt: new Date() }, passwordFingerprint: passwordFingerprint(account) })) { await PushDevice.deleteOne({ _id: device._id }); await PushDelivery.deleteMany({ device: device._id }); continue; }
    const now = new Date(); const from = new Date(Math.max(+device.registeredAt, +(device.scanAt || device.registeredAt) - 300000));
    const notifications = await Notification.find({ recipient: device.user, createdAt: { $gte: from, $lte: now } }).sort({ createdAt: 1, _id: 1 }).limit(1000).select('_id createdAt').lean();
    for (const n of notifications) await PushDelivery.updateOne({ device: device._id, notification: n._id }, { $setOnInsert: { state: 'queued' } }, { upsert: true });
    device.scanAt = notifications.length === 1000 ? notifications.at(-1).createdAt : now;
    await device.save();
  }
  const deliveries = await PushDelivery.find({ state: 'queued', attempts: { $lt: 8 }, $or: [{ attemptedAt: null }, { attemptedAt: { $lt: new Date(Date.now() - 60000) } }] }).limit(100).populate('device').populate('notification');
  for (const delivery of deliveries) {
    const device = delivery.device; const n = delivery.notification;
    if (!device?.token || !n || String(n.recipient) !== String(device.user)) { delivery.state = 'failed'; delivery.error = 'Recipient unavailable'; await delivery.save(); continue; }
    delivery.attempts += 1; delivery.attemptedAt = new Date(); await delivery.save();
    try {
      const [ticket] = await request('send', [pushMessage(device.token, n._id)]);
      if (ticket?.status === 'ok' && ticket.id) { delivery.state = 'ticket'; delivery.ticket = ticket.id; }
      else { delivery.state = 'failed'; delivery.error = ticket?.details?.error || 'Invalid push ticket';
        if (ticket?.details?.error === 'DeviceNotRegistered') await PushDevice.deleteOne({ _id: device._id }); }
      await delivery.save();
    } catch (error) { delivery.error = error.message; if (delivery.attempts >= 8) delivery.state = 'failed'; await delivery.save(); }
  }
  const pending = await PushDelivery.find({ state: 'ticket', attemptedAt: { $lt: new Date(Date.now() - 900000) } }).limit(1000);
  if (pending.length) {
    const receipts = await request('getReceipts', { ids: pending.map(d => d.ticket) });
    for (const d of pending) {
      const r = receipts[d.ticket]; if (!r) { if (Date.now() - +d.attemptedAt > 86400000) { d.state = 'failed'; d.error = 'Receipt expired'; await d.save(); } continue; }
      d.state = r.status === 'ok' ? 'sent' : 'failed'; d.error = r.details?.error || '';
      if (r.details?.error === 'DeviceNotRegistered') await PushDevice.deleteOne({ _id: d.device });
      await d.save();
    }
  }
}
