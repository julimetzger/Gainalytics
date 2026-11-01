import sys,re,json,statistics as st
# usage: gfx.py gfxinfo_framestats.txt -> json summary
t=open(sys.argv[1]).read()
m=re.search(r'---PROFILEDATA---\n(.*?)---PROFILEDATA---',t,re.S)
rows=[l.split(',') for l in m.group(1).strip().split('\n')[1:] if l.strip()]
hdr=m.group(1).strip().split('\n')[0].split(',')
ix={h:i for i,h in enumerate(hdr)}
d=[]
for r in rows:
    try:
        if int(r[ix['Flags']])&1: continue  # skip window-layout-changed frames? keep flags==0 only
        d.append((int(r[ix['FrameCompleted']])-int(r[ix['IntendedVsync']]))/1e6)
    except Exception: pass
def pct(a,p): 
    a=sorted(a); return a[min(len(a)-1,int(len(a)*p/100))] if a else None
tot=re.search(r'Total frames rendered: (\d+)',t); jk=re.search(r'Janky frames: (\d+) \(([\d.]+)%\)',t)
out={'frames_gfxinfo':int(tot.group(1)) if tot else None,'janky':int(jk.group(1)) if jk else None,'janky_pct':float(jk.group(2)) if jk else None,
 'framestats_n':len(d),'p50_ms':pct(d,50),'p90_ms':pct(d,90),'p95_ms':pct(d,95),'p99_ms':pct(d,99),'max_ms':max(d) if d else None,
 'frames_gt16.7':sum(1 for x in d if x>16.7),'frames_gt32':sum(1 for x in d if x>32),'frames_gt100':sum(1 for x in d if x>100)}
for k in ['50th','90th','95th','99th']:
    mm=re.search(k+r' percentile: (\d+)ms',t); out['gfx_'+k]=int(mm.group(1)) if mm else None
print(json.dumps(out))
