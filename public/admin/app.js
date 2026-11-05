// The Steadfast Code admin app (2026-11-04): the admin pages run inside an Android shell (app/, a
// Capacitor WebView on steadfastcode.tech, like Tethered). In the app this registers the phone for
// push and opens a tapped notification's page; in a browser it does nothing. The plugins come from
// the shell (window.Capacitor.Plugins), so no build step here.
(() => {
  const C = window.Capacitor;
  if (!C?.isNativePlatform?.()) return;
  document.documentElement.classList.add('in-app');
  const { PushNotifications } = C.Plugins || {};
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

  function banner(title, body, url) {
    if (!document.getElementById('pushbanner-style')) {
      const st = document.createElement('style');
      st.id = 'pushbanner-style';
      st.textContent = `.pushbanner{position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:99;display:block;width:auto;text-align:left;font:inherit;padding:12px 14px;border-radius:14px;border:1px solid var(--line,#333);background:var(--card,#1d232c);color:var(--ink,#e9ecf2);box-shadow:0 10px 30px -10px rgb(0 0 0/.6);transition:opacity .3s,transform .3s}.pushbanner b{display:block}.pushbanner span{display:block;color:var(--muted,#a9b2bf);font-size:.92rem;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3}.pushbanner.gone{opacity:0;transform:translateY(-12px)}`;
      document.head.appendChild(st);
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pushbanner';
    b.setAttribute('role', 'status');
    b.innerHTML = '<b></b><span></span>';
    b.querySelector('b').textContent = title;
    b.querySelector('span').textContent = body;
    b.addEventListener('click', () => { b.remove(); go(url); });
    document.body.appendChild(b);
    setTimeout(() => { b.classList.add('gone'); setTimeout(() => b.remove(), 400); }, 7000);
  }

  async function register() {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') { status('Notifications are off for this app (Android settings).'); return; }
    // The channel the box's pushes name (scripts/push.mjs): made by the push plugin itself.
    try { await PushNotifications.createChannel({ id: 'steadfast_alerts', name: 'Alerts', importance: 4, visibility: 1 }); } catch {}
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
    // With the app open Android doesn't show the notification itself, so it shows here as a banner
    // (2026-11-04). Not a local notification: on Android 14 those ask for "Alarms & reminders".
    PushNotifications.addListener('pushNotificationReceived', (n) => banner(n.title || n.data?.title || 'Steadfast Code', n.body || n.data?.body || '', n.data?.url));
    PushNotifications.addListener('pushNotificationActionPerformed', (a) => go(a.notification?.data?.url));
  }
  register().catch(() => status('Couldn’t register for notifications.'));
})();
