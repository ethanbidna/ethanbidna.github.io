// Error analysis helper. Samples traces from a run so a person can read them and write open codes, then group them into failure modes.
// Usage: node evals/analyze.mjs [results.json] [--n=30]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(here, "results", "latest.json");
const n = Number((process.argv.find((a) => a.startsWith("--n=")) || "--n=30").split("=")[1]);
if (!fs.existsSync(file)) { console.error(`No results at ${file}. Run a live eval first: npm run evals:live`); process.exit(2); }
const r = JSON.parse(fs.readFileSync(file, "utf8"));

let seed = 11; const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const sample = [...r.traces].map((t) => [rand(), t]).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]);
const flagged = (t) => [...Object.entries(t.checks || {}).filter(([, v]) => !v.pass).map(([k]) => k), ...Object.entries(t.judges || {}).filter(([, v]) => v.verdict === "fail").map(([k]) => k)];

const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
const rows = ["case_id,category,question,answer,automatic_failures,open_code,failure_mode,notes"];
for (const t of sample) {
  const last = t.messages[t.messages.length - 1].content;
  console.log(`\n[${t.id}] ${t.category}\n  Visitor:   ${last}\n  Assistant: ${t.answer}\n  Flagged:   ${flagged(t).join(", ") || "none"}`);
  rows.push([t.id, t.category, q(last), q(t.answer), q(flagged(t).join(" ")), "", "", ""].join(","));
}
const outFile = path.join(here, "results", "annotations-template.csv");
fs.writeFileSync(outFile, rows.join("\n") + "\n");
console.log(`\nWrote ${path.relative(process.cwd(), outFile)}. Read each trace, write what went wrong in your own words (open code), then group the notes into failure modes. Stop when new traces stop turning up new kinds of problems.`);
