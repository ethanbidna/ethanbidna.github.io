import { handleRpc } from "../lib/mcp.js";

// Streamable HTTP endpoint for the Ethan MCP server. Public and read-only, so any origin may call it.
const HITS = new Map();
const WINDOW_MS = 60 * 60 * 1000, MAX_HITS = 300;
function limited(ip) {
  const now = Date.now(), list = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now); HITS.set(ip, list); if (HITS.size > 5000) HITS.clear();
  return list.length > MAX_HITS;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") { res.setHeader("Allow", "POST, OPTIONS"); return res.status(405).json({ error: "This server answers JSON-RPC over POST only." }); }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Too many requests" } });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = undefined; } }
  if (body === undefined || body === null) return res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });

  if (Array.isArray(body)) {
    const out = body.map(handleRpc).filter((r) => r !== null);
    return out.length ? res.status(200).json(out) : res.status(202).end();
  }
  const out = handleRpc(body);
  return out ? res.status(200).json(out) : res.status(202).end();
}
