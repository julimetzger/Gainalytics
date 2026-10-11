# Real device (test phone)

The physical phone (a Samsung Galaxy S20+, SM-G986B, Android 13) is a dedicated TEST device, not the user's personal phone (confirmed by the user 2026-10-11; older entries and run logs that call it "the user's phone" are wrong). Its store holds realistic training data. Its serial appears in older notes — still only ever use your assigned `$ANDROID_SERIAL`.
Back to the [index](../agent-memory.md).

### It is a test device: experimenting is allowed
- Imports (`baseline.gains` or fixtures), `clearState`/`pm clear`, starting/finishing/deleting trainings and logging sets are all fine here. A STARTED training (notifications) may be tested on the phone too.
- Its existing store is realistic data and useful for evidence that needs real-looking history; if your ticket benefits from it, back it up first (`run-as … cat` of the MMKV files, see [reading the store](state-and-data.md#reading-the-persisted-store-on-device)) — optional, not required.
- Still route every Maestro run through your own adb filter proxy — not to protect the phone, but because a misrouted run lands on a SIBLING's device (see [wrong device](maestro-running.md#maestro-drives-the-wrong-device-on-a-multi-device-adb-server)). `run-maestro-from-wsl.sh --mode smoke` runs the full suite; for a short smoke use `--suite __tests__/e2e/maestro/flows/99_smoke.yaml`.
- The read-only "Edit training" view of the last finished training is still a quick way to get execute-view evidence without logging (see [opening a training](app-screens.md#opening-a-specific-training)).
- Evidence for "old data still works" must be produced on the old build before any code change (see [legacy data](evidence-and-process.md#legacy-data-and-migration-evidence)).
(seen in GH-356, GH-401, GH-467, GH-468; test-device status confirmed 2026-10-11)

### Check for a PIN-locked phone at the start of every run
- `adb shell dumpsys window | grep -i mCurrentFocus` → `Window{… Bouncer}` = PIN-locked (locale-independent; the German UI text varies: "PIN eingeben", "Gerät gesperrt"). `wm dismiss-keyguard` does not help. `adb get-state` still says `device`, pushes work, Maestro fails at the first assertion and its screenshots are black.
- `am start` then reports `intent has been delivered to currently running top-most instance` and screencap returns the near-black AOD (< 25 KB).
- Before writing `blocked`, poll `mCurrentFocus` every ~15 s for a bounded window (two 9-min loops) while doing useful prep (flows, unit tests, commits) — the user may unlock. `NotificationShade` can be shade or locked; only app/launcher focus means usable. Never guess a PIN or tap the bouncer.
(seen in GH-152, GH-293, GH-355)

### Guard every scripted tap with a foreground check
- System UI pops up on its own: Samsung's update agent (`com.wssyncmldm` `InstallConfirmActivity`), Google's "Are you trying to sign in?" (`com.google.android.gms/…OctarineActivity`), the file picker (`com.google.android.documentsui`), even other apps (weather, Chrome) after a stray BACK. A blind tap could confirm an OS update or a sign-in.
- Before each tap batch: `f=$(adb -s $S shell dumpsys window | grep -i mCurrentFocus); case "$f" in *powerliftingworkoutplanner*) : ;; *) echo ABORT; exit 1;; esac`.
- Never answer system dialogs. Return with `adb shell am start -n com.powerliftingworkoutplanner/.MainActivity` (the "brought to the front" warning is success); `am force-stop com.wssyncmldm` before runs; `am force-stop com.google.android.documentsui` dismisses a stuck picker (BACK didn't). Mention unanswered prompts in `summary.md`.
- A Maestro failure on the phone that does not reproduce by hand: check `mCurrentFocus` before believing the assertion.
(seen in GH-358, GH-356, GH-428, GH-436)

### Display size override and orientation
- `wm size`: Physical 1440x3200, Override 720x1600 — `input tap/swipe` and `uiautomator` bounds use the 720x1600 override. Screencaps have been reported both at physical and at override resolution — always read the PNG size and scale to the override (from an 800-wide resize ×0.9; from 600-wide ×1.2).
- Active display mode is `mActiveModeId=9` = 720x1600 @ 60 Hz (not 120 Hz): worklets tick every ~16.7 ms; `screenrecord` averages ~55 fps.
- Auto-rotate is on: a phone lying sideways renders landscape 1600x720 and every portrait coordinate misses ("element never appeared"). Check the screencap dimensions first; force portrait with `settings put system accelerometer_rotation 0` + `user_rotation 0`, and RESTORE `accelerometer_rotation 1` afterwards (user setting).
(seen in GH-177, GH-312, GH-323, GH-378, GH-405)

### Samsung restrictions
- `run-as <pkg>` can READ app-private files but WRITES are SELinux/Knox-blocked (even inside the app dir); run-as cwd is `/`, use absolute paths. To re-run native rep detection on stored data, bump the detection version and just open the analysis (the app migrates on load) instead of editing files.
- `sendevent` is blocked (use the injector in [long press and drag](device-interaction.md#long-press-and-drag-with-motionevent)).
- `logcat -s ReactNativeJS` shows nothing (see [JS console](metro-and-bundling.md#reading-js-console-output)).
- The numeric keypad has a real OK key that fires `onSubmitEditing` (`returnKeyType="done"` labels it).
- The Photo Picker selects by `Video vom … mit einer Dauer von MM:SS` and confirms with `Fertig` (see [video screens](app-screens.md#video-analysis-screens)).
(seen in GH-312, GH-313, GH-343, GH-351, GH-358)
