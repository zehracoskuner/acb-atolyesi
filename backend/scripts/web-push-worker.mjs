import 'dotenv/config';
import mongoose from 'mongoose';
import Subscription from '../models/WebPushSubscription.js';
import Delivery from '../models/WebPushDelivery.js';
import { drainWebPush, webPushConfig } from '../services/webPush.js';
if (!process.env.MONGO_URI || !webPushConfig()) throw new Error('MONGO_URI ve WEB_PUSH_* ayarları gerekli.');
await mongoose.connect(process.env.MONGO_URI);
await Promise.all([Subscription.init(), Delivery.init()]);
let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });
try {
  while (running) {
    try { await drainWebPush(); } catch { console.error('Web Push döngüsü başarısız; yeniden denenecek.'); }
    if (process.argv.includes('--once')) break;
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
} finally { await mongoose.disconnect(); }
