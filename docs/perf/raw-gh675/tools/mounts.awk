# GH-675: native views created per UI-thread frame after a gesture (atrace text dump, device awk).
#   awk -v app=<pid> -f mounts.awk trace.txt
# Counts SurfaceMountingManager::createViewUnsafe slices of the UI thread inside each
# "Choreographer#doFrame" (premount + mount) and prints every frame that created views:
# offset after the first gesture's finger-up, views created, UI-thread doFrame duration.
# Last line: total views and the largest number created in one frame ("max_batch").
# The views per frame are what the frame costs on any device (PERF-004: ~0.34 ms per view on the
# SM-G986B, 758 views = the 261 ms frame), independent of the emulator's GPU and CPU contention.
function ts_of(line) {
  if (match(line, / [0-9]+\.[0-9]+: /)) return substr(line, RSTART + 1, RLENGTH - 3) * 1000.0
  return -1
}
function tid_of(line,   s) {
  if (match(line, /-[0-9]+ +\(/)) { s = substr(line, RSTART + 1, RLENGTH - 1); sub(/ .*/, "", s); return s }
  return ""
}
BEGIN { d = 0; inframe = 0; t0 = -1; tot = 0; mx = 0; printf "offset_ms\tviews\tdoframe_ms\n" }
{
  if (!index($0, "tracing_mark_write: ")) next
  if (tid_of($0) != app) next
  t = ts_of($0)
  if (index($0, "tracing_mark_write: B|" app "|")) {
    name = $0; sub(/.*tracing_mark_write: B\|[0-9]+\|/, "", name)
    d++; sn[d] = name; st[d] = t
    if (t0 < 0 && index(name, "deliverInputEvent") == 1) t0 = t
    if (!inframe && index(name, "Choreographer#doFrame ") == 1) { inframe = 1; fd = d; fs = t; nv = 0 }
    if (inframe && index(name, "SurfaceMountingManager::createViewUnsafe") == 1) nv++
  } else if (index($0, "tracing_mark_write: E|" app) && d > 0) {
    if (inframe && d == fd) {
      inframe = 0
      if (nv > 0 && t0 >= 0) { printf "%d\t%d\t%.1f\n", fs - t0, nv, t - fs; tot += nv; if (nv > mx) mx = nv }
    }
    d--
  }
}
END { printf "total %d max_batch %d\n", tot, mx }
