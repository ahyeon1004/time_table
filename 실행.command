#!/bin/zsh
set -e
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js를 먼저 설치해 주세요. https://nodejs.org/"
  read -r "reply?Enter 키를 누르면 종료합니다."
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci
fi
exec npm run dev -- --open
