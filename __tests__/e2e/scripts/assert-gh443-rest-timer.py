#!/usr/bin/env python3
"""GH-443: read the rest timer's time base out of the app's persisted store.

The rest timer's display is a pure function of `restTimer.active.startedAt` and
the wall clock: `target - (now - startedAt)`. So "the timer jumped back" and
"startedAt moved" are the same statement, and `startedAt` is the one of the two
that can be read exactly.

Used together with the Maestro flow `gh443_rest_timer_no_restart.yaml`, which
reads the DISPLAYED value before and after the correction: this script pins the
time base, the flow pins what the user actually sees.

Usage:
    # snapshot the running timer before the correction
    python3 assert-gh443-rest-timer.py --serial emulator-5556 --write before.json

    # after correcting an already logged set: the base must be unchanged
    python3 assert-gh443-rest-timer.py --serial emulator-5556 \
        --expect-same before.json

    # after adding a NEW set: the base must have moved forward
    python3 assert-gh443-rest-timer.py --serial emulator-5556 \
        --expect-restarted before.json

Exits non-zero when the expectation does not hold, and prints both time bases.
"""
import argparse
import json
import re
import subprocess
import sys
import time

PKG = "com.powerliftingworkoutplanner"
MMKV = f"/data/data/{PKG}/files/mmkv/mmkv.default"

# The store holds the settings slice as escaped JSON, e.g.
#   \"restTimer\":{...\"active\":{\"startedAt\":1772318214222,\"targetSeconds\":90,...}}
ACTIVE_RE = re.compile(
    r'\\"active\\":\{\\"startedAt\\":(?P<startedAt>[0-9]+),'
    r'\\"targetSeconds\\":(?P<targetSeconds>[0-9]+)'
)


def read_store(serial: str) -> str:
    proc = subprocess.run(
        ["adb", "-s", serial, "exec-out", "run-as", PKG, "cat", MMKV],
        capture_output=True,
        check=True,
    )
    return proc.stdout.decode("utf-8", "ignore")


def read_active(serial: str) -> dict:
    store = read_store(serial)
    matches = list(ACTIVE_RE.finditer(store))
    if not matches:
        raise SystemExit(
            "FAIL: no active rest timer in the persisted store. Log a set first "
            "(and make sure the app has flushed MMKV, e.g. by leaving the screen)."
        )
    # MMKV appends; the LAST occurrence is the current value.
    last = matches[-1]
    return {
        "startedAt": int(last.group("startedAt")),
        "targetSeconds": int(last.group("targetSeconds")),
        "readAt": int(time.time() * 1000),
    }


def display(active: dict, at_ms: int) -> str:
    """Reproduce app/utils/restTimer.ts formatRestDisplay for a given instant."""
    elapsed = max(0, (at_ms - active["startedAt"]) // 1000)
    remaining = active["targetSeconds"] - elapsed
    if remaining > 0:
        return f"{remaining // 60:02d}:{remaining % 60:02d}"
    overshoot = elapsed - active["targetSeconds"]
    return f"+{overshoot // 60:02d}:{overshoot % 60:02d}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--serial", required=True)
    parser.add_argument("--write", help="write the current time base to this file")
    parser.add_argument(
        "--expect-same",
        metavar="FILE",
        help="fail unless startedAt is byte-identical to the one in FILE",
    )
    parser.add_argument(
        "--expect-restarted",
        metavar="FILE",
        help="fail unless startedAt moved FORWARD compared to FILE",
    )
    args = parser.parse_args()

    current = read_active(args.serial)
    print(
        f"startedAt={current['startedAt']} target={current['targetSeconds']}s "
        f"display@read={display(current, current['readAt'])}"
    )

    if args.write:
        with open(args.write, "w") as handle:
            json.dump(current, handle)
        print(f"wrote {args.write}")

    reference_path = args.expect_same or args.expect_restarted
    if reference_path is None:
        return 0

    with open(reference_path) as handle:
        reference = json.load(handle)
    delta = current["startedAt"] - reference["startedAt"]
    print(f"reference startedAt={reference['startedAt']} delta={delta} ms")

    if args.expect_same:
        if delta != 0:
            print(
                "FAIL: the rest timer was restarted — startedAt moved by "
                f"{delta} ms while it had to stay put."
            )
            return 1
        print("PASS: the rest timer kept its original time base.")
        return 0

    if delta <= 0:
        print(
            "FAIL: the rest timer did NOT restart — startedAt is unchanged or "
            f"went backwards (delta={delta} ms)."
        )
        return 1
    print("PASS: the rest timer restarted, as a new set must.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
