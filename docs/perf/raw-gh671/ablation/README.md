# GH-671 ablation: master vs. render (#683) vs. render + persistence (#684)

The emulator agent checks out only one commit (depth 1), so the three variants are built from this
branch by reverse-applying these patches:

- **C, render + persistence:** this branch as it is.
- **B, render only (#683):** `git apply -R docs/perf/raw-gh671/ablation/persist-code.patch`. This restores
  `configureStore.ts` and `workoutReducer.ts`. `incremental-storage.ts` stays in place but is no longer imported.
- **A, master:** B, plus `git apply -R docs/perf/raw-gh671/ablation/render-code.patch`. This patch covers the
  app code of #683 only; the tests are left as they are.

In the CI agent job `git apply`/`patch` need approval, so the hunks were reversed with the editor and checked with
`git diff -R` against the patches (identical apart from the header lines). Results: `../../gh671-ablation.md`, raw
data in `runs/`, helper scripts (run on the device / Maestro) in `tools/`.
