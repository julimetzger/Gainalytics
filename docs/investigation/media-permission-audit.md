# Media Permission Audit (GH-421)

> **Status: diagnostic only.** This document changes no app behaviour. It answers one
> question raised by the Google Play Console notice *"Richtlinie für Berechtigungen für
> Fotos und Videos: Alternative Systemauswahlen für die Fotos/Videos verwenden"*:
> **does Gainalytics actually need `READ_MEDIA_VIDEO` / `READ_MEDIA_IMAGES`, or is the
> system picker sufficient?**

## 1. Method

| Item | Value |
|---|---|
| Device | Samsung SM-G986B (Galaxy S20+), serial `R5CN30HWZFN` — physical device, not an emulator |
| Android version | 13 (API 33) — the first version the Play policy applies to |
| App `targetSdkVersion` | 36 · `minSdkVersion` 24 (`android/build.gradle`) |
| Build under test | `versionCode 7`, `versionName 0.172` |
| Commit | `8100a3fa247b563b434c322db3ba76a6783795c0` (branch `feature/GH-421`, fresh off `origin/master`) |
| Build variant | `assembleDebug`, installed with `adb install -r` (JS served by Metro) |
| Permission toggling | `adb shell pm revoke/grant com.powerliftingworkoutplanner android.permission.READ_MEDIA_VIDEO` |

Evidence screenshots referenced below live in `screenshots/GH-421/` on this branch.

## 2. What the manifest actually declares

`android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
```

- **`READ_MEDIA_VIDEO` is declared.** This is the permission the Play notice is about.
- **`READ_MEDIA_IMAGES` is _not_ declared** — anywhere in the repo. The app has no image
  or camera picker at all; every "image" in the UI is a vector icon
  (`react-native-paper` / `react-native-vector-icons`). Nothing to remove here.
- `READ_EXTERNAL_STORAGE` is capped at `maxSdkVersion="32"`, so it is not requested on
  Android 13+ and is outside the scope of the Play notice.

### 2.1 Why the permission is in the manifest (and why that reason is gone)

`git log` gives a complete provenance chain:

| Commit | Date | What happened |
|---|---|---|
| `d469edef` | 2026-03-02 | `feat(video-analysis): add emulator import path and maestro coverage` — **added** `READ_MEDIA_VIDEO` together with a dev-only *"Import Emulator Squat Video"* button that read a hard-coded `/sdcard/...` path and therefore called `requestVideoReadPermission()`. |
| `49b5d169` | 2026-04-09 | `fix(GH-71): remove Import Emulator Squat Video button from VideoSelectionModal` — **removed the button** (and its sibling in `VideoAnalysisTab`), deleting both `requestVideoReadPermission()` call sites. |

The permission declaration was never cleaned up afterwards.

### 2.2 The permission is never requested at runtime

`app/utils/video-analysis-import.ts:237` still exports the helper:

```ts
export const requestVideoReadPermission = async () => { ... PermissionsAndroid.request(permission) ... }
```

A repo-wide search for `requestVideoReadPermission` (excluding `node_modules` and build
output) returns **exactly one hit — its own definition**. It is dead code. No screen, hook,
saga or native module calls `PermissionsAndroid.request` for a media permission. In other
words the app already never shows a media-permission prompt to the user; the permission is
only ever granted silently via the system settings page or by an install-time grant, and
nothing in the app depends on the result.

## 3. Complete inventory of media flows

Every place the user picks a video, and every place the app reads it back later.

| # | Flow | Entry point | Underlying media access |
|---|---|---|---|
| F1 | Import a video on **Analyse → Video Analyses** | `VideoAnalysisTab.tsx` → `pickVideoFromGallery()` | `ACTION_OPEN_DOCUMENT` + `takePersistableUriPermission` |
| F2 | Import a video while **linking it to a training set** | `VideoSelectionModal.tsx` → `pickVideoFromGallery()` | same as F1 |
| F3 | **Preflight / seed detection + background analysis** | `prepareSquatVideoSeed`, `analyzeSquatVideo`, `getVideoDuration` | `ContentResolver.openAssetFileDescriptor` / `MediaMetadataRetriever.setDataSource(ctx, uri)` on the `content://` URI |
| F4 | **Playback** in the detail view, overlay card and compare view | `VideoAnalysisPlayerView.java` (Media3/ExoPlayer) | `MediaItem.fromUri(content://…)` via `ContentResolver` |
| F5 | **Playback after a full app restart** | same as F4, URI restored from Redux | the *persisted* URI grant taken in F1/F2 |
| F6 | **"Secure video" / full import** (copy into app storage) | `copyVideoToAppStorage` | `ContentResolver.openInputStream` |
| F7 | **Delete an analysis** → hand the grant back | `releaseVideoUriPermission` | `releasePersistableUriPermission` |
| F8 | `.gains` backup **import** | `SettingsTab.tsx`, `AddTrainingsPlan.tsx` → `react-native-document-picker` | `ACTION_GET_CONTENT` — a document, not a media file |
| F9 | `.gains` backup **export** | `SettingsTab.tsx` → `react-native-fs` `DownloadDirectoryPath` | file write, unrelated to read-media permissions |

**Key architectural point:** since GH-321 the app does *not* copy the picked video into app
storage. It keeps the gallery `content://` URI and reads it directly — but it obtains that
URI from `ACTION_OPEN_DOCUMENT`, the Storage Access Framework picker, and immediately calls
`takePersistableUriPermission`.

`android/app/src/main/java/com/powerliftingworkoutplanner/VideoAnalysisModule.java:141`:

```java
Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
intent.addCategory(Intent.CATEGORY_OPENABLE);
intent.setType("video/*");
intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
```

A SAF grant is **per-URI and independent of `READ_MEDIA_VIDEO`**: the system grants the app
read access to exactly the one file the user chose, and `takePersistableUriPermission`
makes that grant survive process death and reboot. This is precisely the "Systemauswahl"
Google's notice asks for — the app is already compliant in its implementation, and only the
stale manifest entry makes it look otherwise.

## 4. What was changed

Removal only — no picker, playback or analysis logic was touched.

| File | Change |
|---|---|
| `android/app/src/main/AndroidManifest.xml` | `<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />` deleted, replaced by a comment stating why no media permission may be re-added. |
| `app/utils/video-analysis-import.ts` | `requestVideoReadPermission()` deleted (dead since GH-71); the now-unused `import {PermissionsAndroid, Platform} from 'react-native'` deleted with it; `EMULATOR_SQUAT_VIDEO_PATH` deleted — the sibling leftover of the same removed dev button, likewise with only its own definition as a repo-wide hit, and the only remaining hard-coded `/sdcard/` media path in the app. |

After the change `grep -rn "READ_MEDIA" android/app/src/` matches nothing but the explanatory
comment, and `PermissionsAndroid` no longer appears anywhere in `app/`.

## 5. Device verification (R5CN30HWZFN, Android 13 / API 33)

All runs on the physical Galaxy S20+, not an emulator. Screenshots referenced by their
file name live in `screenshots/GH-421/`.

### 5.1 Pre-check: revoking the permission on the OLD build changes nothing

Before rebuilding anything, the hypothesis was tested destructively on the still-installed
pre-fix build (`versionCode 7`, permission *declared*):

```
pm revoke com.powerliftingworkoutplanner android.permission.READ_MEDIA_VIDEO
pm revoke com.powerliftingworkoutplanner android.permission.READ_EXTERNAL_STORAGE
→ READ_MEDIA_VIDEO: granted=false
```

After a cold restart the Video Analyses list rendered with thumbnails intact and the
analysis imported minutes earlier still played, frame and bar-path overlay identical,
same velocity readout `-0.374 m/s` (`08_revoked_playback.png`). This isolates the variable:
the app's video access does not read the permission, it reads the persisted SAF grant.
Log: `checks/revoke-experiment.log`.

### 5.2 The built artifact carries no media permission

`aapt dump permissions` on `app-debug.apk` built from this branch
(sha256 `84a35521db09…`) lists 18 `uses-permission` entries; none of them is
`READ_MEDIA_VIDEO`, `READ_MEDIA_IMAGES` or `READ_MEDIA_VISUAL_USER_SELECTED`.
The same holds for the merged manifest read back with `aapt2 dump xmltree`, and for the
package as the platform sees it after installation (`dumpsys package … requested permissions`).
Log: `checks/apk-manifest-permissions.log`, `checks/install-update-and-permissions.log`.

### 5.3 Existing data survives an UPDATE, not a reinstall

The new build was installed with `adb install -r` over the old one. `firstInstallTime`
stayed `2026-07-13 12:01:35` while `lastUpdateTime` moved, which is the proof that this was
an in-place update and the app's storage was never cleared.

The decisive record: an analysis imported through the system picker **on the pre-fix build**
at `31.8.2026, 13:54:07` (source `content://com.android.providers.downloads.documents/document/msf%3A1000013407`).

| | Before the fix | After the update |
|---|---|---|
| Screenshot | `06_prefix_playback.png` | `10_postfix_legacy_video_plays.png` |
| Rendered | video frame + bar-path overlay | identical |
| Velocity readout | `-0.374 m/s` | `-0.374 m/s` |

It still plays after a **cold restart** of the updated build as well
(`17_postfix_restart_legacy_plays.png`), which is the case that actually exercises the
persisted URI grant rather than a live in-process one.

A second, older record on the device carries a raw `file:///sdcard/Download/squat-3reps.mp4`
source — a leftover of the very dev-import path that introduced the permission
(§2.1). It renders identically before and after
(`02_prefix_existing_detail.png` vs `18_postfix_legacy_filepath_record.png`: same
"No analysis result available yet", same 14 % VL bar). It is worth naming explicitly because
a raw `/sdcard/` path is the one URI shape that *would* depend on a media permission — but
this record has no playback overlay to begin with, and no user-reachable code path can
produce such a record any more since GH-71 removed the button.

### 5.4 All video flows on the permission-free build

| # | Flow | Result | Evidence |
|---|---|---|---|
| 1 | Open the system picker | Opens straight into the SAF Documents UI. No permission dialog. | `11_postfix_picker_no_permission_dialog.png` |
| 2 | Select a video the app never had access to before (`squat-1rep.mp4`, a *different* file, so the grant is genuinely fresh) | Accepted, import starts | `12_postfix_import_running.png` |
| 3 | Analysis run | Completes to `Done`, "Video analysis complete" notification | `13_postfix_analysis_done.png` |
| 4 | Playback of the new import | Frame + overlay + `-0.306 m/s` | `14_postfix_new_import_plays.png` |
| 5 | Full import ("Secure video in app") | `Video secured in app`, `Local Video: /data/user/0/…/analysis-3-….mp4`, playback continues | `15_postfix_secure_video_full_import.png` |
| 6 | Playback after a cold app restart | Pre-fix and post-fix records both play | `17_postfix_restart_legacy_plays.png` |

**No permission dialog and no error appeared in any flow.** `logcat` across all post-fix
flows contains zero matches for `permission deni`, `SecurityException`, `EACCES`,
`READ_MEDIA` or `requestPermissions` (`checks/logcat-postfix-flows.log`,
`checks/logcat-postfix-restart.log`).

### 5.5 Automated e2e

`gh396_api36_video_import.yaml` (import through the system picker) and
`gh396_api36_video_resume.yaml` both passed against R5CN30HWZFN on the permission-free
build. The resume flow is the one that asserts a resulting value rather than mere
navigation: the progress bar must be gone, `Done` must be visible, and `Failed` /
`App was closed while import or analysis was running` must not be.

> Historical note (GH-584): both flows were merged into the target flow
> `__tests__/e2e/maestro/flows/video_import_playback.yaml` (import through the picker, analysis,
> resume, Rep Summary); the file names above refer to the run documented here.

Maestro was pinned to the assigned device with the `adb_filter_proxy`, and the routing was
verified from the run's own debug output (`Width: 720`, `Height: 1600` = R5CN30HWZFN;
the emulator would report 1080×2400). Logs: `checks/maestro-video-import.log`,
`checks/maestro-video-resume.log`, JUnit reports alongside them.

## 6. Side observation, deliberately not acted on

The merged manifest also contains `WRITE_EXTERNAL_STORAGE` **without** a
`maxSdkVersion` cap, pulled in by a dependency rather than declared by this app. It is not
a `READ_MEDIA_*` permission, so it is outside both the Play notice and this ticket's
"remove only" constraint — but it is a storage permission that a future policy review could
pick up, and capping it at `maxSdkVersion="32"` like the app's own
`READ_EXTERNAL_STORAGE` would be the natural follow-up. Worth its own ticket.

## 7. Conclusion and next step in the Play Console

`READ_MEDIA_VIDEO` was a leftover manifest entry with no runtime behaviour behind it; it is
gone, `READ_MEDIA_IMAGES` was never there, and every video flow was shown to work without
it on an Android 13 device — including data imported before the change.

**Next step in the Play Console (to be done by a human, not by this change):** publish a
release built from this branch, then answer the "Photo and Video Permissions" declaration
by choosing the *"app no longer uses these permissions"* route rather than submitting the
explanation form — Gainalytics uses `ACTION_OPEN_DOCUMENT` with
`takePersistableUriPermission`, which is exactly the system picker the policy asks for. The
notice should clear once a release without the permission has been reviewed; no
explanation form is required.

