#!/usr/bin/env python3
"""Local stand-in for the Anthropic Messages API, used only while capturing (GH-485).

The captures must not need an account or a paid API key, so `capture.py` points the
chat at this server for the duration of the AI-chat scene (temporary, uncommitted
patch of `ANTHROPIC_MESSAGES_URL`, reverted right after). The answer below is a
scripted example of what the coach typically replies to the demo question. Run the
capture with `--ai-key <key>` to record a real model answer instead.

The last request body (including the training context the app sends) is written to
`docs/marketing/build/ai_request.json` so the scripted answer can be kept in line
with the demo data.
"""
import argparse
import json
import pathlib
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

REPO = pathlib.Path(__file__).resolve().parents[3]
ANSWER = """**Your squat is trending up — nice work.**

- **Estimated 1RM:** ~204 kg today, +0.2 kg vs. your last session and close to your 225 kg PR.
- **Today's top set:** 175 kg × 5 @ RIR 0. Your video shows **41 % velocity loss** over the set, so that really was close to failure.
- **Volume:** 7.6 t this micro (+2 % vs. M6), legs got the most work (Quads 4 sets, Glutes 2.5).

**Next week**
1. Keep 175 kg but stop the top set at **~25 % velocity loss** (≈ RIR 2) — you'll recover faster for D2.
2. Add one back-off set of 8 × 150 kg.
3. Re-film the top set: if rep 1 is faster than 0.88 m/s, add 2.5 kg."""


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        out = REPO / 'docs/marketing/build/ai_request.json'
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(body)
        time.sleep(1.8)  # let the "thinking" state show up in the recording
        payload = json.dumps({
            'id': 'msg_demo', 'type': 'message', 'role': 'assistant', 'model': 'demo',
            'content': [{'type': 'text', 'text': ANSWER}], 'stop_reason': 'end_turn',
        }).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        print('mock-ai:', fmt % args, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8787)
    args = parser.parse_args()
    HTTPServer(('127.0.0.1', args.port), Handler).serve_forever()


if __name__ == '__main__':
    main()
