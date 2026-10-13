#!/usr/bin/env python3
"""GH-522: prove from a uiautomator dump of Settings that the two timer delete buttons line up.

Maestro on this build cannot read element bounds, so gh522_settings_refinement.yaml stops on
the Settings screen and this script compares the bounds of

  * settings-pause-timer-delete and settings-finish-training-timer-delete: same left and right
    edge (the Pause one right-aligned like the Finish one);
  * each delete button lies fully inside its own row (a long title or a large system font must
    not push it out of the row / card), and to the right of its time button.

Exit code 0 = all checks passed; every check is printed with its numbers.
"""
import re
import sys
import xml.etree.ElementTree as ET

ROWS = ('settings-pause-timer', 'settings-finish-training-timer')


def bounds(node):
    m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
    return tuple(int(v) for v in m.groups()) if m else None


def main():
    if len(sys.argv) != 2:
        print(f'usage: {sys.argv[0]} <uiautomator dump.xml>')
        return 2
    nodes = list(ET.parse(sys.argv[1]).iter('node'))
    by_id = lambda nid: next((bounds(n) for n in nodes if n.get('resource-id') == nid), None)

    failures = []

    def check(ok, message):
        print(('PASS ' if ok else 'FAIL ') + message)
        if not ok:
            failures.append(message)

    deletes = {}
    for row_id in ROWS:
        row, button, delete = by_id(f'{row_id}-row'), by_id(row_id), by_id(f'{row_id}-delete')
        if not (row and button and delete):
            check(False, f'{row_id}: row/button/delete on screen (row={row}, button={button}, delete={delete})')
            continue
        deletes[row_id] = delete
        check(row[0] <= delete[0] and delete[2] <= row[2], f'{row_id}: delete {delete} inside row {row}')
        check(button[2] <= delete[0], f'{row_id}: time button right edge {button[2]} <= delete left edge {delete[0]}')

    if len(deletes) == 2:
        pause, finish = deletes[ROWS[0]], deletes[ROWS[1]]
        check(pause[0] == finish[0], f'delete left edges equal: pause {pause[0]} vs finish {finish[0]}')
        check(pause[2] == finish[2], f'delete right edges equal: pause {pause[2]} vs finish {finish[2]}')

    print('RESULT', 'FAILED' if failures else 'PASSED')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
