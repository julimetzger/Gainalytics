#!/usr/bin/env python3
"""Render the Gainalytics promo video (GH-485) from the committed captures.

    python3 docs/marketing/scripts/render_video.py [--out docs/marketing/gainalytics-promo.mp4]
                                                   [--stills DIR] [--preview SECONDS]

1920x1080, 30 fps, H.264, no audio. Every cut is defined relative to the event
markers that capture.py wrote (docs/marketing/captures/markers.json), so a fresh
capture after UI changes re-renders without touching this file.

Storyboard (about 52 s):
  1. Intro            app icon, name, tagline
  2. Video analysis   import -> analysis -> bar-path overlay playing -> rep table / VL chart
  3. Customization    light/dark, colour wheel -> recoloured app, muscle involvement editor
  4. Built in         training, plan, analysis, AI coach side by side
  5. Overall look     fan of light and dark screens, outro
"""
import argparse
import json
import math
import pathlib
import subprocess
import sys

from PIL import Image, ImageDraw

from compose import (ACCENT_ORANGE, BRAND_BLUE, NAV_BAR_TOP, PhoneFrame, app_icon, clean_screen, font, glow,
                     vertical_gradient)

REPO = pathlib.Path(__file__).resolve().parents[3]
CAPTURES = REPO / 'docs/marketing/captures'
W, H, FPS = 1920, 1080, 30
WHITE = (246, 248, 255)
MUTED = (170, 184, 214)


# ── easing / timing helpers ───────────────────────────────────────────────────
def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def ease(p):
    p = clamp(p)
    return p * p * (3 - 2 * p)


def ease_out(p):
    p = clamp(p)
    return 1 - (1 - p) ** 3


def window(t, t_in, t_out, fade=0.4):
    """0 -> 1 between t_in and t_in+fade, 1 -> 0 between t_out-fade and t_out."""
    return ease((t - t_in) / fade) * (1 - ease((t - (t_out - fade)) / fade))


def mix(a, b, p):
    return tuple(round(x + (y - x) * p) for x, y in zip(a, b))


# ── source footage ────────────────────────────────────────────────────────────
class Reader:
    """Sequential 30 fps reader for one time range of a screen recording."""

    def __init__(self, path, start):
        self.start = start
        self.proc = subprocess.Popen(
            ['ffmpeg', '-loglevel', 'error', '-ss', f'{start:.3f}', '-i', str(path), '-vf', f'fps={FPS}',
             '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
        self.w, self.h = 720, 1600
        self.index = -1
        self.frame = None

    def at(self, src_t):
        target = max(0, round((src_t - self.start) * FPS))
        while self.index < target:
            raw = self.proc.stdout.read(self.w * self.h * 3)
            if len(raw) < self.w * self.h * 3:
                break  # recording ended (static tail) - keep the last frame
            self.index += 1
            self.frame = raw
        if self.frame is None:
            raise RuntimeError('no frames decoded')
        return clean_screen(Image.frombytes('RGB', (self.w, self.h), self.frame))

    def close(self):
        if self.proc.poll() is None:
            self.proc.stdout.close()
            self.proc.kill()
            self.proc.wait()


class Footage:
    """A list of (clip, from_marker_or_seconds, to, speed) segments played back to back.
    speed may also be a target length such as '3s' (e.g. for a wait of unknown length)."""

    def __init__(self, markers, segments):
        self.parts = []
        t = 0.0
        for clip, a, b, speed in segments:
            src_a = self.resolve(markers, clip, a)
            src_b = self.resolve(markers, clip, b)
            if isinstance(speed, str):
                speed = (src_b - src_a) / float(speed.rstrip('s'))
            dur = (src_b - src_a) / speed
            self.parts.append(dict(clip=clip, src_a=src_a, speed=speed, t0=t, t1=t + dur, reader=None))
            t += dur
        self.duration = t

    @staticmethod
    def resolve(markers, clip, ref):
        if isinstance(ref, (int, float)):
            return float(ref)
        name, _, offset = ref.partition('+') if '+' in ref else ref.partition('-')
        value = markers[clip][name.strip()]
        if offset:
            value += float(offset) if '+' in ref else -float(offset)
        return value

    def at(self, t):
        t = clamp(t, 0, self.duration - 1e-3)
        for index, part in enumerate(self.parts):
            if t < part['t1']:
                if index and self.parts[index - 1]['reader'] is not None:
                    self.parts[index - 1]['reader'].close()
                if part['reader'] is None:
                    part['reader'] = Reader(CAPTURES / 'video' / f"{part['clip']}.mp4", part['src_a'])
                img = part['reader'].at(part['src_a'] + (t - part['t0']) * part['speed'])
                part['last'] = img
                prev = self.parts[index - 1].get('last') if index else None
                if prev is not None and t - part['t0'] < 0.25:  # short cross-fade between cuts
                    img = Image.blend(prev, img, (t - part['t0']) / 0.25)
                return img
        return self.parts[-1].get('last')


# ── drawing ───────────────────────────────────────────────────────────────────
class Canvas:
    def __init__(self):
        self.base = vertical_gradient((W, H), (8, 11, 22), (18, 25, 46)).convert('RGBA')
        self.glow_a = glow((1300, 1300), (70, 110, 220), 0.40)
        self.glow_b = glow((1100, 1100), (120, 80, 220), 0.22)

    def background(self, t):
        img = self.base.copy()
        ax = -250 + 120 * math.sin(t * 0.25)
        ay = -380 + 80 * math.cos(t * 0.21)
        img.alpha_composite(self.glow_a, (int(ax), int(ay)))
        bx = 1100 + 140 * math.cos(t * 0.18)
        by = 250 + 90 * math.sin(t * 0.23)
        img.alpha_composite(self.glow_b, (int(bx), int(by)))
        return img


def text(layer, xy, value, fnt, color, alpha=1.0, anchor='la', dx=0, dy=0):
    if alpha <= 0.01:
        return
    d = ImageDraw.Draw(layer)
    d.text((xy[0] + dx, xy[1] + dy), value, font=fnt, fill=color + (round(255 * alpha),), anchor=anchor)


def bullet(layer, x, y, value, accent, p):
    if p <= 0.01:
        return
    a = ease_out(p)
    off = (1 - a) * -30
    d = ImageDraw.Draw(layer)
    d.ellipse((x + off, y + 14, x + off + 14, y + 28), fill=accent + (round(255 * a),))
    text(layer, (x + 34, y), value, font('regular', 40), WHITE, a, dx=off)


def headline_block(layer, t, kicker, title, bullets, accent, x=150, y=250):
    """bullets: list of (appear_time, text)"""
    p = ease_out(t / 0.6)
    text(layer, (x, y), kicker, font('semibold', 28), accent, p, dy=(1 - p) * 20)
    text(layer, (x, y + 46), title, font('black', 92), WHITE, ease_out((t - 0.15) / 0.6),
         dy=(1 - ease_out((t - 0.15) / 0.6)) * 30)
    for i, (t_in, value) in enumerate(bullets):
        bullet(layer, x + 4, y + 190 + i * 74, value, accent, (t - t_in) / 0.45)


def paste_phone(canvas, phone, screen, cx, cy, scale=1.0, alpha=1.0):
    img = phone.render(screen)
    shadow = phone.shadow
    if scale != 1.0:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.BILINEAR)
        shadow = shadow.resize((round(shadow.width * scale), round(shadow.height * scale)), Image.BILINEAR)
    if alpha < 1:
        img.putalpha(img.getchannel('A').point(lambda v: v * alpha))
        shadow = shadow.point(lambda v: v * alpha)
    sx, sy = cx - shadow.width / 2, cy - shadow.height / 2 + 18 * scale
    canvas.paste((0, 0, 0, 255), (int(sx), int(sy), int(sx) + shadow.width, int(sy) + shadow.height), shadow)
    canvas.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))


# ── scenes ────────────────────────────────────────────────────────────────────
class Promo:
    def __init__(self, markers):
        self.m = markers
        self.canvas = Canvas()
        self.icon = app_icon(168)
        self.icon_small = app_icon(110)
        self.big_phone = PhoneFrame(426, 900)
        self.small_phone = PhoneFrame(300, 633)
        self.fan_phone = PhoneFrame(316, 667)

        self.va = Footage(markers, [  # list, analysing, rep 1 (real time), rep 2 (faster), rep table + chart
            ('video_analysis', 'list-1.2', 'import+0.3', 1.0),
            ('video_analysis', 'analysing+0.4', 'done+1.0', '2.6s'),
            ('video_analysis', 'play-0.3', 'play+4.6', 1.0),
            ('video_analysis', 'play+4.6', 'play+9.8', 1.7),
            ('video_analysis', 'summary-0.3', 'end', 1.8),
        ])
        self.custom = Footage(markers, [
            ('custom_settings', 'light-1.2', 'dark+0.9', 2.0),
            ('custom_settings', 'wheel-0.4', 'applied+0.8', 2.3),
            ('custom_settings', 'recolored-0.2', 'recolored+3.4', 1.5),
            ('custom_muscles', 'editor-0.6', 'hamstrings+1.4', 3.2),
        ])
        self.grid = [
            ('Training', 'Log sets, rest timer, live 1RM', Footage(markers, [('training', 'train-0.5', 'end', 1.0)])),
            ('Plan', 'Progression suggested for you', Footage(markers, [('training', 'home+1.0', 'train-0.5', 1.0)])),
            ('Analysis', 'Dashboard, records, graphs', Footage(markers, [('analysis', 'dashboard-1.5', 'end', 1.0)])),
            ('AI coach', 'Answers from your own data', Footage(markers, [('ai_chat', 'empty', 'end', 1.0)])),
        ]
        for _, _, footage in self.grid:  # all four play in the same 8 s window
            for part in footage.parts:
                part['speed'] *= footage.duration / 8.0
                part['t0'] /= footage.duration / 8.0
                part['t1'] /= footage.duration / 8.0
            footage.duration = 8.0
        self.fan_screens = self.load_fan()

        self.t_intro = (0.0, 3.6)
        va_start = 3.2
        self.t_va = (va_start, va_start + 0.6 + self.va.duration + 0.5)
        cu_start = self.t_va[1] - 0.4
        self.t_custom = (cu_start, cu_start + 0.6 + self.custom.duration + 0.5)
        gr_start = self.t_custom[1] - 0.4
        self.t_grid = (gr_start, gr_start + 0.9 + 8.0 + 0.4)
        fan_start = self.t_grid[1] - 0.4
        self.t_fan = (fan_start, fan_start + 5.0)
        self.t_outro = (self.t_fan[1] - 0.6, self.t_fan[1] + 3.6)
        self.duration = self.t_outro[1]

    def load_fan(self):
        names = ['plan_light', 'training_dark', 'video_analysis_light', 'analysis_dark',
                 'customize_settings_light', 'ai_chat_dark', 'customize_muscles_light']
        out = []
        for name in names:
            path = CAPTURES / 'screens' / f'{name}.png'
            if path.exists():
                out.append(self.fan_phone.render(clean_screen(Image.open(path))))
        return out

    # 1 ─ intro
    def intro(self, frame, t):
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        env = 1 - ease((t - 3.0) / 0.6)
        p = ease_out(t / 0.7)
        size = round(168 * (0.7 + 0.3 * p))
        icon = self.icon.resize((size, size), Image.LANCZOS)
        icon.putalpha(icon.getchannel('A').point(lambda v: v * p * env))
        layer.alpha_composite(icon, (W // 2 - size // 2, 300 - size // 2 + round((1 - p) * 30)))
        q = ease_out((t - 0.35) / 0.6)
        text(layer, (W // 2, 470), 'Gainalytics', font('black', 128), WHITE, q * env, anchor='mm', dy=(1 - q) * 30)
        r = ease_out((t - 0.8) / 0.6)
        text(layer, (W // 2, 590), 'Plan. Train. Analyse.', font('regular', 50), MUTED, r * env, anchor='mm',
             dy=(1 - r) * 20)
        s = ease_out((t - 1.3) / 0.6)
        text(layer, (W // 2, 668), 'Powerlifting training with video analysis', font('semibold', 30), BRAND_BLUE,
             s * env, anchor='mm')
        frame.alpha_composite(layer)

    # 2 ─ video analysis
    def video_analysis(self, frame, t):
        env = window(t, 0, self.t_va[1] - self.t_va[0], 0.5)
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        parts = self.va.parts
        b = [(0.5, 'Import any lift video'),
             (0.6 + parts[1]['t0'] + 0.6, 'Reps and bar path detected automatically'),
             (0.6 + parts[2]['t0'] + 1.0, 'Velocity of every rep, right on the video'),
             (0.6 + parts[4]['t0'] + 0.3, 'Velocity loss turns into reps in reserve')]
        headline_block(layer, t, 'VIDEO ANALYSIS', 'See every rep.', b, BRAND_BLUE)
        ft = t - 0.6
        zoom_in = ease((ft - parts[2]['t0']) / 0.8) * (1 - ease((ft - parts[4]['t0'] + 0.2) / 0.8))
        scale = 1.0 + 0.12 * zoom_in
        slide = ease_out(t / 0.8)
        cx, cy = 1390, 540 + (1 - slide) * 700 + zoom_in * 40
        paste_phone(layer, self.big_phone, self.va.at(ft), cx, cy, scale)
        self.blend(frame, layer, env)

    # 3 ─ customization
    def customization(self, frame, t):
        env = window(t, 0, self.t_custom[1] - self.t_custom[0], 0.5)
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        parts = self.custom.parts
        ft = t - 0.6
        applied_at = parts[1]['t1'] - 0.5
        accent = mix(BRAND_BLUE, ACCENT_ORANGE, ease((ft - applied_at) / 0.5))
        accent = mix(accent, BRAND_BLUE, ease((ft - parts[3]['t0']) / 0.5))
        b = [(0.6 + 0.3, 'Light or dark, follows your system'),
             (0.6 + parts[1]['t0'] + 0.2, 'Any accent colour, applied everywhere'),
             (0.6 + parts[3]['t0'] + 0.3, 'Muscle involvement per exercise'),
             (0.6 + parts[3]['t0'] + 2.4, 'Units, timers, toasts - your call')]
        headline_block(layer, t, 'CUSTOMIZATION', 'Make it yours.', b, accent)
        slide = ease_out(t / 0.8)
        paste_phone(layer, self.big_phone, self.custom.at(ft), 1390, 540 + (1 - slide) * 700)
        self.blend(frame, layer, env)

    # 4 ─ everything else, side by side
    def grid_scene(self, frame, t):
        env = window(t, 0, self.t_grid[1] - self.t_grid[0], 0.4)
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        p = ease_out(t / 0.6)
        text(layer, (W // 2, 92), 'Everything else, built in.', font('black', 72), WHITE, p, anchor='mm',
             dy=(1 - p) * 20)
        gap = 450
        x0 = W / 2 - 1.5 * gap
        for i, (label, sub, footage) in enumerate(self.grid):
            q = ease_out((t - 0.2 - i * 0.12) / 0.6)
            cx, cy = x0 + i * gap, 520 + (1 - q) * 500
            ft = clamp(t - 0.9, 0, 7.99)
            paste_phone(layer, self.small_phone, footage.at(ft), cx, cy, alpha=q)
            text(layer, (cx, 900), label, font('bold', 44), WHITE, q, anchor='mm')
            text(layer, (cx, 950), sub, font('regular', 28), MUTED, q, anchor='mm')
        self.blend(frame, layer, env)

    # 5 ─ overall look + outro
    def fan(self, frame, t):
        env = window(t, 0, self.t_fan[1] - self.t_fan[0], 0.5)
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        n = len(self.fan_screens)
        for i, phone in enumerate(self.fan_screens):
            q = ease_out((t - i * 0.12) / 0.9)
            off = i - (n - 1) / 2
            angle = -off * 4.0
            img = phone.rotate(angle, resample=Image.BICUBIC, expand=True)
            cx = W / 2 + off * 232 + math.sin(t * 0.5 + i) * 6
            cy = 630 + abs(off) * 36 + (1 - q) * 700 - t * 8
            img.putalpha(img.getchannel('A').point(lambda v: v * q))
            layer.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))
        p = ease_out((t - 0.8) / 0.6)
        text(layer, (W // 2, 92), 'Light and dark. Every screen.', font('black', 72), WHITE, p, anchor='mm',
             dy=(1 - p) * 20)
        self.blend(frame, layer, env)

    def outro(self, frame, t):
        env = ease(t / 0.6)
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        p = ease_out(t / 0.7)
        icon = self.icon.copy()
        icon.putalpha(icon.getchannel('A').point(lambda v: v * p))
        layer.alpha_composite(icon, (W // 2 - 84, 330 - 84 + round((1 - p) * 20)))
        q = ease_out((t - 0.3) / 0.6)
        text(layer, (W // 2, 500), 'Gainalytics', font('black', 120), WHITE, q, anchor='mm', dy=(1 - q) * 20)
        r = ease_out((t - 0.7) / 0.6)
        text(layer, (W // 2, 615), 'Plan. Train. Analyse.', font('regular', 50), MUTED, r, anchor='mm')
        s = ease_out((t - 1.1) / 0.6)
        text(layer, (W // 2, 700), 'Video analysis  ·  Your colours  ·  AI coach', font('semibold', 32),
             BRAND_BLUE, s, anchor='mm')
        self.blend(frame, layer, env)

    @staticmethod
    def blend(frame, layer, env):
        if env <= 0.005:
            return
        if env < 0.995:
            layer.putalpha(layer.getchannel('A').point(lambda v: v * env))
        frame.alpha_composite(layer)

    def render(self, t):
        frame = self.canvas.background(t)
        for (a, b), fn in ((self.t_intro, self.intro), (self.t_va, self.video_analysis),
                           (self.t_custom, self.customization), (self.t_grid, self.grid_scene),
                           (self.t_fan, self.fan), (self.t_outro, self.outro)):
            if a <= t < b:
                fn(frame, t - a)
        return frame.convert('RGB')

    def close(self):
        for footage in [self.va, self.custom] + [f for _, _, f in self.grid]:
            for part in footage.parts:
                if part['reader'] is not None:
                    part['reader'].close()

    def scene_stills(self):
        """One representative moment per scene (seconds), for review/summary."""
        va = self.t_va[0] + 0.6
        cu = self.t_custom[0] + 0.6
        return {
            '1-intro': 1.8,
            '2-video-analysis-import': va + self.va.parts[1]['t0'] + 1.5,
            '2-video-analysis-overlay': va + self.va.parts[2]['t0'] + 3.0,
            '2-video-analysis-rep-2': va + self.va.parts[3]['t0'] + 1.5,
            '2-video-analysis-velocity-loss': va + self.va.parts[4]['t0'] + 2.5,
            '3-custom-theme': cu + 1.5,
            '3-custom-colour': cu + self.custom.parts[2]['t0'] + 1.0,
            '3-custom-muscles': cu + self.custom.parts[3]['t0'] + 4.0,
            '4-built-in': self.t_grid[0] + 5.0,
            '5-overall-look': self.t_fan[0] + 3.0,
            '6-outro': self.t_outro[0] + 2.5,
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--out', default=str(REPO / 'docs/marketing/gainalytics-promo.mp4'))
    parser.add_argument('--stills', help='also write one PNG per scene into this directory')
    parser.add_argument('--preview', type=float, help='render only the first N seconds')
    args = parser.parse_args()

    markers = json.loads((CAPTURES / 'markers.json').read_text())
    promo = Promo(markers)
    duration = min(promo.duration, args.preview) if args.preview else promo.duration
    total = int(round(duration * FPS))
    print(f'rendering {duration:.1f} s ({total} frames) -> {args.out}')
    stills = {}
    if args.stills:
        pathlib.Path(args.stills).mkdir(parents=True, exist_ok=True)
        stills = {round(t * FPS): name for name, t in promo.scene_stills().items()}

    enc = subprocess.Popen(
        ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
         '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
         '-movflags', '+faststart', args.out], stdin=subprocess.PIPE)
    for i in range(total):
        img = promo.render(i / FPS)
        enc.stdin.write(img.tobytes())
        if i in stills:
            img.save(pathlib.Path(args.stills) / f'{stills[i]}.png')
        if i % (FPS * 5) == 0:
            print(f'  {i / FPS:5.1f} s', flush=True)
    enc.stdin.close()
    promo.close()
    if enc.wait() != 0:
        sys.exit('ffmpeg failed')
    print('done')


if __name__ == '__main__':
    main()
