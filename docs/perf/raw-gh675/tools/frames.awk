# GH-675: frame durations per gesture from an atrace text dump (runs with the device's awk).
#   awk -v app=<pid> [-v win=<ms>] [-v dbg=1] -f frames.awk trace.txt
# win       = only frames that start within <win> ms after the gesture's finger-up (opens: 1500, which
#             leaves out an app-independent burst of long frames ~1.7-2.1 s after the tap that every
#             cold-start series shows on the CI emulator, also without any JS work).
# frame     = UI-thread "Choreographer#doFrame <vsync>" slice + the RenderThread "DrawFrames <vsync>"
#             slice with the same vsync id: start of doFrame -> end of DrawFrames (doFrame alone when
#             nothing was drawn). Approximates PERF-004's frame-timeline duration (no trace_processor here).
# ui        = UI-thread part of the frame: doFrame minus "postAndWait" (the UI thread blocked on the
#             RenderThread). On the CI emulator the RenderThread is dominated by the emulated GPU
#             (first-use shader compiles of 100-500 ms, glCreateProgram), which no app change touches;
#             `ui` is the share the app's own work (mounting views, measuring, View#draw recording) costs.
# gesture   = run of deliverInputEvent slices < 350 ms apart (as gestures.awk); a frame belongs to the
#             gesture in whose window [gesture start, next gesture start) its doFrame starts.
# Output per gesture: frames, > 16.7 ms, > 33 ms, > 50 ms, longest frame; longest ui, ui > 33 ms, ui > 50 ms.
function ts_of(line) {
  if (match(line, / [0-9]+\.[0-9]+: /)) return substr(line, RSTART + 1, RLENGTH - 3) * 1000.0
  return -1
}
function tid_of(line,   s) {
  if (match(line, /-[0-9]+ +\(/)) { s = substr(line, RSTART + 1, RLENGTH - 1); sub(/ .*/, "", s); return s }
  return ""
}
BEGIN { ni = 0; nf = 0 }
{
  if (!index($0, "tracing_mark_write: ")) next
  t = ts_of($0); if (t < 0) next
  tid = tid_of($0)
  if (index($0, "tracing_mark_write: B|" app "|")) {
    name = $0; sub(/.*tracing_mark_write: B\|[0-9]+\|/, "", name)
    depth[tid]++; sn[tid, depth[tid]] = name; st[tid, depth[tid]] = t
    if (index(name, "deliverInputEvent") == 1) { ni++; inp[ni] = t }
  } else if (index($0, "tracing_mark_write: E|" app) && depth[tid] > 0) {
    name = sn[tid, depth[tid]]; s0 = st[tid, depth[tid]]; depth[tid]--
    if (index(name, "Choreographer#doFrame ") == 1 && tid == app) {
      id = name; sub(/^Choreographer#doFrame /, "", id); sub(/ .*/, "", id)
      # Android 14 nests "Choreographer#doFrame - resynced to …" inside the real slice: skip it
      if (id ~ /^[0-9]+$/) { nf++; fid[nf] = id; fs[nf] = s0; fe[nf] = t; fw[nf] = wait; wait = 0 }
    } else if (name == "postAndWait" && tid == app) {
      wait += t - s0
    } else if (index(name, "DrawFrames ") == 1) {
      id = name; sub(/^DrawFrames /, "", id); sub(/ .*/, "", id)
      de[id] = t
    }
  }
}
END {
  ng = 0
  for (i = 1; i <= ni; i++) {
    if (ng > 0 && inp[i] - ge[ng] < 350) ge[ng] = inp[i]
    else { ng++; gs[ng] = inp[i]; ge[ng] = inp[i] }
  }
  printf "i\tframes\tgt16\tgt33\tgt50\tmax_frame_ms\tmax_ui_ms\tui_gt33\tui_gt50\n"
  for (g = 1; g <= ng; g++) {
    we = (g < ng) ? gs[g + 1] : 1e18
    n = 0; a = 0; b = 0; c = 0; mx = 0; mu = 0; ub = 0; uc = 0
    for (k = 1; k <= nf; k++) {
      if (fs[k] < gs[g] || fs[k] >= we) continue
      if (win > 0 && fs[k] > ge[g] + win) continue
      end = (fid[k] in de && de[fid[k]] > fe[k]) ? de[fid[k]] : fe[k]
      d = end - fs[k]; u = fe[k] - fs[k] - fw[k]; n++
      if (d > 16.7) a++
      if (d > 33.4) b++
      if (d > 50) c++
      if (d > mx) mx = d
      if (u > 33.4) ub++
      if (u > 50) uc++
      if (u > mu) mu = u
      if (dbg && d > 16.7) printf "# g%d frame %s at +%d ms: doFrame %.1f ms (ui %.1f, waits %.1f), total %.1f ms\n", g - 1, fid[k], fs[k] - ge[g], fe[k] - fs[k], u, fw[k], d
    }
    printf "%d\t%d\t%d\t%d\t%d\t%.1f\t%.1f\t%d\t%d\n", g - 1, n, a, b, c, mx, mu, ub, uc
  }
}
