import OpenAI from 'openai';
import {CONFIG} from '../config';
import {runJestJson} from '../tests/jestRunner';
import {buildJestFeedback} from '../tests/jestFeedback';
import {loadJestSummary} from '../tests/jestParser';

const client = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

export async function repairWithJestFeedback(plan: any, changedFiles: string[]) {
  // 1) Run tests and load results
  const {outPath, exitCode} = await runJestJson({repoRoot: CONFIG.repoRoot, passWithNoTests: true});
  console.log(`Test results written to: ${outPath} (exitCode=${exitCode})`);
  const summary = loadJestSummary(CONFIG.repoRoot);
  console.log('test summary is', summary);
  if (summary.numFailedTests === 0) return null; // nothing to fix

  // 2) Build compact payload
  const payload = buildJestFeedback(summary, CONFIG.repoRoot, 5);

  // 3) Ask the LLM for a minimal diff to fix the failures
  const system = `You are the Gainalytics Dev Agent. Fix Jest test failures.
Follow project conventions: RN 0.72.6, Redux, React Native Paper, TypeScript, StyleSheet at end.
Return ONLY a git-compatible unified diff that fixes the reported tests. Keep changes minimal and scoped.`;

  const user = `
Task: ${plan?.planId ?? '(unknown)'} — ${plan?.title ?? ''}
Files recently touched:
${changedFiles.map((f) => `- ${f}`).join('\n')}

Failing tests (condensed):
${JSON.stringify(payload, null, 2)}

Rules:
- Do not modify unrelated files.
- Prefer typing fixes and correct imports over workarounds.
- If snapshot change is expected, include updated snapshots in the diff.
- Output ONE multi-file unified diff. No extra text.
`.trim();

  const r = await client.chat.completions.create({
    model: CONFIG.llm.model,
    temperature: 0.2,
    messages: [
      {role: 'system', content: system},
      {role: 'user', content: user},
    ],
  });

  const diff = r.choices[0]?.message?.content ?? '';
  if (!diff.includes('diff --git')) {
    throw new Error('LLM did not return a unified diff.');
  }
  return diff;
}
