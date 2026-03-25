#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import signal
import sys
import time
from pathlib import Path
from typing import Any

from metro_host import is_process_alive
from runtime_state import load_state, save_state, state_file_path, update_run, utc_now


TERMINAL_STATUSES = {"blocked", "needs_input", "ready_for_review", "accepted", "closed"}
BLOCKED_AGENT_STATUSES = {"blocked", "needs_input", "stalled"}


def normalize_status(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip().lower()


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def safe_summary(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text or None


def summarize_blocker(value: Any) -> str | None:
    text = safe_summary(value)
    if not text:
        return None
    return text.splitlines()[0]


def collect_status_payload(run_dir: Path) -> dict[str, Any] | None:
    status_path = run_dir / "status.json"
    if not status_path.exists():
        return None
    return read_json(status_path)


def effective_status(run: dict[str, Any], status_payload: dict[str, Any] | None) -> str:
    payload_status = normalize_status((status_payload or {}).get("status"))
    if payload_status:
        return payload_status

    state_status = normalize_status(run.get("status"))
    if state_status in TERMINAL_STATUSES:
        return state_status

    worker_alive = is_process_alive(run.get("job_id"))
    if state_status == "running":
        return "running" if worker_alive else "stalled"
    if worker_alive:
        return "running"
    if state_status:
        return state_status
    return "unknown"


def build_ticket_report(ticket_id: str, run: dict[str, Any], runs_root: Path) -> dict[str, Any]:
    run_dir = Path(run.get("run_dir") or (runs_root / ticket_id)).resolve()
    status_payload = collect_status_payload(run_dir)
    status = effective_status(run, status_payload)
    worker_alive = is_process_alive(run.get("job_id"))
    metro_alive = is_process_alive(run.get("metro_pid"))

    payload = status_payload or {}
    summary = safe_summary(payload.get("summary")) or safe_summary(run.get("summary"))
    blocker = safe_summary(payload.get("blocker")) or safe_summary(run.get("blocker"))
    commit_hashes = payload.get("commit_hashes") if isinstance(payload.get("commit_hashes"), list) else run.get("commit_hashes") or []

    return {
        "ticket_id": ticket_id,
        "status": status,
        "state_status": normalize_status(run.get("status")) or None,
        "worker_alive": worker_alive,
        "worker_pid": run.get("job_id"),
        "metro_alive": metro_alive,
        "metro_pid": run.get("metro_pid"),
        "emulator_serial": run.get("emulator_serial"),
        "branch": run.get("branch"),
        "worktree_path": run.get("worktree_path"),
        "run_dir": str(run_dir),
        "summary": summary,
        "blocker": blocker,
        "commit_hashes": commit_hashes,
        "status_file_present": status_payload is not None,
        "updated_at": payload.get("updated_at") or run.get("updated_at"),
    }


def sync_state_from_terminal_statuses(state: dict[str, Any], reports: list[dict[str, Any]]) -> bool:
    changed = False
    for report in reports:
        if report["status"] not in TERMINAL_STATUSES or not report["status_file_present"]:
            continue

        payload = {
            "status": report["status"],
            "summary": report["summary"],
            "blocker": report["blocker"],
            "commit_hashes": report["commit_hashes"],
        }
        run = state.setdefault("runs", {}).get(report["ticket_id"], {})
        current = {
            "status": normalize_status(run.get("status")) or None,
            "summary": safe_summary(run.get("summary")),
            "blocker": safe_summary(run.get("blocker")),
            "commit_hashes": run.get("commit_hashes") or [],
        }
        if current != payload:
            update_run(state, report["ticket_id"], payload)
            changed = True
    return changed


def summarize_counts(reports: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for report in reports:
        counts[report["status"]] = counts.get(report["status"], 0) + 1
    return dict(sorted(counts.items()))


def build_report(state: dict[str, Any], state_path: Path) -> dict[str, Any]:
    runs_root = state_path.parent / "runs"
    reports = [
        build_ticket_report(ticket_id, run, runs_root)
        for ticket_id, run in sorted(state.get("runs", {}).items())
        if isinstance(run, dict)
    ]
    blocked_agents = [
        {
            "ticket_id": report["ticket_id"],
            "status": report["status"],
            "emulator_serial": report["emulator_serial"],
            "blocker": report["blocker"] or ("worker exited without status.json" if report["status"] == "stalled" else None),
        }
        for report in reports
        if report["status"] in BLOCKED_AGENT_STATUSES
    ]
    return {
        "generated_at": utc_now(),
        "state_file": str(state_path),
        "counts": summarize_counts(reports),
        "tickets": reports,
        "blocked_agents": blocked_agents,
    }


def render_text_report(report: dict[str, Any]) -> str:
    lines = [f"Orchestrator status {report['generated_at']}"]
    counts = report.get("counts", {})
    if counts:
        count_summary = ", ".join(f"{status}={count}" for status, count in counts.items())
        lines.append(f"Counts: {count_summary}")
    else:
        lines.append("Counts: none")

    lines.append("Tickets:")
    tickets = report.get("tickets", [])
    if not tickets:
        lines.append("- none")
    else:
        for ticket in tickets:
            detail = f"- {ticket['ticket_id']}: {ticket['status']}"
            if ticket.get("emulator_serial"):
                detail += f" on {ticket['emulator_serial']}"
            if ticket.get("worker_alive"):
                detail += " | worker=alive"
            elif ticket.get("worker_pid"):
                detail += " | worker=stopped"
            if ticket.get("summary"):
                detail += f" | {ticket['summary']}"
            lines.append(detail)

    lines.append("Blocked agents:")
    blocked_agents = report.get("blocked_agents", [])
    if not blocked_agents:
        lines.append("- none")
    else:
        for item in blocked_agents:
            detail = f"- {item['ticket_id']}: {item['status']}"
            if item.get("emulator_serial"):
                detail += f" on {item['emulator_serial']}"
            if item.get("blocker"):
                detail += f" | {item['blocker']}"
            lines.append(detail)

    return "\n".join(lines)


def write_outputs(output_dir: Path, report: dict[str, Any], text: str) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "latest-status.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (output_dir / "latest-status.txt").write_text(text + "\n", encoding="utf-8")
    with (output_dir / "history.log").open("a", encoding="utf-8") as handle:
        handle.write(text)
        handle.write("\n\n")


def run_once(state_path: Path, output_dir: Path, sync_state: bool) -> dict[str, Any]:
    state = load_state(state_path)
    report = build_report(state, state_path)
    if sync_state and sync_state_from_terminal_statuses(state, report["tickets"]):
        save_state(state, state_path)
        state = load_state(state_path)
        report = build_report(state, state_path)
    text = render_text_report(report)
    write_outputs(output_dir, report, text)
    print(text)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Emit periodic orchestrator ticket status feedback.")
    parser.add_argument("--state-file", default=None)
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--interval-seconds", type=int, default=300)
    parser.add_argument("--watch", action="store_true")
    parser.add_argument("--no-sync-state", action="store_true")
    args = parser.parse_args()

    state_path = Path(args.state_file).resolve() if args.state_file else state_file_path()
    output_dir = (
        Path(args.output_dir).resolve()
        if args.output_dir
        else state_path.parent / "monitor"
    )
    sync_state = not args.no_sync_state
    running = True

    def handle_signal(_signum: int, _frame: Any) -> None:
        nonlocal running
        running = False

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    run_once(state_path, output_dir, sync_state)
    if not args.watch:
        return

    while running:
        for _ in range(max(args.interval_seconds, 1)):
            if not running:
                break
            time.sleep(1)
        if running:
            print("", flush=True)
            run_once(state_path, output_dir, sync_state)


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(0)
