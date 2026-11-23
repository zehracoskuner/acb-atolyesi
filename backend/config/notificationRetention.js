// Shared by the web/mobile inbox and their delivery records. Reading a
// notification never extends its lifetime: retention starts at creation.
export const NOTIFICATION_RETENTION_SECONDS = 90 * 24 * 60 * 60;

export function notificationCutoff(now = Date.now()) {
  return new Date(now - NOTIFICATION_RETENTION_SECONDS * 1000);
}
