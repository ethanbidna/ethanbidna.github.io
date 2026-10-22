import { answer, MAX_TURNS } from "../lib/answer.js";
import { getClient } from "../lib/provider.js";

const MAX_USER_CHARS = 300;
const MAX_ASSISTANT_CHARS = 1200;
const ORIGINS = (process.env.ALLOWED_ORIGINS || "https://www.ethanbidna.com,https://ethanbidna.com")
  .split(",").map((s) => s.trim()).filter(Boolean);
// Preview deployments call their own address; production never allows it.
if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) ORIGINS.push(`https://${process.env.VERCEL_URL}`, `https://${process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL}`);

// Best-effort per-visitor limit. Serverless instances are short-lived, so this only
// slows down simple abuse. The real monthly cap is the spend limit on the Anthropic
// workspace that owns the API key (see README.md).
const HITS = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_HITS = 12;
function limited(ip) {
  const now = Date.now();
  const list = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  HITS.set(ip, list);
  if (HITS.size > 5000) HITS.clear();
  return list.length > MAX_HITS;
}

function cors(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "no-store");
  const origin = req.headers.origin;
  if (origin && ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return true;
  }
  return false;
}

function validate(body) {
  const msgs = body && body.messages;
  if (!Array.isArray(msgs) || msgs.length < 1 || msgs.length > MAX_TURNS * 2 - 1) return null;
  const clean = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const wantRole = i % 2 === 0 ? "user" : "assistant";
    if (!m || m.role !== wantRole || typeof m.content !== "string") return null;
    const text = m.content.trim();
    const max = wantRole === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS;
    if (!text || text.length > max) return null;
    clean.push({ role: wantRole, content: text });
  }
  if (clean[clean.length - 1].role !== "user") return null;
  return clean;
}

export default async function handler(req, res) {
  const allowed = cors(req, res);
  if (req.method === "OPTIONS") return res.status(allowed ? 204 : 403).end();
  if (!allowed) return res.status(403).json({ error: "forbidden" });
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ error: "slow_down" });

  const messages = validate(req.body);
  if (!messages) return res.status(400).json({ error: "bad_request" });
  const used = messages.filter((m) => m.role === "user").length;

  const client = getClient();
  if (!client) return res.status(503).json({ error: "unavailable" });

  try {
    const out = await answer(messages, { client });
    if (out.stop_reason === "refusal") {
      return res.status(200).json({ reply: "I can't help with that one. Please email Ethan directly.", remaining: MAX_TURNS - used });
    }
    if (!out.text) return res.status(502).json({ error: "empty" });
    return res.status(200).json({ reply: out.text, remaining: MAX_TURNS - used });
  } catch (err) {
    // Includes the spend limit being reached. Never log message content.
    console.error("chat error", err && err.status, err && err.name);
    return res.status(503).json({ error: "unavailable" });
  }
}
