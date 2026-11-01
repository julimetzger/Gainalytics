# Marketing material (GH-485, re-captured for the 1.0 release in GH-665)

| File | What |
| --- | --- |
| `video/gainalytics-promo-16x9.mp4` | Promo video 1920×1080 – YouTube (the Play Store video is a YouTube link) |
| `video/gainalytics-promo-9x16.mp4` | Promo video 1080×1920 – Reels, TikTok, Shorts |
| `video/gainalytics-promo-1x1.mp4` | Promo video 1080×1080 – feed posts |
| `screenshots/NN-<feature>-<light\|dark>.png` | Play Store screenshots, 1080×1920 (9:16), RGB PNG without alpha, 8 features × light/dark |
| `feature-graphic.png` | Play Store feature graphic, 1024×500, RGB without alpha |
| `captures/video/*.mp4` | Raw screen recordings from the phone, one per scene (input of the videos) |
| `captures/markers.json` | Event times inside each recording (written by `capture.py`, used for every cut) and `captured_at` |
| `captures/screens/*.png` | Raw phone screenshots (input of the store screenshots and the videos' fan scene) |
| `scripts/` | Everything needed to redo it, see below |
| `assets/fonts/` | Inter (SIL Open Font License, see `OFL-LICENSE.txt`) |

All three videos: H.264, 30 fps, about 56 s, **no audio**. Each is laid out for its own frame
(copy left of the phone in 16:9 and 1:1, copy above the phone in 9:16 with one caption at a
time); nothing is cropped away.

Storyboard: intro → **video analysis** (a real deadlift being analysed, bar-path overlay over
reps 1–2, rep table and velocity-loss chart) → **customization** (light/dark, colour wheel
recolouring the app, muscle-involvement editor) → Plan with AI → training → Coach Insight →
analysis with the filter panel and the records heatmap → AI chat with sleep and steps from
Health Connect → fan of light and dark screens → outro. Video analysis and customization take
about 11 s and 10 s; the other features about 4 s each.

Store screenshots, strongest first: video analysis, Plan with AI, Coach Insight, customization,
training, analysis (filter panel), AI coach (sleep and steps), records. The muscle editor is
only in the videos.

Sound: none. No music with a verifiable free licence was added, so the videos ship silent
(add a track later with `ffmpeg -i in.mp4 -i music.mp3 -c:v copy -shortest out.mp4`).

## Re-render after copy or layout changes (no phone needed)

```bash
python3 docs/marketing/scripts/render_store_screenshots.py           # ~15 s, screenshots + feature graphic
python3 docs/marketing/scripts/render_video.py                       # ~10 min, all three videos
python3 docs/marketing/scripts/render_video.py --formats 9x16 --stills /tmp/promo-stills   # one format, stills per scene
python3 -m unittest discover -s docs/marketing/scripts -p 'test_*.py' -v                    # checks the formats
```

Texts, colours, timing and the per-format layouts (`LAYOUTS`) live at the top of the two
render scripts. Cuts are defined as `marker ± seconds` (e.g. `'play-0.3'`), so they keep
working after a new capture. Markers are written by the script right after its taps, but a
marker that waits for uiautomator (e.g. `ai_planned`) can lag the screen by a few seconds:
after a re-capture, look at the `--stills` output and adjust the offsets if needed.
`render_video.py` refuses to write a video outside 30–60 s.

## Re-capture after UI changes (phone needed)

Requirements: Python 3 with Pillow and NumPy, ffmpeg, adb, a **debug** build of the app
(`./gradlew assembleDebug`, then `adb install -r`; the debug build carries the Health Connect
test-data helper) on an Android phone with a 720×1600 display-size override (the Galaxy S20+
test phone; set-row check marks and the overflow menu of a running training are tapped at
measured positions), and Metro running for this checkout (`--metro-port`). The capture runs
Metro's production bundle (`__DEV__=false`, no LogBox) – see *setup* below.

One-time on the phone:
1. Settings → Health Connect → **Connect** → allow all (reading sleep and steps).
2. Once, allow the debug helper to write and clear test data (the dialog opens on the first
   run; or start it by hand: `adb shell am start -n com.powerliftingworkoutplanner/.healthconnect.HealthConnectTestDataActivity --es weights '""' --es sleep 7@1 --es steps 1@1`
   and allow weight, sleep and steps). `capture.py` stops with a message instead of answering
   these dialogs.

```bash
python3 docs/marketing/scripts/capture.py --serial <device> --metro-port <host-metro-port> \
    --ai-key-file ~/.config/gainalytics-demo-ai-key \
    --scenes setup,video_analysis,customize,ai_key,training,coach_insight      # ~13 min
python3 docs/marketing/scripts/capture.py --serial <device> --metro-port <host-metro-port> \
    --ai-key-file ~/.config/gainalytics-demo-ai-key \
    --scenes ai_key,analysis,ai_chat,remove_key,teardown                       # ~8 min
python3 docs/marketing/scripts/render_store_screenshots.py
python3 docs/marketing/scripts/render_video.py
```

(`--scenes all` runs everything in one go, ~20 min; split it when a tool limits a single
command to 10 minutes.)

### The lift clip (not in the repo)

The video analysis scene uses a real lift of the app owner from the test phone's gallery:
**`DCIM/Camera/Deadlift200-3reps@7.mp4`** (portrait 1080×1920, 30 fps, 45 s, side view,
conventional deadlift 200 kg × 3 at RPE 7).
The original file is **not committed** (the repo is open source) and the phone's copy is
never changed: the app only reads it through the system picker (no copy on import).

To re-capture on another phone, put the clip (from the owner) into the phone's gallery
with the same file name, e.g. `adb push Deadlift200-3reps@7.mp4 /sdcard/DCIM/Camera/` and
`adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d
file:///sdcard/DCIM/Camera/Deadlift200-3reps@7.mp4` (or open it once in the Gallery app),
so it shows up under *Videos* in the picker. `capture.py` searches the picker's *Videos* root
for the file name. Its timing (seek to 21 s before rep 1, playback length, paused frame for
the store screenshots) and the matching demo-data set (`Deadlift:200x3@3`, added by
`make_demo_fixture.py --add-set`) live in `VA_CLIPS` at the top of `capture.py`. To use a
different clip, add an entry there and pass `--va-clip <file name>`.
`--va-clip demo-squat-5reps.mp4` uses the synthetic plate clip from round 1 instead (no person,
no gallery needed).

The system file picker shows the phone's own folders and accounts, so `capture.py` paints
that part of the committed recording black (`import` → `analysing` markers), and the
videos never show it (they start at the running analysis).

### Real AI answers (Plan with AI, Coach Insight, AI chat)

`--ai-key-file <file>` (or `GAINALYTICS_DEMO_AI_KEY_FILE`) reads an Anthropic key at runtime.
The `ai_key` scene types it into Settings → AI Configuration (in chunks of 8 characters, the
masked field drops characters of one long `input text`), `remove_key` saves an empty key
(= deletes it) and proves it by the chat's "add your API key" notice. If a scene fails while
the key is on the phone, `capture.py` deletes it before it exits; a run that ends with the
key still saved prints a warning. The key is never printed or logged (errors of the typing
step hide the command line), the settings field is masked and never on screen while
recording, and the `uiautomator` dump file (it contains the masked field) is deleted from
the phone. There is no mock server any more: all three AI features show real answers.

What `capture.py` does (fully scripted over adb):

1. **setup** – status bar demo mode (no notification icons), do-not-disturb, portrait lock,
   the app's own language set to `en-GB` (`cmd locale set-app-locales`: English chart labels
   and number formats on a German phone); switches the debug build's own developer setting
   *JS Dev Mode* off so Metro serves the production bundle (no LogBox) and checks
   `__DEV__=false`; switches "Write trainings to Health Connect" off (an import would sync
   every training there and use up Health Connect's request quota); builds the demo data
   (`make_demo_fixture.py`: the e2e baseline with all dates moved so the newest training
   ended a few hours ago, plus the deadlift set that matches the clip) and checks that the
   clip is in the gallery; imports the data through Settings → Import Data; replaces the
   app's sleep and steps in Health Connect by two demo weeks (`DEMO_SLEEP`, `DEMO_STEPS`).
2. **video_analysis** – imports the gallery clip, waits for the analysis, links it to the
   200 kg × 3 deadlift set (recording `video_analysis`), then opens it, seeks to just before
   rep 1, plays the overlay, shows rep table and VL chart (recording `video_analysis_detail`;
   `screenrecord` stops after 180 s, so the scene has two recordings).
3. **customize** – light/dark switch, colour wheel drag + apply, muscle-involvement editor.
4. **ai_key** – see above.
5. **training** – "Plan with AI" with `PLAN_PROMPT` (a short session: squats, leg curls,
   leg extensions), screenshots of the plan with the "Planned with AI" toast (the light one
   is a frame of the recording: the toast is gone before a screencap after the theme switch),
   starts the session, logs every planned set.
6. **coach_insight** – finishes the session (overflow menu); its analysis asks Coach Insight
   (an answer cached by an earlier run is asked again).
7. **analysis** – Analysis with the filter panel (`FILTER`: 6 months, by week, volume + sets,
   back), records heatmap. The filter is reset first (the app keeps it).
8. **ai_chat** – clears the chat (archived to the history), picks the last 28 days, switches
   on "Include sleep and steps", asks `QUESTION`.
9. **remove_key**, **teardown** – deletes the key; leaves demo mode / do-not-disturb,
   re-enables auto-rotate, resets the app language, restores JS Dev Mode, restarts the app.

Every recording is re-encoded on the way in (`-vsync passthrough` keeps the frame times
the markers refer to). Run single scenes with `--scenes training,customize` (they build on
each other in the order above; AI scenes need `ai_key` in the same run).

Notes:
- System dialogs (Google sign-in prompts, update agents, Health Connect permissions) are never
  answered – every tap checks that the app is in the foreground first and brings it back if not.
- While a training is running, `uiautomator` cannot read the screen (timers tick), so the
  training scene measures all positions before pressing *Start*.
- `screenrecord` writes no frames while the screen does not change; `render_video.py` seeks
  after a 30 fps filter so a cut that starts in such a pause shows the frame on screen.
- Health Connect rate-limits reads per app. Many setup runs in a row (every seeding writes 28
  records) can make the chat show "Rate limited request quota has been exceeded"; `ai_chat`
  then fails – wait about half an hour without opening the chat and run it again.
- `teardown` switches *JS Dev Mode* back on if `setup` switched it off (developer menu:
  shake / `adb shell input keyevent 82` → Settings → JS Dev Mode).
