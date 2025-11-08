// /agent/llm/codeEditor.ts
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { CONFIG } from "../config";
import { Plan } from "./planModel";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Begrenze sehr große Dateien, um Token zu sparen */
function trimCode(code: string, max = 20000) {
    return code.length > max ? code.slice(0, max) + "\n/* …trimmed… */" : code;
}

/** Normalisiert auf repo-root-relative Pfade */
function toRel(file: string) {
    // Falls deine Plan-Schritte relative Pfade sind (empfohlen), nimm sie 1:1:
    if (file.startsWith("app/") || file.startsWith("__tests__") || file.startsWith("tests/")) return file;
    // Optional: wenn jemand versehentlich absolute Pfade reingibt, mache sie relativ:
    return file.replace(/^([A-Za-z]:)?[\\/]+/g, "").replace(/^[.][\\/]/, "");
}

/** Baut den Kontext aus den im Plan referenzierten Dateien auf */
function buildFileContexts(plan: Plan) {
    const chunks: string[] = [];
    const seen = new Set<string>();

    for (const step of plan.steps || []) {
        if (!step?.file) continue;
        const rel = toRel(step.file);
        if (seen.has(rel)) continue;
        seen.add(rel);

        const abs = path.join(CONFIG.repoRoot, rel);
        if (fs.existsSync(abs)) {
            const code = fs.readFileSync(abs, "utf8");
            chunks.push(`### File: ${rel}\n${trimCode(code)}`);
        } else {
            // Neue Datei
            chunks.push(`### File: ${rel}\n<new file>`);
        }
    }
    return chunks.join("\n\n");
}

/** Erzeugt einen einzigen Multi-File-Unified-Diff */
async function generateUnifiedDiff(plan: Plan, contexts: string) {
    const userPrompt = `
You are the Gainalytics Dev Agent.
Apply the following plan by producing ONE git-compatible multi-file unified diff that can be applied with 'git apply'.

Plan:
${JSON.stringify(plan, null, 2)}

Context code (repo-root relative):
${contexts}

CRITICAL DIFF FORMAT REQUIREMENTS:
1) Use standard git headers: "diff --git a/<path> b/<path>", followed by index/mode lines where applicable.
2) Paths must be repo-root relative (e.g. "app/components/…").
3) For new files include:
   - "new file mode 100644"
   - "--- /dev/null"
   - "+++ b/<path>"
4) Provide at least 5 context lines per hunk (like: git diff -U5).
5) Match CURRENT file content exactly (from the context). Do not guess line numbers.
6) Output ONLY the unified diff text. No explanations, no fences, no extra prose.
`.trim();

    const response = await client.chat.completions.create({
        model: CONFIG.llm.model,
        messages: [
            {
                role: "system",
                content:
                    "You output only valid unified diffs for Git. Include proper headers and modes. Do not include explanations."
            },
            { role: "user", content: userPrompt }
        ]
    });

    const diffText = response.choices[0]?.message?.content ?? "";
    return diffText;
}

/** Liefert vollständige Datei-Inhalte für alle im Plan geänderten Dateien (Fallback) */
async function generateFullFiles(plan: Plan, contexts: string) {
    const userPrompt = `
Return the FULL FINAL CONTENT for ONLY the files edited/created by this plan.
- Output STRICT JSON in the form: {"files":[{"path":"<repo-root-relative path>","content":"<entire file content>"}]}
- "path" must be repo-root relative (e.g. "app/components/…")
- "content" must be the complete file text after applying the plan changes.
- Do not include comments or explanations outside JSON.

Plan:
${JSON.stringify(plan, null, 2)}

Context code (for reference):
${contexts}
`.trim();

    const response = await client.chat.completions.create({
        model: CONFIG.llm.model,
        messages: [
            { role: "system", content: "You return STRICT JSON only." },
            { role: "user", content: userPrompt }
        ],
        // Bei manchen Modellen verfügbar; wenn nicht, weglassen:
        response_format: { type: "json_object" as any }
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    // Defensive parsing (falls das Modell kein response_format unterstützt)
    const parsed = safeJsonParse(raw, { files: [] as Array<{ path: string; content: string }> });

    // Normalize paths
    const files = (parsed.files || []).map((f: any) => ({
        path: toRel(String(f.path || "")),
        content: String(f.content ?? "")
    }));

    return files;
}

function safeJsonParse<T>(text: string, fallback: T): T {
    try {
        return JSON.parse(text) as T;
    } catch {
        return fallback;
    }
}

/**
 * applyEdits:
 * - erzeugt einen Multi-File unified diff
 * - optional: Full-File-Fallback (files[])
 */
export async function applyEdits(
    plan: Plan,
    opts?: { alsoReturnFullFiles?: boolean }
): Promise<{
    changedFiles: string[];
    patches: Array<{ diff: string }>;
    summaryCommitMessage: () => string;
    files?: Array<{ path: string; content: string }>;
}> {
    const contexts = buildFileContexts(plan);

    // 1) Unified Diff erzeugen
    const diffText = await generateUnifiedDiff(plan, contexts);

    // 2) Optional: Full-File-Fallback anfordern
    let files: Array<{ path: string; content: string }> | undefined = undefined;
    if (opts?.alsoReturnFullFiles) {
        files = await generateFullFiles(plan, contexts);
    }

    // 3) Ausgabe zusammenstellen
    const changedFiles = Array.from(new Set((plan.steps || []).map(s => toRel(s.file))));

    return {
        changedFiles,
        patches: [{ diff: diffText }],
        files, // <- Runner kann bei git-apply-Fehlern hierauf zurückfallen
        summaryCommitMessage: () => `feat(${plan.planId}): ${plan.title}`
    };
}
