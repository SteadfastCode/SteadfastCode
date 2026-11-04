#!/usr/bin/env bash
# Build the admin app's APK on the steadfast-ai box and hand it to the phone over Tailscale
# (2026-11-04). No Android Studio needed: it uses the box's own Android toolchain, the same one the
# routine builds Tethered and Plumb with (JAVA_HOME and ANDROID_HOME in ~/.config/orchestrator/env:
# ~/opt/jdk-21 and ~/opt/android-sdk). Not the system Java 25, which Gradle 8.14 can't run on, and
# not JDK 17, which Capacitor 8's plugins won't compile with. Signed with the box's debug key, so
# every build installs over the last one.
#   app/build-on-box.sh          build, then serve the APK on the tailnet for an hour
#   app/build-on-box.sh --build  build only
set -euo pipefail
cd "$(dirname "$0")"
set -a; . "$HOME/.config/orchestrator/env"; set +a
: "${JAVA_HOME:?JAVA_HOME not set in ~/.config/orchestrator/env}" "${ANDROID_HOME:?ANDROID_HOME not set in ~/.config/orchestrator/env}"
export TMPDIR="${TMPDIR:-$HOME/.cache/tmp}"
[ -f android/app/google-services.json ] || echo "note: no android/app/google-services.json, so this build has no push notifications"
corepack yarn install >/dev/null
npx cap sync android >/dev/null
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
(cd android && ./gradlew --no-daemon -q assembleDebug)
out="$HOME/.cache/apk"; mkdir -p "$out"
cp android/app/build/outputs/apk/debug/app-debug.apk "$out/steadfast-code.apk"
echo "built $out/steadfast-code.apk ($(du -h "$out/steadfast-code.apk" | cut -f1))"
[ "${1:-}" = "--build" ] && exit 0
ip="$(tailscale ip -4 | head -1)"
echo "on the phone (Tailscale on): http://$ip:8790/steadfast-code.apk  (served for an hour, tailnet only)"
timeout 3600 python3 -m http.server 8790 --bind "$ip" --directory "$out" >/dev/null 2>&1 || true
