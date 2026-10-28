import { apiGet, apiPost } from './api';
export const supportsWebPush = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
let audio;
export function unlockPushSound() {
  if (localStorage.getItem('acb_push_sound') !== 'on') return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  audio ||= new Audio();
  audio.resume().catch(() => {});
}
export function playPushSound() {
  if (localStorage.getItem('acb_push_sound') !== 'on' || audio?.state !== 'running') return;
  [660, 880].forEach((frequency, i) => {
    const oscillator = audio.createOscillator(); const gain = audio.createGain();
    const at = audio.currentTime + i * 0.13;
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.055, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.35);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(at); oscillator.stop(at + 0.36);
  });
}
export async function preparePush() {
  const config = await apiGet('/notifications/push/config');
  if (!config.enabled) return { config, registration: null };
  await navigator.serviceWorker.register('/push-sw.js', { scope: '/', updateViaCache: 'none' });
  const registration = await navigator.serviceWorker.ready;
  return { config, registration };
}
export async function syncExistingPush() {
  if (!supportsWebPush() || Notification.permission !== 'granted') return;
  const { registration } = await preparePush();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await apiPost('/notifications/push/subscribe', subscription.toJSON());
}
export function applicationKey(value) {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}
