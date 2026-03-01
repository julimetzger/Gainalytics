#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

MODE="full"
SUITE_PATH="${REPO_ROOT}/__tests__/e2e/maestro/flows/suite.yaml"
REPORT_PATH="${REPO_ROOT}/__tests__/reports/maestro.xml"
FIXTURE_PATH="${REPO_ROOT}/__tests__/testdata/1772318214222.gains"
APP_ID="com.powerliftingworkoutplanner"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"
      shift 2
      ;;
    --suite)
      SUITE_PATH="$2"
      shift 2
      ;;
    --report)
      REPORT_PATH="$2"
      shift 2
      ;;
    --fixture)
      FIXTURE_PATH="$2"
      shift 2
      ;;
    --app-id)
      APP_ID="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

SUITE_PATH="$(realpath "${SUITE_PATH}")"
FIXTURE_PATH="$(realpath "${FIXTURE_PATH}")"
REPORT_DIR="$(cd "$(dirname "${REPORT_PATH}")" && pwd)"
REPORT_PATH="${REPORT_DIR}/$(basename "${REPORT_PATH}")"

mkdir -p "$(dirname "${REPORT_PATH}")"

POWERSHELL_SCRIPT_WIN="$(wslpath -w "${REPO_ROOT}/__tests__/e2e/scripts/run-maestro-windows.ps1")"
REPO_ROOT_WIN="$(wslpath -w "${REPO_ROOT}")"
SUITE_PATH_WIN="$(wslpath -w "${SUITE_PATH}")"
REPORT_PATH_WIN="$(wslpath -w "${REPORT_PATH}")"
FIXTURE_PATH_WIN="$(wslpath -w "${FIXTURE_PATH}")"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${POWERSHELL_SCRIPT_WIN}" \
  -RepoRoot "${REPO_ROOT_WIN}" \
  -SuitePath "${SUITE_PATH_WIN}" \
  -ReportPath "${REPORT_PATH_WIN}" \
  -FixturePath "${FIXTURE_PATH_WIN}" \
  -Mode "${MODE}" \
  -AppId "${APP_ID}"
