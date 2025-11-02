import OpenAI from "openai";
import fs from "fs";
import {CONFIG} from "../config";
import path from "path";
import {Plan} from "./plant";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function applyEdits(plan: Plan) {
    const fileContexts = plan.steps.map(step => {
        let appFile = path.join(CONFIG.appPath, step.file);
        if (fs.existsSync(appFile)) {
            const code = fs.readFileSync(appFile, "utf8");
            return `### File: ${step.file}\n${code}`;
        } else {
            return `### File: ${step.file}\n<new file>`;
        }
    }).join("\n\n");

    const userPrompt = `
You are the Gainalytics Dev Agent.
Apply the following plan by producing *unified diffs* for the specified files.

${JSON.stringify(plan, null, 2)}

Context code:
${fileContexts}

Rules:
- React Native 0.72.6 + Redux + React Native Paper + TypeScript.
- Functional components with props interface + StyleSheet at end.
- Keep diffs minimal and syntactically valid.
- Output ONLY unified diffs, no extra text.
`;

    console.log(userPrompt);
    const response = await client.chat.completions.create({
        model: CONFIG.llm.model,
        messages: [
            {role: "system", content: "You output only valid unified diffs for Git."},
            {role: "user", content: userPrompt}
        ]
    });

    const diffText = response.choices[0].message.content;
    console.log(diffText);
    // The diff is then applied via `git apply`
    return {
        changedFiles: plan.steps.map(s => s.file),
        patches: [{diff: diffText}],
        summaryCommitMessage: () => `feat: ${plan.planId} — implemented planned steps`
    };
}
