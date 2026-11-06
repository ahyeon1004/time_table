#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$1"
IDENTITY="${BSSM_SIGN_IDENTITY:-$(security find-identity -v -p codesigning | awk '/"Apple Development:/ {print $2; exit}')}"
if [ -z "$IDENTITY" ]; then
  echo '무료 Apple Development 인증서가 필요합니다. Xcode에서 Apple 계정의 Personal Team을 먼저 설정하세요.' >&2
  exit 1
fi
SPARKLE="$APP/Contents/Frameworks/Sparkle.framework/Versions/B"
# Sign nested helpers individually; preserve Downloader sandbox entitlements.
codesign --force --sign "$IDENTITY" --options runtime --timestamp=none "$SPARKLE/XPCServices/Installer.xpc"
codesign --force --sign "$IDENTITY" --options runtime --timestamp=none --preserve-metadata=entitlements "$SPARKLE/XPCServices/Downloader.xpc"
codesign --force --sign "$IDENTITY" --options runtime --timestamp=none "$SPARKLE/Autoupdate"
codesign --force --sign "$IDENTITY" --options runtime --timestamp=none "$SPARKLE/Updater.app"
codesign --force --sign "$IDENTITY" --options runtime --timestamp=none "$APP/Contents/Frameworks/Sparkle.framework"
codesign --force --sign "$IDENTITY" --options runtime --timestamp=none --entitlements "$ROOT/widget.entitlements" "$APP/Contents/PlugIns/imetableWidgetExtension.appex"
codesign --force --sign "$IDENTITY" --options runtime --timestamp=none --entitlements "$ROOT/app.entitlements" "$APP"
codesign --verify --deep --strict "$APP"
