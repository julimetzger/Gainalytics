#!/usr/bin/env python3
"""Record the raw material for the promo video and the store screenshots (GH-485).

Drives the app on a real Android phone over adb, starting from the demo data set:

    python3 docs/marketing/scripts/capture.py --serial <device> [--scenes all]

Output (committed, so the video can be re-rendered without a phone):
    docs/marketing/captures/video/<scene>.mp4   screen recordings, one per scene
    docs/marketing/captures/markers.json        scene event times (seconds into each recording)
    docs/marketing/captures/screens/<feature>_<light|dark>.png   raw screenshots

Scenes run in this order and build on each other: setup, training, video_analysis,
customize, analysis, ai_chat, teardown. See docs/marketing/README.md.
"""
import argparse
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
CHAT_FILE = REPO / 'app/utils/ai/sendChatMessage.ts'
CHAT_URL = "const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';"
MOCK_PORT = 8787
DEMO_CLIP = 'demo-squat-5reps.mp4'
QUESTION = 'How is my squat progressing and what should I change next week?'

# The set rows of the running training are not reachable through uiautomator (the
# session timer keeps the screen from ever being idle), so their check marks are
# tapped at fixed positions. Measured on a 720x1600 (wm size override) Galaxy S20+.
SET_CHECK_X = 520
SET_CHECK_Y = [604, 682]
FINISH_Y_CANDIDATES = [1232, 1157, 1310, 1080]
TAB_XY = {'training': (90, 1420), 'exercises': (270, 1420), 'analyse': (450, 1420), 'settings': (630, 1420)}


def log(msg):
    print(msg, flush=True)


class Capture:
    def __init__(self, args):
        self.args = args
        self.d = Device(args.serial, log=log)
        self.markers = json.loads(MARKERS.read_text()) if MARKERS.exists() else {}
        self.dev_mode_changed = False

    # ── helpers ─────────────────────────────────────────────────────────────
    def shot(self, feature, theme):
        self.d.screencap(str(SCREENS / f'{feature}_{theme}.png'))

    def record(self, scene):
        self.d.start_record(scene)

    def stop(self, scene):
        self.markers[scene] = self.d.stop_record(str(VIDEO / f'{scene}.mp4'))
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

    def scroll_to(self, settle=0.6, max_swipes=8, direction='down', x=690, **kw):
        for _ in range(max_swipes):
            node = self.d.find(timeout=0, required=False, **kw)
            if node and 200 < node.center[1] < 1300:
                return node
            if direction == 'down':
                self.d.swipe(x, 1150, x, 550, 500, settle)
            else:
                self.d.swipe(x, 450, x, 1150, 400, settle)
        return self.d.find(timeout=2, **kw)

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
        self.d.tap_el(rid='analyse-drawer-toggle', settle=1.5)
        self.d.tap_el(text=label, settle=2.5)

    def tap_check(self, row):
        self.d.tap(SET_CHECK_X, SET_CHECK_Y[row])
        time.sleep(1.3)

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

        subprocess.run([sys.executable, str(MARKETING / 'scripts/make_demo_fixture.py'), '--days-ago', '0.1'], check=True)
        if not (BUILD / DEMO_CLIP).exists():
            subprocess.run([sys.executable, str(MARKETING / 'scripts/make_demo_lift_clip.py')], check=True)
        d.adb('push', str(BUILD / 'demo.gains'), '/sdcard/Download/baseline.gains')
        d.adb('push', str(BUILD / DEMO_CLIP), f'/sdcard/Download/{DEMO_CLIP}')

        self.restart_app()
        self.production_js()
        self.import_demo_data()

    def production_js(self):
        """Debug builds load JS from Metro with __DEV__ = true, which shows LogBox warnings
        on screen. Switch the build's own developer setting "JS Dev Mode" off (a device
        setting, no app code change) so Metro serves the production bundle."""
        d = self.d
        prefs = d.sh(f'run-as {APP_ID} cat /data/data/{APP_ID}/shared_prefs/{APP_ID}_preferences.xml', check=False)
        if 'name="js_dev_mode_debug" value="false"' in prefs or self.args.release_build:
            return
        log('  switching JS Dev Mode off (developer menu)')
        self.toggle_js_dev_mode()
        self.dev_mode_changed = True
        (BUILD / 'js_dev_mode_changed').touch()
        self.restart_app()

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

    def training(self):
        d = self.d
        log('training: plan a session, start it, log sets, finish it')
        # While a session runs, uiautomator never sees an idle screen (the session and
        # rest timers tick), so everything tapped after "Start" is measured up front.
        self.settings_top()
        nodes = d.dump()
        theme_xy = {t: d.find(rid=f'settings-theme-mode-{t}', nodes=nodes).center for t in ('light', 'dark')}
        self.tab('training')
        for _ in range(3):  # back to the home dashboard if a training screen is still open
            if d.find(rid='micro-hero-card', timeout=3, required=False):
                break
            d.back()
        self.record('training')
        time.sleep(2.5)
        d.mark('home')
        d.tap_el(rid='next-training-start-button', settle=2)
        d.tap_el(rid='train-tab-go-to-plan-button', settle=2)
        d.mark('suggest')
        d.tap_el(rid='training-suggest-last-training-button(-text)?', settle=2.5)
        d.find(rid='plan-read-exercise-section-.*')
        d.mark('plan')
        nodes = d.dump()
        tabs = {}
        for node in nodes:
            m = re.fullmatch(r'training-exercise-(\d+)', node.rid)
            if m:
                count = d.find(rid=f'plan-read-set-count-{m.group(1)}', nodes=nodes, required=False)
                tabs[node.desc.strip()] = (node.center, int(count.desc.split()[0]) if count else 1)
        subtab = {t: d.find(rid=f'subtab-{t}', nodes=nodes).center for t in ('plan', 'train')}
        log(f'    exercises: {tabs}')
        time.sleep(1.5)
        d.swipe(690, 1150, 690, 700, 900, 1.2)
        d.swipe(690, 700, 690, 1150, 900, 1.0)
        d.tap_el(rid='subtab-train', settle=1.5)
        d.mark('train')
        d.tap_el(rid='train-tab-start-button', settle=2.5)
        d.mark('started')
        d.tap(*tabs['Squat'][0])
        time.sleep(1.5)
        d.mark('squat')
        self.tap_check(0)
        d.mark('logged')
        time.sleep(4)
        self.stop('training')
        self.shot('training', 'dark')
        d.tap(*subtab['plan'])
        time.sleep(1.5)
        self.shot('plan', 'dark')

        self.blind_theme('light', theme_xy)
        self.blind_tab('training', settle=2)
        self.shot('plan', 'light')
        d.tap(*subtab['train'])
        time.sleep(1.5)
        self.tap_check(1)
        time.sleep(1.5)
        self.shot('training', 'light')
        self.blind_theme('dark', theme_xy)
        self.blind_tab('training', settle=2)

        for name, (xy, sets) in tabs.items():
            if name == 'Squat':
                continue
            d.tap(*xy)
            time.sleep(1.3)
            for row in range(min(sets, len(SET_CHECK_Y))):
                self.tap_check(row)
        d.tap(*tabs['Squat'][0])
        time.sleep(1.5)
        for y in FINISH_Y_CANDIDATES:
            d.tap(360, y)
            time.sleep(2.5)
            if d.find(text='Total Sets: .*', timeout=6, required=False):
                log(f'  training finished (button at y={y})')
                d.back()
                return
        raise CaptureError('could not find "Finish Training"')

    def blind_tab(self, name, settle=1.5):
        self.d.tap(*TAB_XY[name])
        time.sleep(settle)

    def blind_theme(self, theme, theme_xy):
        self.blind_tab('settings')
        for _ in range(3):
            self.d.swipe(690, 450, 690, 1150, 300, 0.5)
        self.d.tap(*theme_xy[theme])
        time.sleep(1.5)

    def video_analysis(self):
        d = self.d
        log('video_analysis: import a lift, link it, play the overlay')
        self.analyse_screen('Video Analysis')
        d.find(rid='video-analysis-import-button')
        self.record('video_analysis')
        time.sleep(1.5)
        d.mark('list')
        d.tap_el(rid='video-analysis-import-button', settle=3)
        if 'documentsui' not in d.focus():
            raise CaptureError(f'video picker did not open: {d.focus()}')
        clip = d.find(text=re.escape(DEMO_CLIP), timeout=5, required=False)
        if clip is None:
            d.sh('input swipe 15 800 560 800 300')
            time.sleep(1.5)
            d.tap(*d.find(text='Downloads').center, guard=False)
            time.sleep(2)
            clip = d.find(text=re.escape(DEMO_CLIP))
        d.mark('picker')
        time.sleep(1)
        d.tap(*clip.center, guard=False)
        time.sleep(2)
        d.ensure_app_foreground()
        d.mark('analysing')
        d.find(rid='video-analysis-row-\\d+', desc='Unknown Exercise.*Done', timeout=180)
        d.mark('done')
        time.sleep(1.5)
        row = d.find(rid='video-analysis-row-\\d+', desc='Unknown Exercise.*Done')
        row_id = row.rid.rsplit('-', 1)[1]
        d.tap_el(rid=f'video-analysis-link-set-{row_id}', settle=2)
        d.find(text='Select a Set')
        target = None
        for _ in range(5):
            target = d.find(text='5 reps × 175 kg.*', timeout=1, required=False)
            if target and target.center[1] < 1250:
                break
            d.swipe(360, 1150, 360, 650, 700, 1.2)
        nodes = d.dump()
        target = d.find(text='5 reps × 175 kg.*', nodes=nodes)
        link = min((n for n in nodes if n.rid.startswith('set-selection-link-') and not n.rid.endswith('container')),
                   key=lambda n: abs(n.center[1] - target.center[1]))
        d.mark('link')
        d.tap(*link.center)
        time.sleep(2)
        d.mark('linked')
        d.tap_el(rid=f'video-analysis-row-{row_id}', settle=3)
        d.mark('detail')
        self.scroll_player_into_view()
        d.mark('player')
        d.tap_el(rid='video-analysis-playback-toggle', settle=0.2)
        d.mark('play')
        time.sleep(9)
        d.swipe(700, 1250, 700, 300, 1200, 2)
        d.mark('summary')
        time.sleep(2.5)
        d.swipe(700, 1250, 700, 500, 1200, 2)
        d.mark('chart')
        time.sleep(3)
        self.stop('video_analysis')
        self.video_analysis_shots()

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
        """Paused frame in rep 3: seek with the scrubber (playing after a theme switch
        leaves the video surface blank until the next seek)."""
        d = self.d
        self.scroll_player_into_view(from_top=True)
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
            d.tap(bar.x1 + 0.485 * bar.width, bar.center[1])
            time.sleep(1.5)
            thumb = d.find(rid='video-analysis-playback-scrubber-thumb')
            if thumb.x1 > bar.x1 + 0.3 * bar.width:
                break
        else:
            raise CaptureError(f'seek did not move the scrubber: {thumb}')
        for _ in range(swiped):
            d.swipe(700, 700, 700, 1000, 1500, 1.2)
        time.sleep(1)
        d.find(rid='video-analysis-playback-current-rep', text='Rep \\d')
        self.shot('video_analysis', theme)

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
        self.shot('customize_muscles', 'dark')
        d.tap_el(rid='edit-exercise-cancel', settle=1.5)
        self.set_theme('light')
        self.tab('exercises', settle=2)
        d.tap_el(rid='exercise-detail-edit-button', settle=2)
        self.drag_muscles(record=False)
        self.shot('customize_muscles', 'light')
        d.tap_el(rid='edit-exercise-cancel', settle=1.5)
        self.set_theme('dark')

    def drag_muscles(self, record=True):
        d = self.d
        for muscle, start, end in (('Core', 0.30, 0.55), ('Back', 0.0, 0.25), ('Hamstrings', 0.50, 0.70)):
            bar = d.find(rid=f'muscle-bar-{muscle}')
            y = bar.center[1]
            x1 = bar.x1 + max(start, 0.02) * bar.width
            d.drag_line(x1, y, bar.x1 + end * bar.width, y, steps=14, step_s=0.04)
            if record:
                d.mark(muscle.lower())
            time.sleep(0.8)

    def analysis(self):
        d = self.d
        log('analysis: dashboard, records, graphs')
        self.analyse_screen('Dashboard')
        self.scroll_top()
        self.record('analysis')
        time.sleep(2.5)
        d.mark('dashboard')
        d.swipe(690, 1150, 690, 650, 1200, 1.5)
        d.mark('dashboard_scrolled')
        time.sleep(1)
        d.tap_el(rid='analyse-drawer-toggle', settle=1.2)
        d.tap_el(text='Records', settle=0.5)
        d.mark('records')
        time.sleep(3)
        d.tap_el(rid='analyse-drawer-toggle', settle=1.2)
        d.tap_el(text='Analysis', settle=0.5)
        d.mark('graphs')
        time.sleep(3)
        self.stop('analysis')
        for theme in ('dark', 'light'):
            if theme == 'light':
                self.set_theme('light')
            self.analyse_screen('Dashboard')
            self.scroll_top()
            self.shot('analysis', theme)
            d.tap_el(rid='analyse-drawer-toggle', settle=1.2)
            d.tap_el(text='Records', settle=3)
            self.shot('analysis_records', theme)
        self.set_theme('dark')

    def ai_chat(self):
        d = self.d
        log('ai_chat')
        mock = None
        patched = False
        try:
            if not self.args.ai_key:
                mock = subprocess.Popen([sys.executable, str(MARKETING / 'scripts/mock_ai_server.py'),
                                         '--port', str(MOCK_PORT)])
                source = CHAT_FILE.read_text()
                if CHAT_URL not in source:
                    raise CaptureError('sendChatMessage.ts changed - update CHAT_URL in capture.py')
                CHAT_FILE.write_text(source.replace(
                    CHAT_URL, f"const ANTHROPIC_MESSAGES_URL = 'http://localhost:{MOCK_PORT}/v1/messages';"))
                patched = True
                d.adb('reverse', f'tcp:{MOCK_PORT}', f'tcp:{MOCK_PORT}')
                time.sleep(2)
                self.restart_app()
            self.save_api_key(self.args.ai_key or 'sk-ant-demo-local-mock')
            self.analyse_screen('AI Chat')
            if d.exists(rid='chat-message-list') and d.find(rid='chat-clear-button', timeout=2, required=False):
                pass
            d.find(rid='chat-input')
            self.record('ai_chat')
            time.sleep(1.5)
            d.mark('empty')
            d.tap_el(rid='chat-input', settle=1)
            words = QUESTION.split(' ')
            for i in range(0, len(words), 3):
                d.text_input(' '.join(words[i:i + 3]) + (' ' if i + 3 < len(words) else ''))
                time.sleep(0.25)
            d.mark('typed')
            time.sleep(0.8)
            d.tap_el(rid='chat-send-button', settle=0.3)
            d.mark('sent')
            d.hide_keyboard()
            d.find(text='.*trending up.*' if not self.args.ai_key else '.{40,}', timeout=120)
            d.mark('reply')
            time.sleep(3)
            d.swipe(690, 1100, 690, 700, 1500, 1.5)
            d.mark('reply_scrolled')
            time.sleep(2.5)
            self.stop('ai_chat')
        finally:
            if patched:
                CHAT_FILE.write_text(CHAT_FILE.read_text().replace(
                    f"const ANTHROPIC_MESSAGES_URL = 'http://localhost:{MOCK_PORT}/v1/messages';", CHAT_URL))
                log('  reverted the temporary chat URL patch')
            if mock:
                mock.terminate()
        for theme in ('dark', 'light'):
            if theme == 'light':
                self.set_theme('light')
                self.tab('analyse', settle=2)
            for _ in range(2):  # show the question above the answer
                d.swipe(360, 450, 360, 1100, 700, 1.0)
            self.shot('ai_chat', theme)
        self.set_theme('dark')

    def save_api_key(self, key):
        d = self.d
        self.settings_top()
        accordion = self.scroll_to(rid='settings-ai-config-accordion')
        if not d.exists(rid='settings-anthropic-api-key-input'):
            d.tap(*accordion.center)
            time.sleep(1.5)
        field = self.scroll_to(rid='settings-anthropic-api-key-input')
        d.tap(*field.center)
        time.sleep(1)
        d.text_input(key)
        d.hide_keyboard()
        d.tap_el(rid='settings-save-api-key-button', settle=1.5)

    def teardown(self):
        d = self.d
        log('teardown: restore phone settings')
        d.sh('am broadcast -a com.android.systemui.demo -e command exit', check=False)
        d.sh('cmd notification set_dnd off', check=False)
        d.sh('settings put system accelerometer_rotation 1', check=False)
        d.adb('reverse', '--remove', f'tcp:{MOCK_PORT}', check=False)
        if git_dirty_chat_file():
            raise CaptureError('app/utils/ai/sendChatMessage.ts is still modified - restore it!')
        if self.dev_mode_changed or (BUILD / 'js_dev_mode_changed').exists():
            log('  switching JS Dev Mode back on')
            self.toggle_js_dev_mode()
            (BUILD / 'js_dev_mode_changed').unlink(missing_ok=True)
        self.restart_app()  # the device must run the unpatched bundle again


def git_dirty_chat_file():
    out = subprocess.run(['git', 'status', '--porcelain', str(CHAT_FILE)], cwd=REPO, capture_output=True, text=True)
    return bool(out.stdout.strip())


SCENES = ['setup', 'training', 'video_analysis', 'customize', 'analysis', 'ai_chat', 'teardown']


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--serial', default=os.environ.get('ANDROID_SERIAL'), required=not os.environ.get('ANDROID_SERIAL'))
    parser.add_argument('--scenes', default='all', help='comma-separated subset of: ' + ', '.join(SCENES))
    parser.add_argument('--metro-port', default=os.environ.get('E2E_METRO_PORT'),
                        help='host Metro port to reverse device port 8081 to (debug builds)')
    parser.add_argument('--release-build', action='store_true', help='app is a release build (no dev menu)')
    parser.add_argument('--ai-key', default=os.environ.get('GAINALYTICS_DEMO_AI_KEY'),
                        help='real Anthropic key for a real chat answer (default: local mock server)')
    args = parser.parse_args()
    scenes = SCENES if args.scenes == 'all' else args.scenes.split(',')
    for folder in (SCREENS, VIDEO):
        folder.mkdir(parents=True, exist_ok=True)
    cap = Capture(args)
    for scene in scenes:
        t0 = time.time()
        getattr(cap, scene)()
        log(f'== {scene} done in {time.time() - t0:.0f}s')


if __name__ == '__main__':
    main()
