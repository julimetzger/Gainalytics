# React Native & UI patterns

Layout, Paper components, navigation, hooks/effects, gestures, keyboard, charts, animation and render performance in this app.
Back to the [index](../agent-memory.md).

### Gesture handler needs the root import and GestureHandlerRootView
- `import 'react-native-gesture-handler';` must stay the FIRST import of `index.tsx` (after the InitializeCore polyfill), not in a lazy path — release builds otherwise crash when a drawer screen mounts first (debug hides it).
- Android ALSO needs `<GestureHandlerRootView style={{flex: 1}}>` around the app (`App.tsx`). Without it every pan/drag is silently dropped while `onLongPress` still fires — a draggable list "activates" but never reorders.
- `react-native-draggable-flatlist` inside a vertical ScrollView needs `NestableScrollContainer` + `NestableDraggableFlatList` (horizontal lists inside vertical scroll are fine).
(seen in GH-263)

### Fabric and reanimated wrappers can stop drawing laid-out content
**Symptom:** content exists in React/Yoga (correct `onLayout` y/height) but is never drawn — only the first section of a list visible.
**Seen causes (Fabric + reanimated 4):** a `NestableDraggableFlatList` nested in another renders only its first cell; a reanimated `Animated.View` with a `useAnimatedStyle` transform stopped all following siblings from drawing; an empty (`data=[]`) nestable list collapsed its section.
**Fix used in `PlanEditList`:** plain `.map()` + core-RN `Animated.Value` transform + `Gesture.Pan().runOnJS(true)` on the handle; freeze the outer scroll via the patched `useNestableScrollContainerContext().setOuterScrollEnabled`. Check master first (`git stash` is shared — use a clean checkout) before blaming your diff. (seen in GH-324)

### RangeSwiper layout rules
The 3-pane swiper (`app/components/RangeSwiper.tsx`) has been "fixed" many times; keep these constraints:
- In `fillViewport` mode (TrainingsPlanTab) the row must be `{flex: 1, width: dimensions.width * 3}` — with only `flex: 1` the visible pane sits OUTSIDE its parent's box: taps still work (RN's touch search descends) but Android clips touch dispatch so nothing scrolls, and uiautomator prunes the subtree.
- No outer vertical ScrollView in `fillViewport` mode; each pane's `NestableScrollContainer` gets `style={{flex: 1}}` and scrolls internally. A "measure the active pane's height" clamp deadlocks when the pane contains a same-direction ScrollView (it can only re-measure the clamp) — pick one scroll owner.
- Where a clamp is used, clamp only the OFF-screen panes (`height` + `overflow: hidden`); the active pane keeps natural height so growing content isn't clipped at a constant offset.
- Don't add `flexGrow: 1` to the row or `contentContainerStyle` to keep the swipe hit area full-screen — it recreates full-viewport dead space below short panes.
- Render panes in a FIXED DOM order and position them with `transform: [{translateX: (position + 1 − domIndex) · width}]`; reordering via `[-1,0,1].map(...)` makes Android detach/re-record each pane on every swipe (17–20 ms draw).
- Panes are REUSED across (micro, training) slots with new props, not remounted: boolean "fired once" refs must be slot-keyed (``const key = `${planId}:${micro}:${trainingInMicro}` ``, compared in the effect, slot ids in deps); test by re-rendering with new slot props without unmount.
(seen in GH-240, GH-324, GH-345, GH-382, GH-414, PERF-003)

### One-shot navigation params under swiper panes
**Problem:** `TrainingsPlanTab` hands `route.params.subTab` only to the ACTIVE pane. A "consumed" ref holding the last request key gets cleared when the prop disappears (swipe away) and the same request re-applies on swipe back; or a newly current pane sees an "unconsumed" request and jumps back to the opening tab.
**Fix:** remember consumed keys in a `useRef<Set<string>>`, treat the param as a one-off for the opening micro (dismiss it on the first swipe, keyed on the `route.params` object), carry the user's tab in screen state (`stickySubTab`). Test with `rerender` pairs (`requestedSubTab={undefined}` then `"train"`), and back every `assertNotVisible` with a positive assertion. (seen in GH-401, GH-467)

### Mounted screens do not re-run lazy useState initializers
Tab/drawer/native-stack screens stay mounted: `useState(() => fromProps)` sees only the first value.
- Re-sync from route params with `useEffect(() => { if (param !== undefined) setState([param]); }, [param])` (depend on the VALUE; undefined = keep the user's state).
- Persisted props that arrive late: a one-shot `useEffect` guarded by a `useRef`.
- External stores (API key in secureStorage): synchronous initializer + `useEffect` subscribing via `subscribeToApiKeyChanges(...)` returning the unsubscribe.
- Drawer screens are instantiated WITHOUT `route.params` (any drawer item) — destructure `route.params ?? ({} as Partial<…>)` and render a not-found fallback (`VideoAnalysisDetailTab`, `VideoAnalysisCompareTab`).
(seen in GH-130, GH-302, GH-363, GH-458)

### Effects and hooks pitfalls
- Never spread class instances into state (`{...prev, startDate}` loses the prototype; `instanceof` guards then skip) — use the constructor.
- No `.find()`/`.filter()` calls inside a deps array (new reference every render → loop); hoist to a const.
- `new Date(x ?? y).getTime() !== y.getTime()` is always false when `x` is null — check null explicitly. `??` does not fall through `0`: `saved ?? live` shows a stale `0` — put the source of truth first (`live ?? saved`).
- Read "current value at fire time" from a ref, not a state dep — a state dep re-fires the effect (it cancelled animations on every progress-driven duration change).
- Effects run in declaration order: a later "reset everything" effect zeroes values an earlier "init from data" effect set when deps change together — restore at the END of the later effect.
- Call hooks unconditionally; choose the result conditionally (tests should assert which result was used, not that a hook wasn't called).
- A guarded helper called inside a `setState(prev => …)` updater reads the render-time flag (stale) — compute `next` outside the updater, pass an explicit override. Flipping a default can promote such a dormant bug.
- An effect whose deps contain entity state the user's own action changes (creating the training flips `training.state undefined → PLANNED`) fires mid-interaction — e.g. it closed the exercise picker on the first pick. Reset UI chrome only on real slot changes (`[micro, trainingInMicro]`).
- A React `key` containing the row's VALUES remounts the row on every commit and drops the field typed meanwhile — key by identity, and skip the store echo of your own commit (`lastCommittedRef` + field compare).
- Exposing live callbacks to a parent via a setter prop: use the latest-ref pattern (`ref.current = fn` each render + a `useCallback(() => ref.current(), [])` stable wrapper) instead of chains of `useCallback`s.
- Derived state computed in an effect can be `null` when the user acts first — recompute inline in the handler as fallback.
(seen in GH-177, GH-188, GH-194, GH-382, GH-401, GH-406, GH-63)

### Driving an animated marker from a native time source
**Rule:** don't free-run `withTiming` and correct it with `cancelAnimation` on every player progress event — it ticks once per event (~1 s), stutters, or never converges. Use `useFrameCallback` anchored to the player: in `onPlayerProgress` (every ~50 ms on Android) store `anchorTimeMs = nativeMs` and `anchorRecvAtMs = <current frame timestamp>` in SharedValues; in the frame callback `marker = anchorTimeMs + (frameInfo.timestamp - anchorRecvAtMs) * speed`. No drift threshold, smooth between events.
**Details:** worklets cannot read React refs — paused/scrubbing/speed/duration must be SharedValues; write `frameInfo.timestamp` into a SharedValue so JS samples the same clock (no `Date.now()` in the worklet). If you must correct a running animation: compare `Math.abs(drift)`, target the CORRECTED duration, and compute the remaining time from the reference source (`total - nativeMs`), not from the animation. The jest reanimated mock lacks `useFrameCallback` (see [mocks](unit-testing.md#native-module-and-animation-mocks)).
(seen in GH-177, GH-285)

### Keyboard handling on Android
- A TextInput that MOUNTS in the same commit that should focus it must use the native `autoFocus` prop; `inputRef.current?.focus()` in an effect runs before the view has a window, so `showSoftInput` silently fails (focus ring, caret, but no keyboard). Verify with `dumpsys input_method` (`mShowRequested`/`mInputShown`).
- `KeyboardAvoidingView` on Android: `behavior="padding"`; `keyboardVerticalOffset={useHeaderHeight()}` inside drawer/stack screens with a header. KAV overrides its own `paddingBottom` to 0 without a keyboard — add `<View style={{height: insets.bottom}} />` as the last child instead. A Paper outlined `TextInput` alone in a row can collapse to ~45 px in a full-height scene → give the row a `minHeight` (73 dp measured).
- `DrawerNavigator` does not apply the bottom safe-area inset to screen content — screens with fixed-bottom elements apply `useSafeAreaInsets().bottom` themselves.
- Keyboard-aware scrolling inside a RangeSwiper pane (`app/components/common/KeyboardAwareScrollView.tsx`): the pane's ScrollView does NOT shrink with `adjustResize` → visible window = `min(scrollHeight, keyboardTop - scrollY)` with `keyboardTop` from `keyboardDidShow`'s `endCoordinates.screenY`; derive the real offset from `measureInWindow` + `measureLayout` against `scrollView.getInnerViewRef()` (tracked `onScroll` offsets are stale mid-animation); size the gap to the ROW (48 dp), not the input; focus changes with the keyboard open fire no event — poll `TextInput.State.currentlyFocusedInput()` from `onTouchStart` (~120 ms for ≤ 1 s); re-check a `measurementIsStale()` predicate in EVERY native measurement callback. API ≤ 29 gets `keyboardDidShow` via `adjustResize` (`ReactRootView.checkForKeyboardEventsLegacy`).
(seen in GH-168, GH-358, GH-428)

### Non-edge-to-edge Android double-counts the status bar inset
**Problem:** on Android ≤ 14 (not edge-to-edge) every `createNativeStackNavigator` screen was exactly the status-bar height (28 dp) short at the bottom — a band above Paper's tab bar; drawer screens were fine.
**Fix in place:** `edgeToEdgeEnabled=true` in `android/gradle.properties`. API 35+ emulators are always edge-to-edge and cannot reproduce such inset bugs — use the phone (Android 13). Measure with uiautomator bounds (see [layout facts](device-interaction.md#layout-facts-from-dumpsys-and-bounds)). (seen in GH-356)

### Flex layout traps
- A `FlatList` in a `flex:1` container (e.g. inside KAV) needs `style={{flex: 1}}` AND `flexShrink: 0` on every non-scrolling sibling, or the siblings collapse to 0 height.
- Header rows with a long title and trailing icons: left container `flex: 1, flexShrink: 1, minWidth: 0`, title `numberOfLines={1} ellipsizeMode="tail"`, right container `flexShrink: 0` (`minWidth: 0` is the crucial part).
- A `flex: 1` view a few levels inside a shrink-to-fit (auto-height) wrapper resolves to 0 height in Yoga; the content still paints and overlaps the next sibling. Seen with sharingan's dropdown wrapping itself in its own `PaperProvider` (→ `SafeAreaProviderCompat` `flex:1`); patched to use `ThemeProvider`. Diagnose with a debug `backgroundColor` or an on-screen height badge.
- `TrainingElementPicker`: hidden via `display: 'none'`, which doesn't collapse height on every API level → wrap in `<View style={{height: 0, overflow: 'hidden'}}>` from the parent; its toggle `IconButton` is absolutely positioned (`right: 0, zIndex: 2`) and can overlap the list below.
- `react-native-calendars` custom `dayComponent`: use `alignSelf: 'stretch'` (not a fixed width) and `left/right: '50%'` for range halves so fills span the column gaps.
- A ScrollView whose content holds a single ~10 000-char `<Text>` stops scrolling at the end of that Text — cap rendered text per node (`slice(0, 4000)` + "… (+N more characters)").
(seen in GH-302, GH-375, GH-391)

### React Native Paper patterns
- Tall dialogs: `Dialog.Content` never scrolls and the surface has no `maxHeight` — set `style={{maxHeight: windowHeight - 88}}` on `<Dialog>`, wrap content in `<Dialog.ScrollArea>` (`paddingHorizontal: 0`, padding on the inner ScrollView's `contentContainerStyle`), keep `Dialog.Actions` outside. Check landscape (orientation changes are enabled).
- A `Menu` inside a gesture-handler root may not be reachable by automation — render menu content in a `Portal`.
- `SegmentedButtons` cannot take `onLongPress` (fixed prop list); `ToggleButton.Row` + `ToggleButton` forwards `...rest` (so `onLongPress`, `testID` arrive). Pressing the selected `ToggleButton` calls `onValueChange(null)` — guard it. `ToggleButton.Row` only styles direct `ToggleButton` children (no `Tooltip` wrappers). Its published Props omit forwarded props: spread them from a variable (`const lp = {onLongPress}; <ToggleButton … {...lp} />`) instead of casting. Child `style` is applied after the row's first/middle/last styles → per-button radii/background give an M3 pill; `icon` accepts a render function.
- `DataTable.Row`: pass `{borderBottomWidth: 0}` via `style` to suppress the separator (style is applied last).
- Text over `react-native-svg`: use a Paper `<Text>` in an `absoluteFillObject` overlay with centring, not SVG `<Text>`.
- Converting "open a modal to configure" into an inline form section: restructure the parent first (section label + hint instead of the trigger button), then inline the editor.
- `AGENTS.md` mandates Paper components — if a Paper component "breaks the tests", fix the mock (see [unit-testing](unit-testing.md#paper-mocks)) rather than hand-rolling a control.
(seen in GH-235, GH-246, GH-300, GH-404, GH-405, GH-417, GH-462)

### React 19 ignores defaultProps on function components
Third-party components that rely on `Component.defaultProps = …` silently lose every default (sharingan's `searchPlaceholder`, `elevation`, `emptySelectionText` were `undefined`). Only destructuring defaults survive. Check `grep -n defaultProps node_modules/<lib>/lib/module/**/*.js` and convert what you need in the patch. (seen in GH-401)

### Colours and themes
- Never build colours by string concatenation (`theme.colors.primary + '33'` breaks under `rgb()` themes and crashes) — use an alpha-safe helper (`withAlpha`).
- Import `processColor` from `react-native` (Paper's re-export crashes at runtime).
- Light-mode illegibility comes from `*Container` tokens used as FOREGROUND/fill against `surface` (`#D6E3FF` on `#F9F9FF` ≈ 1.1:1); find them with `grep -rnE "(color|iconColor|textColor|valueTextColor)=?\{?[^}]*colors\.(primary|secondary|tertiary)Container"` and switch to the non-container token or `withAlpha(primary, 0.7)`. Flat `opacity: 0.5` on labels is the same bug class.
- The purple palette's scheme is nested one level deeper and renders Paper MD3 defaults (secondary `#625B71`) — read expected colours from `buildThemes()`.
(seen in GH-404, GH-437)

### Charts with react-native-charts-wrapper
- `viewPortOffsets` are physical pixels: `Math.round(VALUE_DP * PixelRatio.get())`; keep JS overlays in dp.
- Per-bar colours: `colors: data.map((_, i) => processColor(i === last ? primary : container))` on the BarDataSet.
- Integer count series: `mode: 'LINEAR'` + `yAxis: {granularity: 1, granularityEnabled: true, axisMinimum: 0}` — bezier overshoots below 0. Keep bezier for continuous measures.
- ms-time x-axis labels: `valueFormatter: 'date', valueFormatterPattern: 'mm:ss'` (epoch-ms formatter; wrong in fractional-hour time zones).
- `chartTranslated` reports UNCLAMPED left/right during fling deceleration — clamp the window into `[axisMin, axisMax]` before mapping taps/markers.
- Helper datasets (trend lines) need `highlightEnabled: false`, or taps select the trend point (no `id`).
- A trajectory (bar path) is not a function of x — LineChart sorts by x and draws garbage. Use `react-native-svg` `Polyline`, normalised to ROM space.
- `react-native-svg` pickers: keep geometry in a fixed `viewBox` and scale touch coordinates by `viewBoxSize / renderedSize`; test with a mocked short `Dimensions.get`.
(seen in GH-204, GH-285, GH-351, GH-363, GH-405, GH-413, GH-468)

### Make a chart assertable via accessibilityLabel
Wrap the `<Svg>`/chart in `<View testID="exercise-row-sparkline-2" accessible accessibilityLabel={`Trend ${values.join(', ')}`}>` so `assertVisible: {id: …, text: 'Trend 210, 205, …'}` checks the plotted series. Compute expectations with the app's formula; watch .5 rounding (Python `round` ≠ JS `toFixed`). (seen in GH-477)

### Lists FlashList and draggable lists
- Variable-height grouped cards in a FlashList: flatten into typed rows (`{type: 'header'}`, `{type: 'workout'}`) with `getItemType`, let the FlashList scroll itself, page with `onEndReached`. Wrapping it in a ScrollView with `scrollEnabled={false}` defeats virtualization (rejected in review).
- FlashList v1 rows only re-render on `data`/`extraData` changes — clock/progress-driven rows need `extraData={now}`. A jest mock that maps items on every render hides this; mock a cell with `shouldComponentUpdate` honouring only `data`/`extraData`.
(seen in GH-277, GH-343)

### Stop off-screen screens from re-rendering
- Mounted-but-invisible native-stack screens keep re-rendering on every dispatch; `React.memo` doesn't help (their own and their children's `useSelector`s run). Split into shell + content and wrap the content in `react-freeze`'s `<Freeze freeze={!useIsFocused()}>` (state and scroll survive; measured 9 re-renders → 0).
- Drawer navigators: `freezeOnBlur: true` in `screenOptions` applies the same to every drawer screen (works without `enableFreeze()`), as in `AnalyseRouter`.
(seen in GH-284, GH-313)

### Responsiveness techniques
- Toggle bars: `useOptimistic` inside a transition in a component that holds ONLY the control (`app/utils/useInstantSelection.ts`) shows the tapped state in ~40 ms while the screen update follows as a transition.
- Big subtrees: stage the mount (`app/components/common/ProgressiveMount.tsx`: a stage counter every 16 ms, `<Stage at={n}>`, `useProgressiveLimit`) — longest frame 50–60 → 30 ms, at the cost of more total JS; report both.
- Measure "busy per swipe" as total JS-thread time until the next gesture, not just a burst chain — deferring work can lower the chain metric while total work rises. "Visible" = first `mountViews` batch ≥ 0.45 ms after finger-up (Perfetto).
- Custom sliders with the responder system: set BOTH `onStartShouldSetResponder` and `onMoveShouldSetResponder`; grant AND move fire on a tap → make the handler a no-op when the value is unchanged; `accessibilityRole="adjustable"` + `accessibilityValue` + `accessibilityActions` (increment/decrement) is enough for TalkBack.
(seen in GH-246, PERF-003)

### TypeScript and JSX small traps
- Mixed text in JSX (`{x.toFixed(1)} kg`) creates array children; use a template literal for a single string child (tests comparing `props.children` need it).
- The Exercise model exports an enum named `Record` — in files importing it, use an index signature instead of TS `Record<K, V>`.
- "Same component in another view": add a `view` prop to the shared component and a thin selector branch (as `MuscleInvolvementCard`/`useMuscleInvolvement` do for plan vs done data) instead of a sibling copy; cross-folder imports (analyse → plan) are fine.
- A menu item with a `() => {}` handler ships a tappable dead control — remove it or wire a minimal real action.
(seen in GH-204, GH-329)
