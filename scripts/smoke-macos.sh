#!/usr/bin/env bash
set -euo pipefail

bundle_root="${1:?bundle root is required}"
dmg="$(find "$bundle_root" -type f -name '*.dmg' -print -quit)"
test -n "$dmg"

mount_dir="$(mktemp -d)"
app_dir="$(mktemp -d)/Applications"
mkdir -p "$app_dir"
cleanup() {
  pkill -f 'InkCV.app/Contents/MacOS' >/dev/null 2>&1 || true
  hdiutil detach "$mount_dir" -quiet >/dev/null 2>&1 || true
}
trap cleanup EXIT

hdiutil attach "$dmg" -nobrowse -readonly -mountpoint "$mount_dir" -quiet
app="$(find "$mount_dir" -maxdepth 1 -type d -name '*.app' -print -quit)"
test -n "$app"
cp -R "$app" "$app_dir/"
copied_app="$(find "$app_dir" -maxdepth 1 -type d -name '*.app' -print -quit)"
binary="$(find "$copied_app/Contents/MacOS" -type f -perm -111 -print -quit)"
test -n "$binary"

"$binary" >/tmp/inkcv-macos-smoke.log 2>&1 &
pid=$!
sleep 10
kill -0 "$pid"
kill "$pid"
wait "$pid" 2>/dev/null || true

echo 'macOS DMG mount/copy/start smoke check passed.'
