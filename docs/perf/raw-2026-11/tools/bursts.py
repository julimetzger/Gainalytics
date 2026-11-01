"""JS-thread burst structure per gesture + idle baseline before the first gesture (PERF-001 burst-structure.txt).
usage: bursts.py trace.pftrace [idle_window_s=10]"""
import sys
from perfetto.trace_processor import TraceProcessor, TraceProcessorConfig
import os
tp = TraceProcessor(trace=sys.argv[1], config=TraceProcessorConfig(bin_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tp')))
APP = "p.name like 'com.powerlifting%'"
ev = [r.ts for r in tp.query(f"select s.ts from slice s join process_track pt on s.track_id=pt.id join process p using(upid) where {APP} and s.name='deliverInputEvent' order by s.ts")]
g = []
for t in ev:
    if g and t - g[-1][1] < 350e6: g[-1][1] = t
    else: g.append([t, t])
js = [(r.ts, r.ts + r.dur) for r in tp.query(f"select ts.ts, ts.dur from thread_state ts join thread t using(utid) join process p using(upid) where {APP} and t.name='mqt_v_js' and ts.state='Running' order by ts.ts")]
idle = float(sys.argv[2]) if len(sys.argv) > 2 else 10
a, b = g[0][0] - idle * 1e9, g[0][0] - 0.3e9
busy = sum(max(0, min(e, b) - max(s, a)) for s, e in js) / 1e6
print(f"IDLE window {(b-a)/1e9:.1f}s JS busy {busy:.0f} ms -> {busy/((b-a)/1e9):.1f} ms/s ({busy/((b-a)/1e9)/10:.1f}% of one core)")
for i, (gs, ge) in enumerate(g):
    we = g[i + 1][0] if i + 1 < len(g) else gs + 5e9
    bs = []
    for s, e in [x for x in js if x[1] > gs and x[0] < we]:
        if bs and s - bs[-1][1] <= 8e6: bs[-1][1] = e; bs[-1][2] += e - s
        else: bs.append([s, e, e - s])
    print(f"gesture {i+1} bursts (start_ms_after_tap, wall_ms, busy_ms):", [(round((s-ge)/1e6), round((e-s)/1e6), round(d/1e6)) for s, e, d in bs if d >= 5e6])
