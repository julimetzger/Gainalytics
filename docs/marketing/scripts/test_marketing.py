#!/usr/bin/env python3
"""Checks the GH-485 / GH-665 deliverables against the ticket's spec.

    python3 -m unittest discover -s docs/marketing/scripts -p 'test_*.py' -v
"""
import json
import pathlib
import subprocess
import sys
import tempfile
import time
import unittest

from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import make_demo_fixture  # noqa: E402
import render_store_screenshots  # noqa: E402
import render_video  # noqa: E402
from compose import NAV_BAR_TOP, STATUS_BAR_H, PhoneFrame, clean_screen  # noqa: E402

MARKETING = pathlib.Path(__file__).resolve().parents[1]
FORMATS = {'16x9': (1920, 1080), '9x16': (1080, 1920), '1x1': (1080, 1080)}
SCENES = ('training', 'coach_insight', 'video_analysis', 'video_analysis_detail', 'custom_settings', 'custom_muscles', 'analysis', 'ai_chat')


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
                          'stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate:format=duration',
                          '-of', 'json', str(path)], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def markers():
    return json.loads((MARKETING / 'captures/markers.json').read_text())


class PromoVideo(unittest.TestCase):
    def test_three_formats_h264_30fps_30_to_60_seconds_without_audio(self):
        for name, size in FORMATS.items():
            with self.subTest(name):
                info = probe(MARKETING / f'video/gainalytics-promo-{name}.mp4')
                kinds = [s['codec_type'] for s in info['streams']]
                self.assertEqual(kinds, ['video'], 'exactly one video stream and no audio')
                video = info['streams'][0]
                self.assertEqual((video['width'], video['height']), size)
                self.assertEqual(video['codec_name'], 'h264')
                self.assertEqual(video['r_frame_rate'], '30/1')
                self.assertEqual(video['avg_frame_rate'], '30/1')
                self.assertTrue(30 <= float(info['format']['duration']) <= 60, info['format']['duration'])

    def test_the_old_single_16_9_video_is_gone(self):
        self.assertFalse((MARKETING / 'gainalytics-promo.mp4').exists())
        self.assertEqual(sorted(p.name for p in (MARKETING / 'video').glob('*.mp4')),
                         sorted(f'gainalytics-promo-{n}.mp4' for n in FORMATS))

    def test_every_cut_refers_to_a_recorded_marker_and_is_not_empty(self):
        m = markers()
        for scene in SCENES:
            self.assertIn(scene, m)
            self.assertTrue((MARKETING / f'captures/video/{scene}.mp4').exists(), scene)
        for feature in render_video.FEATURES:
            with self.subTest(feature['key']):
                footage = render_video.Footage(m, feature['footage'])  # raises on a missing marker / empty cut
                self.assertGreater(footage.duration, 1.0)
                for part, _, _ in feature['bullets']:
                    self.assertLess(part, len(footage.parts))

    def test_recordings_keep_their_frame_times(self):
        """Re-encoding must not round screenrecord's frame times (frames sharing a time are
        dropped by the 30 fps renderer: the footage would stutter)."""
        for scene in SCENES:
            with self.subTest(scene):
                out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                      'packet=pts_time', '-of', 'csv=p=0',
                                      str(MARKETING / f'captures/video/{scene}.mp4')],
                                     capture_output=True, text=True, check=True).stdout
                times = [float(v.strip(',')) for v in out.split() if v.strip(',') not in ('', 'N/A')]
                self.assertGreater(len(times), 30)
                self.assertGreaterEqual(len({round(t, 4) for t in times}) / len(times), 0.98)

    def test_the_storyboard_shows_every_main_feature(self):
        keys = [f['key'] for f in render_video.FEATURES]
        self.assertEqual(keys[:2], ['video-analysis', 'customization'], 'focus scenes first')
        for key in ('plan-with-ai', 'training', 'coach-insight', 'analysis', 'ai-chat'):
            self.assertIn(key, keys)
        copy = json.dumps(render_video.FEATURES)
        for words in ('Sleep and steps', 'Filter by period', 'record', 'Muscle involvement', 'accent colour'):
            self.assertIn(words, copy)
        clips = {seg[0] for f in render_video.FEATURES for seg in f['footage']}
        self.assertEqual(clips, set(SCENES))

    def test_each_format_lays_out_copy_and_phone_inside_the_frame_without_overlap(self):
        for name, layout in render_video.LAYOUTS.items():
            with self.subTest(name):
                w, h = layout.size
                self.assertEqual(layout.size, FORMATS[name])
                phone = PhoneFrame(round(layout.phone_h * 720 / 1520), layout.phone_h)
                cx, cy = layout.phone_xy
                box = (cx - phone.w / 2, cy - phone.h / 2, cx + phone.w / 2, cy + phone.h / 2)
                self.assertGreaterEqual(box[0], 0)
                self.assertGreaterEqual(box[1], 0)
                self.assertLessEqual(box[2], w)
                self.assertLessEqual(box[3], h)
                x, y = layout.text_xy
                if layout.mode == 'side':
                    self.assertLessEqual(x + layout.text_w, box[0] + 10, 'copy column ends left of the phone')
                else:
                    copy_bottom = y + layout.kicker * 1.7 + layout.title * 1.32 + layout.bullet * 2.7 + 7
                    self.assertLessEqual(copy_bottom, box[1], 'copy ends above the phone')

    def test_every_title_and_bullet_fits_its_format(self):
        for name, layout in render_video.LAYOUTS.items():
            for feature in render_video.FEATURES:
                with self.subTest(f'{name} {feature["key"]}'):
                    title_font = render_video.font('black', layout.title)
                    lines = render_video.wrap(feature['title'], title_font, layout.text_w)
                    self.assertLessEqual(len(lines), 2 if layout.mode == 'side' else 1)
                    for line in lines:
                        self.assertLessEqual(title_font.getlength(line), layout.text_w + 4)
                    bullet_font = render_video.font('regular', layout.bullet)
                    for _, _, value in feature['bullets']:
                        self.assertLessEqual(len(render_video.wrap(value, bullet_font, layout.text_w)), 2, value)


class StoreScreenshots(unittest.TestCase):
    def test_4_to_8_features_in_light_and_dark_as_1080x1920_rgb(self):
        shots = render_store_screenshots.SHOTS
        self.assertTrue(4 <= len(shots) <= 8)
        self.assertEqual(shots[0][0], 'video_analysis', 'strongest feature first')
        files = sorted((MARKETING / 'screenshots').glob('*.png'))
        self.assertEqual(len(files), 2 * len(shots), 'no stale screenshots left')
        for index, (feature, _, _) in enumerate(shots, start=1):
            for theme in ('light', 'dark'):
                path = MARKETING / 'screenshots' / f'{index:02d}-{feature.replace("_", "-")}-{theme}.png'
                self.assertTrue(path.exists(), path.name)
                with Image.open(path) as img:
                    self.assertEqual(img.size, (1080, 1920), path.name)
                    self.assertEqual(img.mode, 'RGB', f'{path.name} must not carry alpha')

    def test_the_new_ui_is_in_the_shots(self):
        names = [s[0] for s in render_store_screenshots.SHOTS]
        for feature in ('analysis', 'plan_ai', 'coach_insight', 'ai_chat'):
            self.assertIn(feature, names)

    def test_feature_graphic_is_1024x500_without_alpha(self):
        with Image.open(MARKETING / 'feature-graphic.png') as img:
            self.assertEqual(img.size, (1024, 500))
            self.assertEqual(img.mode, 'RGB')

    def test_light_and_dark_captures_really_differ_in_theme(self):
        for feature, _, _ in render_store_screenshots.SHOTS:
            with self.subTest(feature):
                dark = Image.open(MARKETING / f'captures/screens/{feature}_dark.png').convert('L')
                light = Image.open(MARKETING / f'captures/screens/{feature}_light.png').convert('L')
                mean = lambda im: sum(im.resize((36, 80)).getdata()) / (36 * 80)  # noqa: E731
                self.assertGreater(mean(light) - mean(dark), 40, feature)

    def test_raw_captures_are_from_the_same_run(self):
        """No screen of an older capture run is left over (all captures within a few hours)."""
        m = markers()
        self.assertIn('captured_at', m)
        files = list((MARKETING / 'captures/screens').glob('*.png'))
        used = {f'{s[0]}_{t}.png' for s in render_store_screenshots.SHOTS for t in ('light', 'dark')}
        used |= {f'{n}.png' for n in render_video.FAN}
        self.assertEqual({p.name for p in files}, used, 'only screens that are used, all from capture.py')


class StatusBarCleanup(unittest.TestCase):
    def test_status_bar_is_repainted_and_nav_bar_cropped(self):
        raw = Image.new('RGB', (720, 1600), (17, 19, 24))
        raw.paste((255, 0, 0), (40, 10, 200, 40))  # a "notification icon" in the status bar
        out = clean_screen(raw)
        self.assertEqual(out.size, (720, NAV_BAR_TOP))
        reds = [p for p in out.crop((0, 0, 720, STATUS_BAR_H)).getdata() if p[0] > 200 and p[1] < 60]
        self.assertEqual(reds, [], 'status bar content must be replaced')


class DemoFixture(unittest.TestCase):
    def test_newest_training_is_moved_to_the_requested_age_and_seeded_analyses_dropped(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp) / 'demo.gains'
            subprocess.run([sys.executable, str(MARKETING / 'scripts/make_demo_fixture.py'), '--out', str(out),
                            '--days-ago', '2'], check=True, capture_output=True)
            data = json.loads(out.read_text())
            age_days = (time.time() * 1000 - make_demo_fixture.newest_training_end(data)) / 86400000
            self.assertAlmostEqual(age_days, 2, delta=0.01)
            self.assertEqual(data['videoAnalyses'], {'byId': {}, 'allIds': []})
            baseline = json.loads(make_demo_fixture.BASELINE.read_text())
            self.assertEqual(len(data['trainings']['allIds']), len(baseline['trainings']['allIds']))
            self.assertEqual(data['exercises'], baseline['exercises'])

    def test_add_set_puts_a_linkable_workout_into_the_second_newest_training(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp) / 'demo.gains'
            subprocess.run([sys.executable, str(MARKETING / 'scripts/make_demo_fixture.py'), '--out', str(out),
                            '--add-set', 'Deadlift:200x3@3'], check=True, capture_output=True)
            data = json.loads(out.read_text())
            newest_id = max(data['workouts']['allIds'])  # the link dialog lists the newest ids first
            workout = data['workouts']['byId'][str(newest_id)]
            self.assertEqual(workout['sets'], [dict(workout['sets'][0], weight=200, reps=3, rir=3)])
            self.assertEqual(data['exercises']['byId'][str(workout['exerciseId'])]['name'], 'Deadlift')
            done = sorted((t for t in data['trainings']['byId'].values() if t['state'] == 'F'), key=lambda t: t['end'])
            self.assertEqual(workout['trainingsId'], done[-2]['id'])
            self.assertEqual(done[-2]['doneWorkoutIds'][str(workout['exerciseId'])], newest_id)
            self.assertNotIn(newest_id, done[-1]['doneWorkoutIds'].values(), 'last training (the suggestion) unchanged')


class PrivateMaterial(unittest.TestCase):
    """The owner's gallery clip and the real API key must never be committed."""

    def tracked(self):
        out = subprocess.run(['git', 'ls-files', '.'], cwd=MARKETING, capture_output=True, text=True,
                             check=True)
        return [MARKETING / line for line in out.stdout.splitlines()]  # relative to cwd

    def test_no_gallery_clip_and_no_api_key_in_the_repo(self):
        import capture
        for path in self.tracked():
            for clip in capture.VA_CLIPS:
                self.assertNotEqual(path.name, clip)
            if path.suffix in ('.py', '.md', '.json', '.txt') and path.exists():
                self.assertNotRegex(path.read_text(errors='ignore'), r'sk-ant-api\d\d-', path.name)

    def test_the_file_picker_is_blacked_out_in_the_committed_recording(self):
        """Every frame from the import tap until the app is back (the picker in between) is black."""
        m = markers()['video_analysis']
        frames = subprocess.run(['ffmpeg', '-loglevel', 'quiet', '-i', str(MARKETING / 'captures/video/video_analysis.mp4'),
                                 '-vf', f"select='between(t,{m['import']:.2f},{m['analysing'] - 0.05:.2f})',scale=36:80",
                                 '-vsync', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
                                capture_output=True, check=True).stdout
        size = 36 * 80
        self.assertGreater(len(frames) // size, 10, 'the picker part has frames')
        for i in range(len(frames) // size):
            self.assertLess(max(frames[i * size:(i + 1) * size]), 24, f'picker frame {i} must be black')


if __name__ == '__main__':
    unittest.main()
