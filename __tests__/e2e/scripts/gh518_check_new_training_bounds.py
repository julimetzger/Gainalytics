#!/usr/bin/env python3
"""GH-518: prove from a uiautomator dump that the "New Training" button lies over no card control.

Owner feedback on PR #519: no FAB and no strip below the list — a small button in the "Plans"
header, right above the search, that does not make the header taller. Maestro on this build
cannot read element bounds, so the flows stop at the state to check and this script compares
the bounds in a `uiautomator dump` of the Training home:

  * the button (add-trainings-plan) is part of the list: inside training-home-list and inside
    the Plans header (plans-header), so it scrolls with the content and never floats over a card;
  * it sits on the right, above the search field, and its label "New Training" is not clipped;
  * the header is no taller than --max-header-dp (the header's height before the button: 40 dp);
  * no control of the Next Training card or of a plan card (button, targets, star, menu, row)
    intersects the button;
  * while the header is scrolled off screen the button is gone with it — nothing is left floating;
  * --tap-out FILE: writes "x,y" for a tap into the lower-right corner of the visible
    Next Training button — exactly where the old floating FAB lay over it.

Exit code 0 = all checks passed; every check is printed with its numbers.
"""
import argparse
import re
import sys
import xml.etree.ElementTree as ET

CARD_CONTROLS = re.compile(
    r'^(next-training-start-button|next-training-target-\d+|plan-select-\d+|edit-trainings-plan-\d+|plan-row-\d+)$'
)
BUTTON = 'add-trainings-plan'


def bounds(node):
    m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
    return tuple(int(v) for v in m.groups()) if m else None


def node_id(node):
    return node.get('resource-id') or ''


def intersects(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def inside(inner, outer):
    return outer[0] <= inner[0] and outer[1] <= inner[1] and inner[2] <= outer[2] and inner[3] <= outer[3]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('dump')
    parser.add_argument('--density', type=float, default=2.625, help='px per dp (adb shell wm density / 160)')
    parser.add_argument('--max-header-dp', type=float, default=40)
    parser.add_argument('--require-button', action='store_true', help='the Plans header must be on screen')
    parser.add_argument('--tap-out')
    args = parser.parse_args()

    nodes = list(ET.parse(args.dump).iter('node'))
    by_id = lambda nid: next((bounds(n) for n in nodes if node_id(n) == nid), None)
    button = by_id(BUTTON)
    label = by_id(f'{BUTTON}-text')
    header = by_id('plans-header')
    search = by_id('plans-search-field')
    lst = by_id('training-home-list')
    failures = []
    ok = print

    if lst is None:
        # Builds before GH-518 had no list testID: take the screen's vertical ScrollView.
        scrolls = [bounds(n) for n in nodes if n.get('class') == 'android.widget.ScrollView' and n.get('scrollable') == 'true']
        lst = max(scrolls, key=lambda r: (r[3] - r[1]), default=None)
    if lst is None:
        print('FAIL: training-home-list missing from the dump')
        return 1
    print(f'list training-home-list {lst}  header plans-header {header}  button {BUTTON} {button}  search {search}')

    if button is None:
        if args.require_button:
            failures.append(f'{BUTTON} not on screen')
        else:
            ok(f'OK   the Plans header is scrolled off screen and {BUTTON} with it — nothing floats over the cards')
    else:
        if inside(button, lst):
            ok(f'OK   {BUTTON} {button} lies inside the list {lst} (scrolls with the content)')
        else:
            failures.append(f'{BUTTON} {button} lies outside the list {lst}')
        if header is None or not inside(button, header):
            failures.append(f'{BUTTON} {button} is not inside the Plans header {header}')
        else:
            ok(f'OK   {BUTTON} {button} lies inside the Plans header {header}')
            max_px = round(args.max_header_dp * args.density) + 1
            height = header[3] - header[1]
            if height <= max_px:
                ok(f'OK   Plans header height {height}px ({height / args.density:.1f} dp) <= {args.max_header_dp:g} dp ({max_px}px): the button adds no height')
            else:
                failures.append(f'Plans header height {height}px ({height / args.density:.1f} dp) > {args.max_header_dp:g} dp')
        if search is not None:
            if button[3] <= search[1] and button[0] >= (lst[0] + lst[2]) / 2:
                ok(f'OK   {BUTTON} bottom {button[3]} <= search top {search[1]}, on the right half (left {button[0]})')
            else:
                failures.append(f'{BUTTON} {button} is not on the right above the search {search}')
        if label is None or not inside(label, button):
            failures.append(f'label {BUTTON}-text {label} is missing or clipped by the button {button}')
        else:
            ok(f'OK   label "New Training" {label} fits inside the button {button}')

    checked = 0
    seen = set()
    for n in nodes:
        nid = node_id(n)
        b = bounds(n)
        if not CARD_CONTROLS.match(nid) or b is None or b[2] <= b[0] or b[3] <= b[1] or (nid, b) in seen:
            continue
        seen.add((nid, b))
        checked += 1
        if button is not None and intersects(b, button):
            failures.append(f'{nid} {b} intersects {BUTTON} {button}')
        else:
            ok(f'OK   {nid} {b} is clear of {BUTTON}')
    if checked == 0 and button is None:
        failures.append('neither the button nor a card control is visible — nothing was checked')

    if args.tap_out:
        start = by_id('next-training-start-button')
        if start is None or start[3] - start[1] < 10:
            failures.append(f'Next Training button not visible enough to tap: {start}')
        else:
            x, y = start[2] - 30, start[3] - 6
            with open(args.tap_out, 'w') as f:
                f.write(f'{x},{y}')
            print(f'TAP  lower-right corner of next-training-start-button {start}: {x},{y}')

    for f in failures:
        print(f'FAIL {f}')
    print('RESULT', 'FAILED' if failures else 'PASSED')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
