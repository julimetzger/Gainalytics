"""Aggregate all scenario results into raw/summary.json (+ print a compact table)."""
import json, re, statistics as st, os
R = '/home/jmetzger/projects/PowerliftingWorkoutPlanner/.codex-orchestrator/runs/PERF-001/raw'
def agg(v):
    v = [x for x in v if x is not None]
    return {'median': st.median(v), 'min': min(v), 'max': max(v), 'n': len(v)} if v else None
out = {}
t = open(f'{R}/scenario1-start.txt').read()
out['s1_cold_amstart_TotalTime_ms'] = agg([int(x) for x in re.findall(r'cold \d+: LaunchState: COLD TotalTime: (\d+)', t)])
out['s1_warm_amstart_TotalTime_ms'] = agg([int(x) for x in re.findall(r'warm \d+: LaunchState: HOT TotalTime: (\d+)', t)])
cs = [json.load(open(f'{R}/scn1-coldstart-trace/cold{i}.json')) for i in range(1, 6)]
for k in ['first_frame_ms', 'first_content_mount_ms', 'content_mount_done_ms', 'js_busy_until_content_ms', 'main_busy_until_content_ms']:
    out['s1_trace_' + k] = agg([c[k] for c in cs])
def gest(name, pick=None):
    d = json.load(open(f'{R}/{name}/gestures.json'))
    g = d['gestures'] if pick is None else [x for x in d['gestures'] if pick(x)]
    gfx = json.load(open(f'{R}/{name}/gfx-summary.json'))
    return {'n_gestures': len(g), 'settle_ms': agg([x['settle_ms'] for x in g]), 'js_busy_ms': agg([x['js_busy_ms'] for x in g]),
            'frames_gt16_per_gesture': agg([x['gt16'] for x in g]), 'frames_gt33_per_gesture': agg([x['gt33'] for x in g]),
            'max_frame_ms': agg([x['max_frame_ms'] for x in g]), 'views_created': agg([x['views_created'] for x in g]),
            'gfxinfo': {k: gfx[k] for k in ['frames_gfxinfo', 'janky', 'janky_pct', 'gfx_50th', 'gfx_90th', 'gfx_99th']}}
out['s2_save_set'] = gest('scn2-save')
out['s2_typing_key'] = gest('scn2-type', lambda x: x['i'] % 3 != 0)       # DEL / digit key presses
out['s2_typing_fieldtap'] = gest('scn2-type', lambda x: x['i'] % 3 == 0)  # focusing the field
for n in ['scn3-train', 'scn3-plan', 'scn3-analysis']:
    out['s3_' + n] = gest(n)
out['s4a_exercises_open'] = gest('scn4a', lambda x: x['i'] == 0)
out['s4a_exercises_fling'] = gest('scn4a', lambda x: x['i'] > 0)
out['s4b_history_open'] = gest('scn4b', lambda x: x['i'] < 2)
out['s4b_history_fling'] = gest('scn4b', lambda x: x['i'] >= 2)
out['s4c_calendar_month'] = gest('scn4c', lambda x: 2 <= x['i'] <= 8)
out['s4c_calendar_daytap'] = gest('scn4c', lambda x: x['i'] >= 9)
out['s5a_dashboard_open'] = gest('scn5a', lambda x: x['i'] == 0)
out['s5a_dashboard_fling'] = gest('scn5a', lambda x: x['i'] > 0)
out['s5b_range_modal_open'] = gest('scn5b', lambda x: x['i'] % 4 == 0)
out['s5b_range_typing'] = gest('scn5b', lambda x: x['i'] % 4 == 2)
out['s5b_range_save'] = gest('scn5b', lambda x: x['i'] % 4 == 3)
out['s5c_metrics_week_swipe'] = gest('scn5c')
out['s6_ai_chat_open'] = gest('scn6-open', lambda x: x['i'] % 4 == 1)
out['s6_proxy_exercise_search_key'] = gest('scn6-type-proxy', lambda x: x['i'] > 0)
mem = {}
for ph in ['after-start', 'after-tabs']:
    tot, nat, jav = [], [], []
    for r in range(1, 6):
        m = open(f'{R}/scn7-memory/run{r}-{ph}.txt').read()
        tot.append(int(re.search(r'TOTAL PSS:\s+(\d+)', m).group(1)) / 1024)
        nat.append(int(re.search(r'\n\s+Native Heap:\s+(\d+)', m).group(1)) / 1024)
        jav.append(int(re.search(r'\n\s+Java Heap:\s+(\d+)', m).group(1)) / 1024)
    mem[ph] = {'total_pss_mb': agg([round(x, 1) for x in tot]), 'native_heap_mb': agg([round(x, 1) for x in nat]), 'java_heap_mb': agg([round(x, 1) for x in jav])}
out['s7_memory'] = mem
json.dump(out, open(f'{R}/summary.json', 'w'), indent=1)
for k, v in out.items():
    if 'settle_ms' in (v or {}):
        s = v['settle_ms']; gf = v['gfxinfo']
        print(f"{k:32s} n={v['n_gestures']:3d} settle med {s['median']:>6} [{s['min']}-{s['max']}]  js med {v['js_busy_ms']['median']:>6}  >33ms/g med {v['frames_gt33_per_gesture']['median']}  maxframe med {v['max_frame_ms']['median'] if v['max_frame_ms'] else None}  views med {v['views_created']['median']}")
    else:
        print(k, json.dumps(v))
