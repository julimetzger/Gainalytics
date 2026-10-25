"""Shared drawing helpers for the store screenshots and the promo video (GH-485)."""
import pathlib

from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = pathlib.Path(__file__).resolve().parents[3]
FONTS = REPO / 'docs/marketing/assets/fonts'
ICON = REPO / 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'

# Device geometry (Galaxy S20+ at the 720x1600 display-size override).
STATUS_BAR_H = 49
NAV_BAR_TOP = 1520

BRAND_BLUE = (170, 199, 255)
BRAND_BLUE_DEEP = (61, 94, 160)
ACCENT_ORANGE = (255, 117, 71)


def font(weight, size):
    name = {'regular': 'Inter-Regular.ttf', 'semibold': 'Inter-SemiBold.ttf',
            'bold': 'InterDisplay-Bold.ttf', 'black': 'InterDisplay-ExtraBold.ttf'}[weight]
    return ImageFont.truetype(str(FONTS / name), size)


def luminance(rgb):
    r, g, b = rgb[:3]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def clean_screen(img):
    """Crop the system navigation bar and repaint the status bar with a neutral
    9:41 clock, full signal and battery (no notification icons, no real time)."""
    img = img.convert('RGB').crop((0, 0, img.width, NAV_BAR_TOP))
    row = img.crop((0, STATUS_BAR_H + 2, img.width, STATUS_BAR_H + 4)).resize((1, 1), Image.BOX)
    bg = row.getpixel((0, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, img.width, STATUS_BAR_H), fill=bg)
    fg = (20, 22, 28) if luminance(bg) > 140 else (236, 238, 244)
    draw.text((74, STATUS_BAR_H // 2 + 1), '9:41', font=font('semibold', 25), fill=fg, anchor='lm')
    # signal bars
    x = 526
    for i in range(4):
        h = 8 + i * 5
        draw.rounded_rectangle((x + i * 9, 33 - h, x + i * 9 + 5, 33), radius=1, fill=fg)
    # wifi
    cx, cy = 584, 34
    for r in (20, 13, 6):
        draw.pieslice((cx - r, cy - r, cx + r, cy + r), 225, 315, fill=fg)
        if r > 6:
            inner = r - 4
            draw.pieslice((cx - inner, cy - inner, cx + inner, cy + inner), 225, 315, fill=bg)
    # battery
    draw.rounded_rectangle((612, 15, 648, 33), radius=4, outline=fg, width=2)
    draw.rounded_rectangle((616, 19, 644, 29), radius=2, fill=fg)
    draw.rectangle((650, 20, 652, 28), fill=fg)
    return img


def rounded_mask(size, radius, scale=3):
    w, h = size
    big = Image.new('L', (w * scale, h * scale), 0)
    ImageDraw.Draw(big).rounded_rectangle((0, 0, w * scale - 1, h * scale - 1), radius=radius * scale, fill=255)
    return big.resize(size, Image.LANCZOS)


class PhoneFrame:
    """A simple, brand-free phone body. `render(screen)` returns an RGBA image."""

    def __init__(self, screen_w, screen_h, bezel=None, frame_color=(14, 15, 19), rim=(70, 74, 86)):
        self.screen_w, self.screen_h = screen_w, screen_h
        self.bezel = bezel or max(6, round(screen_w * 0.028))
        self.radius = round(screen_w * 0.12)
        self.w = screen_w + 2 * self.bezel
        self.h = screen_h + 2 * self.bezel
        outer_r = self.radius + self.bezel
        body = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        body.paste(Image.new('RGBA', (self.w, self.h), rim + (255,)), (0, 0), rounded_mask((self.w, self.h), outer_r))
        inset = max(2, self.bezel // 4)
        inner = (self.w - 2 * inset, self.h - 2 * inset)
        body.paste(Image.new('RGBA', inner, frame_color + (255,)), (inset, inset), rounded_mask(inner, outer_r - inset))
        self.body = body
        self.screen_mask = rounded_mask((screen_w, screen_h), self.radius)
        pad = round(self.w * 0.12)
        shadow = Image.new('L', (self.w + 2 * pad, self.h + 2 * pad), 0)
        shadow.paste(rounded_mask((self.w, self.h), outer_r).point(lambda v: v * 0.55), (pad, pad + pad // 3))
        self.shadow = shadow.filter(ImageFilter.GaussianBlur(pad / 2.5))
        self.shadow_pad = pad

    def render(self, screen):
        if screen.size != (self.screen_w, self.screen_h):
            screen = screen.resize((self.screen_w, self.screen_h), Image.LANCZOS)
        out = self.body.copy()
        out.paste(screen.convert('RGB'), (self.bezel, self.bezel), self.screen_mask)
        return out

    def paste(self, canvas, screen, x, y, shadow=True):
        """Paste the phone with its top-left corner at (x, y) onto an RGB canvas."""
        if shadow:
            black = Image.new('RGB', self.shadow.size, (0, 0, 0))
            canvas.paste(black, (int(x - self.shadow_pad), int(y - self.shadow_pad)), self.shadow)
        phone = self.render(screen)
        canvas.paste(phone, (int(x), int(y)), phone)


def vertical_gradient(size, top, bottom):
    w, h = size
    grad = Image.linear_gradient('L').resize((1, h)).resize((w, h))
    return Image.composite(Image.new('RGB', size, bottom), Image.new('RGB', size, top), grad)


def glow(size, color, alpha):
    """Soft round light blob, RGBA."""
    w, h = size
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).ellipse((w * 0.2, h * 0.2, w * 0.8, h * 0.8), fill=int(255 * alpha))
    mask = mask.filter(ImageFilter.GaussianBlur(min(w, h) * 0.15))
    out = Image.new('RGBA', size, color + (0,))
    out.putalpha(mask)
    return out


def app_icon(size):
    """The app's own launcher icon (192 px source - keep `size` <= ~200)."""
    icon = Image.open(ICON).convert('RGBA')
    icon = icon.crop(icon.getbbox()).resize((size, size), Image.LANCZOS)
    icon.putalpha(rounded_mask((size, size), round(size * 0.24)))
    return icon
