#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path

from runtime_state import load_state, reserve_emulator, release_emulator, save_state, state_file_path


def adb_devices_command(adb_host: str | None, adb_port: str | None) -> list[str]:
    command = ["adb"]
    if adb_host:
        command.extend(["-H", adb_host])
    if adb_port:
        command.extend(["-P", adb_port])
    command.append("devices")
    return command


def list_emulators(adb_host: str | None, adb_port: str | None) -> tuple[list[str], str | None]:
    command = adb_devices_command(adb_host, adb_port)
    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as error:
        details = error.stderr.strip() or error.stdout.strip() or str(error)
        return [], details

    emulators: list[str] = []
    for line in completed.stdout.splitlines():
        line = line.strip()
        if not line or line.startswith("List of devices"):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        serial, status = parts[0], parts[1]
        if serial.startswith("emulator-") and status == "device":
            emulators.append(serial)
    return emulators, None


def main() -> None:
    parser = argparse.ArgumentParser(description="Discover and reserve free Android emulators.")
    parser.add_argument("--ticket-id", help="Ticket id to reserve an emulator for")
    parser.add_argument("--state-file", default=None, help="Custom state file path")
    parser.add_argument("--release-emulator", help="Release a reservation by emulator serial")
    parser.add_argument("--adb-host", default=os.environ.get("ADB_HOST"))
    parser.add_argument("--adb-port", default=os.environ.get("ADB_PORT"))
    args = parser.parse_args()

    state_path = Path(args.state_file).resolve() if args.state_file else state_file_path()
    state = load_state(state_path)
    discovered, adb_error = list_emulators(args.adb_host, args.adb_port)
    reserved = set(state.get("reservations", {}).keys())

    if args.release_emulator:
        release_emulator(state, args.release_emulator)
        save_state(state, state_path)
        print(json.dumps({"released": args.release_emulator}, indent=2))
        return

    free = [serial for serial in discovered if serial not in reserved]
    if not args.ticket_id:
        print(
            json.dumps(
                {
                    "adb_error": adb_error,
                    "discovered": discovered,
                    "reserved": sorted(reserved),
                    "free": free
                },
                indent=2,
            )
        )
        return

    if adb_error:
        print(
            json.dumps(
                {
                    "ticket_id": args.ticket_id,
                    "emulator_serial": None,
                    "free": [],
                    "adb_error": adb_error,
                },
                indent=2,
            )
        )
        return

    if not free:
        print(json.dumps({"ticket_id": args.ticket_id, "emulator_serial": None, "free": []}, indent=2))
        return

    emulator_serial = free[0]
    reserve_emulator(state, args.ticket_id, emulator_serial)
    save_state(state, state_path)
    print(
        json.dumps(
            {
                "ticket_id": args.ticket_id,
                "emulator_serial": emulator_serial,
                "free_after": free[1:],
                "adb_error": None,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
