import fs from 'fs';
import path from 'path';

/**
 * GH-636: every video analysis and every import preflight share ONE TFLite Interpreter
 * in VideoAnalysisModule.java. TFLite interpreters are not thread-safe: importing a second
 * clip while the first one was still being analysed ran two inferences at once and the
 * second preflight found no plate ("failed_no_candidate" -> Status: failed). This guards
 * that inference only ever goes through the runInterpreter() helper holding interpreterLock.
 */

const MODULE_PATH = path.resolve(
  __dirname,
  '../../android/app/src/main/java/com/powerliftingworkoutplanner/VideoAnalysisModule.java',
);

const source = fs.readFileSync(MODULE_PATH, 'utf8');

/** The body of `private void runInterpreter(...)`, or null when the helper is missing. */
function runInterpreterBody(): string | null {
  const match = /private void runInterpreter\([^)]*\)\s*\{([\s\S]*?)\n {4}\}/.exec(source);
  return match ? match[1] : null;
}

describe('VideoAnalysisModule interpreter thread safety (GH-636)', () => {
  it('runs inference only inside synchronized(interpreterLock)', () => {
    const body = runInterpreterBody();
    expect(body).not.toBeNull();
    expect(body).toMatch(/synchronized \(interpreterLock\)\s*\{\s*detectionContext\.interpreter\.run\(/);
  });

  it('has no inference call outside runInterpreter()', () => {
    const allRunCalls = source.match(/\binterpreter\.run\(/g) ?? [];
    const helperRunCalls = (runInterpreterBody() ?? '').match(/\binterpreter\.run\(/g) ?? [];
    expect(allRunCalls).toHaveLength(1);
    expect(helperRunCalls).toHaveLength(1);
  });

  it('routes both detection paths through runInterpreter()', () => {
    expect(source.match(/\brunInterpreter\(detectionContext, /g)).toHaveLength(2);
  });
});
