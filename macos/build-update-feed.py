#!/usr/bin/env python3
"""Sign an update archive and appcast. Never regenerate an existing app's key."""
from pathlib import Path
import argparse,subprocess,xml.etree.ElementTree as ET,re
from datetime import datetime,timezone
from email.utils import format_datetime
ROOT=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
p.add_argument('--archive',type=Path,required=True);p.add_argument('--tag',required=True)
p.add_argument('--version',required=True);p.add_argument('--build',type=int,required=True)
p.add_argument('--output',type=Path,default=ROOT/'updates/appcast.xml')
p.add_argument('--key-file',type=Path,default=ROOT.parent/'.data/updates/ed25519.key')
a=p.parse_args()
if not re.fullmatch(r'[A-Za-z0-9._-]+',a.tag) or not re.fullmatch(r'[0-9]+(?:\.[0-9]+)*',a.version) or a.build<1:raise SystemExit('Invalid release identifiers')
if not a.key_file.is_file():raise SystemExit('Missing private update key. Restore its private backup; do not generate a replacement.')
tool=ROOT/'.sparkle/bin/sign_update'
if not tool.is_file():raise SystemExit('Run prepare-sparkle.py first')
signature=subprocess.check_output([str(tool),'--ed-key-file',str(a.key_file),'-p',str(a.archive)],text=True).strip()
ns='http://www.andymatuschak.org/xml-namespaces/sparkle';ET.register_namespace('sparkle',ns)
rss=ET.Element('rss',{'version':'2.0'});channel=ET.SubElement(rss,'channel')
ET.SubElement(channel,'title').text='시간표 · BSSM'
item=ET.SubElement(channel,'item');ET.SubElement(item,'title').text='시간표 '+a.version
ET.SubElement(item,'pubDate').text=format_datetime(datetime.now(timezone.utc))
ET.SubElement(item,'description').text='학교 계정 시간표 위젯 및 자동 업데이트 개선'
ET.SubElement(item,'{'+ns+'}version').text=str(a.build)
ET.SubElement(item,'{'+ns+'}shortVersionString').text=a.version
ET.SubElement(item,'{'+ns+'}minimumSystemVersion').text='14.0'
ET.SubElement(item,'enclosure',{'url':f'https://github.com/ahyeon1004/time_table/releases/download/{a.tag}/{a.archive.name}','length':str(a.archive.stat().st_size),'type':'application/octet-stream','{'+ns+'}edSignature':signature})
a.output.parent.mkdir(parents=True,exist_ok=True);ET.indent(rss)
a.output.write_bytes(ET.tostring(rss,encoding='utf-8',xml_declaration=True))
subprocess.run([str(tool),'--ed-key-file',str(a.key_file),str(a.output)],check=True)
subprocess.run([str(tool),'--verify','--ed-key-file',str(a.key_file),str(a.archive),signature],check=True)
subprocess.run([str(tool),'--verify','--ed-key-file',str(a.key_file),str(a.output)],check=True)
print('Archive and appcast signatures verified')
