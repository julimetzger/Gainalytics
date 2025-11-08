import {execa} from "execa";
import fs from "fs";
import path from "path";

export interface JestRunOptions {
    repoRoot: string;              // project root (.. from /agent)
    outFile?: string;              // where to write JSON (relative to repoRoot)
    passWithNoTests?: boolean;
    testPathPattern?: string;      // optional filter
}

export async function runJestJson(opts: JestRunOptions) {
    const outFile = opts.outFile ?? ".agent/jest.json";
    const outPath = path.join(opts.repoRoot, outFile);

    // ensure output dir
    fs.mkdirSync(path.dirname(outPath), {recursive: true});

    const args = [
        "--json",
        `--outputFile=${outPath}`,
        "--testLocationInResults",
    ];
    if (opts.passWithNoTests) args.push("--passWithNoTests");
    if (opts.testPathPattern) args.push("--testPathPattern", opts.testPathPattern);

    await execa("npx", ["jest", ...args], {
        cwd: opts.repoRoot,
        stdio: "inherit",
    });

    return outPath;
}
