# GH-675: atrace slices of one thread inside a frame, to see what a long UI-thread frame does.
#   awk -v app=<pid> -v tid=<tid> -v frame=<vsync id> [-v min=2] -f slices.awk trace.txt
# Prints every slice (depth, start offset from the doFrame start, duration, name) that begins inside
# "Choreographer#doFrame <frame>" on thread <tid> and lasts >= min ms.
function ts_of(line) {
  if (match(line, / [0-9]+\.[0-9]+: /)) return substr(line, RSTART + 1, RLENGTH - 3) * 1000.0
  return -1
}
function tid_of(line,   s) {
  if (match(line, /-[0-9]+ +\(/)) { s = substr(line, RSTART + 1, RLENGTH - 1); sub(/ .*/, "", s); return s }
  return ""
}
BEGIN { if (min == "") min = 2; d = 0; on = 0; n = 0 }
{
  if (!index($0, "tracing_mark_write: ")) next
  if (tid_of($0) != tid) next
  t = ts_of($0)
  if (index($0, "tracing_mark_write: B|" app "|")) {
    name = $0; sub(/.*tracing_mark_write: B\|[0-9]+\|/, "", name)
    d++; sn[d] = name; st[d] = t
    if (name == "Choreographer#doFrame " frame) { on = 1; f0 = t; fd = d }
  } else if (index($0, "tracing_mark_write: E|" app) && d > 0) {
    if (on && t - st[d] >= min) { n++; out[n] = sprintf("%d\t%.1f\t%.1f\t%s", d - fd, st[d] - f0, t - st[d], substr(sn[d], 1, 90)); key[n] = st[d] }
    if (on && d == fd) on = 0
    d--
  }
}
END {
  # sort by start (insertion sort, few lines)
  for (i = 2; i <= n; i++) { k = key[i]; o = out[i]; j = i - 1; while (j > 0 && key[j] > k) { key[j + 1] = key[j]; out[j + 1] = out[j]; j-- } key[j + 1] = k; out[j + 1] = o }
  printf "depth\tstart_ms\tdur_ms\tname\n"
  for (i = 1; i <= n; i++) print out[i]
}
