#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    return []


def extract_path(value: str) -> str:
    """Extract the bare file path from an evidence string.

    Agents sometimes write evidence entries like:
        "checks/test.log (test: 'some test name')"
    Strip everything from the first whitespace or parenthesis so the validator
    can locate the actual file regardless of inline annotation.
    """
    for sep in (" ", "("):
        idx = value.find(sep)
        if idx != -1:
            value = value[:idx]
    return value.strip()


def existing_relative_files(run_dir: Path, values: list[Any]) -> tuple[list[str], list[str]]:
    existing: list[str] = []
    missing: list[str] = []
    for value in values:
        if not isinstance(value, str) or not value:
            continue
        bare = extract_path(value)
        if not bare:
            missing.append(value)
            continue
        candidate = (run_dir / bare).resolve()
        try:
            candidate.relative_to(run_dir.resolve())
        except ValueError:
            missing.append(bare)
            continue
        if candidate.exists():
            existing.append(bare)
        else:
            missing.append(bare)
    return existing, missing


def normalize_name(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip().lower()


def normalize_criterion(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()


def check_lookup(checks_run: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for item in checks_run:
        if not isinstance(item, dict):
            continue
        name = normalize_name(item.get("name"))
        if name:
            lookup[name] = item
    return lookup


def find_required_check(checks_run: list[dict[str, Any]], token: str) -> dict[str, Any] | None:
    token = token.lower()
    for item in checks_run:
        if not isinstance(item, dict):
            continue
        name = normalize_name(item.get("name"))
        if token in name:
            return item
    return None


def check_passed(item: dict[str, Any] | None) -> bool:
    if not item:
        return False
    return normalize_name(item.get("status")) == "passed"


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate a feature review bundle before surfacing it.")
    parser.add_argument("--run-dir", required=True)
    args = parser.parse_args()

    run_dir = Path(args.run_dir).resolve()
    status_path = run_dir / "status.json"
    summary_path = run_dir / "summary.md"
    ticket_path = run_dir / "ticket.json"

    issues: list[str] = []
    status: dict[str, Any] | None = None
    ticket: dict[str, Any] | None = None

    if not status_path.exists():
        issues.append("missing status.json")
    else:
        status = read_json(status_path)

    if not summary_path.exists():
        issues.append("missing summary.md")
    elif not summary_path.read_text(encoding="utf-8").strip():
        issues.append("summary.md is empty")

    if ticket_path.exists():
        ticket = read_json(ticket_path)

    if status is None:
        print(json.dumps({"run_dir": str(run_dir), "review_gate_passed": False, "issues": issues}, indent=2))
        return

    if normalize_name(status.get("status")) != "ready_for_review":
        issues.append("status is not ready_for_review")

    commit_hashes = [value for value in as_list(status.get("commit_hashes")) if isinstance(value, str) and value]
    if not commit_hashes:
        issues.append("missing commit hashes")

    changed_files = [value for value in as_list(status.get("changed_files")) if isinstance(value, str) and value]
    if not changed_files:
        issues.append("missing changed files")

    checks_run = [item for item in as_list(status.get("checks_run")) if isinstance(item, dict)]
    if not checks_run:
        issues.append("missing checks_run entries")

    log_refs = [
        item.get("log_file")
        for item in checks_run
        if isinstance(item.get("log_file"), str) and item.get("log_file")
    ]
    existing_logs, missing_logs = existing_relative_files(run_dir, log_refs)
    for missing in missing_logs:
        issues.append(f"missing check log file: {missing}")

    for required in ("test",):
        check = find_required_check(checks_run, required)
        if not check:
            issues.append(f"missing required check: {required}")
        elif not check_passed(check):
            issues.append(f"required check not passed: {required}")

    e2e_check = None
    for token in ("maestro", "e2e", "smoke"):
        candidate = find_required_check(checks_run, token)
        if candidate:
            e2e_check = candidate
            break
    if not e2e_check:
        issues.append("missing e2e or maestro check")
    elif not check_passed(e2e_check):
        issues.append("e2e or maestro check did not pass")

    artifacts = status.get("artifacts", {}) if isinstance(status.get("artifacts"), dict) else {}
    screenshots, missing_screenshots = existing_relative_files(run_dir, as_list(artifacts.get("screenshots")))
    e2e_reports, missing_e2e_reports = existing_relative_files(run_dir, as_list(artifacts.get("e2e_reports")))

    if not screenshots:
        issues.append("missing screenshot evidence")
    for missing in missing_screenshots:
        issues.append(f"missing screenshot file: {missing}")

    if not e2e_reports:
        issues.append("missing e2e or maestro artifact")
    for missing in missing_e2e_reports:
        issues.append(f"missing e2e report file: {missing}")

    acceptance_criteria = [
        value
        for value in (
            normalize_criterion(item) for item in as_list((ticket or {}).get("acceptanceCriteria"))
        )
        if value
    ]
    evidence_entries = [
        entry for entry in as_list(status.get("acceptance_evidence")) if isinstance(entry, dict)
    ]
    evidence_by_criterion = {
        normalize_criterion(entry.get("criterion")): entry
        for entry in evidence_entries
        if normalize_criterion(entry.get("criterion"))
    }
    if acceptance_criteria and not evidence_entries:
        issues.append("missing acceptance_evidence entries")

    concrete_evidence_refs = set(screenshots + e2e_reports + existing_logs)
    missing_criteria: list[str] = []
    for criterion in acceptance_criteria:
        entry = evidence_by_criterion.get(criterion)
        if not entry:
            missing_criteria.append(criterion)
            continue
        if normalize_name(entry.get("status")) != "covered":
            issues.append(f"acceptance criterion not covered: {criterion}")
        evidence_refs = [
            value for value in as_list(entry.get("evidence")) if isinstance(value, str) and value
        ]
        if not evidence_refs:
            issues.append(f"acceptance criterion has no evidence: {criterion}")
            continue
        if not any(ref in concrete_evidence_refs for ref in evidence_refs):
            issues.append(f"acceptance criterion lacks concrete screenshot or test evidence: {criterion}")

    for criterion in missing_criteria:
        issues.append(f"missing acceptance evidence for criterion: {criterion}")

    print(
        json.dumps(
            {
                "run_dir": str(run_dir),
                "review_gate_passed": not issues,
                "issues": issues,
                "summary": {
                    "commit_hashes": commit_hashes,
                    "changed_files": changed_files,
                    "screenshots": screenshots,
                    "e2e_reports": e2e_reports,
                    "check_logs": existing_logs,
                    "acceptance_criteria": acceptance_criteria,
                },
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
