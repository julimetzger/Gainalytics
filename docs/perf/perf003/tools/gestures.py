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
# PERF-003: main-thread mount batches (Fabric applies a commit here) and the RenderThread frame that
# draws them -> "tap until visible" = finger-up -> end of the first frame drawn after a mount batch.
mounts_d = [(r.ts, r.dur) for r in tp.query(f"""select s.ts, s.dur from slice s join thread_track tt on s.track_id=tt.id join thread t using(utid)
      join process p using(upid) where {APP} and s.name like 'MountItemDispatcher::mountViews mountItems%' and t.tid=p.pid order by s.ts""")]
mounts = [r.ts for r in tp.query(f"""select s.ts from slice s join thread_track tt on s.track_id=tt.id join thread t using(utid)
      join process p using(upid) where {APP} and s.name like 'MountItemDispatcher::mountViews%' and t.tid=p.pid order by s.ts""")]
draws = [(r.ts, r.ts + r.dur) for r in tp.query(f"""select s.ts, s.dur from slice s join thread_track tt on s.track_id=tt.id join thread t using(utid)
      join process p using(upid) where {APP} and s.name like 'DrawFrames%' and t.name='RenderThread' order by s.ts""")]


def frame_end_after(t):
    """End of the first RenderThread DrawFrames that starts at/after t (= frame that shows a mount begun at t)."""
    for s_, e_ in draws:
        if s_ >= t:
            return e_
    return None


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
    # first / last mount batch inside this gesture's work window [finger-up, end of JS work + 60 ms]
    ms = [t for t in mounts if ge <= t <= end + 60e6]
    # everything the gesture caused, including work deferred past the JS chain (PERF-003: content that mounts
    # after the snap animation): all mount batches until 1.5 s after finger-up
    later = [t for t in mounts if ge <= t <= min(we, ge + 1500e6)]
    full_vis = frame_end_after(later[-1]) if later else None
    first_vis = frame_end_after(ms[0]) if ms else None
    last_vis = frame_end_after(ms[-1]) if ms else None
    # "selected visible": the first real mount batch (>= 0.45 ms; the ripple/animation ticks are ~0.3 ms) after
    # finger-up. For a tap on a toggle bar that is the commit that carries the tapped state: in the old code the
    # one big commit with the content, in the new code the tiny optimistic commit that comes before the content.
    m1 = [t for t, d in mounts_d if t >= ge and d >= 0.45e6 and t <= ge + 1500e6]
    sel_vis = frame_end_after(m1[0]) if m1 else None
    # end of the last real mount batch (>= 1 ms of mounting) within 1.5 s after finger-up: "content is complete"
    big = [t + d for t, d in mounts_d if ge <= t <= min(we, ge + 1500e6) and d >= 1.0e6]
    content_done = round((big[-1] - ge) / 1e6, 1) if big else None
    fr = [d / 1e6 for t, d in frames if gs <= t < we]
    out.append({'i': i, 't_rel_s': round((gs - gestures[0][0]) / 1e9, 2), 'touch_ms': round((ge - gs) / 1e6),
                'js_busy_ms': round(busy(js, gs, we)), 'main_busy_ms': round(busy(mn, gs, we)),
                'settle_ms': round((end - ge) / 1e6), 'frames': len(fr), 'gt16': sum(x > 16.7 for x in fr),
                'gt33': sum(x > 33.4 for x in fr), 'max_frame_ms': round(max(fr), 1) if fr else None,
                'views_created': sum(1 for t in created if gs <= t < we),
                'first_visible_ms': round((first_vis - ge) / 1e6, 1) if first_vis else None,
                'last_visible_ms': round((last_vis - ge) / 1e6, 1) if last_vis else None,
                'mount_batches': len(ms),
                'content_done_ms': content_done,
                'full_visible_ms': round((full_vis - ge) / 1e6, 1) if full_vis else None,
                'sel_visible_ms': round((sel_vis - ge) / 1e6, 1) if sel_vis else None})


def agg(k, rows):
    v = [r[k] for r in rows if r[k] is not None]
    return {'median': st.median(v), 'min': min(v), 'max': max(v), 'n': len(v)} if v else None


res = {'main_thread': main_name, 'n_gestures': len(out), 'gestures': out,
       'summary': {k: agg(k, out) for k in ['js_busy_ms', 'main_busy_ms', 'settle_ms', 'gt16', 'gt33', 'max_frame_ms', 'views_created', 'first_visible_ms', 'last_visible_ms', 'mount_batches', 'sel_visible_ms', 'full_visible_ms', 'content_done_ms']}}
print(json.dumps(res))
