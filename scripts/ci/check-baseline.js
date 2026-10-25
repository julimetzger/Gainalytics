#!/usr/bin/env node
/**
 * Error-count ratchet for ESLint and tsc (used by .github/workflows/ci.yml).
 *
 * The codebase predates CI and still has known ESLint and TypeScript errors. Instead of
 * disabling rules or skipping the checks, CI compares the current errors per file
 * (and per rule / TS error code) against a committed baseline:
 *   - more errors than the baseline in any file/rule  -> fail
 *   - fewer errors                                    -> pass, with a hint to shrink the baseline
 *
 * Usage:
 *   npx eslint . -f json -o eslint.json
 *   node scripts/ci/check-baseline.js eslint eslint.json [--update]
 *
 *   npx tsc -p tsconfig.json --noEmit --pretty false > tsc.txt
 *   node scripts/ci/check-baseline.js tsc tsc.txt [--update]
 *
 * --update rewrites the baseline file (scripts/ci/<kind>-baseline.json). Only ever commit a
 * baseline that went DOWN, never one that hides newly introduced errors.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

function toRepoPath(file) {
  const rel = path.isAbsolute(file) ? path.relative(repoRoot, file) : file;
  return rel.split(path.sep).join('/');
}

function countEslint(reportFile) {
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const counts = {};
  for (const result of report) {
    for (const msg of result.messages) {
      if (msg.severity !== 2) {
        continue;
      }
      const key = `${toRepoPath(result.filePath)} :: ${msg.ruleId || 'parse-error'}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
}

function countTsc(outputFile) {
  const text = fs.readFileSync(outputFile, 'utf8');
  const counts = {};
  const re = /^(.+?)\(\d+,\d+\): error (TS\d+):/;
  let total = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = re.exec(line);
    if (!m) {
      // tsc also prints global errors without a location ("error TS5023: ...").
      const g = /^error (TS\d+):/.exec(line);
      if (g) {
        const key = `<global> :: ${g[1]}`;
        counts[key] = (counts[key] || 0) + 1;
        total++;
      }
      continue;
    }
    const key = `${toRepoPath(m[1])} :: ${m[2]}`;
    counts[key] = (counts[key] || 0) + 1;
    total++;
  }
  if (total === 0 && /error/i.test(text)) {
    throw new Error('tsc produced output that could not be parsed:\n' + text.slice(0, 2000));
  }
  return counts;
}

function sum(obj) {
  return Object.values(obj).reduce((a, b) => a + b, 0);
}

function sortKeys(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map(k => [k, obj[k]]));
}

function main() {
  const [kind, inputFile, flag] = process.argv.slice(2);
  if (!['eslint', 'tsc'].includes(kind) || !inputFile) {
    console.error('Usage: check-baseline.js <eslint|tsc> <report-file> [--update]');
    process.exit(2);
  }
  const current = kind === 'eslint' ? countEslint(inputFile) : countTsc(inputFile);
  const baselineFile = path.join(__dirname, `${kind}-baseline.json`);

  if (flag === '--update') {
    fs.writeFileSync(baselineFile, JSON.stringify(sortKeys(current), null, 2) + '\n');
    console.log(`Wrote ${toRepoPath(baselineFile)} (${sum(current)} errors).`);
    return;
  }

  const baseline = fs.existsSync(baselineFile)
    ? JSON.parse(fs.readFileSync(baselineFile, 'utf8'))
    : {};

  const regressions = [];
  const improvements = [];
  for (const key of new Set([...Object.keys(current), ...Object.keys(baseline)])) {
    const now = current[key] || 0;
    const before = baseline[key] || 0;
    if (now > before) {
      regressions.push(`  ${key}: ${before} -> ${now}`);
    } else if (now < before) {
      improvements.push(`  ${key}: ${before} -> ${now}`);
    }
  }

  console.log(`${kind}: ${sum(current)} errors (baseline ${sum(baseline)}).`);
  if (improvements.length) {
    console.log(
      `\n${improvements.length} file/rule pair(s) improved. Shrink the baseline with:\n` +
        `  node scripts/ci/check-baseline.js ${kind} <report> --update\n` +
        improvements.join('\n'),
    );
  }
  if (regressions.length) {
    console.error(
      `\nNew ${kind} errors compared to scripts/ci/${kind}-baseline.json:\n` +
        regressions.join('\n') +
        '\n\nFix them (preferred). Do not grow the baseline to hide new errors.',
    );
    for (const r of regressions) {
      const file = r.trim().split(' :: ')[0];
      console.log(`::error file=${file}::${kind} errors increased (${r.trim()})`);
    }
    process.exit(1);
  }
}

main();
