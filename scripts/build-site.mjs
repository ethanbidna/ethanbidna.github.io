// Copies only the public site files into dist/, which is what Cloudflare serves. An allowlist, so the code,
// tests, evals and scripts in this repository can never be published by accident.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const FILES = ["index.html", "404.html", "site.css", "favicon.ico", "og.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png",
  "manifest.webmanifest", "robots.txt", "sitemap.xml", "llms.txt", "agents.txt", "_headers"];
const DIRS = ["ask", "contact", "agents", "evals", "img", "fonts", ".well-known"];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(root, f), path.join(dist, f));
for (const d of DIRS) fs.cpSync(path.join(root, d), path.join(dist, d), { recursive: true });
console.log("dist/ ready");
