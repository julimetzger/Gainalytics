import path from 'path';
import {JestSummary} from './jestParser';
import {codeWindow} from '../util/codeWindow';

export function buildJestFeedback(summary: JestSummary, repoRoot: string, maxItems = 5) {
  const top = summary.failures.slice(0, maxItems);
  const items = top.map((f) => {
    const win = codeWindow(repoRoot, f.file, f.line, 10);
    // make file path repo-root relative
    const rel = path.isAbsolute(f.file) ? path.relative(repoRoot, f.file) : f.file;
    return {
      file: rel,
      testName: f.testName,
      line: f.line,
      column: f.column,
      message: f.message,
      context: win,
    };
  });

  return {
    totals: {
      numTotalTests: summary.numTotalTests,
      numFailedTests: summary.numFailedTests,
      numPassedTests: summary.numPassedTests,
      numPendingTests: summary.numPendingTests,
    },
    failures: items,
  };
}
