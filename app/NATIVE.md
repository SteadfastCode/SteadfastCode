# The Steadfast Code admin app (Android)

A **Capacitor** shell around the live admin at steadfastcode.tech/admin, opening on the Inbox: the
same pattern as Tethered (`~/repos/tethered/web/app/NATIVE.md`). The web pages are the app, so
**web changes reach the app with no new build**. A new APK is only needed when this folder changes
(plugins, the config, the Android project).

What the shell adds: push notifications (Firebase Cloud Messaging) and an app icon. The pages detect
the app (`public/admin/app.js`), register the phone for push, and open a tapped notification's page.
Sign-in is the same Cloudflare Access one-time code as the browser (never Google sign-in).

## How notifications flow

The site queues what should reach Daniel in the `notifications` table (migration 0014): a new lead,
a signed contract or care plan, a card added, a payment paid or failed, a plan ending. The build
service on the box (`steadfast-ai/scripts/client-builds.mjs`) sends each one within a few seconds,
along with its own (client messages, flags, finished and failed builds). It pushes to every phone
in `devices` when the Firebase key is on the box, and falls back to Signal when it isn't or no phone
is registered, so Signal pings end on their own once push works.

## One-time setup (Daniel)

1. **Firebase:** console.firebase.google.com → add a project (e.g. "Steadfast Code"; Analytics not
   needed) → add an **Android app** with package name `tech.steadfastcode.admin` → download
   `google-services.json` → put it at `app/android/app/google-services.json` on the machine that
   builds the app. It's ignored by git; this repo is public.
2. **The sending key, on the box:** Firebase → Project settings → Service accounts → Generate new
   private key. Save the file on the box as `~/.config/steadfast-ai/fcm-service-account.json`
   (`chmod 600`). Then `systemctl --user restart client-builds.service`.
3. **Stay signed in:** Cloudflare Zero Trust → Access → Applications → Steadfast Code admin →
   Session duration: 1 month, so the app doesn't ask for a code every day.
4. **Build and install**, on the machine with Android Studio:
   ```
   cd app
   yarn install
   npx cap sync android
   npx cap open android
   ```
   Run ▶ onto the phone over USB, or Build → Build APK(s) and install it. Firebase App
   Distribution works too, as for Tethered (`android/DISTRIBUTION.md` there), if it should update
   itself later.
5. **Check:** open the app, sign in, allow notifications. The Inbox shows "Notifications are on for
   this phone"; press **Send a test**.

## After a change in this folder

Bump `versionCode`/`versionName` in `android/app/build.gradle`, then `npx cap sync android` and
build again. Web changes need none of this.
