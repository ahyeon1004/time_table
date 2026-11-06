#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BUILD="$(mktemp -d "${TMPDIR:-/tmp}/bssm-widget-build.XXXXXX")"
OUT="$ROOT/dist"
mkdir -p "$OUT/BSSMTimetable-macOS"
xcodebuild -project "$ROOT/BSSMTimetable/BSSMTimetable.xcodeproj" -scheme BSSMTimetable -configuration Release -destination 'generic/platform=macOS' -derivedDataPath "$BUILD" ARCHS='arm64 x86_64' ONLY_ACTIVE_ARCH=NO MACOSX_DEPLOYMENT_TARGET=14.0 CODE_SIGNING_ALLOWED=NO build
APP="$OUT/BSSMTimetable-macOS/BSSMTimetable.app"
ditto "$BUILD/Build/Products/Release/BSSMTimetable.app" "$APP"
codesign --force --sign - --options runtime --timestamp=none --entitlements "$ROOT/widget.entitlements" "$APP/Contents/PlugIns/imetableWidgetExtension.appex"
codesign --force --sign - --options runtime --timestamp=none --entitlements "$ROOT/app.entitlements" "$APP"
codesign --verify --deep --strict "$APP"
cp "$ROOT/설치방법.txt" "$ROOT/GmarketSans-NOTICE.txt" "$OUT/BSSMTimetable-macOS/"
ditto -c -k --sequesterRsrc --keepParent "$OUT/BSSMTimetable-macOS" "$OUT/BSSMTimetable-macOS-universal-beta.zip"
(cd "$OUT" && shasum -a 256 BSSMTimetable-macOS-universal-beta.zip > SHA256SUMS.txt)
printf '\n배포 파일: %s\n' "$OUT/BSSMTimetable-macOS-universal-beta.zip"
