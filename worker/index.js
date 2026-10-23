// Cloudflare Worker entry. Static pages are served straight from the assets; only /api/* reaches this code.
// The chat and MCP handlers are written as small Node-style functions (req, res); this adapts them to Workers.
import chat from "../chat-api/api/chat.js";
import mcp from "../chat-api/api/mcp.js";
import { chatStatus } from "../chat-api/lib/budget.js";
export { Limits } from "./limits.js";

const ROUTES = { "/api/chat": chat, "/api/mcp": mcp };

function adapt(request, bodyText) {
  const headers = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers["x-forwarded-for"] = ip;          // the handlers rate-limit on this
  headers.host = new URL(request.url).host;
  let body;
  if (bodyText) { try { body = JSON.parse(bodyText); } catch { body = undefined; } }
  return { method: request.method, headers, body };
}

function responder() {
  const out = { status: 200, headers: new Headers(), body: null, done: null };
  let resolve; out.done = new Promise((r) => { resolve = r; });
  const res = {
    setHeader(k, v) { out.headers.set(k, String(v)); return res; },
    status(c) { out.status = c; return res; },
    json(o) { out.headers.set("Content-Type", "application/json; charset=utf-8"); out.body = JSON.stringify(o); resolve(); return res; },
    end(b) { out.body = b ?? null; resolve(); return res; },
  };
  return { res, out };
}

const quick = (o, status = 200, cache = "no-store") => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache, "X-Content-Type-Options": "nosniff" } });
const limiter = (env) => (env && env.LIMITS ? env.LIMITS.get(env.LIMITS.idFromName("main")) : null);
const ask = async (stub, path, body) => { const r = await stub.fetch(`https://limits${path}`, body ? { method: "POST", body: JSON.stringify(body) } : undefined); return r.json(); };

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    if (path === "/api/status" && request.method === "GET") {
      const s = await chatStatus({ env: { ...process.env, ...env } });
      let out = { chat: s.chat, reason: s.reason };
      const stub = limiter(env);
      if (out.chat && stub) { try { const st = await ask(stub, "/status"); if (st.globalLeft <= 0) out = { chat: false, reason: "daily" }; } catch { /* keep going */ } }
      return quick(out, 200, "public, max-age=30");
    }
    const handler = ROUTES[path];
    if (!handler) return new Response("Not found", { status: 404 });
    // Optional Cloudflare rate-limit binding (see wrangler.jsonc): a second brake on top of the handler's own.
    if (env && env.LIMITER && request.method === "POST") {
      const { success } = await env.LIMITER.limit({ key: request.headers.get("cf-connecting-ip") || "unknown" });
      if (!success) return new Response(JSON.stringify({ error: "slow_down" }), { status: 429, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    const text = request.method === "POST" ? (await request.text()).slice(0, 20000) : "";
    if (path === "/api/chat" && request.method === "POST") {
      const stub = limiter(env);
      if (stub) {
        let looksValid = false; try { const b = JSON.parse(text); looksValid = Array.isArray(b && b.messages); } catch { /* not JSON */ }
        if (looksValid) {
          try {
            const t = await ask(stub, "/take", { ip: request.headers.get("cf-connecting-ip") || "unknown" });
            if (!t.ok) return quick({ error: t.reason === "global" ? "busy" : "slow_down", reason: t.reason }, 429);
          } catch { /* if the counter is unreachable, fall through: the key limit still caps spend */ }
        }
      }
    }
    const { res, out } = responder();
    try {
      await handler(adapt(request, text), res);
      await Promise.race([out.done, new Promise((r) => setTimeout(r, 0))]);
    } catch {
      return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    return new Response(out.status === 204 || out.status === 202 ? null : out.body, { status: out.status, headers: out.headers });
  },
};
