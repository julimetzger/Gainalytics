# Marketing material (GH-485)

| File | What |
| --- | --- |
| `gainalytics-promo.mp4` | Promo video, 1920×1080, 30 fps, H.264, about 55 s, **no audio** |
| `screenshots/NN-<feature>-<light\|dark>.png` | Store screenshots, 1080×1920 (9:16), RGB PNG without alpha, 8 features × light/dark |
| `captures/video/*.mp4` | Raw screen recordings from the phone, one per scene (input of the video) |
| `captures/markers.json` | Event times inside each recording (written by `capture.py`, used for every cut) |
| `captures/screens/*.png` | Raw phone screenshots (input of the store screenshots) |
| `scripts/` | Everything needed to redo it, see below |
| `assets/fonts/` | Inter (SIL Open Font License, see `OFL-LICENSE.txt`) |

Storyboard: intro → **video analysis** (import of a real deadlift, automatic analysis,
bar-path overlay playing over reps 1–2, rep table and velocity-loss chart) → **customization** (light/dark, colour wheel
recolouring the app, muscle-involvement editor) → training, plan, analysis and AI coach
side by side → fan of light and dark screens → outro. Video analysis and customization
take about 15 s each; everything else is shown briefly.

Sound: none. No music with a verifiable free licence was added, so the video ships silent
(add a track later with `ffmpeg -i gainalytics-promo.mp4 -i music.mp3 -c:v copy -shortest out.mp4`).

## Re-render after copy or layout changes (no phone needed)

```bash
python3 docs/marketing/scripts/render_store_screenshots.py   # ~10 s
python3 docs/marketing/scripts/render_video.py               # ~3 min
# optional: one still per scene
python3 docs/marketing/scripts/render_video.py --stills /tmp/promo-stills
```

Texts, colours and timing live at the top of the two render scripts. Cuts are defined
as `marker ± seconds` (e.g. `'play-0.4'`), so they keep working after a new capture.

## Re-capture after UI changes (phone needed)

Requirements: Python 3 with Pillow and NumPy, ffmpeg, adb, a debug build of the app
installed on an Android phone with a 720×1600 display-size override (the Galaxy S20+
test phone; set-row check marks of a running training are tapped at measured positions),
and — for a debug build — Metro running for this checkout.

```bash
python3 docs/marketing/scripts/capture.py --serial <device> --metro-port <host-metro-port> \
    --ai-key-file ~/.config/gainalytics-demo-ai-key      # optional: real AI answer
python3 docs/marketing/scripts/render_store_screenshots.py
python3 docs/marketing/scripts/render_video.py
```

### The lift clip (not in the repo)

The video analysis scene uses a real lift of the app owner from the test phone's gallery:
**`DCIM/Camera/Deadlift200-3reps@7.mp4`** (portrait 1080×1920, 30 fps, 45 s, side view,
conventional deadlift 200 kg × 3 at RPE 7; the app detects 3 reps, VL 22 %, RIR 2–3).
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
video never shows it.

### Real AI answer

`--ai-key-file <file>` (or `GAINALYTICS_DEMO_AI_KEY_FILE`) reads an Anthropic key at runtime
and types it into Settings → AI Configuration for the `ai_chat` scene only. Right after the
answer, the key is replaced by the dummy key `sk-ant-demo-local-mock`. The key is never
printed or logged (errors of the typing step hide the command line). The settings field is
masked and is never on screen while recording. The `uiautomator` dump file (it contains the
field text) is deleted from the phone. Without a key file, the answer comes from
`mock_ai_server.py` (scripted).

What `capture.py` does (about 15 min, fully scripted over adb):

1. **setup** – status bar demo mode (no notification icons), do-not-disturb, portrait lock;
   switches the debug build's own developer setting *JS Dev Mode* off so Metro serves the
   production bundle (no LogBox warnings on screen); builds the demo data
   (`make_demo_fixture.py`: the e2e baseline with all dates moved so the newest training
   ended a few hours ago, plus the deadlift set that matches the clip) and checks that the
   clip is in the gallery; imports the data through Settings → Import Data.
2. **training** – plans today's session ("Suggest based on last Training"), starts it,
   logs sets (rest timer), screenshots plan + training in dark and light, finishes it.
3. **video_analysis** – imports the gallery clip, waits for the analysis, links it to the
   200 kg × 3 deadlift set, seeks to just before rep 1, plays the overlay, shows rep table
   and VL chart.
4. **customize** – light/dark switch, colour wheel drag + apply, muscle-involvement editor.
5. **analysis** – dashboard, records heatmap, graphs.
6. **ai_chat** – clears the chat (archived to the history), asks the coach one question.
   With `--ai-key-file` a real model answer is recorded (see above). Without it the answer comes from
   `mock_ai_server.py`: the chat URL in `app/utils/ai/sendChatMessage.ts` is patched **only
   for this scene** and reverted right after; `teardown` refuses to finish while the file
   is still modified.
7. **teardown** – leaves demo mode / do-not-disturb, re-enables auto-rotate, restores JS Dev Mode, restarts the app.

Every recording is re-encoded on the way in (`-vsync passthrough` keeps the frame times
the markers refer to). Run single scenes with `--scenes training,customize` (they build on each other in the
order above).

Notes:
- System dialogs (Google sign-in prompts, update agents) are never answered — every tap
  checks that the app is in the foreground first and brings it back if not.
- While a training is running, `uiautomator` cannot read the screen (timers tick), so the
  training scene measures all positions before pressing *Start*.
- `teardown` switches *JS Dev Mode* back on if `setup` switched it off (developer menu:
  shake / `adb shell input keyevent 82` → Settings → JS Dev Mode).
