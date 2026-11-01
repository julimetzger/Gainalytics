"""Old (PERF-001 summary.json) vs new (PERF-004 summary.json) comparison table (markdown).
usage: compare.py perf001.json perf004.json"""
import json, sys
a, b = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
def f(x):
    return '–' if not x else f"{x['median']:g} [{x['min']:g}–{x['max']:g}] n={x['n']}"
def ch(o, n):
    if not o or not n or not o['median']: return '–'
    return f"{(n['median'] - o['median']) / o['median'] * 100:+.0f} %"
print('| Schlüssel | Kennzahl | PERF-001 | PERF-004 | Δ |'); print('|---|---|---|---|---|')
for k in b:
    if k == 's8_memory':
        for ph in ['after-start', 'after-tabs']:
            for m in ['total_pss_mb', 'native_heap_mb', 'java_heap_mb']:
                o = a.get('s7_memory', {}).get(ph, {}).get(m); n = b[k][ph][m]
                print(f'| {k}.{ph} | {m} | {f(o)} | {f(n)} | {ch(o, n)} |')
        continue
    o = a.get(k); n = b[k]
    if isinstance(n, dict) and 'settle_ms' in n:
        for m in ['settle_ms', 'js_busy_ms', 'max_frame_ms', 'frames_gt33_per_gesture', 'views_created']:
            print(f'| {k} | {m} | {f((o or {}).get(m))} | {f(n.get(m))} | {ch((o or {}).get(m), n.get(m))} |')
        print(f"| {k} | gfxinfo janky % | {(o or {}).get('gfxinfo', {}).get('janky_pct', '–')} | {n['gfxinfo']['janky_pct']} | |")
    else:
        print(f'| {k} | | {f(o)} | {f(n)} | {ch(o, n)} |')
