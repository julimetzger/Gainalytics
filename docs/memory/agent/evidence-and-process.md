# Evidence, review rounds, git & GitHub

What makes evidence convincing, how to resume/feedback rounds safely, and git/gh pitfalls in this repo.
Back to the [index](../agent-memory.md). The binding workflow is `orchestrator/codex-skills/feature/SKILL.md`.

### Evidence must prove the claimed state
- READ every screenshot back before citing it: Maestro screenshots can lag a step behind or come from the wrong device; `screencap` can return a stale frame. Capture evidence with `adb -s "$ANDROID_SERIAL" exec-out screencap -p` and resize (see [screenshots](device-interaction.md#screenshots-and-pixel-evidence)).
- A "pass" needs an assertion that could fail (see [vacuous passes](maestro-flows.md#make-every-assertion-able-to-fail)); prefer measured numbers (pixel diffs, contrast ratios, dumpsys values, store reads) over "looks right".
- When Maestro is genuinely blocked by infra, adb-driven screenshots + dumps are the fallback: commit the flow anyway (regression spec) and state in `summary.md` which device was used and why Maestro could not run.
- Evidence paths in `status.json` must be bare relative paths — no annotations like "(updated in round 3)", no absolute paths (the validator checks existence).
(seen in GH-63, GH-240, GH-326)

### Commit before the device phase
Land all planned code changes and run `npm test` BEFORE device verification — a crashed device session can wipe the "clean code" moment, and an interrupted round then loses only screenshots, never source. Commit (a `wip(…)` commit is fine) before any experiment that reverts files: `git checkout <sha> -- app` / `git checkout HEAD -- <file>` / `git checkout <file>` silently DESTROY uncommitted edits (80 lines of swipe logic lost once). Never `git stash` for evidence — the stash stack is shared across worktrees. Revert experiments with an inverse edit, not `git checkout`. (seen in GH-404, PERF-003)

### Before/after evidence for JS-only changes
- With a debuggable APK on Metro, capture BEFORE and AFTER in the same session, same store, same scroll position: `cp` changed files aside (or commit), `git checkout <base> -- <files>` (or `git switch --detach <pre-change-sha>`), wait for Fast Refresh/relaunch, screenshot, restore, screenshot. Navigate once; only the code differs.
- Assert a UI marker that exists on one side only (`grep -c` on a dump: 0 before / 1 after) — otherwise a stale bundle yields two identical "before" sets that look like a perfect pass.
- Hook-count changes need force-stop + relaunch instead of Fast Refresh (`EnsureSingleNavigator`/"Should have a queue" red screens after a swap are artifacts). After a wide revert, `curl` the bundle once before `am start` to avoid ANRs while Metro rebuilds.
- For resolution/"two views disagree" bugs the before state needs the triggering data ALREADY SET (e.g. set the reference first, then swap the file).
(seen in GH-355, GH-394, GH-401, GH-404, GH-405, GH-415)

### Legacy data and migration evidence
- "Old data still works" evidence must be produced BEFORE the first code edit, on the old build: put the app in the old state and copy its store out (`adb exec-out run-as <pkg> toybox gzip -c files/mmkv/mmkv.default > legacy.gz`). Develop; restore via `/data/local/tmp` + `chmod 666` + `run-as <pkg> cp` (emulator); `adb install -r --no-streaming`; launch with the Metro reverse REMOVED so the embedded bundle runs (`isMetroRunning(): Async result = false`); compare `strings` of the store before/after.
- Prove an in-place update with `dumpsys package <pkg> | grep -E "firstInstallTime|lastUpdateTime"` (first stays, last moves).
- Inspect what a pre-existing record actually renders before adopting it as fixture — a degenerate record (e.g. a raw `file:///sdcard` path from a removed dev import) gives a passing screenshot that proves nothing.
- Permission removal: `pm revoke` on the installed build first (see [dumpsys checks](device-interaction.md#read-device-state-with-dumpsys-and-pm)).
(seen in GH-404, GH-421)

### Resuming a round
- Read `summary.md`, `status.json` and the `run_dir` artifacts first and reuse them — but reconcile them with the worktree: `git log --oneline master..HEAD` and the tests actually on disk. A previous round may have screenshotted code it never committed; evidence only counts for committed code.
- If the branch already holds the full implementation (worker died after committing, before pushing): verify the diff, run tests, build/capture, push — never redo or amend the existing commit; fix defects with additional commits.
- Fix workers run on the existing PR branch/worktree, not on a fresh branch from master.
- A merged PR whose linked issue is still OPEN is a signal to re-audit: re-derive EVERY acceptance criterion from the original ticket against the current code (grep the call sites), independent of the PR's own narrative.
(seen in GH-263, GH-323, GH-355)

### Review feedback
- Before acting, check which items `git log` already addressed after the reviewer's tested commit and READ the referenced code — stale P1s happen. If the fix is there, document file:line, capture a verification screenshot and set `ready_for_review`; never exit silently.
- Codex auto-review matches patterns textually: if it re-flags a shipped fix done via a helper, inline the exact pattern it prescribes at the call site (keep the helper + tests).
- "Hide X in mode Y" findings: gate the side effects (dispatches, timers, notifications), not only the render, and assert the mock was never called.
- A partial revert request: `git show origin/master:<path> > <path>` for the affected files (+ `rm` added ones), then fix the wiring — one auditable commit.
- When a clarifying user statement contradicts the ticket's framing, trust the clarification and verify against the data (see [video domain](state-and-data.md#video-analysis-domain)).
(seen in GH-168, GH-246, GH-307, GH-323)

### Ticket specs vs the codebase
Specs sometimes name things that don't exist here (an "overflow menu" for plan toggles, "MMKV keys" for preferences, a missing dependency). Map them onto the established pattern (TrainingsPlanDrawer toggles; Redux `settings` fields — see [settings](state-and-data.md#settings-and-persisted-enums)) and say so in the PR. Check `package.json` before believing "X is not installed" (e.g. `react-native-svg` IS a dependency now). Mandated libraries (Paper per `AGENTS.md`) are not replaced because a mock is inconvenient. (seen in GH-192, GH-204, GH-417)

### Repo-wide audits
- testID stability: grep quote-agnostically — JSX `testID="x"` vs scaffold props `testID: 'x'`: `grep -rE "['\"]$id['\"]" app --include="*.tsx"`; diff flow-referenced ids against the base commit (ids already missing at base are pre-existing).
- Copy sweeps ("every edit-modal title"): find the shared component (`EditDialogScaffold`) and audit its `title=`/`confirmTitle=` call sites, not a blind text grep (Card titles, tooltips, menu labels must stay as they are; dynamic parts are proper nouns).
- Extracting a change from a contaminated branch: `git show <commit> -- <file>` per source commit — unwanted code that appears only as unchanged CONTEXT was already on that branch's base. Hand-apply the `+`/`-` hunks; verify `git diff <master> HEAD | grep <bad-pattern>` is empty.
(seen in GH-283, GH-339)

### Git pitfalls in this repo
- `core.ignorecase = true` (cloned from Windows) on a case-sensitive FS: `git add` of `app/components/Analyse/X.tsx` can be recorded as `analyse/X.tsx` and show as "deleted". Put new files into the EXISTING directory (`ls` first: it's `app/components/analyse/`, `__tests__/tabs/analyse/`); `jest.mock` paths must match the on-disk case exactly (`Cannot find module` otherwise).
- Never `cd` into `.codex-orchestrator/runs/<id>` and then run git: a failed step before `git add -A && git commit` committed bundle/`__pycache__` artefacts on `master` in the MAIN checkout. Use absolute paths / `git -C <worktree>`; `git branch --show-current` after any surprising commit (undo unpushed with `git reset --mixed HEAD~1`).
- `Write` over an existing file from an earlier round silently replaces it (a committed spec lost 4 tests). `git log --oneline -- <path>` before writing a file you think is new; `git status --short` shows `M` instead of `A`.
- Push rejected for > 100 MB `app-release.apk`/`.aab` you didn't add: local `master` carries un-pushed "release … with bundle and apk" commits. `git log --oneline origin/master..HEAD`; for an unpushed branch: backup branch, `git reset --hard origin/master`, cherry-pick your commits (or `git rebase --onto origin/master <release-commit> <branch>`), re-run tests. Don't rewrite `master`.
- In a merge of an append-only shared doc, a duplicate you didn't introduce is not yours to fix.
(seen in GH-192, GH-302, GH-307, GH-391, GH-450, GH-458)

### Updating a PR body when gh pr edit fails
`gh pr edit <n> --body/--body-file` can exit 1 (or silently not update) with `GraphQL: Projects (classic) is being deprecated … (repository.pullRequest.projectCards)`. `gh api … -f body=@file` stores the literal `@file`. Working: `python3 -c "import json;print(json.dumps({'body':open('body.md').read()}))" > payload.json && gh api -X PATCH repos/<owner>/<repo>/pulls/<n> --input payload.json` (no `jq` on this box), then verify with `gh pr view <n> --json body -q .body | grep -c <marker>`. (seen in GH-124, GH-323, GH-415, GH-458)
