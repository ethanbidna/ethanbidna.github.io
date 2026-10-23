// Cloudflare Worker entry. Static pages are served straight from the assets; only /api/* reaches this code.
// The chat and MCP handlers are written as small Node-style functions (req, res); this adapts them to Workers.
import chat from "../chat-api/api/chat.js";
import mcp from "../chat-api/api/mcp.js";

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

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    const handler = ROUTES[path];
    if (!handler) return new Response("Not found", { status: 404 });
    // Optional Cloudflare rate-limit binding (see wrangler.jsonc): a second brake on top of the handler's own.
    if (env && env.LIMITER && request.method === "POST") {
      const { success } = await env.LIMITER.limit({ key: request.headers.get("cf-connecting-ip") || "unknown" });
      if (!success) return new Response(JSON.stringify({ error: "slow_down" }), { status: 429, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    const text = request.method === "POST" ? (await request.text()).slice(0, 20000) : "";
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
