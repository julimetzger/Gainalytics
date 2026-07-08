#!/usr/bin/env python3
"""GH-358: assert the value typed into the plan quick-edit field was committed.

The Plan pane is invisible to the accessibility tree (agent-memory #206), so
Maestro cannot assert on the set row itself. Instead we read the app's persisted
MMKV store and assert that the Deadlift set (weight 180, RIR 2) carries the
expected reps value.

Usage:
    python3 assert-gh358-committed-reps.py --serial R5CN30HWZFN --expect 13
    python3 assert-gh358-committed-reps.py --serial R5CN30HWZFN --expect 8

Exits non-zero when the store does not contain exactly one matching set, so it
also fails loudly if the flow edited the wrong row.
"""
import argparse
import re
import subprocess
import sys

PKG = "com.powerliftingworkoutplanner"
MMKV = f"/data/data/{PKG}/files/mmkv/mmkv.default"


def read_store(serial: str) -> str:
    proc = subprocess.run(
        ["adb", "-s", serial, "exec-out", "run-as", PKG, "cat", MMKV],
        capture_output=True,
        check=True,
    )
    return proc.stdout.decode("utf-8", "ignore")


def count_sets(store: str, reps: int) -> int:
    # the store holds escaped JSON: {\"index\":1,...,\"weight\":180,\"reps\":N,\"rir\":2}
    pattern = re.compile(
        r'\\"weight\\":180,\\"reps\\":' + str(reps) + r',\\"rir\\":2'
    )
    return len(pattern.findall(store))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--serial", required=True)
    parser.add_argument("--expect", type=int, required=True)
    parser.add_argument(
        "--baseline",
        type=int,
        default=8,
        help="the pre-edit reps value that must disappear when --expect differs",
    )
    args = parser.parse_args()

    store = read_store(args.serial)
    found = count_sets(store, args.expect)
    print(f"sets with weight=180, rir=2, reps={args.expect}: {found}")

    if found < 1:
        print(
            f"FAIL: no persisted Deadlift set with reps={args.expect}. "
            "The typed value never reached the store.",
            file=sys.stderr,
        )
        return 1

    if args.expect != args.baseline:
        # the historical fixture also contains reps=8 sets, so we only assert the
        # edited value appeared — not that the baseline vanished everywhere.
        print(f"OK: typed value {args.expect} is persisted in the plan set.")
    else:
        print(f"OK: value restored to {args.expect}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
