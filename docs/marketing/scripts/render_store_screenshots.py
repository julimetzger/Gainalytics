#!/usr/bin/env python3
"""Turn the raw device screenshots into store-ready images (GH-485, GH-665).

    python3 docs/marketing/scripts/render_store_screenshots.py

Input:  docs/marketing/captures/screens/<feature>_<light|dark>.png  (from capture.py)
Output: docs/marketing/screenshots/<nn>-<feature>-<light|dark>.png  1080x1920, RGB (no alpha)
        docs/marketing/feature-graphic.png                          1024x500, RGB (no alpha)

Each screenshot gets a headline, a short line of copy and the screenshot in a neutral
phone frame. The status bar is repainted (9:41, no notification icons) and the
system navigation bar is cropped. The order puts the strongest features first.
"""
import pathlib

from PIL import Image, ImageDraw

from compose import (BRAND_BLUE, BRAND_BLUE_DEEP, PhoneFrame, app_icon, clean_screen, font, glow,
                     vertical_gradient)

REPO = pathlib.Path(__file__).resolve().parents[3]
SRC = REPO / 'docs/marketing/captures/screens'
OUT = REPO / 'docs/marketing/screenshots'
FEATURE_GRAPHIC = REPO / 'docs/marketing/feature-graphic.png'
W, H = 1080, 1920

SHOTS = [
    ('video_analysis', 'Video analysis', 'Bar path, reps and velocity -\nstraight from your lift video'),
    ('plan_ai', 'Plan with AI', 'Say what to change today -\nthe session is planned for you'),
    ('coach_insight', 'Coach Insight', 'An AI review of every session,\nbuilt on your own numbers'),
    ('customize_settings', 'Make it yours', 'Light or dark, and any\naccent colour you like'),
    ('training', 'Training', 'Log sets in seconds - with rest\ntimer and live 1RM estimate'),
    ('analysis', 'Analysis', 'Filter by period, exercise\nand muscle group'),
    ('ai_chat', 'AI coach', 'Ask about your training -\nwith sleep and steps included'),
    ('analysis_records', 'Records', 'Every PR on a heatmap -\nsee your best weeks'),
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


def feature_graphic():
    """1024x500 Play Store feature graphic: name and tagline left, three tilted phones right."""
    fw, fh = 1024, 500
    canvas = vertical_gradient((fw, fh), (8, 11, 22), (20, 28, 52)).convert('RGBA')
    blob = glow((900, 900), (70, 110, 220), 0.45)
    canvas.alpha_composite(blob, (-330, -330))
    blob = glow((700, 700), (120, 80, 220), 0.25)
    canvas.alpha_composite(blob, (560, -120))

    icon = app_icon(96)
    canvas.alpha_composite(icon, (64, 118))
    draw = ImageDraw.Draw(canvas)
    draw.text((64, 236), 'Gainalytics', font=font('black', 74), fill=(246, 248, 255), anchor='la')
    draw.text((66, 330), 'Plan. Train. Analyse.', font=font('regular', 32), fill=(170, 184, 214), anchor='la')
    draw.text((66, 382), 'Video analysis · AI coach', font=font('semibold', 24), fill=BRAND_BLUE, anchor='la')

    phone = PhoneFrame(190, 401)
    for name, cx, cy, angle in (('analysis_dark', 640, 330, 8), ('plan_ai_light', 935, 330, -8),
                                ('video_analysis_dark', 790, 292, 0)):
        img = phone.render(clean_screen(Image.open(SRC / f'{name}.png')))
        img = img.rotate(angle, resample=Image.BICUBIC, expand=True)
        shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
        shadow.putalpha(img.getchannel('A').point(lambda v: v * 0.45))
        canvas.alpha_composite(shadow, (int(cx - img.width / 2 + 6), int(cy - img.height / 2 + 14)))
        canvas.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))
    return canvas.convert('RGB')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    wanted = set()
    for index, (feature, title, body) in enumerate(SHOTS, start=1):
        for theme in ('light', 'dark'):
            out = OUT / f'{index:02d}-{feature.replace("_", "-")}-{theme}.png'
            wanted.add(out)
            if not (SRC / f'{feature}_{theme}.png').exists():
                raise SystemExit(f'missing capture {feature}_{theme}.png - run capture.py first')
            render(feature, title, body, theme).save(out, optimize=True)
            print(f'wrote {out.relative_to(REPO)}')
    for stale in OUT.glob('*.png'):  # e.g. a feature that left the list
        if stale not in wanted:
            stale.unlink()
            print(f'removed {stale.relative_to(REPO)}')
    feature_graphic().save(FEATURE_GRAPHIC, optimize=True)
    print(f'wrote {FEATURE_GRAPHIC.relative_to(REPO)}')


if __name__ == '__main__':
    main()
