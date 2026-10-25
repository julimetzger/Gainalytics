# Driving devices with adb

uiautomator dumps, coordinate taps, gestures, text entry, screenshots and `dumpsys` checks — the fallback toolkit when Maestro can't reach something, and the source of most hard evidence.
Real-phone specifics: [real-device.md](real-device.md). Back to the [index](../agent-memory.md).

### uiautomator dump pitfalls
- `adb shell uiautomator dump /sdcard/ui.xml` prints `ERROR: could not get idle state!` and writes NOTHING on screens with a ticking timer, live chart, playing video or the Metro "Bundling …%" overlay — the pulled file is then the PREVIOUS one. `rm -f /sdcard/ui.xml` before every dump and accept success only when stdout contains `dumped to`; retry on a timeout instead of a fixed sleep (bundling on the phone takes ~40 s).
- A dump can even describe a previous app PROCESS (wrong date/screen). Treat the screencap as authoritative for STATE; use the dump for coordinates, cross-checking one value that must differ.
- testIDs surface as `resource-id` OR `content-desc` (bottom tabs) — match `(resource-id == X) OR (content-desc == X)`.
- Paper `TextInput`: the floating label carries the SAME testID as the `EditText` — `grep -m1` taps the label and nothing focuses. Match the class: `grep 'my-input" class="android.widget.EditText'`, then poll for `focused="true"`. The `EditText`'s current value is in `text=` (which precedes `resource-id` in the XML — regex `text="([^"]*)"[^>]*?resource-id="X"`).
- A row half scrolled off-screen exposes its container but not the clipped child Text — scroll it fully into view before concluding a testID is missing.
- While an RN `Modal` is open the dump contains only the modal's window.
- Removal tickets: `grep -c "<text>" ui.xml` = 0 on a FRESH dump is a valid absence check when Maestro is unavailable.
- Never dump while Maestro runs (kills its UiAutomation, see [maestro-running](maestro-running.md#run-maestro-and-uiautomator-never-at-the-same-time)).
- Piping `dumpsys … | python3 - <<PY` over adb intermittently gets empty stdin; `grep … | grep -oE …` pipelines are reliable.
(seen in GH-63, GH-321, GH-405, GH-428, GH-437, GH-477)

### Compute tap coordinates correctly
- Prefer the dump: `bounds="[x1,y1][x2,y2]"` → tap `((x1+x2)/2, (y1+y2)/2)`. Parse safely: `sed 's/\]\[/ /; s/[][]//g; s/,/ /g'` → `x1 y1 x2 y2` (`tr -d '[]'` fuses `357][485` into `357485` and the tap silently goes nowhere). Sanity-check results against the device size.
- Input coordinates live in the `wm size` OVERRIDE space when one is set (the phone: physical 1440x3200, override 720x1600), not in screenshot pixels. Scale = input width / screenshot width (e.g. an 800-wide resized emulator shot → ×1.35; a 600-wide phone shot → ×1.2). Read `adb shell wm size` AND the PNG dimensions every time; gate scripts on them so another display fails loudly.
- When nothing is in the tree: sample the full-resolution screencap with PIL (target colours, e.g. the theme's `primaryContainer`), take the centroid, and verify by drawing a box (`ffmpeg … -vf "drawbox=…,scale=800:-1"`) before tapping. Being 50 px off misses a ~100 px icon.
- Hard-coded tap percentages rot with every layout change — re-measure from the current screen.
(seen in GH-312, GH-322, GH-323, GH-329, GH-363, GH-436)

### Taps that do not register on RN touchables
- `adb shell input tap` sometimes produces a ripple or nothing, while `adb shell input swipe X Y X Y 80` (a tap with an 80 ms hold) registers immediately — use micro-hold swipes for stubborn targets (`~50` ms for closing taps, `≥100` for presses).
- `adb shell input` uses InputManager, so it also works inside `GestureHandlerRootView`/`GestureDetector` subtrees where accessibility-based taps are intercepted.
- No visible effect may just mean late delivery on a loaded emulator (see [loaded emulator](adb-and-emulators.md#a-loaded-emulator-delivers-taps-late)).
- Before deciding the app is broken because adb taps fail, prove the logic with a real-store component test (see [unit-testing](unit-testing.md#prefer-a-real-store-test-over-flaky-device-taps)).
(seen in GH-322, GH-367)

### Long press and drag with motionevent
- `input swipe` interpolates with no initial hold, so `Pressable.onLongPress` (draggable lists) never fires and a slow swipe can PRESS a row (it opened a finished set's edit fields on real data). Compose raw events in ONE shell: `adb shell 'input motionevent DOWN x y && for i in $(seq 1 12); do sleep 0.1; input motionevent MOVE x y; done && for i in $(seq 1 N); do sleep 0.05; input motionevent MOVE x $((y0 - i*step)); done && input motionevent UP x y_end'` — 12 stationary MOVEs ≈ 1.2 s long-press.
- This activates `react-native-draggable-flatlist` drags (row highlighted) but the subsequent pan often does not reorder — treat activation as proof of wiring and ask for real-finger verification. Exception: the custom `PlanEditList` handle (see [plan editor](app-screens.md#plan-editor-inputs)).
- For a mid-swipe screenshot: DOWN, MOVEs, screencap while the finger is down, then UP — on a read-only screen; force-stop afterwards if an edit row opened.
- Pinch: `sendevent` is SELinux-blocked on the phone; build a tiny Java tool that injects two-pointer `MotionEvent`s via `InputManager.getInstance().injectInputEvent(ev, 0)` (`javac --release 11 -cp $ANDROID_HOME/platforms/android-34/android.jar` + `d8`, push the dex, `adb shell CLASSPATH=/data/local/tmp/x.dex app_process /system/bin pkg.Main …`).
(seen in GH-263, GH-351, PERF-003)

### Typing text with adb
- Clear a field: tap it, `input keyevent 123` (MOVE_END — RN does not put the cursor at the end on focus), then N× `input keyevent 67`. Without clearing, typed text concatenates with prefilled values.
- Quote for the DEVICE shell too: `adb shell "input text '#00FF'"` — unquoted `#` starts a comment there (`Argument expected after "text"`); same for `; & < >` and spaces.
- Masked inputs (react-native-paper-dates `MM/DD/YYYY`) drop or re-complete characters under bulk injection: focus, MOVE_END, 12–15 backspaces, type ONE character per `input text` call (~0.1 s apart), verify the `EditText` text in a dump, retry up to 5× (the former GH-341 script `run-gh341-records-flow.sh`, removed in GH-584 — see git history). Digits only works too (`input text 01022026`); the value normalises on blur.
- `adb shell input text` does not open the IME, unlike Maestro `inputText`.
- Hide the IME with `input keyevent 4` (BACK) only when `dumpsys input_method | grep -q 'mInputShown=true'` — otherwise BACK closes the dialog/screen. `keyevent 111` (ESCAPE) navigates back here. Re-dump after the IME hides (layout shifts ~50 px).
- Samsung IME commits typed text twice into some search fields — prefer adb `input text` over typing via the keyboard.
(seen in GH-246, GH-341, GH-405, GH-458)

### Scrolling with adb when a gesture child eats the swipe
- Video players, charts and swipers consume centred drags. Swipe along an edge outside them with a long duration: `adb shell input swipe 1000 1900 1000 600 800` (1080-wide) or `input touchscreen swipe 700 1300 700 200 1500` (720-wide); x ≤ 30 or x ≥ width-30 works when nothing else does — but the far left edge (x ≲ 30) can trigger the system BACK gesture.
- Find the real scroll container first: `grep 'scrollable="true"'` in a dump.
- Don't change `wm density` to fit more on screen (it kicked the app to the launcher; `wm density reset` + relaunch).
See also [Maestro scrolling](maestro-flows.md#scrolling-in-flows).

### Screenshots and pixel evidence
- Always resize before viewing: `adb -s "$ANDROID_SERIAL" exec-out screencap -p > raw.png && ffmpeg -y -i raw.png -vf scale=800:-1 out.png`. A suspiciously small PNG (< 25 KB) = screen off/AOD.
- "Looks identical" claims: diff with PIL `ImageChops.difference` after masking the status bar (top ~4–8 %, live clock) and nav bar (bottom ~4.5 %) — report differing-pixel counts. Same trick proves scrolling (0 changed pixels after three swipes = stuck; `> 20000` = scrolled).
- Order/position changes: crop the strip, binarize, IoU of glyph masks per slot (swapped labels: IoU 1.000 against the other slot) — see `__tests__/e2e/scripts/assert-gh355-tab-order.py`; always re-run with the before image as `--after` and expect exit 1.
- Colours aren't in any a11y tree: crop the element from the RAW screencap, take the dominant colour, compare to the palette token from `buildThemes()` (not the source literal) with tolerance ~4, and assert it differs from the token it must not be.
- Contrast: measure fill vs glyph luminance from the full-size PNG (WCAG ratio); downscaled contact sheets fake low contrast.
- Smoothness: a few screenshots can't prove it — `adb shell screenrecord --time-limit 10`, `ffmpeg -vsync passthrough` every frame, crop, track the marker's x per frame (per-frame deltas, max stall).
(seen in GH-177, GH-355, GH-405, GH-414, GH-437)

### Layout facts from dumpsys and bounds
- `adb shell dumpsys activity top` dumps the native view tree WITH bounds even where uiautomator sees nothing — compare a ReactScrollView's height with its content child (e.g. 4093 vs 5878 = unreachable content). Bounds are parent-relative; a swiper row can sit at x = -1080, so the visible pane isn't necessarily the first ScrollView listed.
- Content-independent geometry: compare the innermost scrollable's `y2` with the tab bar's `y1` from uiautomator bounds instead of measuring pixels on screens whose content ends early.
- `onLayout`/`onContentSizeChange` logs (or an on-screen badge) separate "layout broken" from "touch broken" before touching styles.
(seen in GH-324, GH-356, GH-382, GH-414)

### Read device state with dumpsys and pm
- Keyboard: `dumpsys input_method | grep -E "mShowRequested|mInputShown|mImeWindowVis"` (false/0 → true/3 when it shows).
- Foreground: `dumpsys window | grep -i mCurrentFocus` (app vs launcher vs `Bouncer` vs a system dialog).
- Target SDK actually applied: `dumpsys package <pkg> | grep -oE 'targetSdk=[0-9]+'`; `dumpsys activity services <pkg>` records `targetSdkVersion` per `startForeground`; `aapt2 dump badging <apk>` for the artifact. Edge-to-edge: activity window frame height from `dumpsys window <pkg>` equals `wm size`.
- Update vs reinstall: `dumpsys package <pkg> | grep -E "firstInstallTime|lastUpdateTime"` — `-r` keeps firstInstallTime.
- URI grants: `dumpsys activity permissions | grep -A2 <mediaId> | grep -oE 'persisted=0x[0-9a-f]+'` — count the `persisted=` flag, not the line (a transient session grant keeps the line).
- Permission really unused? `pm revoke <pkg> <perm>` + force-stop + relaunch on the existing build before spending a build.
- While waiting on the device from the harness, `adb shell sleep 15` works where host `sleep` is blocked.
(seen in GH-321, GH-358, GH-396, GH-421, GH-428)
