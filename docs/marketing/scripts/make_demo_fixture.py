#!/usr/bin/env python3
"""Build the demo data set used for the marketing captures (GH-485).

The baseline fixture (`__tests__/e2e/maestro/fixtures/baseline.gains`) is months
old, so every "this week" / "last 28 days" card on a fresh import is empty. This
script copies it and shifts every timestamp by one offset so the newest finished
training ends `--days-ago` days before now. It also drops the seeded video
analyses: they have no local video and only render a "no video path" hint. The
capture script imports a real clip through the app instead.

Usage:
    python3 docs/marketing/scripts/make_demo_fixture.py [--out PATH] [--days-ago N]

Regenerate right before every capture run: a shifted fixture goes stale again
after a week.
"""
import argparse
import datetime as dt
import json
import pathlib
import re

REPO = pathlib.Path(__file__).resolve().parents[3]
BASELINE = REPO / '__tests__/e2e/maestro/fixtures/baseline.gains'
ISO_RE = re.compile(r'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$')
MS_MIN, MS_MAX = 1.4e12, 1.9e12


def newest_training_end(data):
    ends = [t.get('end') for t in data['trainings']['byId'].values()]
    return max(e for e in ends if isinstance(e, (int, float)) and MS_MIN < e < MS_MAX)


def shift(node, offset_ms):
    if isinstance(node, dict):
        return {k: shift(v, offset_ms) for k, v in node.items()}
    if isinstance(node, list):
        return [shift(v, offset_ms) for v in node]
    if isinstance(node, bool):
        return node
    if isinstance(node, (int, float)) and MS_MIN < node < MS_MAX:
        return node + offset_ms
    if isinstance(node, str) and ISO_RE.match(node):
        parsed = dt.datetime.strptime(node, '%Y-%m-%dT%H:%M:%S.%fZ' if '.' in node else '%Y-%m-%dT%H:%M:%SZ')
        moved = parsed + dt.timedelta(milliseconds=offset_ms)
        return moved.strftime('%Y-%m-%dT%H:%M:%S.') + f'{moved.microsecond // 1000:03d}Z'
    return node


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default=str(REPO / 'docs/marketing/build/demo.gains'))
    parser.add_argument('--days-ago', type=float, default=1.0)
    args = parser.parse_args()

    data = json.loads(BASELINE.read_text())
    target = dt.datetime.now().timestamp() * 1000 - args.days_ago * 86400000
    offset_ms = int(target - newest_training_end(data))
    data = shift(data, offset_ms)
    data['videoAnalyses'] = {'byId': {}, 'allIds': []}

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data))
    newest = dt.datetime.fromtimestamp(newest_training_end(data) / 1000)
    print(f'wrote {out} (shifted {offset_ms / 86400000:.1f} days, newest training ends {newest:%Y-%m-%d %H:%M})')


if __name__ == '__main__':
    main()
