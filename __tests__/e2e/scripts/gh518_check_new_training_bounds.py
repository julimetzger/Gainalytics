#!/usr/bin/env python3
"""GH-518: prove from a uiautomator dump that the "New Training" FAB lies over no card control.

Maestro on this build cannot read element bounds, so the flows stop at the state to check and
this script compares the bounds in a `uiautomator dump` of the Training home:

  * the plan list (training-home-list) ends above the FAB's top edge — content scrolled to ANY
    position can therefore never be drawn under the FAB;
  * no control of the Next Training card or of a plan card (button, targets, star, menu, row)
    intersects the FAB;
  * --expect extended|collapsed: the FAB shows its label (wide) or only the icon (square);
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


def bounds(node):
    m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
    return tuple(int(v) for v in m.groups()) if m else None


def node_id(node):
    return node.get('resource-id') or ''


def intersects(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('dump')
    parser.add_argument('--expect', choices=['extended', 'collapsed'])
    parser.add_argument('--tap-out')
    args = parser.parse_args()

    nodes = list(ET.parse(args.dump).iter('node'))
    fab = next((bounds(n) for n in nodes if node_id(n) == 'add-trainings-plan'), None)
    lst = next((bounds(n) for n in nodes if node_id(n) == 'training-home-list'), None)
    if lst is None:
        # Builds before GH-518 had no list testID: take the screen's vertical ScrollView.
        scrolls = [bounds(n) for n in nodes if n.get('class') == 'android.widget.ScrollView' and n.get('scrollable') == 'true']
        lst = max(scrolls, key=lambda r: (r[3] - r[1]), default=None)
    failures = []
    if fab is None or lst is None:
        print(f'FAIL: FAB {fab} or list {lst} missing from the dump')
        return 1
    print(f'FAB add-trainings-plan {fab}  list training-home-list {lst}')

    if lst[3] <= fab[1]:
        print(f'OK   list bottom {lst[3]} <= FAB top {fab[1]} (no scroll position can put a card under the FAB)')
    else:
        failures.append(f'list bottom {lst[3]} > FAB top {fab[1]}')

    checked = 0
    seen = set()
    for n in nodes:
        nid = node_id(n)
        b = bounds(n)
        if not CARD_CONTROLS.match(nid) or b is None or b[2] <= b[0] or b[3] <= b[1] or (nid, b) in seen:
            continue
        seen.add((nid, b))
        checked += 1
        if intersects(b, fab):
            failures.append(f'{nid} {b} intersects FAB {fab}')
        else:
            print(f'OK   {nid} {b} is clear of the FAB')
    if checked == 0:
        failures.append('no card control visible — nothing was checked')

    width, height = fab[2] - fab[0], fab[3] - fab[1]
    if args.expect == 'extended':
        (print if width > 2 * height else lambda m: failures.append(m))(
            f'FAB extended: width {width} > 2 x height {height}' if width > 2 * height else f'FAB not extended: width {width}, height {height}'
        )
    if args.expect == 'collapsed':
        (print if width <= 1.3 * height else lambda m: failures.append(m))(
            f'FAB collapsed to the icon: width {width} <= 1.3 x height {height}' if width <= 1.3 * height else f'FAB not collapsed: width {width}, height {height}'
        )

    if args.tap_out:
        button = next((bounds(n) for n in nodes if node_id(n) == 'next-training-start-button'), None)
        if button is None or button[3] - button[1] < 10:
            failures.append(f'Next Training button not visible enough to tap: {button}')
        else:
            x, y = button[2] - 30, button[3] - 6
            with open(args.tap_out, 'w') as f:
                f.write(f'{x},{y}')
            print(f'TAP  lower-right corner of next-training-start-button {button}: {x},{y}')

    for f in failures:
        print(f'FAIL {f}')
    print('RESULT', 'FAILED' if failures else 'PASSED')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
