import OpenAI from "openai";
import {CONFIG} from "../config.js";
import fs from "fs";
import path from "path";
import {Task} from "../backlog/backlogTask";
import {Plan} from "./plant";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function planSteps(task: Task): Plan {
    // Sammle Dateiinhalte für jede Komponente
    const componentFiles = task.components.map(component => {
        try {
            const filePath = path.join(CONFIG.appPath, component);
            const content = fs.readFileSync(filePath, "utf8");
            return {
                filePath: component,
                content: content
            };
        } catch (error) {
            console.warn(`Could not read file: ${component}`, error);
            return {
                filePath: component,
                content: "// File not found or could not be read"
            };
        }
    });

    const userPrompt = `
You are the autonomous Gainalytics Dev Agent.
Analyze the following backlog item and output a *JSON plan* with clear step breakdowns.

Backlog item:
${JSON.stringify(task, null, 2)}

Files: 
${componentFiles.map(file => `
--- ${file.filePath} ---
${file.content}
`).join('\n')}

REQUIRED JSON OUTPUT FORMAT:
{
  "planId": "string - unique identifier for this plan",
  "taskId": "string - the task ID being processed", 
  "title": "string - brief title of what will be implemented",
  "description": "string - what this plan will accomplish",
  "steps": [
    {
      "stepId": "string - unique step identifier like 'step-1', 'step-2'", 
      "action": "string - one of: 'create', 'modify', 'delete'",
      "file": "string - relative path from project root like 'components/MyComponent.tsx'",
      "description": "string - what this step does",
      "dependencies": ["string array - stepIds this step depends on, empty if none"]
    }
  ],
  "estimatedFiles": "number - estimated number of files to be changed",
  "complexity": "string - one of: 'low', 'medium', 'high'"
}

Rules:
- Use Gainalytics conventions (React Native 0.72.6, TypeScript, React Native Paper)
- Each step MUST have a concrete file path and action
- Keep plan concise (<10 steps)
- Only reference files that actually need to be changed
- Use proper TypeScript interfaces and functional components
- Include test files when creating new components
- File paths must be relative from project root (no leading slash)
- stepId format: "step-1", "step-2", etc.

RESPOND ONLY WITH VALID JSON, NO ADDITIONAL TEXT.
`;

    const backlogFile = path.join(CONFIG.repoRoot, "kiContext.md");
    const body: OpenAI.Chat.ChatCompletionCreateParams = {
        model: CONFIG.llm.model,
        messages: [
            { role: "system" as const, content: fs.readFileSync(backlogFile, "utf8") },
            { role: "user" as const, content: userPrompt }
        ],
        response_format: { type: "json_object" }
    };

    console.log("body is", JSON.stringify(body, null, 2));
    const response = await client.chat.completions.create(body);

    console.log("response is", JSON.stringify(response, null, 2));

    const messageContent = response.choices[0].message.content;
    if (!messageContent) {
        throw new Error("No content received from OpenAI API");
    }

    const plan = JSON.parse(messageContent);

    // Validiere das Planformat
    if (!plan.planId || !plan.steps || !Array.isArray(plan.steps)) {
        throw new Error("Invalid plan format received from LLM");
    }

    // Validiere jeden Step
    for (const step of plan.steps) {
        if (!step.stepId || !step.action || !step.file || !step.description) {
            throw new Error(`Invalid step format: ${JSON.stringify(step)}`);
        }
        if (!['create', 'modify', 'delete'].includes(step.action)) {
            throw new Error(`Invalid action '${step.action}' in step ${step.stepId}`);
        }
    }

    return plan;
}

