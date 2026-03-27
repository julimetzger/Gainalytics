#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path

import yaml

from metro_host import DEFAULT_DEVICE_METRO_PORT, find_free_port, start_or_reuse_metro
from runtime_state import (
    detect_repo_root,
    ensure_runtime_dirs,
    load_state,
    save_state,
    state_file_path,
    update_run,
)


def parse_proxy_socket(proxy_socket: str | None) -> tuple[str, str] | None:
    if not proxy_socket or not proxy_socket.startswith("tcp:"):
        return None

    _, host, port = proxy_socket.split(":", 2)
    return host, port


def configure_proxy_env(env: dict[str, str]) -> tuple[str, str] | None:
    parsed_proxy = parse_proxy_socket(env.get("ORCHESTRATOR_ADB_PROXY_SOCKET"))
    if parsed_proxy is None:
        return None

    host, port = parsed_proxy
    env["ADB_SERVER_SOCKET"] = f"tcp:{host}:{port}"
    env["E2E_ADB_HOST"] = host
    env["E2E_ADB_PORT"] = port
    env["E2E_MAESTRO_HOST"] = host
    return host, port


def configure_maestro_env(env: dict[str, str], run_dir: Path) -> None:
    maestro_home = run_dir / "checks" / "maestro-home"
    maestro_java_home = run_dir / "checks" / "maestro-java-home"
    maestro_home.mkdir(parents=True, exist_ok=True)
    maestro_java_home.mkdir(parents=True, exist_ok=True)

    env["E2E_MAESTRO_HOME"] = str(maestro_home)
    env["MAESTRO_CLI_NO_ANALYTICS"] = "1"

    user_home_override = f"-Duser.home={maestro_java_home}"
    existing_java_tool_options = env.get("JAVA_TOOL_OPTIONS", "").strip()
    if user_home_override not in existing_java_tool_options:
        env["JAVA_TOOL_OPTIONS"] = " ".join(
            part for part in [existing_java_tool_options, user_home_override] if part
        )


DEFAULT_MAESTRO_DRIVER_PORT_START = 7001


def reserve_maestro_driver_port(state: dict, ticket_id: str, prior_run: dict) -> int:
    reserved_ports = {
        run.get("maestro_driver_port")
        for run_ticket_id, run in state.get("runs", {}).items()
        if run_ticket_id != ticket_id and isinstance(run.get("maestro_driver_port"), int)
    }

    existing_port = prior_run.get("maestro_driver_port")
    if isinstance(existing_port, int) and existing_port not in reserved_ports:
        try:
            return find_free_port(start=existing_port, limit=1)
        except RuntimeError:
            pass

    candidate = DEFAULT_MAESTRO_DRIVER_PORT_START
    limit = DEFAULT_MAESTRO_DRIVER_PORT_START + 256
    while candidate < limit:
        if candidate not in reserved_ports:
            try:
                return find_free_port(start=candidate, limit=1)
            except RuntimeError:
                pass
        candidate += 1

    raise RuntimeError(
        f"Could not find a free Maestro driver port in range "
        f"{DEFAULT_MAESTRO_DRIVER_PORT_START}-{limit - 1}"
    )


def load_ticket(path: Path) -> dict:
    raw_text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        return json.loads(raw_text)
    return yaml.safe_load(raw_text)


def load_skill_content(skill_name: str) -> str | None:
    """Return the content of a SKILL.md for the given skill, frontmatter stripped, or None if not found."""
    repo_root = detect_repo_root()
    skill_path = repo_root / "orchestrator" / "codex-skills" / skill_name / "SKILL.md"
    if not skill_path.exists():
        return None
    content = skill_path.read_text(encoding="utf-8")
    # Strip YAML frontmatter (--- ... ---) so the prompt does not start with '--'
    # which the claude CLI would misparse as an option.
    if content.startswith("---"):
        end = content.find("\n---", 3)
        if end != -1:
            content = content[end + 4:].lstrip("\n")
    return content


def build_prompt(
    ticket: dict,
    worktree_path: Path,
    branch: str,
    emulator_serial: str,
    run_dir: Path,
    review_feedback: list[str] | None = None,
    proxy_host: str | None = None,
    proxy_port: str | None = None,
    metro_host: str | None = None,
    metro_port: int | None = None,
    metro_device_port: int = DEFAULT_DEVICE_METRO_PORT,
    maestro_driver_port: int | None = None,
    skill_preamble: str | None = None,
) -> str:
    acceptance = "\n".join(f"- {item}" for item in ticket.get("acceptanceCriteria", [])) or "- none"
    constraints = "\n".join(f"- {item}" for item in ticket.get("constraints", [])) or "- none"
    components = "\n".join(f"- {item}" for item in ticket.get("components", [])) or "- none"
    feedback_items = review_feedback if review_feedback is not None else ticket.get("review_feedback", [])
    feedback = "\n".join(f"- {item}" for item in feedback_items) or "- none"
    proxy_instructions = ""
    if proxy_host and proxy_port:
        proxy_instructions = f"""
- adb_proxy_host: {proxy_host}
- adb_proxy_port: {proxy_port}
- prefer explicit adb commands like `adb -H {proxy_host} -P {proxy_port} ...` for emulator verification
- prefer explicit maestro script args like `--host {proxy_host} --adb-host {proxy_host} --adb-port {proxy_port}` instead of relying only on inherited env
""".rstrip()
    metro_instructions = ""
    if metro_host and metro_port:
        metro_instructions = f"""
- host_metro_host: {metro_host}
- host_metro_port: {metro_port}
- device_metro_port: {metro_device_port}
- a host Metro process is already running for this worktree; reuse it instead of starting a new packager
- for emulator validation, reverse device port `{metro_device_port}` to host port `{metro_port}` or use the provided `E2E_DEVICE_METRO_PORT` and `E2E_METRO_PORT` env vars
""".rstrip()
    maestro_port_instructions = ""
    if maestro_driver_port is not None:
        maestro_port_instructions = f"""
- maestro_driver_host_port: {maestro_driver_port}
- when invoking maestro directly, pass `--driver-host-port {maestro_driver_port}`
- when invoking `run-maestro-from-wsl.sh`, prefer `--driver-host-port {maestro_driver_port}` or the provided `E2E_MAESTRO_DRIVER_PORT` env var
""".rstrip()

    preamble = skill_preamble if skill_preamble is not None else "Use $feature to implement this ticket in the assigned local worktree."
    return f"""
{preamble}

Ticket:
- id: {ticket["id"]}
- title: {ticket["title"]}
- description: {ticket["description"]}

Acceptance criteria:
{acceptance}

Constraints:
{constraints}

Components:
{components}

Assigned execution context:
- worktree_path: {worktree_path}
- branch: {branch}
- emulator_serial: {emulator_serial}
- run_dir: {run_dir}
- status_json: {run_dir / "status.json"}
- summary_md: {run_dir / "summary.md"}

Environment:
- honor ANDROID_SERIAL={emulator_serial}
- if adb host or socket variables are already present in the environment, keep using them
{proxy_instructions}
{metro_instructions}
{maestro_port_instructions}

Prior review feedback:
{feedback}

Write all screenshots and check logs under the run_dir. Before exiting, write status.json and summary.md.
Do not report ready_for_review unless the run directory contains a complete review bundle:
- passed test and e2e or Maestro evidence
- at least one screenshot
- acceptance_evidence entries covering every acceptance criterion
""".strip()


def main() -> None:
    parser = argparse.ArgumentParser(description="Launch one external feature worker.")
    parser.add_argument("--ticket-file", required=True)
    parser.add_argument("--ticket-id", required=True)
    parser.add_argument("--worktree", required=True)
    parser.add_argument("--branch", required=True)
    parser.add_argument("--emulator-serial", required=True)
    parser.add_argument("--state-file", default=None)
    parser.add_argument(
        "--runner",
        choices=["codex", "claude"],
        default="codex",
        help="Which AI CLI to use for the worker process (default: codex).",
    )
    args = parser.parse_args()

    state_path = Path(args.state_file).resolve() if args.state_file else state_file_path()
    state = load_state(state_path)
    ticket = load_ticket(Path(args.ticket_file))
    prior_run = state.get("runs", {}).get(args.ticket_id, {})

    ensure_runtime_dirs(ticket_id=args.ticket_id)
    run_dir = state_path.parent / "runs" / args.ticket_id
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "checks").mkdir(parents=True, exist_ok=True)
    (run_dir / "screenshots").mkdir(parents=True, exist_ok=True)

    repo_root = detect_repo_root()
    worktree_path = Path(args.worktree).resolve()
    env = os.environ.copy()
    env["ANDROID_SERIAL"] = args.emulator_serial
    parsed_proxy = configure_proxy_env(env)
    configure_maestro_env(env, run_dir)
    maestro_driver_port = reserve_maestro_driver_port(state, args.ticket_id, prior_run)
    env["E2E_MAESTRO_DRIVER_PORT"] = str(maestro_driver_port)
    metro = start_or_reuse_metro(
        worktree_path=worktree_path,
        repo_root=repo_root,
        run_dir=run_dir,
        prior_run=prior_run,
        device_port=DEFAULT_DEVICE_METRO_PORT,
    )
    env["E2E_METRO_PORT"] = str(metro["host_port"])
    env["E2E_DEVICE_METRO_PORT"] = str(metro["device_port"])
    state_root = str(state_path.parent.resolve())

    skill_preamble = load_skill_content("feature") if args.runner == "claude" else None
    prompt = build_prompt(
        ticket=ticket,
        worktree_path=worktree_path,
        branch=args.branch,
        emulator_serial=args.emulator_serial,
        run_dir=run_dir,
        review_feedback=prior_run.get("review_feedback"),
        proxy_host=parsed_proxy[0] if parsed_proxy else None,
        proxy_port=parsed_proxy[1] if parsed_proxy else None,
        metro_host=str(metro["host"]),
        metro_port=int(metro["host_port"]),
        metro_device_port=int(metro["device_port"]),
        maestro_driver_port=maestro_driver_port,
        skill_preamble=skill_preamble,
    )
    prompt_path = run_dir / "prompt.txt"
    ticket_copy_path = run_dir / "ticket.json"
    stdout_log = run_dir / "worker.stdout.log"
    stderr_log = run_dir / "worker.stderr.log"
    prompt_path.write_text(prompt, encoding="utf-8")
    ticket_copy_path.write_text(json.dumps(ticket, indent=2), encoding="utf-8")

    if args.runner == "claude":
        cmd = [
            "claude",
            "--allowedTools", "Bash,Read,Write,Edit,Glob,Grep",
            "--output-format", "stream-json",
            "--verbose",
            "-p", prompt,
        ]
        popen_kwargs: dict = {"start_new_session": True, "env": env, "cwd": str(worktree_path)}
    else:
        cmd = [
            "codex",
            "exec",
            "-c", "sandbox_workspace_write.network_access=true",
            "-c", "shell_environment_policy.inherit=all",
            "--full-auto",
            "--verbose",
            "--add-dir", state_root,
            "-C", str(worktree_path),
            prompt,
        ]
        popen_kwargs = {"start_new_session": True, "env": env}

    with stdout_log.open("w", encoding="utf-8") as stdout_handle, stderr_log.open(
        "w", encoding="utf-8"
    ) as stderr_handle:
        process = subprocess.Popen(
            cmd,
            stdout=stdout_handle,
            stderr=stderr_handle,
            **popen_kwargs,
        )

    update_run(
        state,
        args.ticket_id,
        {
            "status": "running",
            "job_id": process.pid,
            "branch": args.branch,
            "worktree_path": str(worktree_path),
            "emulator_serial": args.emulator_serial,
            "run_dir": str(run_dir),
            "prompt_file": str(prompt_path),
            "ticket_file": str(ticket_copy_path),
            "stdout_log": str(stdout_log),
            "stderr_log": str(stderr_log),
            "metro_host": str(metro["host"]),
            "metro_port": int(metro["host_port"]),
            "metro_device_port": int(metro["device_port"]),
            "metro_pid": int(metro["pid"]),
            "metro_log": str(metro["log_path"]) if metro.get("log_path") else None,
            "metro_config": str(metro["config_path"]),
            "maestro_driver_port": maestro_driver_port,
            "ticket": ticket,
        },
    )
    save_state(state, state_path)

    print(
        json.dumps(
            {
                "ticket_id": args.ticket_id,
                "job_id": process.pid,
                "worktree_path": str(worktree_path),
                "run_dir": str(run_dir),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
