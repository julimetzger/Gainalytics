"""Markdown tables for docs/perf/training-tab-fixes.md from the raw run dirs.
usage: report_tables.py <raw dir> <before-prefix> <after-prefix>
Recomputes median [min-max] from the per-gesture values (gestures.json). Gestures that are not taps/swipes of the
scenario (no JS work at all and nothing visible, e.g. the priming touch of a run) are dropped."""
import json, sys, os, statistics as st

raw, bpre, apre = sys.argv[1:4]


def load(prefix, name):
    p = f'{raw}/{prefix}-{name}/gestures.json'
    if not os.path.exists(p):
        return None
    g = json.load(open(p))['gestures']
    return [x for x in g if not (x['settle_ms'] == 0 and x.get('sel_visible_ms') is None)]


def agg(rows, key):
    v = [r[key] for r in rows if r.get(key) is not None]
    if not v:
        return '–'
    f = lambda x: f'{x:.0f}'
    return f'{f(st.median(v))} [{f(min(v))}–{f(max(v))}]'


def row(label, prefix, name, keys, extra=''):
    g = load(prefix, name)
    if g is None:
        return f'| {label} | – |' + ' – |' * len(keys)
    return f'| {label} | {len(g)} | ' + ' | '.join(agg(g, k) for k in keys) + ' |'


def med(rows, key):
    v = [r[key] for r in rows if r.get(key) is not None]
    return st.median(v) if v else None


print('### Swipes (scenario 3: Micro 3 <-> Micro 4)\n')
keys = ['settle_ms', 'js_busy_ms', 'max_frame_ms', 'gt33', 'content_done_ms']
print('| Sub-tab | build | n | busy per swipe, PERF-001 chain (ms) | JS thread total per swipe (ms) | longest frame (ms) | frames > 33 ms | content complete after finger-up (ms) |')
print('|---|---|---|---|---|---|---|---|')
for tab in ['train', 'plan', 'analysis']:
    for label, pre in (('before', bpre), ('after', apre)):
        g = load(pre, f'scn3-{tab}')
        if g is None:
            continue
        print(f'| {tab} | {label} | {len(g)} | ' + ' | '.join(agg(g, k) for k in keys) + ' |')
print()
print('### Toggle bars (12+ taps each)\n')
print('| Bar | build | n | tapped state visible (ms) | busy after tap, chain (ms) | JS total (ms) | longest frame (ms) | all content visible (ms) |')
print('|---|---|---|---|---|---|---|---|')
for name in ['hero', 'sub', 'data', 'overview', 'sort', 'drawer']:
    for label, pre in (('before', bpre), ('after', apre)):
        g = load(pre, f'bar-{name}')
        if g is None:
            continue
        print(f'| {name} | {label} | {len(g)} | ' + ' | '.join(agg(g, k) for k in ['sel_visible_ms', 'settle_ms', 'js_busy_ms', 'max_frame_ms', 'content_done_ms']) + ' |')
