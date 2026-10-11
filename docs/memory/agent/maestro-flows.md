# Writing Maestro flows

Selectors, assertions, scripting, scrolling, keyboard and timing on Maestro 2.0.9-ports as installed here.
App-specific screens: [app-screens.md](app-screens.md). Running/infra: [maestro-running.md](maestro-running.md).
Back to the [index](../agent-memory.md).

### Dump the hierarchy before writing selectors
**Rule:** before authoring or debugging a step, `grep -n testID <Component>.tsx` AND look at the real tree (`uiautomator dump` when no Maestro run is alive, or `maestro hierarchy`). Wrong or unreachable testIDs are the #1 reason flows fail. Check: is it `resource-id` or `content-desc`, does the text have leading/trailing spaces, is the node there at all, is it split over several Text nodes.
See [testID mapping](#how-testids-surface-resource-id-vs-content-desc) and [Paper component quirks](#react-native-paper-components-in-maestro).

### Text selectors are full-string regexes
**Rule:** a bare string / `text:` is compiled as a regex and must match the node's WHOLE text:
- Substrings never match (`'Front squat has no logged sets between'` fails) — use `'… between.*'`, `'.*Foo.*'`; for dynamic suffixes (`Playback: 00:00 / 00:47`) assert a prefix + `.*`.
- Leading/trailing whitespace counts: `<Text> {name}</Text>` renders `" Name"`; fixture names like `"Butterfly "` need `'Butterfly.*'` (anchored at start, so it doesn't hit `"Reverse butterfly "`).
- Metacharacters are live: `'Trainings per week (Mon–Sun)'` never matches — escape `\(` `\)` or use a prefix + `.*`. Check `( ) [ ] + * ? | { } $ ^ .`.
- A short pattern can match a longer label elsewhere: `'Train'` also matches the drawer heading `"Trainings:"`; `'Push'` matches the breadcrumb. Anchor (`'^Import$'`) or scope by id.
- `id:` is an UNANCHORED regex: `id: "plans-search-field"` also matched `plans-search-field-icon` (a disabled Button) of a Paper Searchbar. Anchor: `id: "^plans-search-field$"`.
(seen in GH-393, GH-403, GH-412, GH-413, GH-437, GH-458)

### How testIDs surface resource-id vs content-desc
**Rule:** `id:` matches only `resource-id`; a bare string matches text AND content-desc. Most RN views map `testID` → `resource-id`, but some nodes expose it as `content-desc` with an empty resource-id — notably the bottom tabs (`tab-training` etc. come from `tabBarAccessibilityLabel` in `app/routing/bottomNavigator.tsx`): use `tapOn: 'tab-training'`, never `{id: 'tab-training'}`. Conversely `tapOn: 'some-testID'` does not find a pure resource-id node — use `{id: …}`. An `accessible={true}` container (e.g. a ScrollView with `accessibilityLabel`) merges its whole subtree into ONE node — children become unassertable (see the comment in `TrainingsOverview.tsx`). Off-screen RN views are pruned from the tree until rendered/scrolled into view (an `IconButton`'s resource-id appeared only once fully on-screen). adb scripts must check both attributes, see [uiautomator dumps](device-interaction.md#uiautomator-dump-pitfalls).

### React Native Paper components in Maestro
- `Button`: testID on the touchable plus real ids `${testID}-container` and `${testID}-text` (label on `-text`): `assertVisible: {id: 'x', text: '^Finish Training$'}` works; a bare label `assertVisible: 'Select Hyperextension'` can fail — assert `{id}` and prove the effect after the tap.
- `Card.Title` swallows its testID (only text node); a plain `<Text testID>` in `Card.Content` gets a resource-id — hang value testIDs there. A `<Card testID>` wrapping a `<Pressable testID>` with identical bounds: assert the Card's id (the Pressable aggregates child text into content-desc and its id assertion fails).
- `Chip`: testID on the ripple, label on an unlabelled child Text → split `{id}` and bare-text assertions (the sharingan dropdown's own `chip` DOES carry the label as content-desc).
- `SegmentedButtons`: pass `testID` per item in `buttons: [{value, label, testID}]` (label gets `${testID}-label`); a11y state `{checked}`. `ToggleButton`: state `{selected}` → Maestro `selected: true`.
- `TextInput`/`Searchbar`: a family of ids (`-container`, `-icon`, `-clear-icon`…) and the floating label carries the SAME testID — anchor the id; `copyTextFrom` on a Paper TextInput returns `""` (reads the wrapper) — assert content with `assertVisible: {id, text}` or a unique value, never an emptiness check via `copyTextFrom`.
- `RadioButton` without `.Item`: the label is a decorative sibling `<Text>`; tapping it does nothing. Give radios testIDs and tap by id.
- `IconButton`: sometimes absent from the tree entirely (whole content area one node) → coordinates; see [app-screens](app-screens.md#training-detail-screen-what-maestro-and-uiautomator-can-see).
- `DataTable.Title` with explicit `accessibilityLabel` exposes the label, not the children — keep them in sync.
- `Menu.Item`: tapping right when `extendedWaitUntil` sees it is swallowed while the Portal animates — `waitForAnimationToEnd` before the tap and `extendedWaitUntil: notVisible: {id: <item>}` after. A tap on a DISABLED item dismisses the whole menu — prove non-selectability through the unchanged result.
- `HelperText visible={false}` only animates opacity — still in the tree; render it conditionally if a flow asserts it.
- `Snackbar` auto-dismiss outruns Maestro (~9 s between action and first poll) — use `duration={Number.POSITIVE_INFINITY}` + an action button for assertable UI. `react-native-toast-message` cuts `text2` to one line and may not be seen at all — keep lines short, screenshot right after the tap, assert the effect instead.
(seen in GH-299, GH-322, GH-391, GH-404, GH-405, GH-406, GH-412, GH-413, GH-417, GH-428, GH-437, GH-444, GH-458, GH-466)

### Assert actual values not visibility
**Rule:** `assertVisible: {id: 'my-testid', text: 'expected value'}` pins an exact value to an exact element; visibility alone proves nothing. Compute expected values from the fixture with the app's own traversal (see [fixtures](state-and-data.md#gains-fixture-quirks)) and pin them in the flow. Put displayed values in plain `<Text testID>` nodes so they are assertable; for charts expose the series via an `accessibilityLabel` (see [assertable charts](react-native-ui.md#make-a-chart-assertable-via-accessibilitylabel)).

### Scripted values evalScript and assertTrue on this build
**Rule (2.0.9-ports, verified matrix):**
- `- evalScript: |` BLOCK form does nothing: `output.*` set inside stays `undefined`, and a `throw` inside it does NOT fail the flow (reported COMPLETED, exit 0). Flows built on it can never fail.
- Use a single QUOTED interpolation per step: `- evalScript: "${var s = maestro.copiedText; output.elapsed = 90 - parseInt(s, 10)}"`. Inside it `maestro.copiedText` is live; afterwards `${output.x}` resolves in later steps and `${output.x == 'PASS'}` evaluates. Nesting `${…}` inside the expression fails silently in ~4 s; unquoted `${…}` fails YAML parsing.
- Inline comparison: `- assertTrue: "${maestro.copiedText === 'Total Sets: 1 (planned)'}"` — quote the WHOLE expression whenever it contains `: ` (otherwise `mapping values are not allowed here`). `${1 === 2}` fails, `${1 === 1}` passes. Strip separators when value and unit are sibling Texts: `.replace(/[\s,]/g, '')`.
- `${output.x}` inside SELECTORS rendered `undefined` in some runs — hardcode literals needed by selectors/`inputText` and pin them in a flow comment.
- Print a value: `- assertVisible: "v=${output.x}"` fails with the resolved value in the message — the only print on this CLI.
- Validate YAML before touching the device: `python3 -c "import yaml; list(yaml.safe_load_all(open('flow.yaml')))"`.
- An `evalScript` busy-wait does not delay anything; two screenshots around it were identical.
(seen in GH-63, GH-307, GH-393, GH-436, GH-443)

### Make every assertion able to fail
Vacuous passes seen in this repo — guard against each:
- A tap that does nothing + an assertion on a value that was already set (e.g. a theme already on Green). Assert the TRANSITION: also `assertNotVisible` the previous value.
- `assertNotVisible` passes while an overlay (drawer) hides the target; always pair it with a positive assertion on what should be there.
- Two `copyTextFrom` reads served from the same cached hierarchy compare equal regardless of state.
- `tapOn: point` defaults to retry-if-no-change: on a pane whose effect is invisible to the a11y tree it taps twice and toggles back → set `retryTapIfNoChange: false`.
- A planned/prefilled value satisfies the "logged value" assertion (see [Train rows are prefilled](app-screens.md#addworkout-set-rows-testids-and-prefilled-planned-values)).
- Existence-only unit tests are order-blind (see [order tests](unit-testing.md#prove-a-test-can-fail)).
**Negative control:** run the new flow once against the OLD code (git swap, see [before/after](evidence-and-process.md#beforeafter-evidence-for-js-only-changes)); it must fail with a readable message. Open flows with a precondition assertion pinning the starting state, so a stale state/fixture fails at step 1 instead of deep inside.
(seen in GH-355, GH-367, GH-401, GH-405, GH-428, GH-437, GH-443, GH-466)

### Waiting and app launch
- Start every flow with `- launchApp` (the implicit `appId:` launch often leaves the device on the launcher). `launchApp` force-stops by default — use `launchApp: {clearState: false, stopApp: false}` to resume without killing background work (a restart marks running video analyses FAILED via `RECOVER_STALE_VIDEO_ANALYSES`).
- `launchApp` restores the last tab/sub-screen; navigate explicitly to the target tab first.
- After a cold launch use `extendedWaitUntil: {visible: …, timeout: 60000}`, not bare `assertVisible` (launch returns before RN renders). Use ≥ 20 s for post-drawer navigation on a real device.
- Wait on a screen testID (`id: 'training-home-screen'`), not on a label like `'Training'` — inactive bottom tabs show no label, so literal tab-label waits break.
- Live/animating UI: add `waitToSettleTimeoutMs: 500` to taps while media plays (otherwise each tap waits 25–30 s); sample values at intervals and assert "changed", not an exact short-lived value.
- `repeat` has no `maxRuns` here — unroll retries or use `times:`; `repeat: {while: …}` works.
(seen in QA-MAESTRO-001, GH-130, GH-396, GH-415, GH-439)

### Scrolling in flows
- `scrollUntilVisible` stops the moment the target enters the viewport — at the EDGE. Anchor on the LAST element you need, or add `centerElement: true`; `waitForAnimationToEnd` after every scroll before tapping (a tap during the glide is swallowed).
- Results rendered ABOVE the current scroll position are "not visible" — `scrollUntilVisible` with `direction: UP` instead of waiting.
- Centered swipes are eaten by gesture children (video player, charts, swipers): use edge swipes, e.g. `- swipe: {start: '97%, 80%', end: '97%, 25%', duration: 1500}`, or a `repeat` of long swipes (`duration: 600`) below full-width charts; start scroll swipes below charts (`50%,92%`) — a drag across an MPAndroidChart re-selects a point.
- Swipes starting on a sticky header scroll nothing — start below it (`start: '97%, 45%'`).
- `scrollUntilVisible` toward a `react-native-modal` drawer taps outside it and closes it.
See [app-specific scroll quirks](app-screens.md#training-home-dashboard). (seen in GH-299, GH-307, GH-412, GH-413, GH-415, GH-428, GH-444, GH-468)

### Keyboard and text input in flows
- `hideKeyboard` is a BACK press: on a screen one BACK from the app root it can leave the app; inside the sharingan dropdown it closes the dropdown. Only use it when the next step needs the keyboard gone; check `mCurrentFocus` when a flow fails late.
- With the IME up the lower ~55 % is covered: a `tapOn` on a list row hits a key. With `adjustResize` the field itself can scroll out of the hierarchy — `inputText` → `hideKeyboard` → `waitForAnimationToEnd` → assert the field's text. `hideKeyboard` drops focus: re-tap before the next input.
- `tapOn` a TextInput's PLACEHOLDER text does not focus it; `inputText` is then silently dropped (every step COMPLETED). Tap by id.
- `eraseText` deletes backwards from the cursor (a mid-text tap leaves a tail: `claude-opus-551001`) and costs one key event per char (minutes on a live screen) — bound it (`eraseText: 4`) or clear via adb (`KEYCODE_MOVE_END` + N× `KEYCODE_DEL`), then assert the value.
- Per-character `inputText` walks through valid intermediate values (`#00F` is valid shorthand before `#00FF`) — assert the concrete final value.
- In dense forms the list scrolls between hierarchy snapshot and tap → typed text lands in the neighbouring field. Read back every typed field (`copyTextFrom` + `assertTrue`) before the next one.
- Masked date inputs (react-native-paper-dates) cannot be driven by `inputText` — see [masked dates](device-interaction.md#typing-text-with-adb).
(seen in GH-63, GH-293, GH-341, GH-403, GH-405, GH-412, GH-428, GH-468, AI-447-449)

### Small syntax gotchas
- `tapOn: point` takes integer percentages only (`"3.5%,6.5%"` → NumberFormatException).
- `pressKey:` knows only a few names (HOME, BACK, ENTER, BACKSPACE, VOLUME_*, POWER…); `Menu`/`82` are invalid — open the dev menu from a wrapper with `adb shell input keyevent 82`.
- A sub-flow's header `env:` default OVERRIDES the value the caller passes (`-e` or `runFlow: {env:}`) — no `env:` defaults in parametrised sub-flows; check `defineVariablesCommand` in `commands-*.json`.
- `setAirplaneMode: enabled/disabled` works — use it to prove network-failure, spinner and retry paths without real API calls.
- `copyTextFrom` works on plain RN `<Text>`; not on Paper TextInputs (see above).

### Suite and cross-branch flow hygiene
- A suite (`runFlow` of other flows) fails as a whole when any sub-flow fails; verify component flows standalone.
- Two branches' flows can contradict each other with zero merge conflicts (one asserts behaviour the other changed). After merging master, run the OTHER side's flows too and state in the flow header which expectation changed and why.
- Flows that only ever asserted visibility can carry wrong ids for years (e.g. enum KEY vs VALUE in `muscle-row-*`); copy ids from a dump when switching to value assertions.
- Before blaming your change, run the failing shared flow on unmodified master.
(seen in QA-MAESTRO-001, GH-401, GH-437, GH-444)
