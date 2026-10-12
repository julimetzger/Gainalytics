"""Small adb driver for the marketing captures (GH-485).

Elements are found through `uiautomator dump` by testID (resource-id), content-desc
or text, so the scripted taps survive layout changes. Every tap is guarded by a
foreground check: system dialogs (sign-in prompts, update agents, the file picker)
are never answered by a blind tap.
"""
import math
import os
import re
import subprocess
import time
from dataclasses import dataclass

APP_ID = 'com.powerliftingworkoutplanner'
NODE_RE = re.compile(r'<node [^>]*>')
ATTR_RE = {k: re.compile(r' %s="([^"]*)"' % k) for k in ('text', 'resource-id', 'content-desc', 'bounds', 'package')}


class CaptureError(RuntimeError):
    pass


@dataclass
class Node:
    rid: str
    text: str
    desc: str
    package: str
    x1: int
    y1: int
    x2: int
    y2: int

    @property
    def center(self):
        return (self.x1 + self.x2) // 2, (self.y1 + self.y2) // 2

    @property
    def width(self):
        return self.x2 - self.x1


def _unescape(value):
    return (value.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
            .replace('&quot;', '"').replace('&#10;', '\n'))


class Device:
    def __init__(self, serial, log=print):
        self.serial = serial
        self.log = log
        self._recorder = None
        self._record_name = None
        self.record_t0 = None
        self.markers = {}

    # ── adb basics ──────────────────────────────────────────────────────────
    def adb(self, *args, check=True, capture=True, timeout=120):
        cmd = ['adb', '-s', self.serial, *args]
        res = subprocess.run(cmd, capture_output=capture, timeout=timeout)
        if check and res.returncode != 0:
            raise CaptureError(f'{" ".join(cmd)} failed: {res.stderr.decode(errors="replace")}')
        return res.stdout.decode(errors='replace') if capture else ''

    def sh(self, command, check=True, timeout=120):
        return self.adb('shell', command, check=check, timeout=timeout)

    def focus(self):
        out = self.sh('dumpsys window | grep -i mCurrentFocus', check=False)
        return out.strip()

    def ensure_app_foreground(self, wait=20):
        deadline = time.time() + wait
        while time.time() < deadline:
            focus = self.focus()
            if APP_ID in focus:
                return
            if 'Bouncer' in focus or 'NotificationShade' in focus:
                raise CaptureError(f'phone is locked or the shade is open: {focus}')
            self.log(f'  app not in foreground ({focus}) - bringing it back, no dialog is answered')
            self.sh(f'am start -n {APP_ID}/.MainActivity', check=False)
            time.sleep(2)
        raise CaptureError(f'app did not come to the foreground: {self.focus()}')

    # ── hierarchy ───────────────────────────────────────────────────────────
    def dump(self, retries=3):
        for attempt in range(retries):
            out = self.adb('exec-out', 'sh', '-c',
                           'rm -f /sdcard/gh485.xml; uiautomator dump /sdcard/gh485.xml >/dev/null 2>&1; cat /sdcard/gh485.xml',
                           check=False)
            if '<hierarchy' in out:
                return self._parse(out)
            time.sleep(1 + attempt)
        raise CaptureError('uiautomator dump failed (a ticking timer on screen prevents an idle state)')

    @staticmethod
    def _parse(xml):
        nodes = []
        for match in NODE_RE.finditer(xml):
            raw = match.group(0)
            attrs = {k: (r.search(raw).group(1) if r.search(raw) else '') for k, r in ATTR_RE.items()}
            b = re.findall(r'\d+', attrs['bounds'])
            if len(b) != 4:
                continue
            nodes.append(Node(attrs['resource-id'], _unescape(attrs['text']), _unescape(attrs['content-desc']),
                              attrs['package'], *map(int, b)))
        return nodes

    def find(self, rid=None, text=None, desc=None, timeout=20, nodes=None, required=True):
        """rid/text/desc are full-string regexes."""
        deadline = time.time() + timeout
        while True:
            try:
                current = nodes if nodes is not None else self.dump(retries=1)
            except CaptureError:
                current = []
            for node in current:
                if rid is not None and not re.fullmatch(rid, node.rid):
                    continue
                if text is not None and not re.fullmatch(text, node.text, re.S):
                    continue
                if desc is not None and not re.fullmatch(desc, node.desc, re.S):
                    continue
                if node.x2 <= node.x1 or node.y2 <= node.y1:
                    continue
                return node
            if nodes is not None or time.time() > deadline:
                if required:
                    raise CaptureError(f'element not found: rid={rid} text={text} desc={desc}'
                                       + ('' if current else ' (uiautomator dump failed)'))
                return None
            time.sleep(0.7)

    def exists(self, **kw):
        return self.find(timeout=0, required=False, **kw) is not None

    # ── input ───────────────────────────────────────────────────────────────
    def tap(self, x, y, guard=True):
        if guard:
            self.ensure_app_foreground()
        self.sh(f'input tap {int(x)} {int(y)}')

    def tap_el(self, settle=1.0, **kw):
        node = self.find(**kw)
        self.tap(*node.center)
        time.sleep(settle)
        return node

    def swipe(self, x1, y1, x2, y2, ms=400, settle=0.8):
        self.ensure_app_foreground()
        self.sh(f'input swipe {int(x1)} {int(y1)} {int(x2)} {int(y2)} {int(ms)}')
        time.sleep(settle)

    def drag_path(self, points, step_s=0.03):
        """Finger drag along `points` (one adb call, smooth enough for recordings)."""
        self.ensure_app_foreground()
        x0, y0 = points[0]
        parts = [f'input motionevent DOWN {int(x0)} {int(y0)}']
        for x, y in points[1:]:
            parts.append(f'sleep {step_s}')
            parts.append(f'input motionevent MOVE {int(x)} {int(y)}')
        parts.append(f'input motionevent UP {int(points[-1][0])} {int(points[-1][1])}')
        self.sh('; '.join(parts), timeout=300)

    def drag_line(self, x1, y1, x2, y2, steps=12, step_s=0.03):
        self.drag_path([(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps) for i in range(steps + 1)], step_s)

    def drag_arc(self, cx, cy, r, a0, a1, step_deg=6, step_s=0.03):
        n = max(2, int(abs(a1 - a0) / step_deg))
        pts = [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
                cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
        self.drag_path(pts, step_s)

    def text_input(self, text):
        self.sh("input text '%s'" % text.replace(' ', '%s').replace("'", ''))

    def back(self, settle=1.0):
        self.sh('input keyevent 4')
        time.sleep(settle)

    def hide_keyboard(self):
        if 'mInputShown=true' in self.sh('dumpsys input_method | grep mInputShown', check=False):
            self.back()

    # ── capture ─────────────────────────────────────────────────────────────
    def screencap(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data = subprocess.run(['adb', '-s', self.serial, 'exec-out', 'screencap', '-p'],
                              capture_output=True, check=True).stdout
        if len(data) < 25000:
            raise CaptureError(f'screencap suspiciously small ({len(data)} bytes) - screen off?')
        with open(path, 'wb') as fh:
            fh.write(data)
        self.log(f'  screenshot {os.path.basename(path)}')

    def start_record(self, name):
        self.sh('rm -f /sdcard/gh485_rec.mp4', check=False)
        self._recorder = subprocess.Popen(
            ['adb', '-s', self.serial, 'shell', 'screenrecord', '--bit-rate', '16000000', '--time-limit', '180',
             '/sdcard/gh485_rec.mp4'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self._record_name = name
        time.sleep(0.8)  # screenrecord needs a moment before the first frame
        self.record_t0 = time.time()
        self.markers = {}
        self.log(f'  recording {name} ...')

    def mark(self, label):
        if self.record_t0 is not None:
            self.markers[label] = round(time.time() - self.record_t0, 2)
            self.log(f'    marker {label} @ {self.markers[label]}s')

    def stop_record(self, out_path):
        self.mark('end')
        self.sh('pkill -INT screenrecord', check=False)
        try:
            self._recorder.wait(timeout=20)
        except subprocess.TimeoutExpired:
            self._recorder.kill()
        time.sleep(1.5)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        self.adb('pull', '/sdcard/gh485_rec.mp4', out_path)
        self.sh('rm -f /sdcard/gh485_rec.mp4', check=False)
        markers, self.markers, self.record_t0 = self.markers, {}, None
        self.log(f'  saved {os.path.basename(out_path)}')
        return markers
