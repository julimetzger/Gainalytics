import fs from "fs";
import path from "path";

export function codeWindow(repoRoot: string, file: string, line?: number, radius = 10) {
    try {
        const abs = path.isAbsolute(file) ? file : path.join(repoRoot, file);
        const src = fs.readFileSync(abs, "utf8").split(/\r?\n/);
        if (!line || line < 1 || line > src.length) {
            // fallback: first N lines
            const end = Math.min(src.length, radius * 2);
            return src.slice(0, end).map((l, i) => `${i + 1}: ${l}`).join("\n");
        }
        const start = Math.max(1, line - radius);
        const end = Math.min(src.length, line + radius);
        const out: string[] = [];
        for (let i = start; i <= end; i++) {
            out.push(`${i}: ${src[i - 1]}`);
        }
        return out.join("\n");
    } catch {
        return "(could not load source)";
    }
}
