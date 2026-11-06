#!/usr/bin/env python3
"""Fetch a pinned, checksum-verified official Sparkle distribution."""
from pathlib import Path
import hashlib,shutil,tarfile,urllib.request
ROOT=Path(__file__).resolve().parent
CACHE=ROOT/'.sparkle';CACHE.mkdir(exist_ok=True)
VERSION='2.10.1'
EXPECTED='1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27'
ARCHIVE=CACHE/f'Sparkle-{VERSION}.tar.xz'
if not ARCHIVE.exists():
 with urllib.request.urlopen(f'https://github.com/sparkle-project/Sparkle/releases/download/{VERSION}/{ARCHIVE.name}',timeout=90) as r:ARCHIVE.write_bytes(r.read())
if hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()!=EXPECTED:raise SystemExit('Sparkle checksum mismatch')
with tarfile.open(ARCHIVE) as t:
 selected=[m for m in t.getmembers() if m.name.removeprefix('./').startswith(('Sparkle.framework/','bin/')) or m.name.removeprefix('./') in ['Sparkle.framework','bin','LICENSE']]
 t.extractall(CACHE,members=selected,filter='data')
framework=ROOT/'BSSMTimetable/Frameworks/Sparkle.framework'
framework.parent.mkdir(exist_ok=True)
if framework.exists():shutil.rmtree(framework)
shutil.copytree(CACHE/'Sparkle.framework',framework,symlinks=True)
shutil.copy2(CACHE/'LICENSE',ROOT/'Sparkle-LICENSE.txt')
print('Sparkle 2.10.1: official archive SHA-256 verified')
