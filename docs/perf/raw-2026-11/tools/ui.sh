#!/bin/bash
# dump UI and print clickable/text nodes with centers (720x1600 space)
adb -s ${ANDROID_SERIAL:?set ANDROID_SERIAL} shell uiautomator dump /sdcard/perf004ui.xml >/dev/null 2>&1
adb -s ${ANDROID_SERIAL:?set ANDROID_SERIAL} exec-out cat /sdcard/perf004ui.xml > /tmp/perf004ui.xml
python3 - "$@" <<'PY'
import re,sys
x=open('/tmp/perf004ui.xml').read()
for m in re.finditer(r'<node [^>]*>',x):
    n=m.group(0); g=lambda k:(re.search(k+'="([^"]*)"',n) or [None,''])[1]
    t,d,i=g('text'),g('content-desc'),g('resource-id'); b=re.findall(r'\d+',g('bounds'))
    if not (t or d or i): continue
    x1,y1,x2,y2=map(int,b); print(f"({(x1+x2)//2},{(y1+y2)//2}) [{x1},{y1},{x2},{y2}] t={t!r} d={d!r} id={i!r}")
PY
