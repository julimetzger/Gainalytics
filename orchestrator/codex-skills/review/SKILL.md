---
name: review
description: Review code changes on a feature branch against the GitHub ticket acceptance criteria. Produces a structured verdict (approve, request-changes) with findings categorized by severity. Use when the orchestrator or user wants to validate a worker's output before merging.
---

# Review

## Overview

Review the code diff of a feature branch against its GitHub ticket. Cross-reference
every acceptance criterion, flag issues by severity, and produce a clear verdict.

## Required Inputs

The orchestrator prompt provides:

- `ticket_id`
- `github_issue_number` or ticket body with acceptance criteria
- `branch` — the feature branch to review
- `worktree_path` — path to the worktree (or use the branch directly)
- `run_dir` — where to write the review output

## Workflow

1. Fetch the ticket from GitHub:
   ```bash
   gh issue view <number> --repo julimetzger/Gainalytics --json title,body
   ```

2. Get the full diff against master:
   ```bash
   git diff origin/master...<branch> -- '*.ts' '*.tsx' '*.java' '*.kt'
   ```

3. List all changed files:
   ```bash
   git diff --name-only origin/master...<branch>
   ```

4. Read each changed file in full (not just the diff) to understand context.

5. If the run directory contains screenshots, review them for visual correctness.

6. If tests exist, check test coverage of new code paths:
   ```bash
   cd <worktree_path> && npm test -- --changedSince=origin/master 2>&1
   ```

## Review Checklist

Evaluate each dimension and report findings:

### Acceptance Criteria Coverage
For each acceptance criterion from the ticket:
- Is it addressed by the diff? Which files/lines?
- Is there test coverage for it?
- Is there screenshot or e2e evidence?
- Mark as: `covered`, `partially_covered`, or `missing`

### Correctness
- Logic bugs, off-by-one errors, null/undefined handling
- Race conditions, async issues
- Edge cases not handled

### Security
- Secrets or credentials in code
- Injection vulnerabilities (SQL, XSS, command injection)
- Auth/permission gaps

### Performance
- Unnecessary re-renders (missing useMemo/useCallback in React)
- N+1 patterns, unnecessary loops
- Large bundle impact from new dependencies

### Conventions
- Follows existing codebase patterns (check `AGENTS.md` for rules)
- Naming conventions, file structure
- No unnecessary changes outside ticket scope

### Redux & Persistence
- New reducer actions properly handled
- State shape backwards-compatible or migration added
- `redux-persist` whitelist updated if new reducer added
- `configureStore.ts` migration version bumped if needed

### Android/Native
- Native code changes require rebuild (check if APK was rebuilt)
- Manifest changes reviewed
- No hardcoded device-specific values

## Finding Severity Levels

Categorize each finding:

- **must-fix** — Blocks merge. Bug, missing acceptance criterion, security issue, data loss risk.
- **should-fix** — Should be fixed before merge but not a blocker. Missing edge case, weak test.
- **nit** — Style, naming, minor improvement. Can merge without fixing.

## Output

Write `review.json` to the run directory:

```json
{
  "ticket_id": "TRN-004",
  "branch": "feature/TRN-004",
  "verdict": "request-changes",
  "summary": "8/12 acceptance criteria covered. 2 must-fix issues found.",
  "acceptance_criteria": [
    {
      "criterion": "Meso-Cards auf TrainingHome",
      "status": "covered",
      "evidence": "app/tabs/Training/TrainingHome.tsx:45-67"
    },
    {
      "criterion": "Migration für bestehende Plans",
      "status": "missing",
      "detail": "No migration in configureStore.ts"
    }
  ],
  "findings": [
    {
      "severity": "must-fix",
      "category": "correctness",
      "file": "app/redux/Training/trainingsPlanReducer.ts",
      "lines": "120-135",
      "description": "currentMeso is not updated when a training is completed",
      "suggestion": "Add a case in the reducer to update currentMeso on FINISH_TRAINING"
    }
  ],
  "stats": {
    "files_changed": 12,
    "lines_added": 450,
    "lines_removed": 30,
    "tests_added": 5,
    "acceptance_covered": 8,
    "acceptance_total": 12
  }
}
```

Also write `review.md` as a human-readable summary with the same content.

## Verdict Rules

- **approve** — All acceptance criteria covered, no must-fix findings.
- **request-changes** — Any must-fix finding OR any acceptance criterion missing.
- **needs-discussion** — Ambiguous requirement that needs user clarification.

## Post to GitHub

If there is an open PR for the branch, post the review as a PR review:

```bash
# Find the PR number
PR_NUM=$(gh pr list --repo julimetzger/Gainalytics --head <branch> --json number --jq '.[0].number')

# Post as PR comment with the review
gh pr comment $PR_NUM --repo julimetzger/Gainalytics --body "$(cat <run_dir>/review.md)"

# If verdict is approve:
gh pr review $PR_NUM --repo julimetzger/Gainalytics --approve --body "All acceptance criteria covered."

# If verdict is request-changes:
gh pr review $PR_NUM --repo julimetzger/Gainalytics --request-changes --body "$(cat <run_dir>/review.md)"
```

If no PR exists, fall back to posting on the GitHub issue:

```bash
gh issue comment <github_issue_number> --repo julimetzger/Gainalytics --body "$(cat <run_dir>/review.md)"
```

## Rules

- Do NOT modify any code. This is a read-only review.
- Do NOT create commits or change files in the worktree.
- Read the full file for context, not just the diff hunks.
- Be specific: cite file paths and line numbers for every finding.
- Be fair: acknowledge good patterns and clean implementations, not just problems.
- Focus on what matters: a missing acceptance criterion is more important than a naming nit.
