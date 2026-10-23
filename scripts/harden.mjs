// Adds a Content-Security-Policy and referrer policy to every page, with SHA-256 hashes of the inline scripts.
// GitHub Pages cannot send custom HTTP headers, so these go in <meta> tags. Safe to re-run.
// Usage: node scripts/harden.mjs [https://your-deployment.vercel.app]   (the origin is allowed for the chat request)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv[2];
let origin = "";
if (arg) { try { origin = new URL(arg).origin; } catch { console.error("Give an https origin like https://your-app.vercel.app"); process.exit(1); } }
if (origin && !origin.startsWith("https://")) { console.error("Origin must be https"); process.exit(1); }

const pages = ["index.html", "ask/index.html", "contact/index.html", "agents/index.html", "mcp/index.html", "evals/index.html", "404.html"];
export function policyFor(html, endpointOrigin) {
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => `'sha256-${crypto.createHash("sha256").update(m[1]).digest("base64")}'`);
  return [
    "default-src 'none'",
    `script-src 'self'${hashes.length ? " " + hashes.join(" ") : ""}`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${endpointOrigin ? " " + endpointOrigin : ""}`,
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

// Pages cannot set frame-ancestors from a meta tag, so a tiny script stops other sites from framing them.
const BUSTER = '<script id="frame-guard">if (window.top !== window.self) { window.top.location = window.self.location; }</script>\n';
const strip = (s) => s.replace(/<script id="frame-guard">[\s\S]*?<\/script>\n?/g, "").replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/g, "").replace(/<meta name="referrer"[^>]*>\n?/g, "");
for (const f of pages) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  let html = strip(fs.readFileSync(p, "utf8"));
  html = html.replace(/(<meta charset="utf-8">\n)/, `$1${BUSTER}`);
  // The chat page keeps its endpoint in a data attribute; allow exactly that origin.
  let ep = origin;
  const m = html.match(/data-endpoint="(https:\/\/[^"/]+)/);
  if (!ep && m) ep = m[1];
  const tags = `<meta http-equiv="Content-Security-Policy" content="${policyFor(html, ep).replace(/"/g, "&quot;")}">\n<meta name="referrer" content="strict-origin-when-cross-origin">\n`;
  html = html.replace(/(<meta charset="utf-8">\n)/, `$1${tags}`);
  fs.writeFileSync(p, html);
}
console.log("Security policy written to", pages.length, "pages", origin ? `(chat origin ${origin})` : "");
