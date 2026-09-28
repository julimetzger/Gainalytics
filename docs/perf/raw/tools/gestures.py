"""Per-gesture responsiveness from a Perfetto trace.

usage: gestures.py trace.pftrace [gap_ms=350]

A gesture = a run of deliverInputEvent slices in the app process separated by < gap_ms.
For every gesture we report, in the window [gesture start, next gesture start):
  js_busy_ms    - Running time of the RN JS thread (mqt_v_js)
  main_busy_ms  - Running time of the UI/main thread
  settle_ms     - finger-up -> end of the JS work triggered by the gesture: JS Running segments are
                  merged into bursts (gap <= 8 ms), bursts with >= 10 ms busy are chained from
                  finger-up while the gap to the previous one is < 150 ms (idle ticks are ignored)
  frames / jank - actual frame timeline frames in the window, >16.7 ms, >33 ms, max
"""
import sys, json, statistics as st
from perfetto.trace_processor import TraceProcessor, TraceProcessorConfig

trace = sys.argv[1]
gap = float(sys.argv[2]) * 1e6 if len(sys.argv) > 2 else 350e6
tp = TraceProcessor(trace=trace, config=TraceProcessorConfig(bin_path='/tmp/tp'))
APP = "p.name like 'com.powerlifting%'"

ev = [r.ts for r in tp.query(f"""select s.ts from slice s join process_track pt on s.track_id=pt.id
      join process p using(upid) where {APP} and s.name='deliverInputEvent' order by s.ts""")]
gestures = []
for t in ev:
    if gestures and t - gestures[-1][1] < gap:
        gestures[-1][1] = t
    else:
        gestures.append([t, t])


def running(thread):
    return [(r.ts, r.ts + r.dur) for r in tp.query(f"""select ts.ts, ts.dur from thread_state ts join thread t using(utid) join process p using(upid)
            where {APP} and t.name='{thread}' and ts.state='Running' order by ts.ts""")]


main_name = list(tp.query(f"select t.name from thread t join process p using(upid) where {APP} and t.tid=p.pid"))[0].name
js = running('mqt_v_js')
mn = running(main_name)
frames = [(r.ts, r.dur) for r in tp.query(f"""select a.ts, a.dur from actual_frame_timeline_slice a join process p using(upid) where {APP} order by a.ts""")]
created = [r.ts for r in tp.query(f"""select s.ts from slice s join thread_track tt on s.track_id=tt.id join thread t using(utid)
      join process p using(upid) where {APP} and s.name like 'SurfaceMountingManager::createViewUnsafe%'""")]
trace_end = list(tp.query('select max(ts+dur) e from slice'))[0].e


def busy(segs, a, b):
    return sum(max(0, min(e, b) - max(s, a)) for s, e in segs) / 1e6


out = []
for i, (gs, ge) in enumerate(gestures):
    we = gestures[i + 1][0] if i + 1 < len(gestures) else trace_end
    bursts = []
    for s_, e_ in [x for x in js if x[1] > gs and x[0] < we]:
        if bursts and s_ - bursts[-1][1] <= 8e6:
            bursts[-1][1] = e_; bursts[-1][2] += e_ - s_
        else:
            bursts.append([s_, e_, e_ - s_])
    end = ge
    for s_, e_, b_ in bursts:
        if b_ < 10e6:
            continue
        if s_ > end + 150e6:
            break
        end = max(end, e_)
    fr = [d / 1e6 for t, d in frames if gs <= t < we]
    out.append({'i': i, 't_rel_s': round((gs - gestures[0][0]) / 1e9, 2), 'touch_ms': round((ge - gs) / 1e6),
                'js_busy_ms': round(busy(js, gs, we)), 'main_busy_ms': round(busy(mn, gs, we)),
                'settle_ms': round((end - ge) / 1e6), 'frames': len(fr), 'gt16': sum(x > 16.7 for x in fr),
                'gt33': sum(x > 33.4 for x in fr), 'max_frame_ms': round(max(fr), 1) if fr else None,
                'views_created': sum(1 for t in created if gs <= t < we)})


def agg(k, rows):
    v = [r[k] for r in rows if r[k] is not None]
    return {'median': st.median(v), 'min': min(v), 'max': max(v), 'n': len(v)} if v else None


res = {'main_thread': main_name, 'n_gestures': len(out), 'gestures': out,
       'summary': {k: agg(k, out) for k in ['js_busy_ms', 'main_busy_ms', 'settle_ms', 'gt16', 'gt33', 'max_frame_ms', 'views_created']}}
print(json.dumps(res))
