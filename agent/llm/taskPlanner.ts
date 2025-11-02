import OpenAI from "openai";
import {CONFIG} from "../config.js";
import fs from "fs";
import path from "path";
import {Task} from "../backlog/backlogTask";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function planSteps(task: Task) {
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

Rules:
- Use Gainalytics conventions as in the system description
- Each step must describe a concrete edit or file to add/change.
- Keep plan concise (<10 steps).
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
    return plan;
}

