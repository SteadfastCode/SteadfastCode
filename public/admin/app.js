// The Steadfast Code admin app (2026-11-04): the admin pages run inside an Android shell (app/, a
// Capacitor WebView on steadfastcode.tech, like Tethered). In the app this registers the phone for
// push and opens a tapped notification's page; in a browser it does nothing. The plugins come from
// the shell (window.Capacitor.Plugins), so no build step here.
(() => {
  const C = window.Capacitor;
  if (!C?.isNativePlatform?.()) return;
  document.documentElement.classList.add('in-app');
  const { PushNotifications, LocalNotifications } = C.Plugins || {};
  if (!PushNotifications) return;
  // Only a build with Firebase in it can register (app/build-on-box.sh marks the user agent): in one
  // without, PushNotifications.register() crashes the app instead of failing (2026-11-04).
  if (!/SteadfastCodeApp\/\d+ push\b/.test(navigator.userAgent)) {
    window.__pushStatus = 'This build of the app has no notifications yet.';
    document.dispatchEvent(new CustomEvent('pushstatus', { detail: window.__pushStatus }));
    return;
  }
  const go = (url) => { if (url && /^https:\/\/steadfastcode\.tech\//.test(url)) location.href = url; };
  const status = (text) => { window.__pushStatus = text; document.dispatchEvent(new CustomEvent('pushstatus', { detail: text })); };

  async function register() {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') { status('Notifications are off for this app (Android settings).'); return; }
    try { await LocalNotifications?.createChannel?.({ id: 'steadfast_alerts', name: 'Alerts', importance: 4, visibility: 1 }); } catch {}
    await PushNotifications.register();
  }
  if (!window.__pushWired) {
    window.__pushWired = true;
    PushNotifications.addListener('registration', async (t) => {
      try {
        const r = await fetch('/api/admin/devices', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: t.value, label: navigator.userAgent.match(/Android[^;)]*;[^;)]*/)?.[0] || 'Android' }) });
        status(r.ok ? 'Notifications are on for this phone.' : 'Couldn’t save this phone for notifications.');
      } catch { status('Couldn’t save this phone for notifications.'); }
    });
    PushNotifications.addListener('registrationError', () => status('Couldn’t register for notifications.'));
    // In the foreground Android doesn't show FCM notifications itself: show it, keeping the tap target.
    PushNotifications.addListener('pushNotificationReceived', async (n) => {
      try { await LocalNotifications?.schedule({ notifications: [{ id: Date.now() % 2000000, title: n.title || n.data?.title || 'Steadfast Code', body: n.body || n.data?.body || '', channelId: 'steadfast_alerts', extra: { url: n.data?.url } }] }); } catch {}
    });
    PushNotifications.addListener('pushNotificationActionPerformed', (a) => go(a.notification?.data?.url));
    LocalNotifications?.addListener?.('localNotificationActionPerformed', (a) => go(a.notification?.extra?.url));
  }
  register().catch(() => status('Couldn’t register for notifications.'));
})();
