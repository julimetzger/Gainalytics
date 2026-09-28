import sys,json
from perfetto.trace_processor import TraceProcessor
tp=TraceProcessor(trace=sys.argv[1],config=None) if False else None
from perfetto.trace_processor import TraceProcessorConfig
tp=TraceProcessor(trace=sys.argv[1],config=TraceProcessorConfig(bin_path='/tmp/tp'))
def bursts(thread, gap=4e6):
    q=f"""select ts.ts, ts.dur from thread_state ts join thread t using(utid) join process p using(upid)
          where p.name like 'com.powerlifting%' and t.name='{thread}' and ts.state='Running' order by ts.ts"""
    rows=[(r.ts,r.dur) for r in tp.query(q)]
    out=[];cs=None;ce=None;busy=0
    for s,d in rows:
        if cs is None: cs,ce,busy=s,s+d,d
        elif s-ce<=gap: ce=s+d; busy+=d
        else: out.append((cs,ce-cs,busy)); cs,ce,busy=s,s+d,d
    if cs is not None: out.append((cs,ce-cs,busy))
    return out
res={}
for th in ['mqt_v_js','gworkoutplanner','RenderThread']:
    b=bursts(th)
    # only bursts with >=20ms busy to ignore noise
    big=[x for x in b if x[2]>=20e6]
    res[th]={'total_run_ms':round(sum(x[2] for x in b)/1e6),'bursts_ge20ms':len(big),
      'bursts_ge50ms':sum(1 for x in big if x[2]>=50e6),'bursts_ge100ms':sum(1 for x in big if x[2]>=100e6),'bursts_ge250ms':sum(1 for x in big if x[2]>=250e6),
      'all_burst_busy_ms':sorted([round(x[2]/1e6) for x in big]),'top_burst_busy_ms':sorted([round(x[2]/1e6) for x in big],reverse=True)[:8],
      'top_burst_wall_ms':sorted([round(x[1]/1e6) for x in big],reverse=True)[:8]}
try:
    q="""select jank_type, count(*) n from actual_frame_timeline_slice a join process p using(upid) where p.name like 'com.powerlifting%' group by 1 order by n desc"""
    res['frametimeline']={r.jank_type:r.n for r in tp.query(q)}
    q="""select count(*) n, sum(a.dur>16700000) gt16, sum(a.dur>33400000) gt33, max(a.dur)/1e6 mx from actual_frame_timeline_slice a join process p using(upid) where p.name like 'com.powerlifting%'"""
    r=list(tp.query(q))[0]; res['frametimeline_frames']={'n':r.n,'gt16.7ms':r.gt16,'gt33ms':r.gt33,'max_ms':r.mx}
except Exception as e: res['frametimeline_err']=str(e)
print(json.dumps(res))
