#!/usr/bin/env python3
"""Render the demo lift clip used for the video-analysis captures (GH-485).

It draws the same plate as the e2e fixture `squat-3reps.mp4` (same size and grey
bands, so the app's plate detector finds it), but moves it like a real set of
squats: five reps whose concentric phase gets slower rep by rep (velocity loss)
and a slight J-shaped bar path. No people, no third-party footage.

Usage:
    python3 docs/marketing/scripts/make_demo_lift_clip.py [--out PATH]
"""
import argparse
import math
import pathlib
import subprocess

import numpy as np

REPO = pathlib.Path(__file__).resolve().parents[3]
W, H, FPS = 720, 1280, 30
BG = 18
SS = 3  # supersampling for anti-aliased edges

TOP_Y = 470
ROM_PX = 330
X0 = 330
ECC_S = 1.3
BOTTOM_S = 0.15
TOP_PAUSE_S = 0.75
CONC_S = [0.95, 1.03, 1.14, 1.3, 1.52]


def ease(p):
    return 0.5 - 0.5 * math.cos(math.pi * min(max(p, 0.0), 1.0))


def timeline():
    """Yields (x, y) of the plate centre for every frame."""
    segments = [('hold', 0.8)]
    for conc in CONC_S:
        segments += [('ecc', ECC_S), ('bottom', BOTTOM_S), ('conc', conc), ('hold', TOP_PAUSE_S)]
    segments.append(('hold', 0.8))
    for kind, dur in segments:
        frames = int(round(dur * FPS))
        for i in range(frames):
            p = i / frames
            if kind == 'hold':
                yield X0, TOP_Y
            elif kind == 'ecc':
                yield X0 + 14 * math.sin(math.pi * p / 2), TOP_Y + ROM_PX * ease(p)
            elif kind == 'bottom':
                yield X0 + 14, TOP_Y + ROM_PX
            else:
                yield X0 + 14 * math.cos(math.pi * p / 2) - 6 * math.sin(math.pi * p), TOP_Y + ROM_PX * (1 - ease(p))


def plate_frame(cx, cy, yy, xx):
    r = np.hypot((xx - cx * SS) / SS, (yy - cy * SS) / SS)
    img = np.full(r.shape, BG, np.float32)
    img[(r >= 30) & (r < 60)] = 167
    img[(r >= 60) & (r < 100)] = 214
    small = img.reshape(H, SS, W, SS).mean(axis=(1, 3))
    return np.repeat(small[:, :, None], 3, axis=2).astype(np.uint8)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default=str(REPO / 'docs/marketing/build/demo-squat-5reps.mp4'))
    args = parser.parse_args()
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    yy, xx = np.mgrid[0:H * SS, 0:W * SS].astype(np.float32)
    ffmpeg = subprocess.Popen(
        ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
         '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', str(out)],
        stdin=subprocess.PIPE)
    count = 0
    for cx, cy in timeline():
        ffmpeg.stdin.write(plate_frame(cx, cy, yy, xx).tobytes())
        count += 1
    ffmpeg.stdin.close()
    ffmpeg.wait()
    print(f'wrote {out} ({count} frames, {count / FPS:.1f} s)')


if __name__ == '__main__':
    main()
