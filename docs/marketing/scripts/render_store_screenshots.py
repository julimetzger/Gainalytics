#!/usr/bin/env python3
"""Turn the raw device screenshots into store-ready images (GH-485).

    python3 docs/marketing/scripts/render_store_screenshots.py

Input:  docs/marketing/captures/screens/<feature>_<light|dark>.png  (from capture.py)
Output: docs/marketing/screenshots/<nn>-<feature>-<light|dark>.png  1080x1920, RGB (no alpha)

Each image gets a headline, a short line of copy and the screenshot in a neutral
phone frame. The status bar is repainted (9:41, no notification icons) and the
system navigation bar is cropped.
"""
import pathlib

from PIL import Image, ImageDraw

from compose import BRAND_BLUE, BRAND_BLUE_DEEP, PhoneFrame, clean_screen, font, glow, vertical_gradient

REPO = pathlib.Path(__file__).resolve().parents[3]
SRC = REPO / 'docs/marketing/captures/screens'
OUT = REPO / 'docs/marketing/screenshots'
W, H = 1080, 1920

SHOTS = [
    ('video_analysis', 'Video analysis', 'Bar path, reps and velocity -\nstraight from your lift video'),
    ('customize_settings', 'Make it yours', 'Light or dark, and any\naccent colour you like'),
    ('customize_muscles', 'Your muscles, your rules', 'Set how much each exercise\nworks every muscle group'),
    ('training', 'Training', 'Log sets in seconds - with rest\ntimer and live 1RM estimate'),
    ('plan', 'Plan', 'Mesos, micros and progression,\nsuggested from your last session'),
    ('analysis', 'Analysis', 'Your week, muscle groups\nand top lifts at a glance'),
    ('analysis_records', 'Records', 'Every PR on a heatmap -\nsee your best weeks'),
    ('ai_chat', 'AI coach', 'Ask about your training -\nanswers built on your own data'),
]

THEMES = {
    'dark': dict(top=(10, 14, 26), bottom=(22, 30, 54), title=(246, 248, 255), body=(176, 190, 222),
                 accent=BRAND_BLUE, glow=(90, 130, 230), glow_alpha=0.35),
    'light': dict(top=(244, 247, 255), bottom=(214, 225, 252), title=(16, 22, 40), body=(66, 80, 112),
                  accent=BRAND_BLUE_DEEP, glow=(150, 180, 255), glow_alpha=0.55),
}


def render(feature, title, body, theme):
    t = THEMES[theme]
    canvas = vertical_gradient((W, H), t['top'], t['bottom'])
    blob = glow((1400, 1400), t['glow'], t['glow_alpha'])
    canvas.paste(blob, (-160, 520), blob)

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((W / 2 - 40, 92, W / 2 + 40, 100), radius=4, fill=t['accent'])
    draw.text((W / 2, 128), title, font=font('black', 86), fill=t['title'], anchor='ma')
    draw.multiline_text((W / 2, 246), body, font=font('regular', 44), fill=t['body'], anchor='ma',
                        align='center', spacing=14)

    screen = clean_screen(Image.open(SRC / f'{feature}_{theme}.png'))
    screen_h = 1440
    phone = PhoneFrame(round(screen.width * screen_h / screen.height), screen_h)
    phone.paste(canvas, screen, (W - phone.w) / 2, 410)
    return canvas


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for index, (feature, title, body) in enumerate(SHOTS, start=1):
        for theme in ('light', 'dark'):
            if not (SRC / f'{feature}_{theme}.png').exists():
                print(f'missing capture {feature}_{theme}.png - run capture.py first')
                continue
            out = OUT / f'{index:02d}-{feature.replace("_", "-")}-{theme}.png'
            render(feature, title, body, theme).save(out, optimize=True)
            print(f'wrote {out.relative_to(REPO)}')


if __name__ == '__main__':
    main()
