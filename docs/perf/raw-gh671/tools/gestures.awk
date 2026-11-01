# GH-671 (copy of GH-672's gestures.awk + column block_ms): per-gesture analysis of an atrace text dump, same definitions as
# docs/perf/raw-2026-11/tools/gestures.py (PERF-004), runs with the device's awk
# (no trace_processor / python on the CI runner).
#   awk -v app=<pid> -v js=<tid of mqt_v_js> -f gestures.awk trace.txt
# gesture      = run of deliverInputEvent slices of the app separated by < 350 ms
# js_busy_ms   = Running time of mqt_v_js in [gesture start, next gesture start)
# settle_ms    = finger-up -> end of the JS work the gesture triggered: Running segments merged
#                into bursts (gap <= 8 ms), bursts >= 10 ms chained from finger-up while the
#                gap to the chain end is <= 150 ms
# views        = SurfaceMountingManager::createViewUnsafe slices in the window
function ts_of(line,   m) {
  if (match(line, / [0-9]+\.[0-9]+: /)) return substr(line, RSTART + 1, RLENGTH - 3) * 1000.0
  return -1
}
{
  t = ts_of($0)
  if (t < 0) next
  if (index($0, "sched_switch:")) {
    np = $0; sub(/.*next_pid=/, "", np); sub(/ .*/, "", np)
    pp = $0; sub(/.*prev_pid=/, "", pp); sub(/ .*/, "", pp)
    if (pp == js && run_start >= 0) { ns++; ss[ns] = run_start; se[ns] = t; run_start = -1 }
    if (np == js) run_start = t
    next
  }
  if (index($0, "tracing_mark_write: B|" app "|")) {
    if (index($0, "|deliverInputEvent")) { ni++; inp[ni] = t }
    else if (index($0, "|SurfaceMountingManager::createViewUnsafe")) { nv++; cv[nv] = t }
  }
  last = t
}
BEGIN { run_start = -1; ns = 0; ni = 0; nv = 0; ng = 0 }
END {
  for (i = 1; i <= ni; i++) {
    if (ng > 0 && inp[i] - ge[ng] < 350) ge[ng] = inp[i]
    else { ng++; gs[ng] = inp[i]; ge[ng] = inp[i] }
  }
  printf "i\tt_rel_s\ttouch_ms\tjs_busy_ms\tsettle_ms\tviews\tblock_ms\n"
  for (g = 1; g <= ng; g++) {
    we = (g < ng) ? gs[g + 1] : last
    busy = 0; nb = 0
    for (k = 1; k <= ns; k++) {
      if (se[k] <= gs[g] || ss[k] >= we) continue
      a = (ss[k] > gs[g]) ? ss[k] : gs[g]; b = (se[k] < we) ? se[k] : we
      busy += b - a
      if (nb > 0 && ss[k] - be[nb] <= 8) { be[nb] = se[k]; bb[nb] += se[k] - ss[k] }
      else { nb++; bs[nb] = ss[k]; be[nb] = se[k]; bb[nb] = se[k] - ss[k] }
    }
    end = ge[g]
    for (k = 1; k <= nb; k++) {
      if (bb[k] < 10) continue
      if (bs[k] > end + 150) break
      if (be[k] > end) end = be[k]
    }
    v = 0
    for (k = 1; k <= nv; k++) if (cv[k] >= gs[g] && cv[k] < we) v++
    # GH-671: block_ms = wall time of the first JS burst >= 10 ms busy after the finger-up
    # (PERF-004 burst-structure.txt "zusammenhaengender JS-Block")
    blk = 0
    for (k = 1; k <= nb; k++) if (bb[k] >= 10 && be[k] > ge[g]) { blk = be[k] - bs[k]; break }
    printf "%d\t%.2f\t%d\t%d\t%d\t%d\t%d\n", g - 1, (gs[g] - gs[1]) / 1000, ge[g] - gs[g], busy, end - ge[g], v, blk
  }
}
