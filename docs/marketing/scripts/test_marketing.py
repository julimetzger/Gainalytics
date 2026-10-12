#!/usr/bin/env python3
"""Checks the GH-485 deliverables against the ticket's spec.

    python3 -m unittest discover -s docs/marketing/scripts -p 'test_*.py' -v
"""
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import make_demo_fixture  # noqa: E402
from compose import NAV_BAR_TOP, STATUS_BAR_H, clean_screen  # noqa: E402

MARKETING = pathlib.Path(__file__).resolve().parents[1]
FEATURES = ['video-analysis', 'customize-settings', 'customize-muscles', 'training', 'plan', 'analysis',
            'analysis-records', 'ai-chat']


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
                          'stream=codec_type,codec_name,width,height,r_frame_rate:format=duration',
                          '-of', 'json', str(path)], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


class PromoVideo(unittest.TestCase):
    def test_is_1080p_16_9_between_30_and_60_seconds_without_audio(self):
        info = probe(MARKETING / 'gainalytics-promo.mp4')
        kinds = [s['codec_type'] for s in info['streams']]
        self.assertEqual(kinds, ['video'], 'exactly one video stream and no audio')
        video = info['streams'][0]
        self.assertEqual((video['width'], video['height']), (1920, 1080))
        self.assertEqual(video['codec_name'], 'h264')
        self.assertEqual(video['r_frame_rate'], '30/1')
        self.assertTrue(30 <= float(info['format']['duration']) <= 60, info['format']['duration'])

    def test_every_cut_refers_to_a_recorded_marker(self):
        markers = json.loads((MARKETING / 'captures/markers.json').read_text())
        for scene in ('training', 'video_analysis', 'custom_settings', 'custom_muscles', 'analysis', 'ai_chat'):
            self.assertIn(scene, markers)
            self.assertTrue((MARKETING / f'captures/video/{scene}.mp4').exists(), scene)
        source = (MARKETING / 'scripts/render_video.py').read_text()
        import re
        for clip, ref in re.findall(r"\('(\w+)', '([a-z_]+)[^']*'", source):
            if clip in markers:
                self.assertIn(ref, markers[clip], f'{clip}: marker {ref} missing')


class StoreScreenshots(unittest.TestCase):
    def test_all_features_exist_in_light_and_dark_as_1080x1920_rgb(self):
        files = sorted((MARKETING / 'screenshots').glob('*.png'))
        self.assertEqual(len(files), 2 * len(FEATURES))
        for index, feature in enumerate(FEATURES, start=1):
            for theme in ('light', 'dark'):
                path = MARKETING / 'screenshots' / f'{index:02d}-{feature}-{theme}.png'
                self.assertTrue(path.exists(), path.name)
                with Image.open(path) as img:
                    self.assertEqual(img.size, (1080, 1920), path.name)
                    self.assertEqual(img.mode, 'RGB', f'{path.name} must not carry alpha')

    def test_light_and_dark_captures_really_differ_in_theme(self):
        for feature in ('training', 'plan', 'analysis', 'ai_chat', 'customize_muscles'):
            dark = Image.open(MARKETING / f'captures/screens/{feature}_dark.png').convert('L')
            light = Image.open(MARKETING / f'captures/screens/{feature}_light.png').convert('L')
            mean = lambda im: sum(im.resize((36, 80)).getdata()) / (36 * 80)  # noqa: E731
            self.assertGreater(mean(light) - mean(dark), 60, feature)


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
            import time
            age_days = (time.time() * 1000 - make_demo_fixture.newest_training_end(data)) / 86400000
            self.assertAlmostEqual(age_days, 2, delta=0.01)
            self.assertEqual(data['videoAnalyses'], {'byId': {}, 'allIds': []})
            baseline = json.loads(make_demo_fixture.BASELINE.read_text())
            self.assertEqual(len(data['trainings']['allIds']), len(baseline['trainings']['allIds']))
            self.assertEqual(data['exercises'], baseline['exercises'])


if __name__ == '__main__':
    unittest.main()
