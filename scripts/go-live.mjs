// Turns the Ask me anything page on. Usage: node scripts/go-live.mjs https://YOUR-DEPLOYMENT/api/chat
// Run it from the repo root after the chat-api function is deployed.
import fs from "node:fs";
const endpoint = process.argv[2];
if (!/^https:\/\/.+\/api\/chat$/.test(endpoint || "")) { console.error("Give the full https URL ending in /api/chat"); process.exit(1); }
const edit = (file, fn) => { const before = fs.readFileSync(file, "utf8"), after = fn(before); if (before === after) console.warn("no change:", file); fs.writeFileSync(file, after); };
const unhide = (s) => s.replace(/(id="(?:nav-clone|to-clone|ask)"[^>]*?) hidden/g, "$1");
for (const f of ["index.html", "contact/index.html", "agents/index.html"]) if (fs.existsSync(f)) edit(f, unhide);
edit("ask/index.html", (s) => s.replace('data-endpoint=""', `data-endpoint="${endpoint}"`).replace('content="noindex, follow"', 'content="index, follow, max-image-preview:large"'));
edit("sitemap.xml", (s) => s.includes("/ask/") ? s : s.replace("  <url><loc>https://www.ethanbidna.com/agents/</loc>", "  <url><loc>https://www.ethanbidna.com/ask/</loc><lastmod>2026-10-22</lastmod><priority>0.7</priority></url>\n  <url><loc>https://www.ethanbidna.com/agents/</loc>"));
edit("llms.txt", (s) => s.includes("/ask/") ? s : s.replace("- [Contact]", "- [Ask me anything](https://www.ethanbidna.com/ask/): ask an AI assistant trained on Ethan's work\n- [Contact]"));
console.log("Ask me anything enabled with", endpoint);
