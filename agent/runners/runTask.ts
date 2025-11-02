// /agent/runners/runTask.js
import fs from "fs";
import path from "path";
import { execa } from "execa";
import {planSteps} from "../llm/taskPlanner";
import {applyEdits} from "../llm/codeEditor";
import {Task} from "../backlog/backlogTask";
import {CONFIG} from "../config";

// --- helpers ---------------------------------------------------------------

async function ensureBranch(branch) {
    try {
        await execa("git", ["checkout", "-b", branch], { stdio: "inherit" });
    } catch {
        await execa("git", ["checkout", branch], { stdio: "inherit" });
    }
}

async function npmChecks() {
    await execa("npm", ["run", "typecheck"], { stdio: "inherit" });
    await execa("npm", ["run", "test"], { stdio: "inherit" });
    await execa("npm", ["run", "lint"], { stdio: "inherit" });
    await execa("npm", ["run", "format"], { stdio: "inherit" });
}

async function gitCommit(message) {
    await execa("git", ["add", "."], { stdio: "inherit" });
    try {
        await execa("git", ["commit", "-m", message], { stdio: "inherit" });
    } catch {
        // no-op if nothing to commit
    }
}

async function applyPatch(patch) {
    if (!patch?.diff || typeof patch.diff !== "string") {
        throw new Error("Invalid patch provided");
    }

    // Parse das Diff um zu verstehen was gemacht werden soll
    const lines = patch.diff.split('\n');
    let targetFile = null;
    let isNewFile = false;
    let content = [];

    for (const line of lines) {
        if (line.startsWith('diff --git ')) {
            const match = line.match(/diff --git a\/(.*?) b\/(.*)/);
            if (match) {
                targetFile = match[2]; // b/ path ist der Ziel-Pfad
            }
        } else if (line.includes('new file mode')) {
            isNewFile = true;
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
            // Füge Zeile hinzu (ohne das '+' am Anfang)
            content.push(line.substring(1));
        }
    }

    if (!targetFile) {
        throw new Error("Could not determine target file from diff");
    }

    const fullPath = path.join(CONFIG.appPath, targetFile);

    if (isNewFile) {
        // Erstelle Verzeichnis falls es nicht existiert
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Schreibe neue Datei
        fs.writeFileSync(fullPath, content.join('\n'), 'utf8');
        console.log(`Created new file: ${targetFile}`);
    } else {
        // TODO: Handle file modifications (für jetzt nur neue Dateien)
        console.warn(`File modification not implemented yet: ${targetFile}`);
    }
}

export async function runTask(task: Task) {
    const branch = `agent/${task.id}`;
    await ensureBranch(branch);

    console.log(`Processing task ${task.id}: ${task.title}`);

    // 1) Plan erstellen
    console.log("Creating plan...");
    const plan = await planSteps(task);
    console.log("Plan created:", JSON.stringify(plan, null, 2));

    // 2) Edits/Diffs erzeugen
    console.log("Generating edits...");
    const { changedFiles, summaryCommitMessage, patches } = await applyEdits(plan);
    console.log(`Generated ${patches?.length || 0} patches for ${changedFiles?.length || 0} files`);

    // 3) Patches anwenden - NEUE METHODE
    if (patches && patches.length > 0) {
        for (let i = 0; i < patches.length; i++) {
            const p = patches[i];
            console.log(`Applying patch ${i + 1}/${patches.length}...`);

            try {
                await applyPatch(p);
                console.log(`Patch ${i + 1} applied successfully`);
            } catch (error) {
                console.error(`Failed to apply patch ${i + 1}:`, error.message);
                throw error;
            }
        }
    }

    // 4) Commit
    const commitMsg = summaryCommitMessage ? summaryCommitMessage() : `feat(${task.id}): ${task.title}`;
    console.log("Committing changes with message:", commitMsg);
    await gitCommit(commitMsg);

    return {
        branch,
        taskId: task.id,
        status: "ready-for-review",
        changedFiles,
        plan
    };
}

