// /agent/actions/jestRunner.ts
import { execa } from "execa";
import fs from "fs";
import path from "path";

export interface JestRunOptions {
  repoRoot: string;
  outFile?: string;               // default: .agent/jest.json (relativ zu repoRoot)
  passWithNoTests?: boolean;
  testPathPattern?: string;
}

export async function runJestJson(opts: JestRunOptions) {
  const outFile = opts.outFile ?? ".agent/jest.json";
  const outPath = path.join(opts.repoRoot, outFile);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const args = [
    "--json",
    `--outputFile=${outPath}`,
    "--testLocationInResults",
  ];
  if (opts.passWithNoTests) args.push("--passWithNoTests");
  if (opts.testPathPattern) args.push("--testPathPattern", opts.testPathPattern);

  // WICHTIG: reject:false → execa wirft nicht bei Exitcode 1
  const { exitCode } = await execa("npx", ["jest", ...args], {
    cwd: opts.repoRoot,
    stdio: "inherit",
    reject: false,
  });

  // Jest schreibt die JSON auch bei Exitcode 1. Wenn die Datei fehlt → harter Fehler.
  if (!fs.existsSync(outPath)) {
    throw new Error(`Jest JSON was not written to ${outPath}`);
  }

  return { outPath, exitCode }; // exitCode 0 = grün, 1 = Tests fehlgeschlagen (normal)
}
