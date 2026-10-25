#!/usr/bin/env python3
"""GH-355 — assert the Training sub-tab strip reads Plan, Train, Analysis left-to-right.

Why pixels instead of Maestro selectors:
    TrainingModeTabs renders inside TrainingsPlanNode's `NestableScrollContainer`
    (react-native-draggable-flatlist). That subtree is absent from the Android
    accessibility hierarchy on <phone-serial>, so neither `uiautomator dump` nor Maestro can
    see `subtab-plan` / `subtab-train` / `subtab-analysis` or any pane text. An
    `assertVisible: {text: Train, rightOf: {text: Plan}}` cannot pass there — on the old
    order *or* the new one — so it would assert nothing.

What this asserts, from two real-device screenshots of the same screen (same navigation,
same training), one taken with the OLD tab order and one with the NEW one:

  1. The active-tab underline sits in slot 1 (middle) BEFORE and slot 0 (left) AFTER.
     The screen is a PLANNED training, which auto-selects the Plan sub-tab, so the
     underline marks where "Plan" lives.
  2. The rendered glyphs swapped: before-slot0 == after-slot1 and before-slot1 ==
     after-slot0 (same label bitmap, different slot), while slot 2 is unchanged.
     That is precisely "Train and Plan swapped, Analysis stayed third".

Usage:
    python3 __tests__/e2e/scripts/assert-gh355-tab-order.py --before A.png --after B.png
Exit code 0 = all assertions hold.
"""
import argparse
import sys

import numpy as np
from PIL import Image

# Tab strip geometry on a 720x1600 capture of <phone-serial>.
LABEL_BAND = (160, 195)  # y range containing the tab label glyphs
UNDERLINE_BAND = (195, 215)  # y range containing the active-tab underline
SCROLLBAR_X = 700  # ignore the right-edge scrollbar artifact
N_SLOTS = 3
GLYPH_MIN_SUM = 300  # R+G+B threshold separating label text from the dark background
UNDERLINE_MIN_RUN = 80  # px; the underline is ~145px wide, glyph noise is far shorter
MIN_IOU = 0.80  # same glyph rendered at a different x should match near-perfectly


def load(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(int)
    if a.shape[1] != 720:
        raise SystemExit(f"{path}: expected a 720px-wide device capture, got {a.shape[1]}")
    return a


def slot_width(img):
    return img.shape[1] // N_SLOTS


def underline_slot(img, path):
    """Slot index (0..2) of the active-tab underline."""
    y0, y1 = UNDERLINE_BAND
    band = img[y0:y1, :SCROLLBAR_X]
    # The underline is the primary colour (~176,197,249): bright, and clearly blue-shifted.
    is_primary = (band[:, :, 2] > 200) & (band[:, :, 2] - band[:, :, 0] > 40)
    cols = np.where(is_primary.any(axis=0))[0]
    if cols.size == 0:
        raise SystemExit(f"{path}: no active-tab underline found in y={y0}..{y1}")
    # Longest contiguous run of underline columns.
    splits = np.split(cols, np.where(np.diff(cols) != 1)[0] + 1)
    run = max(splits, key=len)
    if len(run) < UNDERLINE_MIN_RUN:
        raise SystemExit(f"{path}: underline run too short ({len(run)}px) — geometry changed?")
    centre = (run[0] + run[-1]) / 2
    return int(centre // slot_width(img)), (int(run[0]), int(run[-1]))


def glyph_mask(img, slot):
    """Tight binary bitmap of the label glyphs inside one tab slot."""
    y0, y1 = LABEL_BAND
    w = slot_width(img)
    x0, x1 = slot * w, min((slot + 1) * w, SCROLLBAR_X)
    band = img[y0:y1, x0:x1]
    mask = band.sum(axis=2) > GLYPH_MIN_SUM
    if not mask.any():
        raise SystemExit(f"slot {slot}: no label glyphs found in y={y0}..{y1}")
    rows, cols = np.where(mask)
    return mask[rows.min(): rows.max() + 1, cols.min(): cols.max() + 1]


def iou(a, b):
    """Intersection-over-union of two tight glyph bitmaps, padded to a common shape."""
    h, w = max(a.shape[0], b.shape[0]), max(a.shape[1], b.shape[1])
    pa = np.zeros((h, w), bool)
    pb = np.zeros((h, w), bool)
    pa[: a.shape[0], : a.shape[1]] = a
    pb[: b.shape[0], : b.shape[1]] = b
    union = (pa | pb).sum()
    return (pa & pb).sum() / union if union else 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--before", required=True, help="720px capture with the OLD tab order")
    ap.add_argument("--after", required=True, help="720px capture with the NEW tab order")
    args = ap.parse_args()

    before, after = load(args.before), load(args.after)
    failures = []

    b_slot, b_run = underline_slot(before, args.before)
    a_slot, a_run = underline_slot(after, args.after)
    print(f"underline BEFORE: slot {b_slot} (x {b_run[0]}..{b_run[1]})")
    print(f"underline AFTER : slot {a_slot} (x {a_run[0]}..{a_run[1]})")
    if b_slot != 1:
        failures.append(f"expected the active (Plan) tab in slot 1 before the change, got {b_slot}")
    if a_slot != 0:
        failures.append(f"expected the active (Plan) tab in slot 0 after the change, got {a_slot}")

    b = [glyph_mask(before, i) for i in range(N_SLOTS)]
    a = [glyph_mask(after, i) for i in range(N_SLOTS)]
    for i, (bm, am) in enumerate(zip(b, a)):
        print(f"slot {i}: before glyph {bm.shape[1]}x{bm.shape[0]}px, after glyph {am.shape[1]}x{am.shape[0]}px")

    checks = [
        ("before slot 0 ('Train') == after slot 1", b[0], a[1]),
        ("before slot 1 ('Plan')  == after slot 0", b[1], a[0]),
        ("slot 2 ('Analysis') unchanged", b[2], a[2]),
        # And the labels really did move: slot 0 must NOT show the same glyph as before.
    ]
    for name, x, y in checks:
        score = iou(x, y)
        ok = score >= MIN_IOU
        print(f"[{'OK ' if ok else 'FAIL'}] {name}: IoU={score:.3f}")
        if not ok:
            failures.append(f"{name}: IoU={score:.3f} < {MIN_IOU}")

    swapped = iou(b[0], a[0])
    print(f"[{'OK ' if swapped < MIN_IOU else 'FAIL'}] slot 0 label actually changed: IoU(before0, after0)={swapped:.3f} (must be < {MIN_IOU})")
    if swapped >= MIN_IOU:
        failures.append(f"slot 0 label did not change: IoU={swapped:.3f}")

    if failures:
        print("\nFAILED:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("\nPASS: tab strip swapped Train/Plan and reads Plan, Train, Analysis left-to-right.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
