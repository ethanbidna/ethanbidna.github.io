// Publishes the latest LIVE eval results to the website's /evals/ page.
// Usage: node scripts/publish-evals.mjs   (from the repo root, after: cd chat-api && npm run evals:live -- --yes)
import fs from "node:fs";

const src = "chat-api/evals/results/latest.json";
if (!fs.existsSync(src)) { console.error(`No ${src}. Run a live eval first.`); process.exit(2); }
const r = JSON.parse(fs.readFileSync(src, "utf8"));
if (r.meta.source !== "live" || r.meta.judge !== "live") { console.error("Refusing to publish: these results are not from a live run against the real assistant and a real judge."); process.exit(3); }

const out = {
  meta: { source: r.meta.source, judge: r.meta.judge, ranAt: r.meta.ranAt, assistantModel: r.meta.assistantModel, judgeModel: r.meta.judgeModel, cases: r.meta.cases, labeledTest: r.meta.labeledTest },
  criteria: r.criteria.map(({ id, type, name, plain, n, passed, rate, judgeValidation, corrected }) => ({ id, type, name, plain, n, passed, rate, judgeValidation, corrected })),
  categories: r.categories,
  failures: r.failures.slice(0, 5).map(({ caseId, category, criterion, note, answer }) => ({ caseId, category, criterion, plain: (r.criteria.find((c) => c.id === criterion) || {}).name, note, answer: answer.slice(0, 240) })),
  failureCount: r.failures.length,
  gate: r.gate,
};
fs.mkdirSync("evals", { recursive: true });
fs.writeFileSync("evals/results.json", JSON.stringify(out, null, 1) + "\n");
console.log(`Published ${out.criteria.length} criteria over ${out.meta.cases} cases to evals/results.json (run ${out.meta.ranAt}).`);
