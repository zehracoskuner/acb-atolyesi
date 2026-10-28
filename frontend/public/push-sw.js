/* Push only: this worker does not cache pages, API responses, or private content. */
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data?.json() || {}; } catch { /* generic notification */ }
    const notificationId = /^[a-f0-9]{24}$/i.test(data.notificationId || '') ? data.notificationId : 'update';
    await self.registration.showNotification('ACB Atölyesi', {
      body: 'Atölyeden yeni bir bildirimin var.',
      icon: '/app-icon-192.png',
      tag: `acb-${notificationId}`, data: { url: '/bildirimler' },
    });
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const focused = windows.find(client => client.focused && client.visibilityState === 'visible');
    for (const client of windows) client.postMessage({ type: 'acb-push', notificationId, sound: client.id === focused?.id });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const destination = new URL('/bildirimler', self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(destination); await existing.focus(); }
    else await self.clients.openWindow(destination);
  })());
});
