#!/usr/bin/env bash
# Build the admin app's APK on the steadfast-ai box and hand it to the phone over Tailscale
# (2026-11-04). No Android Studio needed: it uses the box's own Android toolchain, the same one the
# routine builds Tethered and Plumb with (JAVA_HOME and ANDROID_HOME in ~/.config/orchestrator/env:
# ~/opt/jdk-21 and ~/opt/android-sdk). Not the system Java 25, which Gradle 8.14 can't run on, and
# not JDK 17, which Capacitor 8's plugins won't compile with. Signed with the box's debug key, so
# every build installs over the last one.
#   app/build-on-box.sh            build, then serve the APK on the tailnet for an hour
#   app/build-on-box.sh --build    build only
#   app/build-on-box.sh --publish  build, then publish it for the app's own in-app update: the APK
#                                  and app/apk.json in R2 (steadfast-client-uploads, under app/),
#                                  read by /api/admin/app-apk. Installed apps offer it on next open.
set -euo pipefail
cd "$(dirname "$0")"
set -a; . "$HOME/.config/orchestrator/env"; set +a
: "${JAVA_HOME:?JAVA_HOME not set in ~/.config/orchestrator/env}" "${ANDROID_HOME:?ANDROID_HOME not set in ~/.config/orchestrator/env}"
export TMPDIR="${TMPDIR:-$HOME/.cache/tmp}"
[ -f android/app/google-services.json ] || echo "note: no android/app/google-services.json, so this build has no push notifications"
corepack yarn install >/dev/null
npx cap sync android >/dev/null
# The page registers for push only when the user agent says this build has Firebase in it: without
# google-services.json, PushNotifications.register() crashes the app ("Default FirebaseApp is not
# initialized"). The synced config is generated (gitignored), so marking it leaves the repo clean.
push=nopush; [ -f android/app/google-services.json ] && push=push
node -e 'const f=process.argv[1],c=JSON.parse(require("fs").readFileSync(f));c.appendUserAgent=`SteadfastCodeApp/1 ${process.argv[2]}`;require("fs").writeFileSync(f,JSON.stringify(c,null,2))' android/app/src/main/assets/capacitor.config.json "$push"
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
# Every build gets a higher versionCode than the last (Android won't update to a lower one):
# minutes since 2026-01-01 UTC, which also fits the 2.1-billion limit for the next 4,000 years.
code=$(( ($(date -u +%s) - 1767225600) / 60 ))
name="1.0.$code"
(cd android && ./gradlew --no-daemon -q assembleDebug -PappVersionCode="$code" -PappVersionName="$name")
out="$HOME/.cache/apk"; mkdir -p "$out"
cp android/app/build/outputs/apk/debug/app-debug.apk "$out/steadfast-code.apk"
echo "built $out/steadfast-code.apk, version $name ($code), $(du -h "$out/steadfast-code.apk" | cut -f1)"
[ "${1:-}" = "--build" ] && exit 0
if [ "${1:-}" = "--publish" ]; then
  apk="$out/steadfast-code.apk"
  bt="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"
  signer="$("$bt/apksigner" verify --print-certs "$apk" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -1)"
  [ -n "$signer" ] || { echo "could not read the signing certificate"; exit 1; }
  sha="$(sha256sum "$apk" | cut -d' ' -f1)"
  file="steadfast-code-$code.apk"
  manifest="$out/apk.json"
  printf '{"versionName":"%s","versionCode":%s,"file":"%s","sha256":"%s","size":%s,"builtAt":"%s","signing":"debug","signerSha256":"%s"}\n' \
    "$name" "$code" "$file" "$sha" "$(stat -c %s "$apk")" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$signer" > "$manifest"
  set -a; . "$HOME/.config/steadfast-ai/cloudflare.env"; set +a
  wrangler="$HOME/repos/steadfast-analytics/node_modules/.bin/wrangler"
  export CI=1
  # The APK first, then the manifest that points at it, so the app never sees a manifest for a file
  # that isn't there yet.
  "$wrangler" r2 object put "steadfast-client-uploads/app/$file" --file "$apk" --content-type application/vnd.android.package-archive --remote >/dev/null
  "$wrangler" r2 object put "steadfast-client-uploads/app/apk.json" --file "$manifest" --content-type application/json --remote >/dev/null
  echo "published $name ($code): the app offers it on next open"
  exit 0
fi
ip="$(tailscale ip -4 | head -1)"
echo "on the phone (Tailscale on): http://$ip:8790/steadfast-code.apk  (served for an hour, tailnet only)"
timeout 3600 python3 -m http.server 8790 --bind "$ip" --directory "$out" >/dev/null 2>&1 || true
