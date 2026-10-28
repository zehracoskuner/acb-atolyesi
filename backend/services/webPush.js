import webpush from 'web-push';
import Subscription from '../models/WebPushSubscription.js';
import Delivery from '../models/WebPushDelivery.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import { passwordFingerprint } from './authSession.js';

export function webPushConfig() {
  const { WEB_PUSH_PUBLIC_KEY: publicKey, WEB_PUSH_PRIVATE_KEY: privateKey, WEB_PUSH_SUBJECT: subject } = process.env;
  if (!publicKey || !privateKey || !subject) return null;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { publicKey, privateKey, subject };
}

// Never allow an authenticated subscription to turn the worker into an arbitrary HTTP client.
export function validateSubscription(value) {
  const invalid = () => { throw Object.assign(new Error('Geçersiz tarayıcı aboneliği.'), { status: 400 }); };
  if (typeof value?.endpoint !== 'string' || value.endpoint.length > 2048) invalid();
  let url; try { url = new URL(value.endpoint); } catch { invalid(); }
  const host = url.hostname;
  const allowed = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com'
    || host === 'push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com')
    || host === 'web.push.apple.com' || host.endsWith('.notify.windows.com');
  if (!allowed || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) invalid();
  for (const [key, size] of [['p256dh', 65], ['auth', 16]]) {
    const item = value.keys?.[key];
    if (typeof item !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(item) || Buffer.from(item, 'base64url').length !== size) invalid();
  }
  if (Buffer.from(value.keys.p256dh, 'base64url')[0] !== 4) invalid();
  return { endpoint: value.endpoint, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } };
}

export async function activeSubscription(sub) {
  const user = await User.findOne({ _id: sub.user, role: { $ne: 'banned' } }).select('sifreHash').lean();
  return !!user && !!await AuthSession.exists({ tokenHash: sub.sessionHash, user: sub.user,
    expiresAt: { $gt: new Date() }, passwordFingerprint: passwordFingerprint(user) });
}
export async function removeSubscription(id) {
  await Subscription.deleteOne({ _id: id });
  await Delivery.deleteMany({ subscription: id });
}
export function webPushPayload(notification) {
  // Public lock screens must not reveal private text or moderation details.
  return JSON.stringify({ title: 'ACB Atölyesi', body: 'Atölyeden yeni bir bildirimin var.',
    notificationId: String(notification._id), url: '/bildirimler' });
}

export async function drainWebPush() {
  const vapidDetails = webPushConfig();
  if (!vapidDetails) throw new Error('Web Push yapılandırması eksik.');
  for await (const sub of Subscription.find().cursor()) {
    if (!await activeSubscription(sub)) { await removeSubscription(sub._id); continue; }
    const until = new Date();
    const from = new Date(Math.max(+sub.registeredAt, +(sub.scanAt || sub.registeredAt) - 300000));
    // Cursor avoids dropping notifications when a recipient has more than one batch.
    for await (const n of Notification.find({ recipient: sub.user, createdAt: { $gte: from, $lte: until } }).select('_id').cursor()) {
      await Delivery.updateOne({ subscription: sub._id, notification: n._id }, { $setOnInsert: { state: 'queued' } }, { upsert: true });
    }
    await Subscription.updateOne({ _id: sub._id, sessionHash: sub.sessionHash }, { $set: { scanAt: until } });
  }
  const pending = await Delivery.find({ state: 'queued', attempts: { $lt: 8 },
    $or: [{ attemptedAt: null }, { attemptedAt: { $lt: new Date(Date.now() - 60000) } }] }).limit(100);
  for (const delivery of pending) {
    const sub = await Subscription.findById(delivery.subscription);
    if (!sub || !await activeSubscription(sub)) {
      if (sub) await removeSubscription(sub._id);
      else await Delivery.deleteOne({ _id: delivery._id });
      continue;
    }
    const notification = await Notification.findOne({ _id: delivery.notification, recipient: sub.user,
      read: false, createdAt: { $gte: sub.registeredAt } }).lean();
    if (!notification) { delivery.state = 'failed'; delivery.error = 'Notification unavailable or read'; await delivery.save(); continue; }
    delivery.attempts += 1; delivery.attemptedAt = new Date(); await delivery.save();
    try {
      const subscription = validateSubscription(sub.toObject());
      await webpush.sendNotification(subscription, webPushPayload(notification), {
        vapidDetails, TTL: 3600, timeout: 10000, urgency: 'normal', topic: String(notification._id),
      });
      delivery.state = 'sent'; delivery.error = undefined;
    } catch (error) {
      if ([404, 410].includes(error.statusCode)) { await removeSubscription(sub._id); continue; }
      delivery.error = `Push delivery failed (${error.statusCode || error.status || 'network'})`;
      if (delivery.attempts >= 8 || error.status === 400 || [400, 401, 403, 413].includes(error.statusCode)) delivery.state = 'failed';
    }
    await delivery.save();
  }
}
