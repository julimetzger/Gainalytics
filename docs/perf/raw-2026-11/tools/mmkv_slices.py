"""Extract the latest redux-persist value (key persist:root) from an MMKV file into slice_<name>.json.
usage: mmkv_slices.py mmkv.default outdir"""
import sys, json, os
b = open(sys.argv[1], 'rb').read(); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
def varint(i):
    r = s = 0
    while True:
        c = b[i]; i += 1; r |= (c & 0x7f) << s; s += 7
        if c < 0x80: return r, i
key = b'persist:root'; pos = -1; best = None
while True:
    pos = b.find(key, pos + 1)
    if pos < 0: break
    i = pos + len(key)
    try:
        n1, j = varint(i); n2, k = varint(j)
        raw = b[k:k + n2].decode('utf-8')
        obj = json.loads(raw); best = (pos, raw, obj)
    except Exception:
        continue
pos, raw, obj = best
print(json.dumps({'offset': pos, 'persist_root_chars': len(raw), 'slices': {k: len(v) for k, v in obj.items()}}))
for k, v in obj.items():
    try: json.dump(json.loads(v), open(f'{out}/slice_{k}.json', 'w'))
    except Exception: open(f'{out}/slice_{k}.raw', 'w').write(v)
