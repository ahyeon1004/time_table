#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
python3 "$ROOT/prepare-sparkle.py"
BUILD="$(mktemp -d "${TMPDIR:-/tmp}/bssm-widget-build.XXXXXX")"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/bssm-widget-package.XXXXXX")"
OUT="$ROOT/dist"
mkdir -p "$OUT" "$STAGE/BSSMTimetable-macOS"
xcodebuild -project "$ROOT/BSSMTimetable/BSSMTimetable.xcodeproj" -scheme BSSMTimetable -configuration Release -destination 'generic/platform=macOS' -derivedDataPath "$BUILD" ARCHS='arm64 x86_64' ONLY_ACTIVE_ARCH=NO MACOSX_DEPLOYMENT_TARGET=14.0 CODE_SIGNING_ALLOWED=NO build
APP="$STAGE/BSSMTimetable-macOS/BSSMTimetable.app"
ditto --norsrc --noextattr "$BUILD/Build/Products/Release/BSSMTimetable.app" "$APP"
cp "$ROOT/GmarketSans-NOTICE.txt" "$ROOT/Sparkle-LICENSE.txt" "$APP/Contents/Resources/"
bash "$ROOT/sign-app.sh" "$APP"
cp "$ROOT/설치방법.txt" "$ROOT/GmarketSans-NOTICE.txt" "$ROOT/Sparkle-LICENSE.txt" "$STAGE/BSSMTimetable-macOS/"
ditto -c -k --sequesterRsrc --keepParent "$STAGE/BSSMTimetable-macOS" "$OUT/BSSMTimetable-macOS-universal-beta.zip"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$OUT/BSSMTimetable-update.zip"
(cd "$OUT" && shasum -a 256 BSSMTimetable-macOS-universal-beta.zip BSSMTimetable-update.zip > SHA256SUMS.txt)
printf '\n배포 파일: %s\n' "$OUT/BSSMTimetable-macOS-universal-beta.zip"
