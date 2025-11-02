// /agent/runners/runTask.js
import fs from "fs";
import path from "path";
import { execa } from "execa";
import {planSteps} from "../llm/taskPlanner";
import {applyEdits} from "../llm/codeEditor";

// --- helpers ---------------------------------------------------------------

async function ensureBranch(branch) {
    try {
        await execa("git", ["checkout", "-b", branch], { stdio: "inherit" });
    } catch {
        await execa("git", ["checkout", branch], { stdio: "inherit" });
    }
}

async function gitApplyUnifiedDiff(diffText) {
    const tmp = path.join(process.cwd(), ".agent_patch.diff");
    fs.writeFileSync(tmp, diffText, "utf8");
    try {
        await execa("git", ["apply", "-p0", tmp], { stdio: "inherit" });
    } finally {
        fs.unlinkSync(tmp);
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

// --- main -----------------------------------------------------------------

export async function runTask(task) {
    const branch = `agent/${task.id}`;
    await ensureBranch(branch);

    // 1) Plan erstellen (taskPlanner.ts)
    const plan = await planSteps(task);

    // 2) Edits/Diffs erzeugen (codeEditor.ts)
    // applyEdits liefert: { changedFiles, summaryCommitMessage(): string, patches: [{ diff: string }] }
    const { changedFiles, summaryCommitMessage, patches } = await applyEdits(plan);

    // 3) Patches anwenden (alle unified diffs)
    for (const p of patches) {
        if (!p?.diff || typeof p.diff !== "string") {
            throw new Error("applyEdits() returned an invalid patch entry.");
        }
        await gitApplyUnifiedDiff(p.diff);
    }

    // 4) Checks
    await npmChecks();

    // 5) Commit
    await gitCommit(summaryCommitMessage ? summaryCommitMessage() : `feat(${task.id}): ${task.title}`);

    // 6) Report
    return {
        branch,
        taskId: task.id,
        status: "ready-for-review",
        changedFiles,
        plan
    };
}
