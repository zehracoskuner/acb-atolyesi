import Notification from '../models/Notification.js';
import PushDelivery from '../models/PushDelivery.js';
import WebPushDelivery from '../models/WebPushDelivery.js';
import { NOTIFICATION_RETENTION_SECONDS } from '../config/notificationRetention.js';

export async function prepareNotificationRetention() {
  // Explicitly install/verify TTL even when automatic model indexes are disabled.
  // Do not silently start with an incompatible index and unbounded storage.
  await Promise.all([Notification, PushDelivery, WebPushDelivery].map(model =>
    model.collection.createIndex({ createdAt: 1 }, {
      expireAfterSeconds: NOTIFICATION_RETENTION_SECONDS,
    })
  ));
}
