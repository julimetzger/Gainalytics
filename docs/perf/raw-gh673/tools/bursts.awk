# GH-673: JS-thread bursts after one gesture of an atrace text dump (like PERF-004 bursts.py).
#   awk -v app=<pid> -v js=<tid> -v g=<gesture index> -f bursts.awk trace.txt
# Gestures as in gestures.awk (deliverInputEvent runs < 350 ms apart). Prints every burst (Running
# segments of mqt_v_js merged while the gap <= 8 ms) from the gesture's last input event until the
# next gesture: offset_ms after finger-up, duration_ms, gap_ms to the previous burst.
function ts_of(line) {
  if (match(line, / [0-9]+\.[0-9]+: /)) return substr(line, RSTART + 1, RLENGTH - 3) * 1000.0
  return -1
}
BEGIN { run_start = -1; ns = 0; ni = 0 }
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
  if (index($0, "tracing_mark_write: B|" app "|") && index($0, "|deliverInputEvent")) { ni++; inp[ni] = t }
}
END {
  ng = 0
  for (i = 1; i <= ni; i++) {
    if (ng > 0 && inp[i] - ge[ng] < 350) ge[ng] = inp[i]
    else { ng++; gs[ng] = inp[i]; ge[ng] = inp[i] }
  }
  k = g + 1
  from = ge[k]; to = (k < ng) ? gs[k + 1] : 1e18
  nb = 0
  for (j = 1; j <= ns; j++) {
    if (se[j] <= from || ss[j] >= to) continue
    if (nb > 0 && ss[j] - be[nb] <= 8) be[nb] = se[j]
    else { nb++; bs[nb] = ss[j]; be[nb] = se[j] }
  }
  printf "offset_ms\tduration_ms\tgap_ms\n"
  for (j = 1; j <= nb; j++) printf "%d\t%d\t%d\n", bs[j] - from, be[j] - bs[j], (j > 1) ? bs[j] - be[j - 1] : 0
}
