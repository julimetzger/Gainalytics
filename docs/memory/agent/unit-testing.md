# Unit testing (jest, RNTL)

`jest.setup.js` global mocks, Redux in tests, Paper mocks, native-module mocks, timers, and making tests meaningful.
Back to the [index](../agent-memory.md).

### Running jest in a worktree
`jest.config.cjs` currently ignores only `/node_modules/` and `/__tests__/coverage/` — run `npx jest <path>` directly inside the worktree. If "No tests found"/`0 matches` returns, check whether a `/.worktrees/` pattern was re-added: every path inside a worktree contains it. The safe form is `'<rootDir>/.worktrees/'` (excludes sibling worktrees from the main checkout, excludes nothing inside a worktree); jest CLI array flags REPLACE the config list (`--testPathIgnorePatterns=/node_modules/`). On Node 24 a trailing `TypeError: (0 , _exit(...).default) is not a function` / exit 1 after a green run is a jest-cli incompatibility — read the `Tests:` line. (seen in GH-302, GH-329)

### jest.setup.js stubs react-redux globally
`jest.setup.js` mocks `react-redux` for ALL suites: `useSelector: jest.fn(() => [])`, `useDispatch: jest.fn(() => jest.fn())`. Consequences:
- A spec that renders a real `<Provider store={configureStore({reducer: rootReducer})}>` still gets `[]` from every selector (symptoms point elsewhere: `stored.trim is not a function`, `Invalid time value`, `Cannot read properties of undefined (reading 'find')`). Opt back in at the top: `jest.mock('react-redux', () => jest.requireActual('react-redux'));` (as `AddWorkout.rendering.spec.tsx`, `CollapsibleSection.spec.tsx` do).
- Adding a store-reading hook to a screen breaks OTHER specs rendering that screen: a hook typed `Date | undefined` returns a truthy `[]` (`getTime is not a function`). Mock the hook module in those specs; don't make production code defend against array-shaped values.
- Specs with hand-crafted `mockUseSelector.mockImplementation(state => …)` crash with `Cannot read properties of undefined (reading 'plan')` when a component gains a selector on a new top-level key — add the key (e.g. `settings: {mode: 'dark'}`) to every hand-crafted state, mock newly imported child components that select differently, and mock navigation hooks (`useSafeAreaInsets`, `useHeaderHeight`) the redux mock doesn't cover. A minimal mock store must seed every slice the component transitively reads.
(seen in GH-188, GH-192, GH-316, GH-391, GH-458, AI-447-449)

### Seed a real store via preloadedState
Don't seed with the app's add-actions: RTK's immutability middleware throws `A state mutation was detected inside a dispatch` (legacy reducers mutate) and reducers assign their own ids. Build it: `const initial = configureStore({reducer: rootReducer}).getState(); configureStore({reducer: rootReducer, preloadedState: {...initial, workouts: {...initial.workouts, byId: {[ID]: {…}}, allIds: [ID]}}})`. (seen in GH-316)

### Prefer a real-store test over flaky device taps
When on-device taps repeatedly "fail" to reproduce an interaction the code clearly implements (toggle/expand/persisted state), write an RTL test with a real store (`requireActual` + `createStore(rootReducer)`) and `fireEvent.press` on the testIDs — it proves reducer → dispatch → hook → render in seconds. Before concluding there is a bug, also confirm the device ran the new bundle (see [prove which JS runs](metro-and-bundling.md#prove-which-js-the-device-runs-before-debugging-the-fix)). (seen in GH-367)

### Paper mocks
- When a screen gains a Paper component (`Chip`, `IconButton`, `SegmentedButtons`…), specs that mock `react-native-paper` with a few components crash with "Element type is invalid" — add it to the mock. Shared stub for wholesale-mocking specs: `__tests__/helpers/paperMocks.tsx`.
- A `TextInput` mock rendering `<View testID>` makes `fireEvent.changeText` a silent no-op — render an inner `require('react-native').TextInput` with `testID`, `value`, `onChangeText` (no testID on the wrapper).
- Mirror real testID shapes in mocks (`${testID}-text` for Button, `Divider: ({testID}) => <View testID={testID ?? 'row-divider'} />`) so spec and device agree.
- A spec that mocks a library away cannot see that library's bugs (sharingan: duplicated options, lodash `remove` mutating the caller's array, lost `defaultProps`). Add a spec that renders the REAL component (already in `transformIgnorePatterns`): wrap in `PaperProvider`, pass `hideChip`, use `getAllByText(...)[0]` for the doubled anchor label.
(seen in GH-159, GH-235, GH-401, GH-417, GH-437)

### jest.mock factory scoping
`jest.mock()` is hoisted above imports: its factory may only reference variables whose name STARTS with `mock` (`mockUseExerciseFn` ok, `useExerciseMock` → "not allowed to reference any out-of-scope variables"). Use literals for imported constants inside factories. (seen in GH-159, GH-246)

### Native module and animation mocks
- Native modules without jest support (`@notifee/react-native`, `react-native-keychain`, `react-native-mmkv`, …) break every suite that imports them transitively — one global `jest.mock` in `jest.setup.js` fixes all.
- Reanimated 4: `jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'))` BEFORE the reanimated mock. The reanimated mock lacks `useFrameCallback` — `jest.setup.js` extends it with `jest.fn().mockReturnValue({setActive: () => {}, isActive: false, callbackId: 0})`.
- The mocked `useSharedValue` returns a fresh `{value}` per call (production is stable): `const sv = useRef(useSharedValue(0)).current;` and never put SharedValues in dependency arrays.
- `react-native/Libraries/Animated/NativeAnimatedHelper` no longer exists (RN ≥ 0.76) — don't mock it.
- A tab-level render (e.g. `AIChatTab`) also needs `useNavigation`, `@react-navigation/elements`' `useHeaderHeight`, `react-native-markdown-display` and a `DateRangePicker` stub (react-native-paper-dates doesn't mount under the test renderer).
- `UNSAFE_getAllByType(Pressable)` throws `No instances found` under the RN preset — use `root.findAll(n => typeof n.props?.testID === 'string')` and dedupe (testIDs appear on composite and host nodes).
(seen in GH-139, GH-177, GH-355, GH-391)

### Time and timers in tests
- Plain `jest.useFakeTimers()` deadlocks RNTL's cleanup (`Exceeded timeout of 5000 ms for a hook`). Fake only the clock: `jest.useFakeTimers({doNotFake: ['setTimeout','clearTimeout','setInterval','clearInterval','setImmediate','clearImmediate','nextTick','queueMicrotask','requestAnimationFrame','cancelAnimationFrame','requestIdleCallback','cancelIdleCallback','performance','hrtime']})` + `jest.setSystemTime(...)`; `jest.useRealTimers()` in `afterAll`.
- `new Date('2024-01-08T12:00:00')` is LOCAL time but `toISOString()` is UTC — in Europe/Berlin the date shifts. Build dates with `new Date(y, m, d, h)` and assert with `getFullYear/getMonth/getDate`.
- JS `setMonth(getMonth() - n)` rolls invalid days forward (31 Aug − 6 months → 3 Mar) — compute real range boundaries before choosing edge-case evidence.
- React 19 first renders with `waitFor` can exceed 5 s — give flaky tests a `15000` timeout.
- Async native measurement chains: test with an input whose callbacks are queued and released by the test (synchronous fakes can't express the gap).
(seen in GH-413, GH-428)

### Prove a test can fail
- Existence-only assertions (`getByTestId`, `getByText`) pass identically before and after a reorder. For order, assert the sequence (`getAllByText(/^(Plan|Train|Analysis)$/).map(n => n.props.children)`).
- Run every new regression test once against the OLD code and watch it fail (also for e2e — see [vacuous passes](maestro-flows.md#make-every-assertion-able-to-fail)).
- Theme-driven colours: render with `MD3LightTheme` AND `MD3DarkTheme`, assert each against its token and that they differ; read with `StyleSheet.flatten(node.props.style).color`. Pair with a structural assertion only the real library emits (Paper `${testID}-label`).
- Side effects: for "X must not happen in mode Y" assert the dispatch/mock was never called, not only that a testID is absent.
(seen in GH-323, GH-355, GH-417)

### Pre-existing failures
Failures in files you didn't touch: `git diff HEAD origin/master -- <file>` — no diff means pre-existing; say so in the PR. But re-run inherited "known failures" instead of copying the caveat forward — master may have fixed them (a long-repeated `SettingsTab.spec.tsx` note was dead). (seen in GH-263, GH-428)

### Testing helpers without extra packages
- `@testing-library/react-hooks` is not installed: test a hook through a small `Wrapper` component that stores the result in a `useRef` (`.tsx` file).
- Run repo TypeScript in plain Node (no ts-node/@babel/register): `require.extensions['.ts'] = (m, f) => m._compile(require('@babel/core').transformFileSync(f, {filename: f, babelrc: false, configFile: false, presets: [['@babel/preset-env', {targets: {node: 'current'}}], '@babel/preset-typescript']}).code, f);` — only for modules without RN imports.
(seen in GH-405)
