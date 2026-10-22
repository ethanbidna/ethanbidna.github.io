import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import { APPLIES, CODE_CRITERIA, JUDGE_CRITERIA, CRITERIA, TAXONOMY_V0, THRESHOLDS } from "./criteria.mjs";
import { CHECKS } from "./checks.mjs";
import { runJudge, JUDGE_MODEL } from "./judge.mjs";
import { confusion, rates, correctedRate, bootstrapCorrected } from "./metrics.mjs";
import { answer as askAssistant, MODEL } from "../lib/answer.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(here, f), "utf8"));

async function pool(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const k = next++; out[k] = await fn(items[k], k); } }));
  return out;
}

const PRICES = { "claude-haiku-5-5": [0.1, 0.5], "claude-sonnet-5-5": [2, 10], "claude-opus-5-5": [4, 20] };  // USD per million tokens (input, output)
const cost = (model, u) => PRICES[model] ? (u.input * PRICES[model][0] + u.output * PRICES[model][1]) / 1e6 : null;
const gitSha = () => { try { return execSync("git rev-parse --short HEAD", { cwd: here, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return null; } };

export function planCalls({ cases, labeled }) {
  let judgeCases = 0;
  for (const c of cases) judgeCases += APPLIES[c.category].filter((k) => JUDGE_CRITERIA[k]).length;
  return { answers: cases.length, judgeOnCases: judgeCases, judgeValidation: labeled.filter((l) => l.split === "test").length };
}

// source: "fixtures" (recorded answers, for testing the harness) or "live" (calls the real assistant).
// judge:  "mock" | "mock-bad" (for tests) or "live" (calls the judge model).
export async function runEvals({ source = "fixtures", judge = "mock", client, model = MODEL, judgeModel = JUDGE_MODEL, concurrency = 4, limit, now = new Date() } = {}) {
  let cases = read("cases.json"); if (limit) cases = cases.slice(0, limit);
  const labeled = read("labeled.json");
  const fixtures = source === "fixtures" ? read("fixtures/outputs.json") : null;
  if ((source === "live" || judge === "live") && !client) client = new Anthropic({ maxRetries: 2, timeout: 60000 });

  const usage = { assistant: { input: 0, output: 0 }, judge: { input: 0, output: 0 } };
  const addUsage = (bucket, u) => { if (u) { usage[bucket].input += u.input_tokens || 0; usage[bucket].output += u.output_tokens || 0; } };

  // 1. Answers
  const traces = await pool(cases, concurrency, async (c) => {
    if (source === "fixtures") {
      const fx = fixtures[c.id]; if (!fx) throw new Error(`No fixture for case ${c.id}`);
      return { id: c.id, category: c.category, messages: c.messages, answer: fx.answer, stop_reason: "end_turn", expected: fx.expected || {} };
    }
    const out = await askAssistant(c.messages, { client, model });
    addUsage("assistant", out.usage);
    return { id: c.id, category: c.category, messages: c.messages, answer: out.text, stop_reason: out.stop_reason, expected: {} };
  });

  // 2. Code checks
  for (const t of traces) {
    t.checks = {};
    for (const k of APPLIES[t.category]) if (CODE_CRITERIA[k]) t.checks[k] = CHECKS[k](t.answer, cases.find((c) => c.id === t.id));
  }

  // 3. Judges. Few-shot examples come only from the labeled "train" split, never from the split used to validate.
  const examples = {}; for (const k of Object.keys(JUDGE_CRITERIA)) examples[k] = labeled.filter((l) => l.criterion === k && l.split === "train");
  let badCounter = 0;
  const judgeOne = async (criterion, ctx) => {
    if (judge === "live") { const r = await runJudge({ client, model: judgeModel, criterion, messages: ctx.messages, answer: ctx.answer, examples: examples[criterion] }); addUsage("judge", r.usage); return r; }
    const truth = ctx.expected || "pass";
    if (judge === "mock-bad" && (++badCounter % 3 === 0)) return { verdict: truth === "pass" ? "fail" : "pass", critique: "mock: wrong on purpose" };
    return { verdict: truth, critique: "mock verdict" };
  };
  const jobs = [];
  for (const t of traces) for (const k of APPLIES[t.category]) if (JUDGE_CRITERIA[k]) jobs.push({ t, k });
  await pool(jobs, concurrency, async ({ t, k }) => { t.judges = t.judges || {}; t.judges[k] = await judgeOne(k, { messages: t.messages, answer: t.answer, expected: t.expected[k] }); });

  // 4. Judge validation against the human labels (test split only)
  const validation = {};
  for (const k of Object.keys(JUDGE_CRITERIA)) {
    const items = labeled.filter((l) => l.criterion === k && l.split === "test");
    const judged = await pool(items, concurrency, async (l) => ({ truth: l.label, judged: (await judgeOne(k, { messages: [{ role: "user", content: l.question }], answer: l.answer, expected: l.label })).verdict }));
    const r = rates(confusion(judged));
    validation[k] = { ...r, confusion: confusion(judged), trusted: r.n >= THRESHOLDS.judgeMinTest && r.tpr >= THRESHOLDS.judgeTPR && r.tnr >= THRESHOLDS.judgeTNR, labeledSet: items.map((l) => l.label), judgedSet: judged.map((j) => j.judged) };
  }

  // 5. Aggregate
  const criteria = [];
  for (const k of Object.keys(CRITERIA)) {
    const rows = traces.filter((t) => APPLIES[t.category].includes(k));
    const outcomes = rows.map((t) => (CODE_CRITERIA[k] ? (t.checks[k].pass ? "pass" : "fail") : t.judges[k].verdict));
    const passed = outcomes.filter((o) => o === "pass").length, n = outcomes.length, rate = n ? passed / n : null;
    const entry = { id: k, type: CODE_CRITERIA[k] ? "code" : "judge", name: CRITERIA[k].name, plain: CRITERIA[k].plain, n, passed, rate };
    if (JUDGE_CRITERIA[k]) {
      const v = validation[k];
      entry.judgeValidation = { n: v.n, tpr: v.tpr, tnr: v.tnr, precision: v.precision, f1: v.f1, confusion: v.confusion, trusted: v.trusted };
      if (v.trusted && n) {
        const corrected = correctedRate(rate, v.tpr, v.tnr);
        const ci = bootstrapCorrected({ outcomes, labeled: v.labeledSet.map((truth, i) => ({ truth, judged: v.judgedSet[i] })) });
        entry.corrected = corrected === null ? null : { rate: corrected, ...(ci || {}) };
      }
    }
    criteria.push(entry);
  }
  const casePassed = (t) => APPLIES[t.category].every((k) => (CODE_CRITERIA[k] ? t.checks[k].pass : t.judges[k].verdict === "pass"));
  const categories = [...new Set(traces.map((t) => t.category))].map((cat) => { const rows = traces.filter((t) => t.category === cat); return { id: cat, n: rows.length, passed: rows.filter(casePassed).length }; });
  const failures = [];
  for (const t of traces) for (const k of APPLIES[t.category]) {
    const ok = CODE_CRITERIA[k] ? t.checks[k].pass : t.judges[k].verdict === "pass";
    if (!ok) failures.push({ caseId: t.id, category: t.category, criterion: k, note: CODE_CRITERIA[k] ? t.checks[k].detail : t.judges[k].critique, answer: t.answer.slice(0, 400) });
  }
  const failing = criteria.filter((c) => c.n && c.rate < THRESHOLDS.default).map((c) => c.id);
  const unverified = criteria.filter((c) => c.type === "judge" && !c.judgeValidation.trusted).map((c) => c.id);

  return {
    meta: { source, judge, ranAt: now.toISOString(), assistantModel: source === "live" ? model : "fixture", judgeModel: judge === "live" ? judgeModel : "mock", git: gitSha(), cases: traces.length, labeledTest: labeled.filter((l) => l.split === "test").length, thresholds: THRESHOLDS,
      usage: { ...usage, estimatedCostUSD: source === "live" || judge === "live" ? { assistant: cost(model, usage.assistant), judge: cost(judgeModel, usage.judge) } : null } },
    criteria, categories: categories.map((c) => ({ ...c, rate: c.passed / c.n })), failures, taxonomy: TAXONOMY_V0.map((t) => ({ ...t, status: "hypothesis" })),
    gate: { passed: failing.length === 0 && unverified.length === 0, failing, unverified },
    traces,
  };
}

export function markdownSummary(r) {
  const pct = (x) => (x === null || x === undefined ? "n/a" : (x * 100).toFixed(0) + "%");
  const lines = [`# Assistant eval run`, ``, `Source: ${r.meta.source} | Judge: ${r.meta.judge} | ${r.meta.ranAt} | cases: ${r.meta.cases}`, ``, `| Criterion | Type | Pass | Rate | Judge TPR / TNR | Corrected rate |`, `|---|---|---|---|---|---|`];
  for (const c of r.criteria) {
    const v = c.judgeValidation;
    lines.push(`| ${c.name} | ${c.type} | ${c.passed}/${c.n} | ${pct(c.rate)} | ${v ? `${pct(v.tpr)} / ${pct(v.tnr)}${v.trusted ? "" : " (not trusted)"}` : ""} | ${c.corrected ? `${pct(c.corrected.rate)}${c.corrected.lo !== undefined ? ` (${pct(c.corrected.lo)} to ${pct(c.corrected.hi)})` : ""}` : ""} |`);
  }
  lines.push(``, `Gate: ${r.gate.passed ? "PASS" : "FAIL"}${r.gate.failing.length ? ` | below threshold: ${r.gate.failing.join(", ")}` : ""}${r.gate.unverified.length ? ` | judges not trusted: ${r.gate.unverified.join(", ")}` : ""}`);
  if (r.failures.length) { lines.push(``, `## Failures`); for (const f of r.failures) lines.push(`- ${f.caseId} (${f.criterion}): ${f.note || ""}`); }
  return lines.join("\n") + "\n";
}

// ---------------- command line
function args(argv) { const o = {}; for (let i = 2; i < argv.length; i++) { const a = argv[i]; if (a.startsWith("--")) { const [k, v] = a.slice(2).split("="); o[k] = v === undefined ? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true) : v; } } return o; }
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const a = args(process.argv), source = a.source || "fixtures", judge = a.judge || (source === "live" ? "live" : "mock");
  const out = path.join(here, "results"); fs.mkdirSync(out, { recursive: true });
  if (source === "live" || judge === "live") {
    if (!process.env.ANTHROPIC_API_KEY) { console.error("A live run needs ANTHROPIC_API_KEY in the environment."); process.exit(2); }
    const plan = planCalls({ cases: read("cases.json"), labeled: read("labeled.json") });
    const calls = (source === "live" ? plan.answers : 0) + plan.judgeOnCases + plan.judgeValidation * 1;
    console.log(`This will make about ${calls} API calls (${plan.answers} assistant answers, ${plan.judgeOnCases + plan.judgeValidation} judge verdicts). Expect roughly $1 to $3.`);
    if (!a.yes && process.env.CI !== "true") { console.error("Add --yes to confirm and spend that."); process.exit(2); }
  }
  const r = await runEvals({ source, judge, limit: a.limit ? Number(a.limit) : undefined, concurrency: a.concurrency ? Number(a.concurrency) : 4 });
  const live = r.meta.source === "live" && r.meta.judge === "live";
  const base = live ? "latest" : "fixture-run";
  fs.writeFileSync(path.join(out, base + ".json"), JSON.stringify(r, null, 1));
  fs.writeFileSync(path.join(out, base + ".md"), markdownSummary(r));
  if (live) fs.writeFileSync(path.join(out, "traces.jsonl"), r.traces.map((t) => JSON.stringify(t)).join("\n") + "\n");
  console.log(markdownSummary(r));
  console.log(`Wrote results/${base}.json${live ? " and traces.jsonl" : " (not publishable: not a live run)"}`);
  process.exit(a.gate && !r.gate.passed ? 1 : 0);
}
