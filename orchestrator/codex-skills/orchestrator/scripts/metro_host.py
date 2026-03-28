#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import signal
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path


DEFAULT_DEVICE_METRO_PORT = 8081
DEFAULT_HOST_METRO_PORT_START = 8082


def ensure_worktree_node_modules(worktree_path: Path, repo_root: Path) -> Path:
    shared_node_modules = (repo_root / "node_modules").resolve()
    if not shared_node_modules.is_dir():
        raise FileNotFoundError(f"Shared node_modules directory is missing: {shared_node_modules}")

    worktree_node_modules = worktree_path / "node_modules"
    if worktree_node_modules.is_symlink():
        if worktree_node_modules.resolve() == shared_node_modules:
            return worktree_node_modules
        worktree_node_modules.unlink()
    elif worktree_node_modules.exists():
        if worktree_node_modules.is_dir() and not any(worktree_node_modules.iterdir()):
            worktree_node_modules.rmdir()
        else:
            return worktree_node_modules

    relative_target = os.path.relpath(shared_node_modules, worktree_path)
    worktree_node_modules.symlink_to(relative_target, target_is_directory=True)
    return worktree_node_modules


def render_metro_config(worktree_path: Path, repo_root: Path) -> str:
    shared_node_modules = (repo_root / "node_modules").resolve()
    return f"""const path = require('path');
const {{getDefaultConfig, mergeConfig}} = require('@react-native/metro-config');

const projectRoot = {json.dumps(str(worktree_path.resolve()))};
const sharedNodeModules = {json.dumps(str(shared_node_modules))};

module.exports = mergeConfig(getDefaultConfig(projectRoot), {{
  projectRoot,
  watchFolders: [sharedNodeModules],
  resolver: {{
    unstable_enableSymlinks: true,
    nodeModulesPaths: [path.join(projectRoot, 'node_modules'), sharedNodeModules],
  }},
}});
"""


def write_metro_config(worktree_path: Path, repo_root: Path, run_dir: Path) -> Path:
    config_path = run_dir / "metro.worktree.config.cjs"
    config_path.write_text(render_metro_config(worktree_path, repo_root), encoding="utf-8")
    return config_path


def is_process_alive(pid: int | None) -> bool:
    if not pid or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def stop_process_group(pid: int | None) -> None:
    if not is_process_alive(pid):
        return
    try:
        os.killpg(pid, signal.SIGTERM)
    except ProcessLookupError:
        return

    deadline = time.time() + 5
    while time.time() < deadline:
        if not is_process_alive(pid):
            return
        time.sleep(0.2)

    try:
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        return


def metro_is_healthy(port: int, timeout_seconds: float = 2.0) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/status", timeout=timeout_seconds) as response:
            body = response.read().decode("utf-8", errors="replace").strip()
            return body == "packager-status:running"
    except (urllib.error.URLError, TimeoutError, ValueError):
        return False


def wait_for_metro(port: int, timeout_seconds: float = 45.0) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if metro_is_healthy(port):
            return True
        time.sleep(1)
    return False


def find_free_port(start: int = DEFAULT_HOST_METRO_PORT_START, limit: int = 100) -> int:
    for port in range(start, start + limit):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as candidate:
            candidate.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                candidate.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise RuntimeError(f"Could not find a free localhost port in range {start}-{start + limit - 1}")


def tail_text(path: Path, max_lines: int = 80) -> str:
    if not path.exists():
        return ""
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    return "\n".join(lines[-max_lines:])


def start_or_reuse_metro(
    *,
    worktree_path: Path,
    repo_root: Path,
    run_dir: Path,
    prior_run: dict,
    device_port: int = DEFAULT_DEVICE_METRO_PORT,
) -> dict[str, object]:
    ensure_worktree_node_modules(worktree_path, repo_root)
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "checks").mkdir(parents=True, exist_ok=True)

    existing_pid = prior_run.get("metro_pid")
    existing_port = prior_run.get("metro_port")
    config_path = write_metro_config(worktree_path, repo_root, run_dir)
    log_path = Path(prior_run.get("metro_log")) if prior_run.get("metro_log") else None

    if (
        isinstance(existing_pid, int)
        and isinstance(existing_port, int)
        and is_process_alive(existing_pid)
        and metro_is_healthy(existing_port)
    ):
        return {
            "reused": True,
            "pid": existing_pid,
            "host": "127.0.0.1",
            "host_port": existing_port,
            "device_port": device_port,
            "config_path": str(config_path),
            "log_path": str(log_path) if log_path else None,
        }

    if isinstance(existing_pid, int):
        stop_process_group(existing_pid)

    candidate_port = existing_port if isinstance(existing_port, int) and not metro_is_healthy(existing_port) else None
    host_port = candidate_port or find_free_port()
    log_path = run_dir / "checks" / f"metro-host-{host_port}.log"

    with log_path.open("w", encoding="utf-8") as log_handle:
        process = subprocess.Popen(
            [
                "node",
                str((repo_root / "node_modules" / "react-native" / "cli.js").resolve()),
                "start",
                "--config",
                str(config_path),
                "--host",
                "0.0.0.0",
                "--port",
                str(host_port),
                "--reset-cache",
            ],
            cwd=worktree_path,
            env=os.environ.copy(),
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )

    if wait_for_metro(host_port):
        return {
            "reused": False,
            "pid": process.pid,
            "host": "127.0.0.1",
            "host_port": host_port,
            "device_port": device_port,
            "config_path": str(config_path),
            "log_path": str(log_path),
        }

    stop_process_group(process.pid)
    tail = tail_text(log_path)
    raise RuntimeError(
        f"Host Metro failed to become healthy on port {host_port}. "
        f"Log: {log_path}\n{tail}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Start or reuse a host-side Metro process for a worktree.")
    parser.add_argument("--worktree", required=True)
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--repo-root", default=None)
    parser.add_argument("--metro-port", type=int, default=None)
    parser.add_argument("--device-metro-port", type=int, default=DEFAULT_DEVICE_METRO_PORT)
    args = parser.parse_args()

    worktree_path = Path(args.worktree).resolve()
    run_dir = Path(args.run_dir).resolve()
    repo_root = Path(args.repo_root).resolve() if args.repo_root else worktree_path.parents[1]
    prior_run = {}
    if args.metro_port is not None:
        prior_run["metro_port"] = args.metro_port

    metro = start_or_reuse_metro(
        worktree_path=worktree_path,
        repo_root=repo_root,
        run_dir=run_dir,
        prior_run=prior_run,
        device_port=args.device_metro_port,
    )
    print(json.dumps(metro, indent=2))


if __name__ == "__main__":
    main()
