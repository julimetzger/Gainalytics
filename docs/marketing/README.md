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

Storyboard: intro → **video analysis** (import, automatic analysis, bar-path overlay
playing, rep table and velocity-loss chart) → **customization** (light/dark, colour wheel
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
python3 docs/marketing/scripts/capture.py --serial <device> --metro-port <host-metro-port>
python3 docs/marketing/scripts/render_store_screenshots.py
python3 docs/marketing/scripts/render_video.py
```

What `capture.py` does (about 15 min, fully scripted over adb):

1. **setup** – status bar demo mode (no notification icons), do-not-disturb, portrait lock;
   switches the debug build's own developer setting *JS Dev Mode* off so Metro serves the
   production bundle (no LogBox warnings on screen); builds the demo data
   (`make_demo_fixture.py`: the e2e baseline with all dates moved so the newest training
   ended a few hours ago) and the demo lift clip (`make_demo_lift_clip.py`: a synthetic
   plate moving like 5 squat reps with growing velocity loss — no people, no third-party
   footage); imports the data through Settings → Import Data.
2. **training** – plans today's session ("Suggest based on last Training"), starts it,
   logs sets (rest timer), screenshots plan + training in dark and light, finishes it.
3. **video_analysis** – imports the clip, waits for the analysis, links it to the
   logged 175 kg × 5 squat set, plays the overlay, shows rep table and VL chart.
4. **customize** – light/dark switch, colour wheel drag + apply, muscle-involvement editor.
5. **analysis** – dashboard, records heatmap, graphs.
6. **ai_chat** – asks the coach one question. Without `--ai-key` the answer comes from
   `mock_ai_server.py` (a scripted example answer, no account or paid API needed): the
   chat URL in `app/utils/ai/sendChatMessage.ts` is patched **only for this scene** and
   reverted right after; `teardown` refuses to finish while the file is still modified.
   With `--ai-key <key>` (or `GAINALYTICS_DEMO_AI_KEY`) a real model answer is recorded.
7. **teardown** – leaves demo mode / do-not-disturb, re-enables auto-rotate, restores JS Dev Mode, restarts the app.

Run single scenes with `--scenes training,customize` (they build on each other in the
order above). The file picker of the system shows the phone's own folders, so the video
cuts it out; it never appears in the final material.

Notes:
- System dialogs (Google sign-in prompts, update agents) are never answered — every tap
  checks that the app is in the foreground first and brings it back if not.
- While a training is running, `uiautomator` cannot read the screen (timers tick), so the
  training scene measures all positions before pressing *Start*.
- `teardown` switches *JS Dev Mode* back on if `setup` switched it off (developer menu:
  shake / `adb shell input keyevent 82` → Settings → JS Dev Mode).
