import "dotenv/config";
import path from "path";
import * as process from "node:process";


export const CONFIG = {
    agentRoot: process.cwd(),
    repoRoot : path.resolve(process.cwd(), ".."),
    appPath: path.resolve(process.cwd(), "../app"),
    backlogPath: "backlog/tasks.yaml",
    llm: {
        model: "gpt-5"
    },
    commands: {
        typecheck: "npm run typecheck",
        tests: "npm run test",
        lint: "npm run lint",
        format: "npm run format"
    }
};
