import 'dotenv/config';
import mongoose from 'mongoose';
import PushDevice from '../models/PushDevice.js';
import PushDelivery from '../models/PushDelivery.js';
import { drainPush } from '../services/pushDelivery.js';
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required for the push worker.');
await mongoose.connect(process.env.MONGO_URI);
await Promise.all([PushDevice.init(), PushDelivery.init()]);
let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });
while (running) {
  try { await drainPush(); } catch (error) { console.error('Mobile push worker:', error.message); }
  if (process.argv.includes('--once')) break;
  await new Promise(resolve => setTimeout(resolve, 10000));
}
await mongoose.disconnect();
