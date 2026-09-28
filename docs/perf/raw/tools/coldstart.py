"""Cold-start breakdown from a Perfetto trace (app process found via its RN JS thread 'mqt_v_js',
because a freshly forked process still carries the name zygote64 in the trace).

usage: coldstart.py trace.pftrace
t0 = first scheduling of the app main thread (fork from zygote).
Reports ms relative to t0: bindApplication, activityStart, first frame, JS thread start, JS busy
time, first/last large mount batch (>= 50 views created within 250 ms = real screen content),
plus the long slices on main/JS threads.
"""
import sys, json
from perfetto.trace_processor import TraceProcessor, TraceProcessorConfig

tp = TraceProcessor(trace=sys.argv[1], config=TraceProcessorConfig(bin_path='/tmp/tp'))
upid = list(tp.query("select upid from thread where name='mqt_v_js' order by utid desc limit 1"))[0].upid
pid = list(tp.query(f"select pid from process where upid={upid}"))[0].pid
main_utid = list(tp.query(f"select utid from thread where upid={upid} and tid={pid}"))[0].utid
js_utid = list(tp.query(f"select utid from thread where upid={upid} and name='mqt_v_js'"))[0].utid
t0 = list(tp.query(f"select min(ts) t from thread_state where utid={main_utid}"))[0].t


def rel(t):
    return None if t is None else round((t - t0) / 1e6)


def first_slice(name_like):
    r = list(tp.query(f"""select min(s.ts) t, s.dur from slice s join thread_track tt on s.track_id=tt.id where tt.utid={main_utid} and s.name like '{name_like}'"""))
    return r[0].t, (r[0].dur or 0)


res = {'pid': pid}
t, d = first_slice('bindApplication%'); res['bindApplication_start_ms'] = rel(t); res['bindApplication_dur_ms'] = round(d / 1e6)
t, d = first_slice('activityStart%'); res['activityStart_ms'] = rel(t)
fr = [r.ts for r in tp.query(f"select a.ts from actual_frame_timeline_slice a where a.upid={upid} order by a.ts")]
res['first_frame_ms'] = rel(fr[0]) if fr else None
js = [(r.ts, r.dur) for r in tp.query(f"select ts, dur from thread_state where utid={js_utid} and state='Running' order by ts")]
res['js_first_run_ms'] = rel(js[0][0]) if js else None
created = [r.ts for r in tp.query(f"""select s.ts from slice s join thread_track tt on s.track_id=tt.id join thread t using(utid)
          where t.upid={upid} and s.name like 'SurfaceMountingManager::createViewUnsafe%' order by s.ts""")]
batches = []
for c in created:
    if batches and c - batches[-1][1] < 250e6:
        batches[-1][1] = c; batches[-1][2] += 1
    else:
        batches.append([c, c, 1])
big = [b for b in batches if b[2] >= 50]
res['mount_batches'] = [{'start_ms': rel(b[0]), 'end_ms': rel(b[1]), 'views': b[2]} for b in batches if b[2] >= 10]
res['first_content_mount_ms'] = rel(big[0][0]) if big else None
res['content_mount_done_ms'] = rel(big[0][1]) if big else None
end = big[0][0] if big else js[-1][0]
res['js_busy_until_content_ms'] = round(sum(min(e + d, end) - e for e, d in js if e < end) / 1e6)
res['main_busy_until_content_ms'] = round(sum(min(r.ts + r.dur, end) - r.ts for r in tp.query(
    f"select ts, dur from thread_state where utid={main_utid} and state='Running'") if r.ts < end) / 1e6)
# JS thread wall-clock phases (bursts separated by >= 30 ms idle) until content
bursts = []
for s, d in js:
    if s >= end:
        break
    if bursts and s - bursts[-1][1] < 30e6:
        bursts[-1][1] = s + d; bursts[-1][2] += d
    else:
        bursts.append([s, s + d, d])
res['js_bursts_until_content'] = [{'start_ms': rel(b[0]), 'wall_ms': round((b[1] - b[0]) / 1e6), 'busy_ms': round(b[2] / 1e6)} for b in bursts if b[2] >= 10e6]
res['long_slices'] = [{'t_ms': rel(r.ts), 'dur_ms': round(r.dur / 1e6), 'thread': r.tn, 'name': r.name[:80]} for r in tp.query(
    f"""select s.ts, s.dur, s.name, t.name tn from slice s join thread_track tt on s.track_id=tt.id join thread t using(utid)
        where t.upid={upid} and s.dur > 40e6 and s.depth <= 1 order by s.ts limit 25""")]
print(json.dumps(res))
