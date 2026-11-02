# GH-671 ablation: master vs. render (#683) vs. render + persistence (#684)

The emulator agent checks out only one commit (depth 1), so the three variants are built from this
branch by reverse-applying these patches:

- **C, render + persistence:** this branch as it is.
- **B, render only (#683):** `git apply -R docs/perf/raw-gh671/ablation/persist-code.patch`. This restores
  `configureStore.ts` and `workoutReducer.ts`. `incremental-storage.ts` stays in place but is no longer imported.
- **A, master:** B, plus `git apply -R docs/perf/raw-gh671/ablation/render-code.patch`. This patch covers the
  app code of #683 only; the tests are left as they are.
