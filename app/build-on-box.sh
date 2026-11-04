#!/usr/bin/env bash
# Build the admin app's APK on the steadfast-ai box and hand it to the phone over Tailscale
# (2026-11-04). No Android Studio needed: the box has the Android SDK (~/Android/Sdk) and a JDK 21
# in ~/.local/jdk (Gradle 8.14 can't run on the system's Java 25). Signed with the box's debug key,
# so every build installs over the last one.
#   app/build-on-box.sh          build, then serve the APK on the tailnet for an hour
#   app/build-on-box.sh --build  build only
set -euo pipefail
cd "$(dirname "$0")"
export ANDROID_HOME="$HOME/Android/Sdk"
export JAVA_HOME="$(ls -d "$HOME"/.local/jdk/jdk-21* | tail -1)"
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
