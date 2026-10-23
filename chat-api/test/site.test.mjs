import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..", "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const pages = ["index.html", "ask/index.html", "contact/index.html", "agents/index.html", "mcp/index.html", "evals/index.html", "404.html"];

for (const f of pages) {
  const html = read(f);
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
  assert.ok(csp, `${f}: missing CSP`);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/, `${f}: CSP must not allow unsafe code`);
  assert.match(csp, /object-src 'none'/); assert.match(csp, /base-uri 'none'/);
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)];
  for (const m of scripts) {
    const h = `'sha256-${crypto.createHash("sha256").update(m[1]).digest("base64")}'`;
    assert.ok(csp.includes(h), `${f}: inline script hash not in CSP (run node scripts/harden.mjs)`);
  }
  assert.match(html, /name="referrer"/, `${f}: referrer policy`);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/, `${f}: no third-party scripts`);
}

// security.txt must be current.
const exp = /Expires: (.+)/.exec(read(".well-known/security.txt"))[1];
assert.ok(new Date(exp) > new Date(), "security.txt has expired");

// The agent-facing files carry the privacy rules and no personal details.
for (const f of ["agents.txt", ".well-known/agents.txt", "llms.txt"]) {
  const t = read(f);
  assert.match(t, /personal|Privacy/i, `${f}: privacy rules`);
  assert.doesNotMatch(t, /Boston|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|Morning Consult|Rochester/, `${f}: personal detail`);
}
assert.equal(read("agents.txt"), read(".well-known/agents.txt"), "agents.txt copies differ");
// The numbers on the Ask page must match the eval suite.
{
  const cases = JSON.parse(read("chat-api/evals/cases.json"));
  const { CODE_CRITERIA, JUDGE_CRITERIA } = await import("../evals/criteria.mjs");
  const ask = read("ask/index.html");
  assert.match(ask, new RegExp(`<span>${cases.length}</span> conversations`), "Ask page conversation count is stale");
  assert.match(ask, new RegExp(`<span>${Object.keys(CODE_CRITERIA).length + Object.keys(JUDGE_CRITERIA).length}</span> checks`), "Ask page check count is stale");
}
console.log("all site tests passed");
