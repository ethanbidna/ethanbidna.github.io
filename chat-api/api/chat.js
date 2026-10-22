import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM, FINAL_TURN } from "../lib/prompt.js";

const MODEL = process.env.CHAT_MODEL || "claude-haiku-5-5";
const MAX_TURNS = 3;
const MAX_USER_CHARS = 300;
const MAX_ASSISTANT_CHARS = 1200;
const ORIGINS = (process.env.ALLOWED_ORIGINS || "https://www.ethanbidna.com,https://ethanbidna.com")
  .split(",").map((s) => s.trim()).filter(Boolean);

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

  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "unavailable" });

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: 20000 });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: used >= MAX_TURNS ? SYSTEM + FINAL_TURN : SYSTEM,
      output_config: { effort: "low" },
      messages,
    });
    if (response.stop_reason === "refusal") {
      return res.status(200).json({ reply: "I can't help with that one. Please email Ethan directly.", remaining: MAX_TURNS - used });
    }
    const reply = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!reply) return res.status(502).json({ error: "empty" });
    return res.status(200).json({ reply, remaining: MAX_TURNS - used });
  } catch (err) {
    // Includes the spend limit being reached. Never log message content.
    console.error("chat error", err && err.status, err && err.name);
    return res.status(503).json({ error: "unavailable" });
  }
}
