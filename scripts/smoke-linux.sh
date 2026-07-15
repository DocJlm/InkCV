#!/usr/bin/env bash
set -euo pipefail

bundle_root="${1:?bundle root is required}"
appimage="$(realpath "$(find "$bundle_root" -type f -iname '*.AppImage' -print -quit)")"
deb="$(realpath "$(find "$bundle_root" -type f -name '*.deb' -print -quit)")"
test -n "$appimage"
test -n "$deb"

chmod +x "$appimage"
extract_dir="$(mktemp -d)"
(
  cd "$extract_dir"
  "$appimage" --appimage-extract >/dev/null
  xvfb-run -a ./squashfs-root/AppRun >/tmp/inkcv-appimage-smoke.log 2>&1 &
  pid=$!
  sleep 10
  kill -0 "$pid"
  kill "$pid"
  wait "$pid" 2>/dev/null || true
)

sudo dpkg -i "$deb"
package_name="$(dpkg-deb -f "$deb" Package)"
installed_binary="$(dpkg -L "$package_name" | grep -E '^/usr/bin/' | head -n 1)"
test -x "$installed_binary"
xvfb-run -a "$installed_binary" >/tmp/inkcv-deb-smoke.log 2>&1 &
pid=$!
sleep 10
kill -0 "$pid"
kill "$pid"
wait "$pid" 2>/dev/null || true

echo 'Linux AppImage and DEB install/start smoke checks passed.'
