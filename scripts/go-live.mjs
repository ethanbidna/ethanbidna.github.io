// Turns the Ask me anything page on. Usage: node scripts/go-live.mjs   (the chat runs on the same site at /api/chat)
// Run it from the repo root after the site is deployed on Cloudflare with the OPENROUTER_API_KEY secret set.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const endpoint = "/api/chat";
const edit = (file, fn) => { const before = fs.readFileSync(file, "utf8"), after = fn(before); if (before === after) console.warn("no change:", file); fs.writeFileSync(file, after); };
const unhide = (s) => s.replace(/(id="(?:nav-clone|to-clone|mcp|ask-evals)"[^>]*?) hidden/g, "$1");
for (const f of ["index.html", "contact/index.html", "agents/index.html"]) if (fs.existsSync(f)) { const before = fs.readFileSync(f, "utf8"); const after = unhide(before); if (after !== before) fs.writeFileSync(f, after); }
edit("ask/index.html", (s) => s.replace('data-endpoint=""', `data-endpoint="${endpoint}"`).replace('content="noindex, follow"', 'content="index, follow, max-image-preview:large"'));
edit("sitemap.xml", (s) => s.includes("/ask/") ? s : s.replace("  <url><loc>https://www.ethanbidna.com/agents/</loc>", "  <url><loc>https://www.ethanbidna.com/ask/</loc><lastmod>2026-10-22</lastmod><priority>0.7</priority></url>\n  <url><loc>https://www.ethanbidna.com/agents/</loc>"));
edit("llms.txt", (s) => s.includes("/ask/") ? s : s.replace("- [Contact]", "- [Ask me anything](https://www.ethanbidna.com/ask/): ask an AI assistant that knows Ethan's work\n- [Contact]"));
const mcpUrl = "https://www.ethanbidna.com/api/mcp";
for (const f of ["agents/index.html", "agents.txt", ".well-known/agents.txt"]) edit(f, (s) => s.replaceAll("https://YOUR-DEPLOYMENT.vercel.app/api/mcp", mcpUrl));
edit("llms.txt", (s) => s.includes("MCP server") ? s : s.trimEnd() + `\n- MCP server (read-only tools about Ethan): ${mcpUrl}\n`);
execFileSync("node", ["scripts/harden.mjs"], { stdio: "inherit" });
console.log("Ask me anything enabled with", endpoint);
console.log("MCP server listed at", mcpUrl);
