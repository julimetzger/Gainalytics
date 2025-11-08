import fs from "fs";
import path from "path";

export type JestFailure = {
    file: string;
    testName: string;
    message: string;       // condensed failure message
    line?: number;
    column?: number;
};

export type JestSummary = {
    numTotalTests: number;
    numFailedTests: number;
    numPassedTests: number;
    numPendingTests: number;
    failures: JestFailure[];
};

export function loadJestSummary(repoRoot: string, jsonFile = ".agent/jest.json"): JestSummary {
    const p = path.join(repoRoot, jsonFile);
    if (!fs.existsSync(p)) {
        return { numTotalTests: 0, numFailedTests: 0, numPassedTests: 0, numPendingTests: 0, failures: [] };
    }
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));

    const numTotalTests = raw.numTotalTests ?? 0;
    const numFailedTests = raw.numFailedTests ?? 0;
    const numPassedTests = raw.numPassedTests ?? 0;
    const numPendingTests = raw.numPendingTests ?? 0;

    const failures: JestFailure[] = [];
    for (const tr of raw.testResults ?? []) {
        const testFile = tr.name as string;
        for (const a of tr.assertionResults ?? []) {
            if (a.status !== "failed") continue;

            // Extract a message (Jest puts rich info in failureMessages)
            const msg = (a.failureMessages?.[0] ?? tr.message ?? "").toString();

            // Try to find a line/column inside message (best-effort)
            let line: number | undefined;
            let column: number | undefined;
            // Typical frame: "at Object.<anonymous> (<repo>/path/to/file.tsx:42:7)"
            const m = msg.match(/:(\d+):(\d+)\)?\s*$/m);
            if (m) {
                line = Number(m[1]);
                column = Number(m[2]);
            }

            failures.push({
                file: testFile,
                testName: a.fullName || a.title || "(unknown test)",
                message: condenseMessage(msg, 1200),
                line,
                column
            });
        }
    }

    return { numTotalTests, numFailedTests, numPassedTests, numPendingTests, failures };
}

function condenseMessage(s: string, max = 1200): string {
    // strip ANSI and collapse whitespace
    const ansi = /\u001b\[[0-9;]*m/g;
    const clean = s.replace(ansi, "").replace(/\r/g, "").slice(0, max);
    return clean;
}
