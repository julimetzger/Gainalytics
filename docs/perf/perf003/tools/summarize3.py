"""usage: summarize3.py <raw dir> <prefix>   -> one line per run dir: <prefix>-*  (median [min-max])"""
import json, sys, glob, os
d, pre = sys.argv[1], sys.argv[2]
def f(s, k, nd=0):
    v = s.get(k)
    if not v: return '-'
    r = lambda x: (f'{x:.{nd}f}' if nd else f'{x:.0f}')
    return f"{r(v['median'])} [{r(v['min'])}–{r(v['max'])}]"
print('run | n | busy(settle) ms | selected visible ms | JS busy total ms | full content visible ms | max frame ms | frames>33 | views created')
for p in sorted(glob.glob(f'{d}/{pre}-*/gestures.json')):
    try: g = json.load(open(p))
    except Exception: continue
    s = g['summary']
    print(os.path.basename(os.path.dirname(p)), '|', g['n_gestures'], '|', f(s, 'settle_ms'), '|', f(s, 'sel_visible_ms'), '|', f(s, 'js_busy_ms'), '|', f(s, 'full_visible_ms'), '|', f(s, 'max_frame_ms'), '|', f(s, 'gt33'), '|', f(s, 'views_created'))
