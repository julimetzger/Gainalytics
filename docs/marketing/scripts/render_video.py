#!/usr/bin/env python3
"""Render the Gainalytics promo video (GH-485, GH-665) from the committed captures.

    python3 docs/marketing/scripts/render_video.py [--formats 16x9,9x16,1x1] [--out-dir DIR]
                                                   [--stills DIR] [--preview SECONDS]

Three versions, each laid out for its own frame (nothing is cropped away):
    gainalytics-promo-16x9.mp4   1920x1080   YouTube (the Play Store video is a YouTube link)
    gainalytics-promo-9x16.mp4   1080x1920   Reels, TikTok, Shorts
    gainalytics-promo-1x1.mp4    1080x1080   Feed posts
All are 30 fps, H.264, no audio, 30-60 s. Every cut is defined relative to the event
markers that capture.py wrote (docs/marketing/captures/markers.json), so a fresh
capture after UI changes re-renders without touching this file.

Storyboard (about 55 s):
  1. Intro            app icon, name, tagline
  2. Video analysis   import -> analysis -> bar-path overlay playing -> rep table / VL chart
  3. Customization    light/dark, colour wheel -> recoloured app, muscle involvement editor
  4. Feature parade   Plan with AI, training, Coach Insight, analysis filter panel + records,
                      AI chat with sleep and steps from Health Connect
  5. Overall look     fan of light and dark screens
  6. Outro
"""
import argparse
import json
import math
import pathlib
import subprocess
import sys
from dataclasses import dataclass

from PIL import Image, ImageDraw

from compose import ACCENT_ORANGE, BRAND_BLUE, PhoneFrame, app_icon, clean_screen, font, glow, vertical_gradient

REPO = pathlib.Path(__file__).resolve().parents[3]
MARKETING = REPO / 'docs/marketing'
CAPTURES = MARKETING / 'captures'
FPS = 30
WHITE = (246, 248, 255)
MUTED = (170, 184, 214)
ACCENT_GREEN = (110, 220, 170)
ACCENT_VIOLET = (190, 160, 255)
TAGLINE = 'Plan. Train. Analyse.'
SUBLINE = 'Powerlifting training with video analysis'
OUTRO_LINE = 'Video analysis  ·  Your colours  ·  AI coach'


@dataclass
class Layout:
    """Where things go in one output format. `mode` 'side' puts the copy left of the phone,
    'stack' puts it above the phone (portrait), with one caption at a time instead of a list."""
    name: str
    size: tuple
    mode: str
    phone_h: int            # screen height of the big phone
    phone_xy: tuple         # its centre
    text_xy: tuple          # top-left (side) or top-centre (stack) of the copy block
    kicker: int
    title: int
    bullet: int
    bullet_gap: int
    text_w: int             # wrap width of the copy
    fan_h: int              # screen height of the fan phones
    fan_n: int
    fan_gap: int
    fan_y: int
    intro_scale: float
    headline: int           # size of the centred headlines (fan scene)


LAYOUTS = {
    '16x9': Layout('16x9', (1920, 1080), 'side', 900, (1390, 540), (150, 250), 28, 92, 40, 74, 820,
                   620, 7, 232, 610, 1.0, 72),
    '9x16': Layout('9x16', (1080, 1920), 'stack', 1340, (540, 1150), (540, 120), 30, 96, 42, 0, 960,
                   900, 5, 190, 1080, 1.05, 76),
    '1x1': Layout('1x1', (1080, 1080), 'side', 880, (800, 540), (70, 210), 24, 66, 30, 64, 500,
                  520, 5, 175, 610, 0.8, 58),
}


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
        # Output-side seek after the fps filter: screenrecord writes no frames while the
        # screen is static, so an input-side seek into such a pause would jump to the
        # NEXT change instead of holding the frame that is on screen at `start`.
        self.proc = subprocess.Popen(
            ['ffmpeg', '-loglevel', 'error', '-i', str(path), '-vf', f'fps={FPS}', '-ss', f'{start:.3f}',
             '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
        self.w, self.h = 720, 1600
        self.index = -1
        self.frame = None
        self.cache = {}

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
        key = id(self.frame)
        if key not in self.cache:  # speed < 1 shows the same frame more than once
            self.cache = {key: clean_screen(Image.frombytes('RGB', (self.w, self.h), self.frame))}
        return self.cache[key]

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
            if src_b <= src_a:
                raise ValueError(f'{clip}: {a} -> {b} is empty ({src_a:.2f} -> {src_b:.2f})')
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

    def close(self):
        for part in self.parts:
            if part['reader'] is not None:
                part['reader'].close()
                part['reader'] = None


# ── storyboard ────────────────────────────────────────────────────────────────
# Each feature scene: copy (kicker, title, bullets) next to / above a phone playing
# `footage`. A bullet appears at (footage part, seconds into that part).
FEATURES = [
    dict(key='video-analysis', kicker='VIDEO ANALYSIS', title='See every rep.', accent=BRAND_BLUE, zoom=(1, 3),
         footage=[('video_analysis', 'analysing+0.4', 'done+1.0', '1.8s'),          # just imported, analysing
                  ('video_analysis_detail', 'play-0.3', 'play+4.4', 1.0),           # rep 1 with the overlay
                  ('video_analysis_detail', 'play+4.4', 'play+9.8', 2.0),           # rep 2, faster
                  ('video_analysis_detail', 'summary-0.3', 'end', '2.0s')],         # rep table, VL chart
         bullets=[(0, 0.0, 'Import any lift video'),
                  (0, 1.0, 'Reps and bar path detected automatically'),
                  (1, 1.0, 'Velocity of every rep, right on the video'),
                  (3, 0.2, 'Rep table and velocity loss per set')]),
    dict(key='customization', kicker='CUSTOMIZATION', title='Make it yours.', accent=BRAND_BLUE, recolour=True,
         footage=[('custom_settings', 'light-1.2', 'dark+0.9', '2.2s'),
                  ('custom_settings', 'wheel-0.4', 'applied+0.8', '3.0s'),
                  ('custom_settings', 'recolored-0.2', 'recolored+2.4', '1.4s'),
                  ('custom_muscles', 'editor-0.6', 'hamstrings+1.2', '3.2s')],
         bullets=[(0, 0.2, 'Light or dark, follows your system'),
                  (1, 0.2, 'Any accent colour, applied everywhere'),
                  (3, 0.3, 'Muscle involvement per exercise')]),
    dict(key='plan-with-ai', kicker='PLAN WITH AI', title='Say it. Planned.', accent=ACCENT_VIOLET,
         footage=[('training', 'plan_screen-0.2', 'plan_screen+0.8', 1.0),       # empty "Plan with AI"
                  ('training', 'ai_sent-1.0', 'ai_sent+2.0', '1.1s'),             # the request, planning
                  ('training', 'light+0.95', 'light+1.9', 0.7)],                  # the plan + "Planned with AI"
         bullets=[(0, 0.1, 'Tell it what to change today')]),
    dict(key='training', kicker='TRAINING', title='Log it fast.', accent=BRAND_BLUE,
         footage=[('training', 'started-0.2', 'end', '3.5s')],
         bullets=[(0, 0.1, 'Sets, rest timer, live 1RM')]),
    dict(key='coach-insight', kicker='COACH INSIGHT', title='Instant feedback.', accent=ACCENT_GREEN,
         footage=[('coach_insight', 'menu-0.3', 'finished+0.4', 1.0),          # "Finish Training"
                  ('coach_insight', 'insight-2.0', 'insight+0.3', '0.9s'),       # "Generating insight…"
                  ('coach_insight', 'insight+0.3', 'end', '2.6s')],              # the answer, scrolled up
         bullets=[(0, 0.0, 'An AI review of every session')]),
    dict(key='analysis', kicker='ANALYSIS', title='See your progress.', accent=BRAND_BLUE,
         footage=[('analysis', 'graphs-0.3', 'panel_closed+1.2', '3.3s'),
                  ('analysis', 'records+1.0', 'end', '1.6s')],
         bullets=[(0, 0.0, 'Filter by period, exercise and muscle'),
                  (1, 0.0, 'Every record on a heatmap')]),
    dict(key='ai-chat', kicker='AI COACH', title='Ask anything.', accent=ACCENT_GREEN,
         footage=[('ai_chat', 'filters-0.3', 'filters_closed', '1.6s'),
                  ('ai_chat', 'typed-0.3', 'sent+0.4', '0.6s'),
                  ('ai_chat', 'reply-0.2', 'end', '2.8s')],
         bullets=[(0, 0.0, 'Sleep and steps from Health Connect'),
                  (2, 0.0, 'Answers from your own training')]),
]
AI_CHAT_BULLETS_WITHOUT_HEALTH_CONNECT = [(0, 0.0, 'You choose what the AI sees'),
                                         (2, 0.0, 'Answers from your own training')]
FAN = ['plan_ai_light', 'training_dark', 'video_analysis_light', 'analysis_dark', 'customize_settings_light',
       'coach_insight_dark', 'ai_chat_light']
LEAD, TAIL, OVERLAP = 0.6, 0.5, 0.4


# ── drawing ───────────────────────────────────────────────────────────────────
def text(layer, xy, value, fnt, color, alpha=1.0, anchor='la', dx=0, dy=0):
    if alpha <= 0.01:
        return
    d = ImageDraw.Draw(layer)
    d.text((xy[0] + dx, xy[1] + dy), value, font=fnt, fill=color + (round(255 * alpha),), anchor=anchor)


def wrap(value, fnt, width):
    """Greedy word wrap to `width` pixels."""
    words, lines = value.split(), []
    for word in words:
        if lines and fnt.getlength(lines[-1] + ' ' + word) <= width:
            lines[-1] += ' ' + word
        else:
            lines.append(word)
    return lines


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


class Canvas:
    def __init__(self, size):
        w, h = size
        self.size = size
        self.base = vertical_gradient(size, (8, 11, 22), (18, 25, 46)).convert('RGBA')
        g = round(max(w, h) * 0.68)
        self.glow_a = glow((g, g), (70, 110, 220), 0.40)
        self.glow_b = glow((round(g * 0.85), round(g * 0.85)), (120, 80, 220), 0.22)

    def background(self, t):
        w, h = self.size
        img = self.base.copy()
        ax = -0.13 * w + 0.06 * w * math.sin(t * 0.25)
        ay = -0.35 * h + 0.07 * h * math.cos(t * 0.21)
        img.alpha_composite(self.glow_a, (int(ax), int(ay)))
        bx = 0.57 * w + 0.07 * w * math.cos(t * 0.18)
        by = 0.23 * h + 0.08 * h * math.sin(t * 0.23)
        img.alpha_composite(self.glow_b, (int(bx), int(by)))
        return img


# ── the video ─────────────────────────────────────────────────────────────────
class Promo:
    def __init__(self, markers, layout):
        self.m = markers
        self.L = layout
        self.W, self.H = layout.size
        self.canvas = Canvas(layout.size)
        self.icon = app_icon(round(168 * layout.intro_scale))
        self.big_phone = PhoneFrame(round(layout.phone_h * 720 / 1520), layout.phone_h)
        fan_phone = PhoneFrame(round(layout.fan_h * 720 / 1520), layout.fan_h)
        self.fan_screens = self.load_fan(fan_phone)

        self.features = []
        t = 3.2  # the intro
        self.t_intro = (0.0, t + OVERLAP)
        for spec in FEATURES:
            if spec['key'] == 'ai-chat' and 'recovery_on' not in markers['ai_chat']:
                spec = dict(spec, bullets=AI_CHAT_BULLETS_WITHOUT_HEALTH_CONNECT)  # captured without them
            footage = Footage(markers, spec['footage'])
            span = (t, t + LEAD + footage.duration + TAIL)
            self.features.append(dict(spec, footage=footage, span=span))
            t = span[1] - OVERLAP
        self.t_fan = (t, t + 4.0)
        self.t_outro = (self.t_fan[1] - 0.6, self.t_fan[1] + 3.4)
        self.duration = self.t_outro[1]

    def load_fan(self, phone):
        out = []
        names = FAN[:self.L.fan_n] if self.L.fan_n < len(FAN) else FAN
        if self.L.fan_n < len(FAN):  # keep a light/dark mix when fewer phones fit
            names = [FAN[i] for i in (0, 1, 2, 3, 5)][:self.L.fan_n]
        for name in names:
            path = CAPTURES / 'screens' / f'{name}.png'
            if not path.exists():
                raise FileNotFoundError(f'{path} - run capture.py first')
            out.append(phone.render(clean_screen(Image.open(path))))
        return out

    # 1 ─ intro
    def intro(self, frame, t):
        L, W, H = self.L, self.W, self.H
        s = L.intro_scale
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        env = 1 - ease((t - 3.0) / 0.6)
        cy = H / 2
        p = ease_out(t / 0.7)
        base = self.icon.width
        size = round(base * (0.7 + 0.3 * p))
        icon = self.icon.resize((size, size), Image.LANCZOS)
        icon.putalpha(icon.getchannel('A').point(lambda v: v * p * env))
        layer.alpha_composite(icon, (W // 2 - size // 2, round(cy - 240 * s - size / 2 + (1 - p) * 30)))
        q = ease_out((t - 0.35) / 0.6)
        text(layer, (W // 2, cy - 70 * s), 'Gainalytics', font('black', round(128 * s)), WHITE, q * env, anchor='mm',
             dy=(1 - q) * 30)
        r = ease_out((t - 0.8) / 0.6)
        text(layer, (W // 2, cy + 50 * s), TAGLINE, font('regular', round(50 * s)), MUTED, r * env, anchor='mm',
             dy=(1 - r) * 20)
        q = ease_out((t - 1.3) / 0.6)
        lines = wrap(SUBLINE, font('semibold', round(30 * s)), W - 120)
        for i, line in enumerate(lines):
            text(layer, (W // 2, cy + 128 * s + i * 42 * s), line, font('semibold', round(30 * s)), BRAND_BLUE,
                 q * env, anchor='mm')
        frame.alpha_composite(layer)

    # 2-4 ─ one feature
    def feature(self, frame, t, f):
        L = self.L
        span = f['span'][1] - f['span'][0]
        env = window(t, 0, span, 0.5)
        layer = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        footage = f['footage']
        parts = footage.parts
        ft = t - LEAD
        accent = f['accent']
        if f.get('recolour'):
            applied_at = parts[1]['t1'] - 0.5
            accent = mix(BRAND_BLUE, ACCENT_ORANGE, ease((ft - applied_at) / 0.5))
            accent = mix(accent, BRAND_BLUE, ease((ft - parts[3]['t0']) / 0.5))
        bullets = [(LEAD + parts[i]['t0'] + off, value) for i, off, value in f['bullets']]
        self.copy(layer, t, f['kicker'], f['title'], bullets, accent, span)

        scale, zoom_dy = 1.0, 0.0
        if f.get('zoom'):
            a, b = f['zoom']
            zoom = ease((ft - parts[a]['t0']) / 0.8) * (1 - ease((ft - parts[b]['t0'] + 0.2) / 0.8))
            # zoom in on the overlay, but the whole phone stays inside the frame
            fit = (self.H - 16) / self.big_phone.h if L.mode == 'side' else 1.06
            scale, zoom_dy = 1.0 + (min(1.12, fit) - 1.0) * zoom, 0.0
        slide = ease_out(t / 0.8)
        cx, cy = L.phone_xy
        paste_phone(layer, self.big_phone, footage.at(ft), cx, cy + (1 - slide) * self.H * 0.65 + zoom_dy, scale)
        self.blend(frame, layer, env)

    def copy(self, layer, t, kicker, title, bullets, accent, span):
        L = self.L
        x, y = L.text_xy
        p = ease_out(t / 0.6)
        q = ease_out((t - 0.15) / 0.6)
        title_font = font('black', L.title)
        if L.mode == 'side':
            text(layer, (x, y), kicker, font('semibold', L.kicker), accent, p, dy=(1 - p) * 20)
            lines = wrap(title, title_font, L.text_w)
            for i, line in enumerate(lines):
                text(layer, (x, y + L.kicker * 1.65 + i * L.title * 1.08), line, title_font, WHITE, q,
                     dy=(1 - q) * 30)
            by = y + L.kicker * 1.65 + len(lines) * L.title * 1.08 + L.bullet * 1.3
            bfont = font('regular', L.bullet)
            for t_in, value in bullets:
                a = ease_out((t - t_in) / 0.45)
                if a <= 0.01:
                    break
                off = (1 - a) * -30
                dot = L.bullet * 0.36
                ImageDraw.Draw(layer).ellipse(
                    (x + 4 + off, by + L.bullet * 0.36, x + 4 + off + dot, by + L.bullet * 0.36 + dot),
                    fill=accent + (round(255 * a),))
                for j, line in enumerate(wrap(value, bfont, L.text_w - L.bullet)):
                    text(layer, (x + 4 + L.bullet * 0.85, by + j * L.bullet * 1.25), line, bfont, WHITE, a, dx=off)
                    if j:
                        by += L.bullet * 1.25
                by += L.bullet_gap
        else:  # stack: centred title, one caption at a time (the newest bullet)
            text(layer, (x, y), kicker, font('semibold', L.kicker), accent, p, anchor='ma', dy=(1 - p) * 20)
            text(layer, (x, y + L.kicker * 1.7), title, title_font, WHITE, q, anchor='ma', dy=(1 - q) * 30)
            cap_y = y + L.kicker * 1.7 + L.title * 1.32
            bfont = font('regular', L.bullet)
            for i, (t_in, value) in enumerate(bullets):
                t_out = bullets[i + 1][0] if i + 1 < len(bullets) else span
                a = ease_out((t - t_in) / 0.4) * (1 - ease((t - t_out + 0.3) / 0.3))
                if a <= 0.01:
                    continue
                for j, line in enumerate(wrap(value, bfont, L.text_w)):
                    text(layer, (x, cap_y + j * L.bullet * 1.25), line, bfont, MUTED, a, anchor='ma',
                         dy=(1 - a) * 16)
            pill_y = cap_y + L.bullet * 2.7
            ImageDraw.Draw(layer).rounded_rectangle((x - 40, pill_y, x + 40, pill_y + 7), radius=3,
                                                    fill=accent + (round(255 * p),))

    # 5 ─ overall look
    def fan(self, frame, t):
        L = self.L
        env = window(t, 0, self.t_fan[1] - self.t_fan[0], 0.5)
        layer = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        n = len(self.fan_screens)
        for i, phone in enumerate(self.fan_screens):
            q = ease_out((t - i * 0.12) / 0.9)
            off = i - (n - 1) / 2
            img = phone.rotate(-off * 4.0, resample=Image.BICUBIC, expand=True)
            cx = self.W / 2 + off * L.fan_gap + math.sin(t * 0.5 + i) * 6
            cy = L.fan_y + abs(off) * 30 + (1 - q) * self.H * 0.65 - t * 6
            img.putalpha(img.getchannel('A').point(lambda v: v * q))
            layer.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))
        p = ease_out((t - 0.8) / 0.6)
        hfont = font('black', L.headline)
        headline = 'Light and dark. Every screen.'
        lines = [headline] if hfont.getlength(headline) <= self.W - 100 else ['Light and dark.', 'Every screen.']
        top = round(self.H * (0.085 if L.mode == 'side' else 0.07))
        for i, line in enumerate(lines):
            text(layer, (self.W // 2, top + i * L.headline * 1.1), line, hfont, WHITE, p, anchor='mm',
                 dy=(1 - p) * 20)
        self.blend(frame, layer, env)

    # 6 ─ outro
    def outro(self, frame, t):
        L, W, H = self.L, self.W, self.H
        s = L.intro_scale
        env = ease(t / 0.6)
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        cy = H / 2
        p = ease_out(t / 0.7)
        icon = self.icon.copy()
        icon.putalpha(icon.getchannel('A').point(lambda v: v * p))
        layer.alpha_composite(icon, (W // 2 - icon.width // 2, round(cy - 210 * s - icon.height / 2 + (1 - p) * 20)))
        q = ease_out((t - 0.3) / 0.6)
        text(layer, (W // 2, cy - 40 * s), 'Gainalytics', font('black', round(120 * s)), WHITE, q, anchor='mm',
             dy=(1 - q) * 20)
        r = ease_out((t - 0.7) / 0.6)
        text(layer, (W // 2, cy + 75 * s), TAGLINE, font('regular', round(50 * s)), MUTED, r, anchor='mm')
        q = ease_out((t - 1.1) / 0.6)
        ofont = font('semibold', round(32 * s))
        if ofont.getlength(OUTRO_LINE) <= W - 100:
            text(layer, (W // 2, cy + 160 * s), OUTRO_LINE, ofont, BRAND_BLUE, q, anchor='mm')
        else:
            for i, line in enumerate(OUTRO_LINE.split('  ·  ')):
                text(layer, (W // 2, cy + 160 * s + i * 48 * s), line, ofont, BRAND_BLUE, q, anchor='mm')
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
        a, b = self.t_intro
        if a <= t < b:
            self.intro(frame, t - a)
        for f in self.features:
            a, b = f['span']
            if a <= t < b:
                self.feature(frame, t - a, f)
            elif t >= b:
                f['footage'].close()
        for (a, b), fn in ((self.t_fan, self.fan), (self.t_outro, self.outro)):
            if a <= t < b:
                fn(frame, t - a)
        return frame.convert('RGB')

    def close(self):
        for f in self.features:
            f['footage'].close()

    def scene_stills(self):
        """One representative moment per scene (seconds) - plus the main video analysis steps."""
        out = {'1-intro': 1.8}
        for i, f in enumerate(self.features, start=2):
            parts, a = f['footage'].parts, f['span'][0] + LEAD
            if f['key'] == 'video-analysis':
                out.update({f'{i:02d}-{f["key"]}-import': a + parts[0]['t0'] + 1.2,
                            f'{i:02d}-{f["key"]}-overlay': a + parts[1]['t0'] + 3.0,
                            f'{i:02d}-{f["key"]}-rep-table': a + parts[3]['t0'] + 1.0})
            elif f['key'] == 'customization':
                out.update({f'{i:02d}-{f["key"]}-theme': a + 0.9,
                            f'{i:02d}-{f["key"]}-colour': a + parts[2]['t0'] + 1.0,
                            f'{i:02d}-{f["key"]}-muscles': a + parts[3]['t0'] + 2.5})
            else:
                out[f'{i:02d}-{f["key"]}'] = a + parts[-1]['t1'] - 0.4
        n = len(self.features) + 2
        out[f'{n:02d}-overall-look'] = self.t_fan[0] + 3.0
        out[f'{n + 1:02d}-outro'] = self.t_outro[0] + 2.5
        return out


def render_format(markers, layout, out, stills_dir=None, preview=None):
    promo = Promo(markers, layout)
    W, H = layout.size
    duration = min(promo.duration, preview) if preview else promo.duration
    total = int(round(duration * FPS))
    print(f'[{layout.name}] rendering {duration:.1f} s ({total} frames) -> {out}', flush=True)
    stills = {}
    if stills_dir:
        stills_dir = pathlib.Path(stills_dir) / layout.name
        stills_dir.mkdir(parents=True, exist_ok=True)
        stills = {round(t * FPS): name for name, t in promo.scene_stills().items()}
    enc = subprocess.Popen(
        ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
         '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
         '-r', str(FPS), '-movflags', '+faststart', str(out)], stdin=subprocess.PIPE)
    try:
        for i in range(total):
            img = promo.render(i / FPS)
            enc.stdin.write(img.tobytes())
            if i in stills:
                img.save(stills_dir / f'{stills[i]}.png')
            if i % (FPS * 10) == 0:
                print(f'  [{layout.name}] {i / FPS:5.1f} s', flush=True)
    finally:
        enc.stdin.close()
        promo.close()
    if enc.wait() != 0:
        sys.exit('ffmpeg failed')
    return promo.duration


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--formats', default=','.join(LAYOUTS), help='comma-separated subset of: ' + ', '.join(LAYOUTS))
    parser.add_argument('--out-dir', default=str(MARKETING / 'video'))
    parser.add_argument('--stills', help='also write one PNG per scene into DIR/<format>/')
    parser.add_argument('--preview', type=float, help='render only the first N seconds')
    args = parser.parse_args()

    markers = json.loads((CAPTURES / 'markers.json').read_text())
    out_dir = pathlib.Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in args.formats.split(','):
        duration = render_format(markers, LAYOUTS[name], out_dir / f'gainalytics-promo-{name}.mp4', args.stills,
                                 args.preview)
        if not args.preview and not 30 <= duration <= 60:
            sys.exit(f'{name}: {duration:.1f} s is outside 30-60 s - shorten the storyboard')
    print('done')


if __name__ == '__main__':
    main()
