#!/usr/bin/env python3
"""Record the raw material for the promo videos and the store screenshots (GH-485, GH-665).

Drives the app on a real Android phone over adb, starting from the demo data set:

    python3 docs/marketing/scripts/capture.py --serial <device> --metro-port <port> \\
        --ai-key-file ~/.config/gainalytics-demo-ai-key [--scenes all]

Output (committed, so everything can be re-rendered without a phone):
    docs/marketing/captures/video/<scene>.mp4   screen recordings, one per scene
    docs/marketing/captures/markers.json        scene event times (seconds into each recording)
    docs/marketing/captures/screens/<feature>_<light|dark>.png   raw screenshots

Scenes run in this order and build on each other: setup, video_analysis, customize,
ai_key, training, coach_insight, analysis, ai_chat, remove_key, teardown. The real
Anthropic key is only on the phone between ai_key and remove_key (also removed when a
scene in between fails). See docs/marketing/README.md.
"""
import argparse
import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from device import APP_ID, CaptureError, Device  # noqa: E402

REPO = pathlib.Path(__file__).resolve().parents[3]
MARKETING = REPO / 'docs/marketing'
BUILD = MARKETING / 'build'
CAPTURES = MARKETING / 'captures'
SCREENS = CAPTURES / 'screens'
VIDEO = CAPTURES / 'video'
MARKERS = CAPTURES / 'markers.json'
DEMO_CLIP = 'demo-squat-5reps.mp4'
KEY_ON_PHONE = BUILD / 'ai_key_on_phone'  # set while the real key is saved in the app
APP_LOCALE = 'en-GB'  # per-app language: English labels and number formats in the charts

# The lift shown in the video analysis scene. A clip from the phone's own gallery
# is not committed (see README): it is found in the system picker through the
# "Videos" root and its search, by file name. `add_set` is the matching set that
# make_demo_fixture.py adds to the demo data, `link` the row it shows in the
# "Select a Set" dialog. Times are seconds into the clip: playback starts at
# `play_from` and runs `play_s`, the store screenshots pause at `shot_at`.
VA_CLIPS = {
    'Deadlift200-3reps@7.mp4': dict(duration=45.23, add_set='Deadlift:200x3@3', link='3 reps × 200 kg.*',
                                    play_from=21.0, play_s=10.5, shot_at=23.4, gallery=True),
    DEMO_CLIP: dict(duration=6.0, add_set=None, link='5 reps × 175 kg.*', play_from=0.0, play_s=9.0,
                    shot_at=2.9, gallery=False),
}
DEFAULT_VA_CLIP = 'Deadlift200-3reps@7.mp4'

# What the demo user asks the AI.
PLAN_PROMPT = 'Short on time: only squats, leg curls and leg extensions today. One more set of squats'
QUESTION = 'How do my sleep and steps affect my training? What should I change next week?'

# Demo sleep (hours, ends 07:00 N days ago, with stages) and steps for Health Connect,
# written by the debug build's HealthConnectTestDataActivity (14 days back).
DEMO_SLEEP = [7.6, 7.2, 8.1, 6.9, 7.4, 7.8, 6.6, 7.5, 7.0, 8.0, 7.3, 6.8, 7.7, 7.1]
DEMO_STEPS = [8420, 11250, 9870, 6420, 12890, 10340, 7650, 9120, 11760, 8030, 10450, 6980, 9640, 12110]

# The analysis filter shown in the analysis scene.
FILTER = dict(preset='6M', group='Week', metrics=('Volume', 'Sets'), muscle='Back')

# A running training keeps uiautomator from ever seeing an idle screen (the session
# timer ticks), so the set-row check marks, the tab bar and the overflow menu's
# "Finish Training" are tapped at positions measured on a 720x1600 (wm size override)
# Galaxy S20+.
SET_CHECK_X = 520
SET_CHECK_Y = [604, 682, 760, 838]
OVERFLOW_ICON = (675, 99)
OVERFLOW_FINISH = (580, 160)
TAB_XY = {'training': (90, 1420), 'exercises': (270, 1420), 'analyse': (450, 1420), 'settings': (630, 1420)}


def log(msg):
    print(msg, flush=True)


class Capture:
    def __init__(self, args):
        self.args = args
        self.d = Device(args.serial, log=log)
        self.markers = json.loads(MARKERS.read_text()) if MARKERS.exists() else {}
        self.dev_mode_changed = False
        if args.va_clip not in VA_CLIPS:
            raise CaptureError(f'unknown --va-clip {args.va_clip}: add it to VA_CLIPS ({", ".join(VA_CLIPS)})')
        self.clip = VA_CLIPS[args.va_clip]

    # ── helpers ─────────────────────────────────────────────────────────────
    def shot(self, feature, theme):
        self.d.screencap(str(SCREENS / f'{feature}_{theme}.png'))

    def record(self, scene):
        self.d.start_record(scene)

    def stop(self, scene, blank=None, frames=None):
        """blank: (from_marker, to_marker) - that part of the committed recording is
        painted black (the system file picker shows the phone's own folders and accounts).
        frames: {screen name: (marker, offset s)} - screenshots taken from the recording
        (for moments a screencap is too slow for, e.g. a toast)."""
        raw = BUILD / f'{scene}.raw.mp4'
        markers = self.d.stop_record(str(raw))
        for name, (marker, offset) in (frames or {}).items():
            at = markers[marker] + offset
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(raw), '-ss', f'{at:.2f}',
                            '-frames:v', '1', str(SCREENS / f'{name}.png')], check=True)
            log(f'  screenshot {name}.png (from the recording at {at:.2f}s)')
        vf = []
        if blank:
            a, b = markers[blank[0]] + 0.35, markers[blank[1]]
            vf = ['-vf', f"drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='between(t,{a:.2f},{b:.2f})'"]
        # Keeps the variable frame timestamps of screenrecord (the markers rely on them),
        # drops its extra data stream, and makes the file ~10x smaller.
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(raw), '-map', '0:v:0', *vf,
                        '-vsync', 'passthrough', '-c:v', 'libx264', '-preset', 'medium', '-crf', '25',
                        '-pix_fmt', 'yuv420p', str(VIDEO / f'{scene}.mp4')], check=True)
        raw.unlink()
        self.markers[scene] = markers
        self.markers['captured_at'] = dt.datetime.now().isoformat(timespec='seconds')
        MARKERS.write_text(json.dumps(self.markers, indent=2) + '\n')

    def wait_app(self, timeout=300):
        deadline = time.time() + timeout
        while time.time() < deadline:
            if APP_ID in self.d.focus() and self.d.exists(desc='tab-training'):
                return
            time.sleep(3)
        raise CaptureError('app did not finish loading')

    def restart_app(self):
        d = self.d
        d.sh(f'am force-stop {APP_ID}')
        d.sh(f'run-as {APP_ID} rm -f /data/data/{APP_ID}/files/BridgelessReactNativeDevBundle.js', check=False)
        if self.args.metro_port:
            d.adb('reverse', 'tcp:8081', f'tcp:{self.args.metro_port}')
        d.sh(f'am start -n {APP_ID}/.MainActivity')
        self.wait_app()
        time.sleep(2)

    def tab(self, name, settle=1.5):
        self.d.tap_el(desc=f'tab-{name}', settle=settle)

    def scroll_to(self, settle=0.6, max_swipes=8, direction='down', x=690, required=True, **kw):
        for _ in range(max_swipes):
            node = self.d.find(timeout=0, required=False, **kw)
            if node and 200 < node.center[1] < 1300:
                return node
            if direction == 'down':
                self.d.swipe(x, 1150, x, 550, 500, settle)
            else:
                self.d.swipe(x, 450, x, 1150, 400, settle)
        return self.d.find(timeout=2, required=required, **kw)

    def scroll_top(self):
        for _ in range(3):
            self.d.swipe(690, 450, 690, 1250, 250, 0.3)
        time.sleep(1.5)

    def settings_top(self):
        self.tab('settings')
        self.scroll_to(rid='settings-theme-mode-dark', direction='up')

    def set_theme(self, theme):
        self.settings_top()
        self.d.tap_el(rid=f'settings-theme-mode-{theme}', settle=1.5)

    def analyse_screen(self, label):
        self.tab('analyse')
        if not self.d.exists(rid='analyse-drawer-toggle'):
            self.d.back()
        self.d.tap_el(rid='analyse-drawer-toggle', settle=1.5)
        self.d.tap_el(text=label, settle=2.5)

    def tap_check(self, row):
        self.d.tap(SET_CHECK_X, SET_CHECK_Y[row])
        time.sleep(1.3)

    def home(self):
        self.tab('training')
        for _ in range(3):  # back to the home dashboard if a training screen is still open
            if self.d.find(rid='micro-hero-card', timeout=3, required=False):
                return
            self.d.back()
        self.d.find(rid='micro-hero-card')

    # ── scenes ──────────────────────────────────────────────────────────────
    def setup(self):
        d = self.d
        log('setup: phone state, demo data')
        if 'Bouncer' in d.focus():
            raise CaptureError('phone is PIN-locked - unlock it first')
        d.sh('settings put system accelerometer_rotation 0; settings put system user_rotation 0', check=False)
        d.sh('cmd notification set_dnd priority', check=False)
        d.sh('settings put global sysui_demo_allowed 1', check=False)
        for extra in ('enter', 'notifications -e visible false', 'battery -e level 100 -e plugged false',
                      'network -e wifi show -e level 4 -e fully true', 'network -e mobile show -e level 4 -e datatype none'):
            d.sh(f'am broadcast -a com.android.systemui.demo -e command {extra}', check=False)
        d.sh(f'pm grant {APP_ID} android.permission.POST_NOTIFICATIONS', check=False)
        d.sh(f'cmd locale set-app-locales {APP_ID} --locales {APP_LOCALE}', check=False)

        fixture = [sys.executable, str(MARKETING / 'scripts/make_demo_fixture.py'), '--days-ago', '0.1']
        if self.clip['add_set']:
            fixture += ['--add-set', self.clip['add_set']]
        subprocess.run(fixture, check=True)
        d.adb('push', str(BUILD / 'demo.gains'), '/sdcard/Download/baseline.gains')
        if self.clip['gallery']:
            found = d.sh(f"ls /sdcard/DCIM/Camera/'{self.args.va_clip}'", check=False)
            if 'No such file' in found or not found.strip():
                raise CaptureError(f'{self.args.va_clip} is not in DCIM/Camera on the phone (see README)')
        else:
            if not (BUILD / DEMO_CLIP).exists():
                subprocess.run([sys.executable, str(MARKETING / 'scripts/make_demo_lift_clip.py')], check=True)
            d.adb('push', str(BUILD / DEMO_CLIP), f'/sdcard/Download/{DEMO_CLIP}')

        self.restart_app()
        self.production_js()
        # Writing trainings to Health Connect would sync every imported training there, and
        # that burst uses up Health Connect's request quota: the chat then cannot read sleep
        # and steps for a while ("Rate limited request quota has been exceeded").
        self.health_connect_writes_off()
        self.import_demo_data()
        self.health_connect_writes_off()
        self.seed_health_connect()

    def health_connect_writes_off(self):
        d = self.d
        self.settings_top()
        switch = self.scroll_to(rid='health-connect-write-switch', required=False)
        if switch is not None and switch.checked:
            log('  switching "Write trainings to Health Connect" off')
            d.tap(*switch.center)
            time.sleep(1.5)
            if d.find(rid='health-connect-write-switch').checked:
                raise CaptureError('could not switch Health Connect writing off')

    def seed_health_connect(self):
        """Replaces the app's own sleep and steps records in Health Connect by the demo week
        (debug builds only). Health Connect must be connected once by hand (README)."""
        d = self.d
        log('  seeding sleep and steps in Health Connect')
        sleep = ','.join(f'{h}@{i}@staged' for i, h in enumerate(DEMO_SLEEP))
        steps = ','.join(f'{n}@{i}' for i, n in enumerate(DEMO_STEPS))
        d.adb('logcat', '-c', check=False)
        d.sh(f'am start -W -n {APP_ID}/.healthconnect.HealthConnectTestDataActivity --ez clear true '
             f'--es sleep "{sleep}" --es steps "{steps}"')
        deadline = time.time() + 30
        while time.time() < deadline:
            out = d.adb('logcat', '-d', '-s', 'GainalyticsHcTestData', check=False)
            if 'failed:' in out:
                raise CaptureError(f'seeding Health Connect failed: {out.strip().splitlines()[-1]}')
            if ' done' in out:
                break
            if 'healthdata' in d.focus():
                raise CaptureError('Health Connect asks for permissions: connect it once by hand (README), then rerun')
            time.sleep(1)
        else:
            raise CaptureError('seeding Health Connect did not finish')
        d.ensure_app_foreground()
        self.settings_top()
        status = self.scroll_to(rid='health-connect-status')
        if status.text != 'Connected':
            raise CaptureError(f'Health Connect is "{status.text}" - connect it in Settings first (README)')

    def production_js(self):
        """Debug builds load JS from Metro with __DEV__ = true, which shows LogBox warnings
        on screen. Switch the build's own developer setting "JS Dev Mode" off (a device
        setting, no app code change) so Metro serves the production bundle."""
        d = self.d
        prefs = d.sh(f'run-as {APP_ID} cat /data/data/{APP_ID}/shared_prefs/{APP_ID}_preferences.xml', check=False)
        if 'name="js_dev_mode_debug" value="false"' not in prefs and not self.args.release_build:
            log('  switching JS Dev Mode off (developer menu)')
            self.toggle_js_dev_mode()
            self.dev_mode_changed = True
            (BUILD / 'js_dev_mode_changed').touch()
            self.restart_app()
        if not self.args.release_build:
            head = d.sh(f'run-as {APP_ID} head -c 200 /data/data/{APP_ID}/files/BridgelessReactNativeDevBundle.js',
                        check=False)
            if '__DEV__=false' not in head:
                raise CaptureError('the app does not run the production bundle (__DEV__=false) - check Metro')

    def toggle_js_dev_mode(self):
        d = self.d
        d.sh('input keyevent 82')
        d.tap_el(text='Settings', settle=1.5)
        d.tap_el(text='JS Dev Mode', settle=1)
        d.back()

    def import_demo_data(self):
        d = self.d
        log('  importing demo data')
        self.tab('settings')
        self.scroll_to(rid='settings-import-data-button')
        d.tap_el(rid='settings-import-data-button', settle=1.5)
        d.find(text='Import full data from backup file\\?', timeout=10)
        d.tap_el(text='Import', settle=3)
        if 'documentsui' not in d.focus():
            raise CaptureError(f'file picker did not open: {d.focus()}')
        if not d.find(text='baseline.gains', timeout=4, required=False):
            d.sh('input swipe 15 800 560 800 300')
            time.sleep(1.5)
            d.tap(*d.find(text='Downloads').center, guard=False)
            time.sleep(2)
        d.tap(*d.find(text='baseline.gains').center, guard=False)
        time.sleep(4)
        d.ensure_app_foreground()
        d.find(text='Import Data', timeout=120)
        self.tab('training', settle=3)
        d.find(rid='micro-hero-card', timeout=60)

    def video_analysis(self):
        d = self.d
        log('video_analysis: import a lift, link it, play the overlay')
        self.analyse_screen('Video Analysis')
        d.find(rid='video-analysis-import-button')
        # A static screen gives screenrecord no frames (the first one is black): open the
        # list while recording.
        d.tap_el(rid='analyse-drawer-toggle', settle=1.5)
        self.record('video_analysis')
        time.sleep(0.8)
        d.tap_el(text='Video Analysis', settle=0.3)
        button = d.find(rid='video-analysis-import-button')
        d.mark('list')
        time.sleep(1.5)
        d.tap(*button.center)
        d.mark('import')
        time.sleep(3)
        if 'documentsui' not in d.focus():
            raise CaptureError(f'video picker did not open: {d.focus()}')
        self.pick_clip()
        time.sleep(2)
        d.ensure_app_foreground()
        d.mark('analysing')
        d.find(rid='video-analysis-row-\\d+', desc='Unknown Exercise.*Done', timeout=300)
        d.mark('done')
        time.sleep(1.5)
        row = d.find(rid='video-analysis-row-\\d+', desc='Unknown Exercise.*Done')
        row_id = row.rid.rsplit('-', 1)[1]
        d.tap_el(rid=f'video-analysis-link-set-{row_id}', settle=2)
        d.find(text='Select a Set')
        target = None
        for _ in range(8):
            target = d.find(text=self.clip['link'], timeout=1, required=False)
            if target and target.center[1] < 1250:
                break
            d.swipe(360, 1150, 360, 650, 700, 1.2)
        nodes = d.dump()
        target = d.find(text=self.clip['link'], nodes=nodes)
        link = min((n for n in nodes if n.rid.startswith('set-selection-link-') and not n.rid.endswith('container')),
                   key=lambda n: abs(n.center[1] - target.center[1]))
        d.mark('link')
        d.tap(*link.center)
        time.sleep(2)
        d.mark('linked')
        # screenrecord stops after 180 s: the detail and playback get a recording of their own
        self.stop('video_analysis', blank=('import', 'analysing'))
        self.record('video_analysis_detail')
        time.sleep(1.0)
        d.mark('list')
        d.tap_el(rid=f'video-analysis-row-{row_id}', settle=3)
        d.mark('detail')
        self.scroll_player_into_view()
        d.mark('player')
        if self.clip['play_from']:
            self.seek(self.clip['play_from'])
        toggle = d.find(rid='video-analysis-playback-toggle')
        time.sleep(0.8)
        d.tap(*toggle.center)
        d.mark('play')
        time.sleep(self.clip['play_s'])
        d.swipe(700, 1250, 700, 300, 1200, 2)
        d.mark('summary')
        time.sleep(2.5)
        d.swipe(700, 1250, 700, 500, 1200, 2)
        d.mark('chart')
        time.sleep(3)
        self.stop('video_analysis_detail')
        self.video_analysis_shots()

    def pick_clip(self):
        """In the system picker (not the app): Downloads for the generated clip, the
        "Videos" root + search by file name for a gallery clip. Never answers a dialog."""
        d, name = self.d, self.args.va_clip
        if not self.clip['gallery']:
            clip = d.find(text=re.escape(name), timeout=5, required=False)
            if clip is None:
                d.tap(*d.find(desc='Root-Verzeichnis anzeigen|Show roots').center, guard=False)
                time.sleep(1.5)
                d.tap(*d.find(text='Downloads').center, guard=False)
                time.sleep(2)
                clip = d.find(text=re.escape(name))
        else:
            if not d.find(rid='.*header_title', text='Videos', timeout=3, required=False):
                d.tap(*d.find(desc='Root-Verzeichnis anzeigen|Show roots').center, guard=False)
                time.sleep(1.5)
                d.tap(*d.find(text='Videos').center, guard=False)
                time.sleep(2)
            d.tap(*d.find(desc='Suchen|Search').center, guard=False)
            time.sleep(1.5)
            d.text_input(name.rsplit('.', 1)[0])
            d.sh('input keyevent 66')
            time.sleep(3)
            clip = d.find(text=re.escape(name))
        time.sleep(0.5)
        d.tap(*clip.center, guard=False)

    def video_analysis_shots(self):
        self.va_shot('dark')
        self.set_theme('light')
        self.tab('analyse', settle=2)
        self.va_shot('light')
        self.set_theme('dark')
        self.tab('analyse', settle=2)

    def scroll_player_into_view(self, from_top=False):
        d = self.d
        if from_top:
            for _ in range(5):
                d.swipe(700, 450, 700, 1250, 300, 0.4)
            time.sleep(1)
        for _ in range(8):
            node = d.find(rid='video-analysis-playback-overlay', timeout=0, required=False)
            if node and node.y1 < 1000:
                delta = node.y1 - 175
                if abs(delta) > 25:
                    d.swipe(700, 1000, 700, 1000 - delta, 1500, 1.5)
                return
            d.swipe(700, 1200, 700, 500, 900, 1.2)
        raise CaptureError('playback overlay not found')

    def va_shot(self, theme):
        """Paused frame inside a rep: seek with the scrubber (playing after a theme switch
        leaves the video surface blank until the next seek)."""
        self.scroll_player_into_view(from_top=True)
        self.seek(self.clip['shot_at'])
        self.d.find(rid='video-analysis-playback-current-rep', text='Rep \\d')
        self.shot('video_analysis', theme)

    def seek(self, clip_s):
        """Tap the scrubber at clip_s seconds (the player must be in view)."""
        d = self.d
        fraction = clip_s / self.clip['duration']
        swiped = 0
        for _ in range(6):
            bar = d.find(rid='video-analysis-playback-scrubber', timeout=2, required=False)
            if bar and 300 < bar.center[1] < 1250:
                break
            d.swipe(700, 1000, 700, 700, 1500, 1.5)
            swiped += 1
        log(f'    seek: scrubber at y={bar.center[1]} after {swiped} swipes')
        for _ in range(3):  # a tap right after a scroll only stops the scroll
            time.sleep(1.5)
            d.tap(bar.x1 + fraction * bar.width, bar.center[1])
            time.sleep(1.5)
            thumb = d.find(rid='video-analysis-playback-scrubber-thumb')
            if abs(thumb.center[0] - (bar.x1 + fraction * bar.width)) < 0.1 * bar.width:
                break
        else:
            raise CaptureError(f'seek did not move the scrubber: {thumb}')
        for _ in range(swiped):
            d.swipe(700, 700, 700, 1000, 1500, 1.2)
        time.sleep(1)

    def customize(self):
        d = self.d
        log('customize: theme mode, own colour, muscle involvement')
        self.settings_top()
        self.record('custom_settings')
        time.sleep(1.5)
        d.mark('settings')
        d.tap_el(rid='settings-theme-mode-light', settle=2.2)
        d.mark('light')
        d.tap_el(rid='settings-theme-mode-dark', settle=2.0)
        d.mark('dark')
        d.tap_el(rid='settings-palette-custom', settle=2)
        wheel = d.find(rid='theme-color-wheel')
        d.mark('wheel')
        cx, cy = wheel.center
        d.drag_arc(cx, cy, wheel.width * 0.36, 200, 375, step_deg=4, step_s=0.05)
        d.mark('picked')
        time.sleep(1.2)
        d.tap_el(rid='theme-color-apply-button', settle=1.5)
        d.mark('applied')
        self.tab('training', settle=2.5)
        d.mark('recolored')
        self.tab('exercises', settle=2.5)
        self.stop('custom_settings')

        for theme in ('dark', 'light'):
            if theme == 'light':
                self.set_theme('light')
            self.settings_top()
            d.tap_el(rid='settings-palette-custom', settle=2)
            self.shot('customize_settings', theme)
            d.tap_el(rid='theme-color-cancel-button', settle=1)
        self.set_theme('dark')
        d.tap_el(rid='settings-palette-blue', settle=1.5)

        self.tab('exercises', settle=2)
        for _ in range(3):  # back to the list if a detail screen is still open
            if d.exists(rid='exercise-searchbar'):
                break
            d.back()
        d.tap_el(rid='exercise-searchbar', settle=1)
        d.sh('input keyevent 123; input keyevent --longpress 67', check=False)
        d.text_input('Squat')
        time.sleep(1.5)
        d.hide_keyboard()
        d.tap_el(rid='exercise-row-\\d+', desc='Squat,.*', settle=2.5)
        d.find(rid='exercise-detail-edit-button')
        self.record('custom_muscles')
        time.sleep(1.5)
        d.mark('detail')
        d.tap_el(rid='exercise-detail-edit-button', settle=2)
        d.mark('editor')
        time.sleep(1)
        self.drag_muscles()
        time.sleep(2)
        self.stop('custom_muscles')
        d.tap_el(rid='edit-exercise-cancel', settle=1.5)

    def drag_muscles(self):
        d = self.d
        for muscle, start, end in (('Core', 0.30, 0.55), ('Back', 0.0, 0.25), ('Hamstrings', 0.50, 0.70)):
            bar = d.find(rid=f'muscle-bar-{muscle}')
            y = bar.center[1]
            x1 = bar.x1 + max(start, 0.02) * bar.width
            d.drag_line(x1, y, bar.x1 + end * bar.width, y, steps=14, step_s=0.04)
            d.mark(muscle.lower())
            time.sleep(0.8)

    # ── scenes with the real AI key ─────────────────────────────────────────
    def ai_key(self):
        if not self.args.ai_key:
            raise CaptureError('Plan with AI, Coach Insight and the AI chat need --ai-key-file (real answers)')
        log('ai_key: saving the real key in Settings → AI Configuration (masked, never logged)')
        KEY_ON_PHONE.touch()
        self.save_api_key(self.args.ai_key)

    def remove_key(self):
        log('remove_key: deleting the real key from the app')
        for attempt in range(4):
            try:
                self.d.ensure_app_foreground()
                self.save_api_key('')
                break
            except CaptureError as error:
                log(f'  removing the API key failed ({error}), retrying')
                self.d.back()
                time.sleep(3)
        else:
            raise CaptureError('THE REAL API KEY IS STILL ON THE PHONE - delete it in Settings → AI Configuration')
        # Proof: without a key the chat only shows its "add your key" notice.
        self.analyse_screen('AI Chat')
        self.d.find(rid='chat-no-key-message', timeout=20)
        KEY_ON_PHONE.unlink(missing_ok=True)
        log('  the key is gone (chat shows the no-key notice)')

    def save_api_key(self, key):
        """An empty key deletes the saved one. The field is masked on screen and in
        uiautomator dumps (one bullet per character); the key is typed in chunks (one long
        `input text` drops characters there), never printed, and the dump file is removed
        from the phone afterwards."""
        d = self.d
        self.settings_top()
        field = None
        for _ in range(2):  # the accordion keeps its state: only open it if the field is not there
            field = self.scroll_to(rid='settings-anthropic-api-key-input', max_swipes=3, required=False)
            if field:
                break
            accordion = self.scroll_to(rid='settings-ai-config-accordion', direction='up')
            d.tap(*accordion.center)
            time.sleep(1.5)
        if field is None:
            field = self.scroll_to(rid='settings-anthropic-api-key-input')
        # A focused field (blinking cursor) keeps uiautomator from ever seeing an idle
        # screen, so the field is only read while it is not focused.
        for _ in range(3):
            length = len(field.text)  # masked or not, one character per key character
            d.tap(*field.center)
            time.sleep(1)
            d.sh('input keyevent 123; input keyevent ' + ' '.join(['67'] * (length + 5)), check=False)
            if key:
                d.text_input(key, secret=True, chunk=8)
            time.sleep(0.5)
            d.hide_keyboard()
            time.sleep(1)
            field = d.find(rid='settings-anthropic-api-key-input', timeout=30)
            if len(field.text) == len(key) or (not key and field.text in ('', 'sk-ant-...')):
                break
        else:
            d.forget_dump()
            raise CaptureError('the API key field does not hold the new key')
        d.tap_el(rid='settings-save-api-key-button', settle=1.5)
        d.find(text='API key (saved|removed).*', timeout=8, required=False)
        d.forget_dump()

    def training(self):
        d = self.d
        log('training: Plan with AI, start the session, log sets')
        # While a session runs, uiautomator never sees an idle screen (the session and
        # rest timers tick), so everything tapped after "Start" is measured up front.
        self.settings_top()
        nodes = d.dump()
        theme_xy = {t: d.find(rid=f'settings-theme-mode-{t}', nodes=nodes).center for t in ('light', 'dark')}
        self.home()
        self.record('training')
        time.sleep(2.5)
        d.mark('home')
        d.tap_el(rid='next-training-start-button', settle=2)
        d.tap_el(rid='train-tab-go-to-plan-button', settle=2)
        field = d.find(rid='plan-with-ai-input')
        d.mark('plan_screen')
        time.sleep(1.2)
        d.tap(*field.center)
        time.sleep(1.0)
        d.mark('typing')
        words = PLAN_PROMPT.split(' ')
        for i in range(0, len(words), 2):
            d.text_input(' '.join(words[i:i + 2]) + (' ' if i + 2 < len(words) else ''))
            time.sleep(0.15)
        d.mark('typed')
        time.sleep(0.8)
        # A tap next to the field closes the keyboard and blurs the input; the button tap
        # then starts the request (its spinner keeps uiautomator busy until the answer).
        d.tap(*d.find(rid='', text='Plan with AI', nodes=d.dump()).center)  # the section title
        time.sleep(1.0)
        button = d.find(rid='plan-with-ai-button')
        d.tap(*button.center)
        d.mark('ai_sent')
        t0 = time.time()
        d.find(rid='plan-read-exercise-section-.*', timeout=150)
        d.mark('ai_planned')
        log(f'    planned with AI after {time.time() - t0:.0f}s')
        self.shot('plan_ai', 'dark')
        # The "Planned with AI" toast stays 8 s, a screencap after the theme switch comes
        # too late: the light shot is a frame of the recording (see stop()).
        self.blind_theme('light', theme_xy, swipes=0)
        self.blind_tab('training', settle=0.2)
        d.mark('light')
        time.sleep(2.0)
        if d.find(rid='plan-with-ai-error', timeout=0, required=False):
            raise CaptureError('Plan with AI answered with an error')
        tabs, subtab = self.planned_exercises()
        d.swipe(690, 1150, 690, 700, 900, 1.2)
        d.swipe(690, 700, 690, 1150, 900, 1.0)
        d.tap(*subtab['train'])
        time.sleep(1.5)
        d.mark('train')
        d.tap_el(rid='train-tab-start-button', settle=2.5)
        d.mark('started')
        first = next((t for t in tabs if t[0] == 'Squat'), tabs[0])
        d.tap(*first[1])
        time.sleep(1.5)
        d.mark('exercise')
        self.tap_check(0)
        d.mark('logged')
        time.sleep(3.5)
        self.stop('training', frames={'plan_ai_light': ('light', 1.2)})
        self.shot('training', 'light')
        self.blind_theme('dark', theme_xy)
        self.blind_tab('training', settle=2)
        self.tap_check(1)
        time.sleep(1.5)
        self.shot('training', 'dark')
        # log every planned set, so Coach Insight reviews a complete session
        for row in range(2, first[2]):
            self.tap_check(row)
        for name, xy, sets in tabs:
            if name == first[0]:
                continue
            d.tap(*xy)
            time.sleep(1.3)
            for row in range(sets):
                self.tap_check(row)
        d.tap(*first[1])
        time.sleep(1.5)

    def planned_exercises(self):
        """[(name, tab xy, planned sets)] of the plan on screen, and the sub-tab positions.
        Every exercise tab must be on screen (they are tapped blind while the session runs)."""
        d = self.d
        counts, sections = {}, set()
        for attempt in range(4):
            nodes = d.dump()
            for node in nodes:
                m = re.fullmatch(r'plan-read-set-count-(\d+)', node.rid)
                if m:
                    counts[m.group(1)] = int(re.search(r'\d+', node.desc or node.text).group())
                m = re.fullmatch(r'plan-read-exercise-section-(\d+)', node.rid)
                if m:
                    sections.add(m.group(1))
            if attempt == 0:
                tabs = [(n.desc.strip(), n.center, n.rid.rsplit('-', 1)[1]) for n in nodes
                        if re.fullmatch(r'training-exercise-\d+', n.rid)]
                subtab = {t: d.find(rid=f'subtab-{t}', nodes=nodes).center for t in ('plan', 'train')}
            if sections and sections <= set(counts):
                break
            d.swipe(690, 1150, 690, 650, 700, 1.2)
        for _ in range(attempt):
            d.swipe(690, 650, 690, 1150, 700, 0.8)
        if {t[2] for t in tabs} != sections or any(t[1][0] > 690 for t in tabs):
            raise CaptureError(f'not every planned exercise has a tab on screen ({tabs}, {sections}) - '
                               'make PLAN_PROMPT ask for fewer exercises')
        tabs = [(name, xy, counts.get(eid, 1)) for name, xy, eid in tabs]
        if max(t[2] for t in tabs) > len(SET_CHECK_Y):
            raise CaptureError(f'more sets than measured rows ({tabs}) - extend SET_CHECK_Y')
        log(f'    exercises: {tabs}')
        return tabs, subtab

    def coach_insight(self):
        """Finishes the running training: the app opens its analysis, where Coach Insight
        asks the AI about the session."""
        d = self.d
        log('coach_insight: finish the training, the AI reviews it')
        self.record('coach_insight')
        time.sleep(1.5)
        d.tap(*OVERFLOW_ICON)
        time.sleep(1.3)
        d.mark('menu')
        d.tap(*OVERFLOW_FINISH)
        time.sleep(0.5)
        d.mark('finished')
        if not d.find(rid='training-coach-insight-(loading|card)', timeout=20, required=False):
            raise CaptureError('the training did not finish (no Coach Insight card)')
        stamp = d.find(rid='training-coach-insight-timestamp', timeout=2, required=False)
        if stamp and stamp.text != 'Generated just now':  # answer cached by an earlier run: ask again
            d.tap_el(rid='training-coach-insight-refresh', settle=0.3)
            d.mark('refresh')
        t0 = time.time()
        d.find(rid='training-coach-insight-timestamp', text='Generated just now', timeout=150)  # under the answer
        d.mark('insight')
        log(f'    insight after {time.time() - t0:.0f}s')
        if d.find(rid='training-coach-insight-error', timeout=0, required=False):
            raise CaptureError('Coach Insight answered with an error')
        time.sleep(3)
        card = d.find(rid='training-coach-insight-card')
        if card.y1 > 350:  # bring the card to the top so the answer fills the screen
            d.swipe(690, 1100, 690, 1100 - (card.y1 - 260), 1400, 1.5)
        d.mark('scrolled')
        time.sleep(3)
        self.stop('coach_insight')
        self.shot('coach_insight', 'dark')
        self.set_theme('light')
        self.blind_tab('training', settle=2.5)
        d.find(rid='training-coach-insight-timestamp')
        self.shot('coach_insight', 'light')
        self.set_theme('dark')

    def blind_tab(self, name, settle=1.5):
        self.d.tap(*TAB_XY[name])
        time.sleep(settle)

    def blind_theme(self, theme, theme_xy, swipes=3):
        self.blind_tab('settings', settle=1.2)
        for _ in range(swipes):
            self.d.swipe(690, 450, 690, 1150, 300, 0.5)
        self.d.tap(*theme_xy[theme])
        time.sleep(1.2)

    def analysis(self):
        d = self.d
        log('analysis: filter panel, graphs, records')
        self.analyse_screen('Analysis')
        self.scroll_top()
        self.reset_filter()
        self.record('analysis')
        time.sleep(2.0)
        d.mark('graphs')
        d.tap_el(rid='filter-panel-card', settle=1.0)
        d.mark('panel_open')
        nodes = d.dump()  # one measurement, then quick taps (the rows keep their places)
        chips = [f'filter-range-preset-{FILTER["preset"]}', f'filter-groupby-{FILTER["group"]}',
                 *(f'filter-metric-{m}' for m in FILTER['metrics']), f'filter-muscle-{FILTER["muscle"]}']
        for rid in chips:
            d.tap(*d.find(rid=rid, nodes=nodes).center)
            time.sleep(0.9)
        d.mark('filtered')
        time.sleep(1.2)
        d.tap(*d.find(rid='filter-panel-collapse', nodes=nodes).center)
        d.mark('panel_closed')
        time.sleep(3.5)  # no swipe over the charts: a touch there selects a point
        d.tap_el(rid='analyse-drawer-toggle', settle=1.2)
        d.tap_el(text='Records', settle=0.3)
        d.mark('records')
        time.sleep(3)
        d.swipe(690, 1150, 690, 800, 1200, 1.5)
        d.mark('records_scrolled')
        time.sleep(1.5)
        self.stop('analysis')
        for theme in ('dark', 'light'):
            if theme == 'light':
                self.set_theme('light')
            self.analyse_screen('Analysis')
            self.scroll_top()
            d.tap_el(rid='filter-panel-card', settle=1.5)
            self.shot('analysis', theme)
            d.tap_el(rid='filter-panel-collapse', settle=1)
            d.tap_el(rid='analyse-drawer-toggle', settle=1.2)
            d.tap_el(text='Records', settle=3)
            self.scroll_top()
            self.shot('analysis_records', theme)
        self.set_theme('dark')

    def reset_filter(self):
        """Back to the defaults (3M, Day, all metrics, nothing selected) - the filter is
        kept between runs. Leaves the panel collapsed."""
        d = self.d
        d.tap_el(rid='filter-panel-card', settle=1.2)
        nodes = d.dump()
        for node in nodes:
            if node.selected and re.fullmatch(r'filter-(metric|exercise-chip)-[\w-]+', node.rid):
                d.tap(*node.center)
                time.sleep(0.6)
        if d.find(rid='filter-muscle-section-title', text='Muscles \\(0\\)', nodes=nodes, required=False) is None:
            d.tap_el(rid='filter-muscle-clear', settle=0.6)
        d.tap_el(rid='filter-range-preset-3M', settle=0.6)
        d.tap_el(rid='filter-groupby-Day', settle=0.6)
        d.tap_el(rid='filter-panel-collapse', settle=1.2)
        summary = d.find(rid='filter-selection-summary')
        if summary.text != 'All exercises':
            raise CaptureError(f'filter reset failed: {summary.text}')

    def ai_chat(self):
        d = self.d
        log('ai_chat: sleep and steps in the context, one question, a real answer')
        self.analyse_screen('AI Chat')
        d.find(rid='chat-input', timeout=45)
        if not d.exists(rid='chat-empty-state'):  # start from an empty chat (archived, not deleted)
            d.tap_el(rid='chat-clear-button', settle=1.5)
            d.find(rid='chat-empty-state')
        if d.exists(rid='chat-filter-section'):
            d.tap_el(rid='chat-context-badge', settle=1)
        self.recovery_switch(False)  # off, so the scene can switch it on
        message_list = d.find(rid='chat-message-list')
        self.record('ai_chat')
        time.sleep(1.5)
        d.mark('empty')
        d.tap_el(rid='chat-context-badge', settle=1.2)
        d.mark('filters')
        nodes = d.dump()
        d.tap(*d.find(rid='chat-preset-28d', nodes=nodes).center)  # the last 4 weeks
        time.sleep(1.2)
        d.tap(*d.find(rid='chat-recovery-switch', nodes=nodes).center)
        d.find(rid='chat-recovery-info', text='Sleep and steps attached: \\d+ days?')
        d.mark('recovery_on')
        time.sleep(2.0)
        d.tap_el(rid='chat-context-badge', settle=0.8)
        d.mark('filters_closed')
        d.tap_el(rid='chat-input', settle=1)
        d.mark('typing')
        words = QUESTION.split(' ')
        for i in range(0, len(words), 3):
            d.text_input(' '.join(words[i:i + 3]) + (' ' if i + 3 < len(words) else ''))
            time.sleep(0.2)
        d.mark('typed')
        time.sleep(0.8)
        d.tap_el(rid='chat-send-button', settle=0.3)
        d.mark('sent')
        # A tap on the list closes the keyboard AND blurs the input (the back key only
        # hides the keyboard; a focused input's cursor keeps uiautomator from working).
        d.tap(message_list.center[0], message_list.y1 + 60)
        time.sleep(0.5)
        self.wait_reply()
        d.mark('reply')
        time.sleep(3)
        d.swipe(690, 1100, 690, 700, 1500, 1.5)
        d.mark('reply_scrolled')
        time.sleep(2.5)
        self.stop('ai_chat')
        self.ai_chat_shots()

    def recovery_switch(self, on):
        """Sets "Include sleep and steps" (in the context filter section)."""
        d = self.d
        d.tap_el(rid='chat-context-badge', settle=1.2)
        switch = d.find(rid='chat-recovery-switch')
        if switch.checked != on:
            d.tap(*switch.center)
            time.sleep(1)
        d.tap_el(rid='chat-context-badge', settle=1)

    def ai_chat_shots(self):
        d = self.d
        for theme in ('dark', 'light'):
            if theme == 'light':
                self.set_theme('light')
            self.tab('analyse', settle=2)
            if not d.find(rid='chat-message-list', timeout=3, required=False):
                self.analyse_screen('AI Chat')
            d.find(rid='chat-message-list')
            for _ in range(5):  # top of the conversation: the question above the answer
                d.swipe(360, 500, 360, 1150, 500, 0.6)
            time.sleep(1)
            d.find(rid='chat-bubble-user')
            self.shot('ai_chat', theme)
        self.set_theme('dark')

    def wait_reply(self, timeout=150):
        """Until an assistant bubble is there and the loading row is gone (screenrecord
        stops after 180 s, so a slower answer fails the scene instead of cutting it)."""
        d = self.d
        t0 = time.time()
        deadline = t0 + timeout
        while time.time() < deadline:
            try:
                nodes = d.dump(retries=1)
            except CaptureError:  # the loading timer can keep the screen from being idle
                nodes = None
            if nodes is not None:
                if d.find(rid='chat-error', nodes=nodes, required=False):
                    raise CaptureError('the chat answered with an error')
                if (d.find(rid='chat-bubble-assistant', nodes=nodes, required=False)
                        and not d.find(rid='chat-loading', nodes=nodes, required=False)):
                    log(f'    answer after {time.time() - t0:.0f}s')
                    return
            time.sleep(1)
        raise CaptureError('no chat answer')

    def teardown(self):
        d = self.d
        log('teardown: restore phone settings')
        d.sh('am broadcast -a com.android.systemui.demo -e command exit', check=False)
        d.sh('cmd notification set_dnd off', check=False)
        d.sh('settings put system accelerometer_rotation 1', check=False)
        d.sh(f'cmd locale set-app-locales {APP_ID} --locales ""', check=False)  # back to the system language
        d.forget_dump()
        if KEY_ON_PHONE.exists():
            raise CaptureError('the real API key may still be on the phone - run --scenes remove_key')
        if self.dev_mode_changed or (BUILD / 'js_dev_mode_changed').exists():
            log('  switching JS Dev Mode back on')
            self.toggle_js_dev_mode()
            (BUILD / 'js_dev_mode_changed').unlink(missing_ok=True)
        self.restart_app()


SCENES = ['setup', 'video_analysis', 'customize', 'ai_key', 'training', 'coach_insight', 'analysis', 'ai_chat',
          'remove_key', 'teardown']


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--serial', default=os.environ.get('ANDROID_SERIAL'), required=not os.environ.get('ANDROID_SERIAL'))
    parser.add_argument('--scenes', default='all', help='comma-separated subset of: ' + ', '.join(SCENES))
    parser.add_argument('--metro-port', default=os.environ.get('E2E_METRO_PORT'),
                        help='host Metro port to reverse device port 8081 to (debug builds)')
    parser.add_argument('--release-build', action='store_true', help='app is a release build (no dev menu)')
    parser.add_argument('--ai-key-file', default=os.environ.get('GAINALYTICS_DEMO_AI_KEY_FILE'),
                        help='file with a real Anthropic key (needed for Plan with AI, Coach Insight and the '
                             'AI chat). It is typed into the app by the ai_key scene and deleted by remove_key')
    parser.add_argument('--va-clip', default=DEFAULT_VA_CLIP,
                        help=f'lift clip for the video analysis scene, one of: {", ".join(VA_CLIPS)}')
    args = parser.parse_args()
    args.ai_key = None
    if args.ai_key_file:
        args.ai_key = pathlib.Path(args.ai_key_file).expanduser().read_text().strip()
        if not re.fullmatch(r'sk-ant-[A-Za-z0-9_-]{20,}', args.ai_key):
            raise SystemExit('--ai-key-file does not contain an Anthropic key')
    scenes = SCENES if args.scenes == 'all' else args.scenes.split(',')
    for folder in (SCREENS, VIDEO, BUILD):
        folder.mkdir(parents=True, exist_ok=True)
    cap = Capture(args)
    try:
        for scene in scenes:
            t0 = time.time()
            getattr(cap, scene)()
            log(f'== {scene} done in {time.time() - t0:.0f}s')
    except BaseException:
        if KEY_ON_PHONE.exists():  # a scene failed while the real key was on the phone: never leave it there
            cap.remove_key()
        raise
    if KEY_ON_PHONE.exists():
        log('!! the real API key is still on the phone - finish with --scenes ...,remove_key')


if __name__ == '__main__':
    main()
