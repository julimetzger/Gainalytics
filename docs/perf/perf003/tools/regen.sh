#!/bin/bash
# usage: regen.sh <prefix> ...   (re-run gestures.py on every trace of the given run-dir prefixes)
# PERF003_WORKTREE: checkout to measure (default: the git checkout containing this script, else $PWD)
# PERF003_RUN_DIR:  PERF-003 run directory (default <main repo>/.codex-orchestrator/runs/PERF-003)
S=$(dirname "$(readlink -f "$0")")
W=${PERF003_WORKTREE:-$(git -C "$S" rev-parse --show-toplevel 2>/dev/null || pwd)}
T=$W/docs/perf/perf003/tools   # analyzers always come from the checkout, never from a copied script's dir
M=$(dirname "$(git -C "$W" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo "$W/.git")")
RUN=${PERF003_RUN_DIR:-$M/.codex-orchestrator/runs/PERF-003}
R=$RUN/raw
cd /tmp
[ -f "$T/gestures.py" ] || { echo "gestures.py not found in $T (set PERF003_WORKTREE)" >&2; exit 1; }
rc=0
for p in "$@"; do for d in $R/$p-*/; do
  [ -f $d/trace.pftrace ] || continue
  # write to a temp file and replace gestures.json only when the analyzer succeeded
  tmp=$(mktemp "$d/gestures.json.XXXXXX")
  if python3 "$T/gestures.py" "$d/trace.pftrace" > "$tmp"; then mv "$tmp" "$d/gestures.json"
  else echo "gestures.py failed for $d (kept existing gestures.json)" >&2; rm -f "$tmp"; rc=1; fi
done; done
exit $rc
