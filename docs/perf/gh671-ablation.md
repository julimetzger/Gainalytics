# GH-671 ablation: master vs. render fix (#683) vs. render fix + incremental persistence (#684)

Question: is the persistence rework (#684) worth its complexity on top of the render fix (#683)?
Measured on 02.11.2026 on the **CI emulator** (Android 14 x86_64, 1080×2400, same job, same boot) with three
**release builds** (Hermes, no Metro, not debuggable, debug key) built from one checkout of `perf/gh671-persist`
(`536cebe`):

| Variant | Code | How it was built |
|---|---|---|
| **A** master | neither change | `persist-code.patch` and `render-code.patch` reversed (by hand with the editor; `git diff -R` checked byte-identical against both patches) |
| **B** render only (#683) | `useSettingsSelector`, memoised themes, `selectIsAnyTrainingStarted` | `persist-code.patch` reversed |
| **C** render + persistence (#684) | B + `incremental-storage.ts`, `serialize: false`, immutable `FINALIZE_WORKOUT` | branch as is |

Every installed APK was identified on the device before each run (`ablation/tools/variant-check.sh`: Hermes magic
`c61fbc03c103191f`, `pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]`, and string counts in the bytecode:
`selectIsAnyTrainingStarted` = render fix present, `incremental-storage: part` = persistence present, `GH671P` = probe).
A, B, C showed `render/persist` = 0/0, 1/0, 1/1 and probe = 0.

## 1. Method (same as `gh671-set-save.md` / PERF-004 scenario 2)

* **Same data for every run:** `adb install -r apk-<V>` → `pm clear` → `pm grant POST_NOTIFICATIONS` → `tool.sh import-baseline`
  (baseline fixture, the PERF-004 data) → cold start → `raw-gh671/tools/gh671_prep_set_add.yaml` (empty slot
  Push pull › Meso 1 › Micro 6, one exercise Bankdrücken, input row 5 / 0 / 20 kg, training started).
* **Measurement:** `raw-gh671/tools/scn2save.sh` = atrace, 10 s idle, then **12 × "Add"** 4 s apart at (944, 744);
  analysis with `gestures.awk` (PERF-004 definitions). Each tap mounted one new set row (27 views per tap in every
  run, 46 for set 1, which also mounts the rest-timer card), so all 108 taps logged a set.
  * `settle_ms` = finger-up → end of the JS work the tap triggered (bursts ≥ 10 ms chained while gaps ≤ 150 ms) =
    how long the app is blocked after "Add". **This is the ticket metric.**
  * `js_busy_ms` = total JS thread run time until the next tap (4 s window, incl. the 1 s ticks of session and rest timer).
  * `block_ms` = wall time of the first contiguous JS burst after the tap.
* **Interleaved against drift:** 3 rounds, order rotated: r1 A B C, r2 B C A, r3 C A B → n = 3 runs × 12 sets per variant.
  Battery 100 %, 25.0 °C in every run (`conditions.txt`).

## 2. Results (median [min–max])

### Overall, 36 taps per variant (`runs/agg-*.tsv`)

| Variant | settle_ms | js_busy_ms | block_ms |
|---|---|---|---|
| A master | **326.5** [221–476] | **287.5** [223–345] | 221 [17–308] |
| B render | **264** [143–437] | **193** [164–283] | 137 [14–263] |
| C render + persistence | **117.5** [91–326] | **132** [114–252] | 98.5 [18–166] |

### Per run (median of the 12 taps, `runs/per-run.tsv`)

| Run | settle_ms | js_busy_ms |
|---|---|---|
| A-r1 / A-r2 / A-r3 | 329 / 318 / 343.5 | 288 / 264 / 296 |
| B-r1 / B-r2 / B-r3 | 259.5 / 262 / 264 | 196 / 189 / 199.5 |
| C-r1 / C-r2 / C-r3 | 117.5 / 120 / 119 | 131.5 / 132.5 / 131 |

### Differences (median of the run medians; range = every run of one variant against every run of the other)

| | settle_ms | js_busy_ms |
|---|---|---|
| **B − A** (render fix) | **−67** [−84 … −54] (−20 %) | **−92** [−107 … −64.5] (−32 %) |
| **C − B** (persistence) | **−143** [−146.5 … −139.5] (−55 %) | **−64.5** [−68.5 … −56.5] (−33 %) |
| C − A (both) | −210 (−64 %) | −156.5 (−54 %) |

Of the total gain A → C, the persistence rework accounts for **68 % of `settle`** and 41 % of the JS CPU time;
the render fix for 32 % / 59 %.

### Per set (median [min–max] over the 3 runs)

| Set | settle A | settle B | settle C | js_busy A | js_busy B | js_busy C |
|---|---|---|---|---|---|---|
| 1 | 298 [288–344] | 300 [270–437] | 211 [169–243] | 271 [260–297] | 258 [245–283] | 199 [185–252] |
| 2 | 313 [307–325] | 205 [192–274] | 124 [119–168] | 236 [229–238] | 184 [174–197] | 121 [120–139] |
| 3 | 246 [221–317] | 264 [184–273] | 232 [112–280] | 236 [223–251] | 182 [172–188] | 164 [125–166] |
| 4 | 325 [279–416] | 267 [258–277] | 112 [95–113] | 246 [238–277] | 208 [189–225] | 129 [120–130] |
| 5 | 323 [266–422] | 192 [180–264] | 114 [93–262] | 268 [263–295] | 178 [177–186] | 128 [119–135] |
| 6 | 285 [236–339] | 271 [143–272] | 104 [95–181] | 264 [246–295] | 202 [164–207] | 123 [117–166] |
| 7 | 353 [340–366] | 180 [160–373] | 106 [93–118] | 265 [265–294] | 176 [176–233] | 122 [114–137] |
| 8 | 363 [319–399] | 198 [190–272] | 113 [91–195] | 316 [285–317] | 189 [183–205] | 129 [119–152] |
| 9 | 287 [275–392] | 311 [276–318] | 117 [107–326] | 291 [290–345] | 193 [193–210] | 134 [125–167] |
| 10 | 426 [301–476] | 179 [176–266] | 116 [96–126] | 335 [302–342] | 198 [191–219] | 135 [126–136] |
| 11 | 381 [355–386] | 287 [223–307] | 184 [101–267] | 310 [303–316] | 189 [188–226] | 138 [122–157] |
| 12 | 343 [328–394] | 204 [170–252] | 129 [109–261] | 335 [324–336] | 195 [194–211] | 155 [126–159] |

**Set 12 vs. set 1** (AC: set 12 ≤ 1.2 × set 1):

| Variant | settle 1 → 12 | js_busy 1 → 12 | js_busy 2 → 11 (without the special first/last tap) |
|---|---|---|---|
| A | 298 → 343 (+15 %) | 271 → 335 (+24 %) | 236 → 310 (+31 %) |
| B | 300 → 204 (−32 %) | 258 → 195 (−24 %) | 184 → 189 (+3 %) |
| C | 211 → 129 (−39 %) | 199 → 155 (−22 %) | 121 → 138 (+14 %) |

Set 1 is more expensive in every variant (it creates the workout, `ADD_WORKOUT`, and mounts the rest-timer card).
Set 12's window is ~1 s longer (until the end of the trace), so it collects one more timer tick. The growth per set
is a master problem (A). The render fix removes it (B is flat). C still grows by about 2 ms per set in `js_busy`
(see the open questions), but `settle` stays flat.

## 3. Where the C − B gap comes from (instrumented probe, one run each)

Two extra release builds of B and C with the temporary probe (`raw-gh671/tools/perfProbe.ts.txt`):
`probeStart` in the "Add" `onPress`, a span around the handler (`submit()`), and a span around `reduxStorage.setItem`
(the same wrapper in both variants). The probe was removed again and is not in any committed file or measured APK.
Times are from the start of the handler; one run of 12 sets (`runs/probe-B/probe.txt`, `runs/probe-C/probe.txt`).

| | B render only | C render + persistence |
|---|---|---|
| handler (`submit`: two dispatches + selectors) | 19.7 [16.1–37.3] | 17.9 [14.3–49.8] |
| storage write starts | 141 [103–208] | 56 [49–115] |
| storage write (`setItem`) duration | 15.1 [7.9–27.4] (one 1.74 MB MMKV `set`) | 9.2 [8.6–82.9] (manifest + changed parts) |
| **tap → end of the storage write** | **158 [122–221]** | **65 [60–198]** |

In B the write is the old redux-persist path: on the next timer ticks after the render, it serialises the changed slices
(including the 1.35 MB `workouts` slice), then stringifies the root value again, then makes one MMKV `set` of 1.74 MB.
This JS work (~60 ms CPU per tap on the emulator, see the `js_busy` difference) runs as **separate bursts after the
render**, less than 150 ms apart, so it extends the blocked chain (`settle`) far more than its CPU time. That is why
C − B is −143 ms in `settle` but only −64.5 ms in `js_busy`.
In C the write is finished ~65 ms after the tap, right behind the render, so the chain ends at ~100–120 ms.
One outlier in C (set 3: `setItem` 82.9 ms, end 198 ms, and in the same tap `settle` 254 ms) was not investigated further.
Apart from that tap, the probe builds showed the same `settle` as the measured runs: B 160–393 ms, C 93–145 ms
(`probe-*/gestures.tsv`).

## 4. Data safety of C (sanity check)

`runs/safety-C.txt`: release C, 3 × "Add", a 4th "Add" and `am force-stop` (SIGKILL) ~0.3 s after it
(`forcestop-after-add.sh … 0.3`, the script returned after 506 ms incl. the `input`/`am` start-up), cold start →
`ablation/tools/gh671_check_after_kill.yaml` green: the next row is "Set 5", logged rows 1–4 are present, row 5 is not;
the screen showed "Bankdrücken 4 sets ✓" and the rest timer still running. Together with the probe (write finished
≤ 198 ms after the tap), the killed set had been written.

## 5. Assessment

* **C − B is far above the noise.** The run medians within each variant spread by 4.5 ms (B) and 2.5 ms (C) in `settle`,
  and by 10.5 ms (B) and 1.5 ms (C) in `js_busy`. The gap between B and C is −139.5 to −146.5 ms (`settle`) and −56.5 to −68.5 ms
  (`js_busy`) for **every** pair of runs, so the ranges do not overlap. `js_busy` is lower in C than in B for all 12
  set positions; `settle` is lower for all 12 set medians as well. The tap → end-of-write time drops from 158 to 65 ms (probe).
* **Without the persistence rework the target is out of reach even on the emulator.** B blocks for 264 ms in the
  median on the emulator; the ticket target is ≤ 150 ms **on the real device**, which was ~1.65× slower than this
  emulator in PERF-004 (549 ms device vs. 333 ms emulator for master). C is the only variant below 150 ms on the
  emulator (117.5 ms). The device estimate (factor 1.65, **not a measurement**) is A ≈ 540, B ≈ 435, C ≈ 195 ms.
* **The render fix alone is worth it too.** It removes the per-set growth (A +31 % from set 2 to 11, B +3 %) and
  32 % of the JS CPU time. It accounts for the smaller part of the `settle` gain (−67 ms) because the persistence
  bursts keep the chain alive in B.
* **Costs of C:** 237 lines of storage code plus tests, a new storage format (a downgrade starts empty), the
  "never mutate a stored workout" rule for reducers, and an open Codex P2 finding (reference caches are
  updated before the manifest commit, so after a failed write a retry can be skipped). The finding was not fixed in
  this round, because the round was measurement only.
* **Verdict from the data:** the persistence rework delivers the larger part of the gain in the ticket metric. The
  numbers support keeping it, provided the Codex finding is fixed. A cheaper alternative that also takes the 1.35 MB
  serialisation out of every "Add" (for example a nested persist config only for `workouts`, or a longer
  redux-persist `throttle`) was **not** measured here. It would need its own run against C.

## 6. Caveats

* **Emulator, not the device.** Absolute values do not transfer 1:1, and the relative weight of serialisation vs. rendering
  can differ on the ARM device (Hermes on a phone CPU, real flash for MMKV). The acceptance measurement on R5CN30HWZFN
  is still open.
* n = 3 runs per variant (36 taps). The probe numbers come from one run per variant. The probe builds contain a few extra
  `performance.now()` calls and one `console.log` 2.5 s after each tap, outside the measured window.
* `settle` depends on the 150 ms chaining rule: a timer tick (~10 ms each second) next to the chain can extend it by
  100–200 ms. This causes the single high values in every variant (e.g. C 326 ms at set 9 in one run).
* Open question: C's `js_busy` grows ~2 ms per set (121 → 138 ms from set 2 to 11). B does not, so the cause is
  probably the incremental storage. A likely candidate is the set list of the running workout, which gets longer and
  is rewritten in its chunk on each "Add". At 12 sets this is far below the noise of `settle`, but it was not investigated.

## 7. Files

* `raw-gh671/ablation/runs/` – per run `gestures.tsv`, `conditions.txt`, `ids.txt`, `gfxinfo.txt`, `meminfo.txt`;
  `agg-A|B|C.tsv` (per set over 3 runs), `per-run.tsv`, `probe-B/`, `probe-C/` (`probe.txt` = the logcat lines),
  `safety-C.txt`. The atrace dumps (~100 MB per run) are not checked in.
* `raw-gh671/ablation/tools/` – `variant-check.sh` (which variant is installed), `export-ablation.sh` (aggregation and
  export on the device), `gh671_check_after_kill.yaml` (Maestro check after the kill). Measurement tools as before in
  `raw-gh671/tools/`.
