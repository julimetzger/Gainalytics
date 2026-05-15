#!/usr/bin/env python3
"""GH-288 — aggregate React.Profiler + persist-action trace from a logcat capture.

Input : a logcat text file containing the dev-gated instrumentation lines:
          [PROFILER] id=<id> phase=<mount|update|nested-update> actual=<ms> base=<ms> @<epoch_ms>
          [PERSIST_TRACE] #<n> <ACTION_TYPE> @<epoch_ms>
Output: - per-component render table (mean / p50 / p95 / max actualDuration)
        - persist-action counts (total + per cascade)
        - a raw CSV (one row per profiler commit, tagged with its cascade index)

Usage : python3 aggregate.py <logcat.txt> <out_csv> [cascade_window_ms]
"""
import re
import sys
import statistics

PROFILER_RE = re.compile(
    r"\[PROFILER\] id=(?P<id>\S+) phase=(?P<phase>\S+) "
    r"actual=(?P<actual>[\d.]+) base=(?P<base>[\d.]+) @(?P<ts>\d+)"
)
TRACE_RE = re.compile(r"\[PERSIST_TRACE\] #(?P<n>\d+) (?P<type>\S+) @(?P<ts>\d+)")


def pctl(values, p):
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * (p / 100.0)
    lo = int(k)
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def main():
    log_path = sys.argv[1]
    out_csv = sys.argv[2]
    window_ms = int(sys.argv[3]) if len(sys.argv) > 3 else 800

    profiler_rows = []   # dict: id, phase, actual, base, ts
    trace_rows = []      # dict: n, type, ts

    with open(log_path, "r", errors="ignore") as fh:
        for line in fh:
            m = PROFILER_RE.search(line)
            if m:
                profiler_rows.append({
                    "id": m.group("id"),
                    "phase": m.group("phase"),
                    "actual": float(m.group("actual")),
                    "base": float(m.group("base")),
                    "ts": int(m.group("ts")),
                })
                continue
            m = TRACE_RE.search(line)
            if m:
                trace_rows.append({
                    "n": int(m.group("n")),
                    "type": m.group("type"),
                    "ts": int(m.group("ts")),
                })

    # Cascade = the window opened by an ADD_OR_UPDATE_SET_IN_WORKOUT dispatch.
    set_dispatches = [t for t in trace_rows if t["type"] == "ADD_OR_UPDATE_SET_IN_WORKOUT"]
    set_dispatches.sort(key=lambda t: t["ts"])

    def cascade_index(ts):
        idx = None
        for i, d in enumerate(set_dispatches):
            if d["ts"] <= ts <= d["ts"] + window_ms:
                idx = i + 1
        return idx

    # Tag every profiler commit with its cascade index (or 0 = outside any cascade).
    for r in profiler_rows:
        r["cascade"] = cascade_index(r["ts"]) or 0

    # Write raw CSV.
    with open(out_csv, "w") as fh:
        fh.write("cascade,profiler_id,phase,actual_ms,base_ms,ts_ms\n")
        for r in sorted(profiler_rows, key=lambda r: r["ts"]):
            fh.write(f"{r['cascade']},{r['id']},{r['phase']},"
                     f"{r['actual']:.3f},{r['base']:.3f},{r['ts']}\n")

    n_cascades = len(set_dispatches)
    print(f"== GH-288 set-add render re-baseline ==")
    print(f"logcat            : {log_path}")
    print(f"cascade window    : {window_ms} ms after each ADD_OR_UPDATE_SET_IN_WORKOUT")
    print(f"set dispatches (n): {n_cascades}")
    print(f"profiler commits  : {len(profiler_rows)} total "
          f"({sum(1 for r in profiler_rows if r['cascade'] > 0)} inside a cascade)")
    print()

    # Per-component table — only commits that fall inside a set-add cascade.
    ids = sorted({r["id"] for r in profiler_rows})
    print("Per-component actualDuration (ms), commits inside a set-add cascade:")
    print(f"{'profiler_id':<24} {'n':>4} {'mean':>8} {'p50':>8} {'p95':>8} {'max':>8} {'sum':>9}")
    for pid in ids:
        vals = [r["actual"] for r in profiler_rows if r["id"] == pid and r["cascade"] > 0]
        if not vals:
            print(f"{pid:<24} {0:>4} {'-':>8} {'-':>8} {'-':>8} {'-':>8} {'-':>9}")
            continue
        print(f"{pid:<24} {len(vals):>4} {statistics.mean(vals):>8.2f} "
              f"{pctl(vals,50):>8.2f} {pctl(vals,95):>8.2f} {max(vals):>8.2f} "
              f"{sum(vals):>9.2f}")
    print()

    # Commits per cascade per component (how many times each child re-rendered per set-add).
    print("Commits per cascade per component:")
    print(f"{'profiler_id':<24} " + " ".join(f"c{i+1:>2}" for i in range(n_cascades)))
    for pid in ids:
        counts = []
        for i in range(n_cascades):
            counts.append(sum(1 for r in profiler_rows
                              if r["id"] == pid and r["cascade"] == i + 1))
        print(f"{pid:<24} " + " ".join(f"{c:>3}" for c in counts))
    print()

    # Persist-action counts.
    persist = [t for t in trace_rows if t["type"].startswith("persist/")]
    print(f"persist/* actions total            : {len(persist)}")
    by_type = {}
    for t in persist:
        by_type[t["type"]] = by_type.get(t["type"], 0) + 1
    for k in sorted(by_type):
        print(f"  {k:<32} : {by_type[k]}")
    # persist/* actions that land inside a set-add cascade window
    persist_in_cascade = [t for t in persist if cascade_index(t["ts"])]
    print(f"persist/* inside a set-add cascade  : {len(persist_in_cascade)}")
    print(f"ADD_OR_UPDATE_SET_IN_WORKOUT count : {n_cascades}")


if __name__ == "__main__":
    main()
