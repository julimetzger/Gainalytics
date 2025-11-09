// /agent/runners/runTask.js
import fs from 'fs';
import path from 'path';
import {execa, Options} from 'execa';
import {planSteps} from '../llm/taskPlanner';
import {applyEdits} from '../llm/codeEditor';
import {Task} from '../backlog/backlogTask';
import {CONFIG} from '../config';
import * as os from 'node:os';
import {repairWithJestFeedback} from '../llm/fixTests';

// --- helpers ---------------------------------------------------------------

async function ensureBranch(branch) {
  try {
    await execa('git', ['checkout', '-b', branch], {stdio: 'inherit'});
  } catch {
    await execa('git', ['checkout', branch], {stdio: 'inherit'});
  }
}

async function npmChecks() {
  let opts: Options = {stdio: 'inherit', cwd: CONFIG.repoRoot};
  //await execa("npm", ["run", "typecheck"], opts);
  await execa('npm', ['run', 'test'], opts);
  // await execa('npm', ['run', 'lint'], opts);
  //  await execa('npm', ['run', 'format'], opts);
}

async function gitCommit(message) {
  await execa('git', ['add', '.'], {stdio: 'inherit'});
  try {
    await execa('git', ['commit', '-m', message], {stdio: 'inherit'});
  } catch {
    // no-op if nothing to commit
  }
}

/** Sichert, dass Zielverzeichnisse existieren (für neue Dateien im Patch). */
function ensureDirsFromDiff(diff: string) {
  const fileHeaders = Array.from(diff.matchAll(/^diff --git a\/(.+?) b\/(.+?)$/gm)).map((m) => m[2]);
  const dirs = new Set(fileHeaders.map((f) => path.dirname(f)));
  for (const d of dirs) {
    const abs = path.join(CONFIG.repoRoot, d);
    if (!fs.existsSync(abs)) fs.mkdirSync(abs, {recursive: true});
  }
}

/** Debug: Zeigt die Umgebung der fehlerhaften Linie im Patch an. */
function dumpPatchContext(tmpFile: string, errorLine: number, lines = 12) {
  try {
    const txt = fs.readFileSync(tmpFile, 'utf8').split('\n');
    const start = Math.max(0, errorLine - lines);
    const end = Math.min(txt.length, errorLine + lines);
    const snippet = txt
      .slice(start, end)
      .map((l, i) => `${start + i + 1}: ${l}`)
      .join('\n');
    console.error(`--- Patch context around line ${errorLine} ---\n${snippet}\n--- end context ---`);
  } catch {}
}

async function tryGitApply(args: string[], cwd: string) {
  try {
    await execa('git', ['apply', ...args], {stdio: 'inherit', cwd});
    return true;
  } catch (e: any) {
    // execa liefert hier kein error.line, deshalb lassen wir den Aufrufer ggf. Kontext dumpen
    return false;
  }
}

async function writeFiles(
  files:
    | Array<{
        path: string;
        content: string;
      }>
    | undefined,
) {
  if (!files || files.length === 0) {
    throw new Error('Patch failed and no full-file fallback provided by codeEditor.');
  }
  for (const f of files) {
    const abs = path.join(CONFIG.repoRoot, f.path);
    fs.mkdirSync(path.dirname(abs), {recursive: true});
    fs.writeFileSync(abs, f.content, 'utf8');
    console.log('Wrote full file:', f.path);
  }
}

// ... oben imports unverändert
export async function runTask(task: Task) {
  npmChecks();
  console.log(`Processing task ${task.id}: ${task.title}`);

  const plan = await planSteps(task);
  console.log('Plan created:', JSON.stringify(plan, null, 2));

  const branch = `agent/${task.id}`;
  await ensureBranch(branch);
  // Wichtig: full-file Fallback aktivieren
  const result = await applyEdits(plan, {alsoReturnFullFiles: true});
  const {changedFiles, summaryCommitMessage, files} = result;

  // 1) Erst versuchen, den Unified Diff anzuwenden
  await writeFiles(files);
  // after applying initial patch + running checks:
  const fixDiff = await repairWithJestFeedback(plan, changedFiles);
  if (fixDiff) {
    console.log('applying test fix: ', fixDiff);
    await writeFiles(fixDiff); // your robust git-apply
    // re-run tests if desired
  }
  const commitMsg = summaryCommitMessage ? summaryCommitMessage() : `feat(${task.id}): ${task.title}`;
  await gitCommit(commitMsg);

  return {
    branch,
    taskId: task.id,
    status: 'ready-for-review',
    changedFiles,
    plan,
  };
}
