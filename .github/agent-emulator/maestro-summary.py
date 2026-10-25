#!/usr/bin/env python3
"""GH-588: summarise Maestro runs for the job summary and as workflow annotations.

Usage: maestro-summary.py <run_dir> [--attempts N] [--booted yes|no]

Reads every <run_dir>/maestro/<flow>/ written by `tool.sh flow` (report.xml, console.txt,
debug/commands-*.json) plus <run_dir>/timings.txt. Prints Markdown for $GITHUB_STEP_SUMMARY to
stdout and `::notice::` / `::error::` annotations to stderr (annotations are readable through the
checks API, job logs are not always). Exit code: 0 if every report passed, 1 otherwise (also when
no report exists at all).
"""
import glob
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
FLOW_NAME = re.compile(r"([\w./-]+\.ya?ml)")


def esc(text: str) -> str:
    """Escape a workflow-command value (keeps an annotation on one line)."""
    return text.replace("%", "%25").replace("\r", "").replace("\n", "%0A")


def one_line(text: str, limit: int = 400) -> str:
    text = " ".join(str(text).split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def read_report(path: str) -> dict:
    out = {"tests": "?", "failures": "0", "errors": "0", "time": "?", "messages": []}
    try:
        root = ET.parse(path).getroot()
    except (ET.ParseError, OSError) as exc:
        out["messages"].append(f"report.xml unreadable: {exc}")
        out["failures"] = "1"
        return out
    suite = root if root.tag == "testsuite" else root.find("testsuite")
    if suite is not None:
        for key in ("tests", "failures", "errors", "time"):
            out[key] = suite.get(key, out[key])
    for case in root.iter("testcase"):
        for tag in ("failure", "error"):
            for node in case.findall(tag):
                msg = node.get("message") or node.text or ""
                out["messages"].append(f"{case.get('name', '?')}: {one_line(msg)}")
    return out


def console_lines(path: str) -> list:
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return [ANSI.sub("", line).rstrip() for line in fh]
    except OSError:
        return []


def command_label(cmd: dict) -> str:
    """Short description of one serialized Maestro command."""
    if not isinstance(cmd, dict) or not cmd:
        return "?"
    kind, body = next(iter(cmd.items()))
    if isinstance(body, dict):
        if body.get("label"):
            return f"{kind}: {body['label']}"
        if kind == "runFlowCommand":
            return f"runFlow {body.get('sourceDescription') or body.get('config', {}).get('name') or '?'}"
        body = {k: v for k, v in body.items() if v not in (None, False, [], {}) and k != "commands"}
    return one_line(f"{kind} {json.dumps(body, ensure_ascii=False)}", 300)


def debug_commands(flow_dir: str) -> tuple:
    """(failed runFlow names, failing leaf command, its error, last completed leaf)."""
    flows, leaf, error, last_ok = [], "", "", ""
    for path in sorted(glob.glob(os.path.join(flow_dir, "debug", "**", "commands-*.json"), recursive=True)):
        try:
            with open(path, encoding="utf-8") as fh:
                entries = json.load(fh)
        except (OSError, ValueError):
            continue
        for entry in entries if isinstance(entries, list) else []:
            cmd = entry.get("command") or {}
            meta = entry.get("metadata") or {}
            status = meta.get("status")
            is_flow = "runFlowCommand" in cmd
            if status == "COMPLETED" and not is_flow:
                last_ok = command_label(cmd)
            if status != "FAILED":
                continue
            if is_flow:
                flows.append(command_label(cmd).replace("runFlow ", ""))
            else:
                leaf = command_label(cmd)
                err = meta.get("error") or {}
                error = one_line(err.get("message", "") if isinstance(err, dict) else err)
    return flows, leaf, error, last_ok


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    run_dir = sys.argv[1]
    attempts = "1"
    booted = "yes"
    args = sys.argv[2:]
    for i, arg in enumerate(args):
        if arg == "--attempts" and i + 1 < len(args):
            attempts = args[i + 1]
        if arg == "--booted" and i + 1 < len(args):
            booted = args[i + 1]

    md = ["## Maestro smoke", ""]
    ok = True
    timings = []
    try:
        with open(os.path.join(run_dir, "timings.txt"), encoding="utf-8") as fh:
            timings = [line.strip() for line in fh if line.strip()]
    except OSError:
        pass

    if booted != "yes":
        ok = False
        msg = f"Emulator did not boot ({attempts} attempt(s)); no flow ran."
        md += [f"**Failed:** {msg}", ""]
        print(f"::error title=Maestro smoke: emulator boot::{esc(msg)}", file=sys.stderr)

    flow_dirs = sorted(d for d in glob.glob(os.path.join(run_dir, "maestro", "*")) if os.path.isdir(d))
    if booted == "yes" and not flow_dirs:
        ok = False
        msg = "No Maestro report found (the run stopped before the flow, see the emulator step)."
        md += [f"**Failed:** {msg}", ""]
        print(f"::error title=Maestro smoke::{esc(msg)}", file=sys.stderr)

    if flow_dirs:
        md += ["| Flow | Tests | Failures | Errors | Time (s) |", "|---|---|---|---|---|"]
    details = []
    for flow_dir in flow_dirs:
        name = os.path.basename(flow_dir)
        report_path = os.path.join(flow_dir, "report.xml")
        lines = console_lines(os.path.join(flow_dir, "console.txt"))
        if os.path.isfile(report_path):
            rep = read_report(report_path)
        else:
            rep = {"tests": "?", "failures": "1", "errors": "0", "time": "?",
                   "messages": ["no report.xml (Maestro aborted or timed out)"]}
        failed = rep["failures"] not in ("0", "") or rep["errors"] not in ("0", "")
        md.append(f"| `{name}` | {rep['tests']} | {rep['failures']} | {rep['errors']} | {rep['time']} |")
        if not failed:
            print(f"::notice title=maestro {name}::passed, tests={rep['tests']} time={rep['time']}s",
                  file=sys.stderr)
            continue
        ok = False
        flows, leaf, error, last_ok = debug_commands(flow_dir)
        failed_console = [l.strip() for l in lines if re.search(r"\bFAILED\b", l)]
        if not flows:
            flows = [m.group(1) for l in failed_console for m in [FLOW_NAME.search(l)] if m]
        if not leaf and failed_console:
            leaf = one_line(failed_console[-1], 300)
        sub_flow = flows[-1] if flows else name
        parts = [f"failing flow: {sub_flow}"]
        if leaf:
            parts.append(f"failing step: {leaf}")
        if error:
            parts.append(f"error: {error}")
        elif rep["messages"]:
            parts.append(f"error: {rep['messages'][0]}")
        if last_ok:
            parts.append(f"last passed step: {last_ok}")
        print(f"::error title=Maestro {name} failed::{esc(' | '.join(parts))}", file=sys.stderr)
        details += [f"### `{name}` failed", ""]
        if flows:
            details.append(f"- **Failing flow:** `{' › '.join(dict.fromkeys(flows))}`")
        if leaf:
            details.append(f"- **Failing step:** `{leaf}`")
        for msg in rep["messages"][:3]:
            details.append(f"- **Report:** {msg}")
        if error:
            details.append(f"- **Error:** {error}")
        if last_ok:
            details.append(f"- **Last passed step:** `{last_ok}`")
        tail = lines[-25:]
        if tail:
            details += ["", "<details><summary>Maestro console (last 25 lines)</summary>", "", "```",
                        *tail, "```", "</details>"]
        details.append("")

    md.append("")
    md += details
    if timings:
        md += ["### Timings", "", "```", *timings, "```", ""]
        print(f"::notice title=timings::{esc(' '.join(timings))}", file=sys.stderr)
    md.append("Artifact `maestro-smoke-evidence`: JUnit report, Maestro debug output (failure "
              "screenshots, commands JSON), screenshots, logcat.")
    print("\n".join(md))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
