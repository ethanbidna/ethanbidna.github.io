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

const criteriaRows = (obj, withDefs) => Object.entries(obj).map(([id, c]) =>
  `<li><b>${esc(c.name)}</b> ${esc(c.plain)}${withDefs ? `<details><summary>Pass and fail</summary><p><b>Pass.</b> ${esc(c.pass)}</p><p><b>Fail.</b> ${esc(c.fail)}</p></details>` : ""}</li>`).join("\n      ");

const groupHtml = Object.entries(GROUPS).map(([cat, title]) => {
  const list = cases.filter((c) => c.category === cat);
  if (!list.length) return "";
  const items = list.map((c) => `<li>${c.messages.filter((m) => m.role === "user").map((m) => esc(m.content)).join(' <span class="then">then</span> ')}</li>`).join("\n        ");
  return `<details class="group"><summary>${esc(title)} <span class="count">${list.length}</span></summary>\n      <ul class="plain">\n        ${items}\n      </ul></details>`;
}).filter(Boolean).join("\n      ");

const codeN = Object.keys(CODE_CRITERIA).length, judgeN = Object.keys(JUDGE_CRITERIA).length;
const desc = `The ${cases.length} test conversations and ${codeN + judgeN} pass or fail checks used to test the AI assistant on Ethan Bidna's site.`;

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
<link rel="icon" href="/favicon.ico">
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
<div class="wrap">
  <header class="bar"><a class="wordmark" href="/">Ethan Bidna</a><nav aria-label="Primary"><a href="/ask/">Ask me anything</a><a href="/contact/">Contact</a><a href="/agents/">For agents</a></nav></header>
  <main class="page evals">
    <h1>Evals</h1>
    <p class="lead">${cases.length} test conversations. ${codeN + judgeN} pass or fail checks.</p>

    <h2>Checks</h2>
    <p>Each check tests one thing and is a plain pass or fail.</p>
    <ul class="plain">
      ${criteriaRows(CODE_CRITERIA, false)}
    </ul>
    <p>Judged by an AI, one narrow question at a time.</p>
    <ul class="plain">
      ${criteriaRows(JUDGE_CRITERIA, true)}
    </ul>

    <h2>Test conversations</h2>
    ${groupHtml}
  </main>
</div>
<footer><a href="/agents/">Are you an AI agent? Start here.</a></footer>
</body>
</html>
`;
fs.writeFileSync(path.join(root, "evals/index.html"), html);
import { execFileSync } from "node:child_process";
execFileSync("node", [path.join(root, "scripts/harden.mjs")], { stdio: "ignore" });
console.log(`evals/index.html: ${cases.length} cases, ${codeN + judgeN} checks`);
