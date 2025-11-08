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

export async function applyPatch(patch: {diff: string}) {
  if (!patch?.diff || typeof patch.diff !== 'string') {
    throw new Error('Invalid patch provided');
  }

  let diffText = patch.diff.replace(/\r\n/g, '\n');
  if (!diffText.endsWith('\n')) diffText += '\n';

  if (!diffText.includes('diff --git')) {
    throw new Error("Patch is not a valid unified diff (missing 'diff --git').");
  }

  // Ziel-Ordner vorbereiten (für neue Dateien/Pfade)
  ensureDirsFromDiff(diffText);

  const tmpFile = path.join(os.tmpdir(), `.gainalytics_patch_${Date.now()}.diff`);
  fs.writeFileSync(tmpFile, diffText, 'utf8');
  const cwd = CONFIG.repoRoot;

  // Reihenfolge der Versuche:
  // 1) --check -p0 → apply -p0 (tolerant)
  // 2) --check -p1 → apply -p1 (tolerant)
  // 3) --3way (benutzt Index/Blob, wenn Kontext nicht passt)
  const tolerantArgs = ['--reject', '--ignore-whitespace', '--whitespace=nowarn'];

  const trySeq: {check: string[]; apply: string[]; label: string}[] = [
    {check: ['--check', '-p0', tmpFile], apply: [...tolerantArgs, '-p0', tmpFile], label: 'p0'},
    {check: ['--check', '-p1', tmpFile], apply: [...tolerantArgs, '-p1', tmpFile], label: 'p1'},
  ];

  try {
    for (const step of trySeq) {
      const okCheck = await tryGitApply(step.check, cwd);
      if (okCheck) {
        const okApply = await tryGitApply(step.apply, cwd);
        if (okApply) {
          console.log(`Patch applied successfully with ${step.label}`);
          fs.unlinkSync(tmpFile);
          return;
        }
      }
    }

    // Letzter Versuch: 3-way (nur apply; --check kennt kein --3way)
    const ok3way = await tryGitApply(['--3way', '-p0', tmpFile], cwd);
    if (ok3way) {
      console.log('Patch applied successfully with --3way');
      fs.unlinkSync(tmpFile);
      return;
    }

    // Wenn alles fehlschlägt: etwas Kontext dumpen
    console.error('All git apply strategies failed. Showing patch head for debugging:');
    dumpPatchContext(tmpFile, 15); // häufige Fehlermarke (kannst du anpassen)

    throw new Error('git apply failed with all strategies (p0, p1, 3way).');
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
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
  const {changedFiles, summaryCommitMessage, patches, files} = result;

  // 1) Erst versuchen, den Unified Diff anzuwenden
  let applied = false;
  if (patches && patches.length > 0) {
    try {
      for (let i = 0; i < patches.length; i++) {
        console.log(`Applying patch ${i + 1}/${patches.length}...`);
        await applyPatch(patches[i]); // deine robuste Version mit --check/--3way
      }
      applied = true;
    } catch (e) {
      console.warn('Unified diff failed, falling back to full-file writes…', String(e));
    }
  }

  // 2) Fallback: komplette Dateien schreiben (überschreiben)
  if (!applied) {
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
  // after applying initial patch + running checks:
  const fixDiff = await repairWithJestFeedback(plan, changedFiles);
  if (fixDiff) {
    await applyPatch({diff: fixDiff}); // your robust git-apply
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
