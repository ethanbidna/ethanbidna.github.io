// Generates evals/index.html from the eval suite itself (criteria + test conversations), so the page can never drift.
// Usage: node scripts/build-evals-page.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
import { CODE_CRITERIA, JUDGE_CRITERIA, APPLIES } from "../chat-api/evals/criteria.mjs";

const cases = JSON.parse(fs.readFileSync(path.join(root, "chat-api/evals/cases.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const GROUPS = {
  basics: "Everyday questions about his work",
  unknown: "Questions it should not guess at",
  identity: "Is it an AI?",
  injection: "Attempts to rewrite its rules",
  commitment: "Requests for promises on his behalf",
  off_topic: "Requests that have nothing to do with him",
  abuse: "Rude or intrusive requests",
  personal: "Personal questions",
  multi_turn_final: "The last question of a conversation",
};

const codeIds = Object.keys(CODE_CRITERIA), judgeIds = Object.keys(JUDGE_CRITERIA);
const ALL = { ...CODE_CRITERIA, ...JUDGE_CRITERIA };
const ids = [...codeIds, ...judgeIds];
const typeOf = (id) => (id in JUDGE_CRITERIA ? "judge" : "code");
const cats = Object.keys(GROUPS);
const SHORT = { basics: "basics", unknown: "unknown", identity: "identity", injection: "injection", commitment: "commit", off_topic: "off-topic", abuse: "abuse", personal: "personal", multi_turn_final: "final turn" };
const countBy = (cat) => cases.filter((c) => c.category === cat).length;
const appliesTo = (id) => cats.filter((c) => (APPLIES[c] || []).includes(id));
const chip = (t) => `<span class="chip ${t}">${t === "judge" ? "LLM judge" : "code"}</span>`;
const inputOf = (c) => c.messages.filter((m) => m.role === "user").map((m) => m.content).join("  →  ");

const evaluatorRows = ids.map((id) => {
  const c = ALL[id], t = typeOf(id), n = appliesTo(id).length;
  const defs = t === "judge" ? `<details><summary>Pass / fail criteria</summary><p><b>Pass.</b> ${esc(c.pass)}</p><p><b>Fail.</b> ${esc(c.fail)}</p></details>` : "";
  return `<tr><td><code>${id}</code></td><td>${esc(c.name)}</td><td>${chip(t)}</td><td>${esc(c.plain)}${defs}</td><td class="num">${n}<span class="of">/${cats.length}</span></td></tr>`;
}).join("\n          ");

const matrixHead = cats.map((c) => `<th scope="col" class="mx"><span>${SHORT[c]}</span><small>n=${countBy(c)}</small></th>`).join("");
const matrixRows = ids.map((id) => {
  const t = typeOf(id);
  const cells = cats.map((c) => (APPLIES[c] || []).includes(id) ? `<td class="mx"><span class="cell ${t}" title="${id} runs on ${SHORT[c]}"></span><span class="sr-only">runs</span></td>` : `<td class="mx"><span class="cell off"></span><span class="sr-only">not run</span></td>`).join("");
  return `<tr><th scope="row"><code>${id}</code></th>${cells}</tr>`;
}).join("\n          ");

const maxCat = Math.max(...cats.map(countBy));
const dist = cats.map((c) => `<li><span class="lab">${SHORT[c]}</span><span class="segs" role="img" aria-label="${countBy(c)} examples">${Array.from({ length: maxCat }, (_, k) => `<i class="seg ${k < countBy(c) ? "on" : ""}"></i>`).join("")}</span><span class="val">${countBy(c)}</span></li>`).join("\n        ");

const datasetRows = cases.map((c) => {
  const on = APPLIES[c.category] || [];
  const turns = c.messages.filter((m) => m.role === "user").length;
  const pips = ids.map((id) => `<i class="pip ${on.includes(id) ? typeOf(id) : "off"}"></i>`).join("");
  return `<tr><td><code>${c.id}</code></td><td><span class="chip cat">${SHORT[c.category]}</span></td><td class="num">${turns}</td><td class="in"><code title="${esc(inputOf(c))}">${esc(inputOf(c))}</code></td><td><span class="pips" role="img" aria-label="${on.length} evaluators">${pips}</span> <span class="n">${on.length}</span></td></tr>`;
}).join("\n          ");

const codeN = Object.keys(CODE_CRITERIA).length, judgeN = Object.keys(JUDGE_CRITERIA).length;
const desc = `The evaluators and the ${cases.length}-example dataset used to test the AI assistant on Ethan Bidna's site: ${codeN} code checks and ${judgeN} LLM judges across ${cats.length} categories.`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evals | Ethan Bidna</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="https://www.ethanbidna.com/evals/">
<meta name="theme-color" content="#adacb0">
<meta name="author" content="Ethan S. Bidna">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="alternate" type="text/plain" href="/.well-known/agents.txt" title="agents.txt">
<link rel="alternate" type="text/plain" href="/llms.txt" title="Summary for AI agents">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ethan Bidna">
<meta property="og:title" content="Evals | Ethan Bidna">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="https://www.ethanbidna.com/evals/">
<meta property="og:image" content="https://www.ethanbidna.com/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Ethan Bidna. AI product management and enablement.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Evals | Ethan Bidna">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="https://www.ethanbidna.com/og.png">
<link rel="preload" href="/fonts/bricolage-latin-opsz.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site.css">
</head>
<body>
<div class="topbar"><div class="wrap"><header class="bar"><a class="wordmark" href="/">Ethan Bidna</a><nav aria-label="Primary"><a href="/ask/" id="nav-clone"><span class="long">Ask me anything</span><span class="short">Ask me</span></a><a href="/mcp/">Ethan MCP</a><a href="/contact/">Contact</a></nav></header></div></div>
<div class="wrap">
  <main class="ev" id="main">
    <p class="ev-crumb"><span>assistant</span> <span class="sl">/</span> <b>evals</b></p>
    <h1>Evals</h1>
    <div class="ev-stats">
      <div><span class="k">Examples</span><span class="v">${cases.length}</span></div>
      <div><span class="k">Evaluators</span><span class="v">${codeN + judgeN}</span></div>
      <div><span class="k">Code checks</span><span class="v">${codeN}</span></div>
      <div><span class="k">LLM judges</span><span class="v">${judgeN}</span></div>
      <div><span class="k">Categories</span><span class="v">${cats.length}</span></div>
    </div>
    <nav class="ev-tabs" aria-label="Sections"><a href="#evaluators">Evaluators <i>${codeN + judgeN}</i></a><a href="#coverage">Coverage</a><a href="#dataset">Dataset <i>${cases.length}</i></a></nav>

    <section id="evaluators" class="ev-sec">
      <h2>Evaluators</h2>
      <div class="ev-card tbl"><table>
        <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>What it checks</th><th class="num">Runs on</th></tr></thead>
        <tbody>
          ${evaluatorRows}
        </tbody>
      </table></div>
    </section>

    <section id="coverage" class="ev-sec">
      <h2>Coverage</h2>
      <p class="key"><span class="cell code"></span> code check <span class="cell judge"></span> LLM judge <span class="cell off"></span> not run on that category</p>
      <div class="ev-two">
        <div class="ev-card tbl"><table class="matrix">
          <thead><tr><th>Evaluator</th>${matrixHead}</tr></thead>
          <tbody>
          ${matrixRows}
          </tbody>
        </table></div>
        <div class="ev-card dist"><h3>Examples by category</h3>
          <ul>
        ${dist}
          </ul>
        </div>
      </div>
    </section>

    <section id="dataset" class="ev-sec">
      <h2>Dataset</h2>
      <div class="ev-card tbl scroll"><table class="dataset">
        <thead><tr><th>ID</th><th>Category</th><th class="num">Turns</th><th>Input</th><th>Evaluators</th></tr></thead>
        <tbody>
          ${datasetRows}
        </tbody>
      </table></div>
    </section>
  </main>
</div>
<footer><a href="/agents/">Are you an AI agent? Start here.</a></footer>
<script src="/nav.js" defer></script>
</body>
</html>
`;
fs.writeFileSync(path.join(root, "evals/index.html"), html);
import { execFileSync } from "node:child_process";
execFileSync("node", [path.join(root, "scripts/harden.mjs")], { stdio: "ignore" });
console.log(`evals/index.html: ${cases.length} cases, ${codeN + judgeN} checks`);
