# GH-675: heavy UI-thread slices after the first gesture of an atrace text dump (device awk).
#   awk -v app=<pid> [-v min=20] [-v win=1500] -f heavy.awk trace.txt
# Counts, on the UI thread, within <win> ms after the first finger-up:
#   props = "IntBufferBatchMountItem::mountInstructions::UPDATE_PROPS" batches >= min ms
#           (a native view applying changed props; for the charts-wrapper charts every prop update runs
#           notifyDataSetChanged + a full redraw)
#   draw  = "Record View#draw()" slices >= min ms (UI-thread recording of a frame, e.g. the chart redraw)
# and prints their sum in ms.
function ts_of(line) {
  if (match(line, / [0-9]+\.[0-9]+: /)) return substr(line, RSTART + 1, RLENGTH - 3) * 1000.0
  return -1
}
function tid_of(line,   s) {
  if (match(line, /-[0-9]+ +\(/)) { s = substr(line, RSTART + 1, RLENGTH - 1); sub(/ .*/, "", s); return s }
  return ""
}
BEGIN { if (min == "") min = 20; if (win == "") win = 1500; d = 0; t0 = -1; np = 0; nd = 0; sp = 0; sd = 0 }
{
  if (!index($0, "tracing_mark_write: ")) next
  if (tid_of($0) != app) next
  t = ts_of($0)
  if (index($0, "tracing_mark_write: B|" app "|")) {
    name = $0; sub(/.*tracing_mark_write: B\|[0-9]+\|/, "", name)
    d++; sn[d] = name; st[d] = t
    if (t0 < 0 && index(name, "deliverInputEvent") == 1) t0 = t
  } else if (index($0, "tracing_mark_write: E|" app) && d > 0) {
    if (t0 >= 0 && st[d] >= t0 && st[d] <= t0 + win && t - st[d] >= min) {
      if (index(sn[d], "mountInstructions::UPDATE_PROPS") > 0) { np++; sp += t - st[d] }
      if (sn[d] == "Record View#draw()") { nd++; sd += t - st[d] }
    }
    d--
  }
}
END { printf "props %d (%.0f ms)\tdraw %d (%.0f ms)\n", np, sp, nd, sd }
