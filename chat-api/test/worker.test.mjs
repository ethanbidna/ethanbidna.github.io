import assert from "node:assert/strict";
process.env.OPENROUTER_API_KEY = "test";
const { default: worker } = await import("../../worker/index.js");

const post = (path, body, headers = {}) => worker.fetch(new Request(`https://www.ethanbidna.com${path}`, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "5.5.5.5", ...headers }, body: JSON.stringify(body) }), {});

let r = await post("/api/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" });
assert.equal(r.status, 200);
assert.equal((await r.json()).result.tools.length, 8);
assert.equal(r.headers.get("cache-control"), "no-store");

r = await post("/api/chat", { messages: [{ role: "user", content: "Where does Ethan live?" }] }, { origin: "https://www.ethanbidna.com" });
assert.equal(r.status, 200);
assert.match((await r.json()).reply, /personal details private/);

r = await post("/api/chat", { messages: [{ role: "user", content: "hi" }] }, { origin: "https://evil.example" });
assert.equal(r.status, 403);

r = await worker.fetch(new Request("https://www.ethanbidna.com/api/chat", { method: "OPTIONS", headers: { origin: "https://www.ethanbidna.com" } }), {});
assert.equal(r.status, 204);

r = await worker.fetch(new Request("https://www.ethanbidna.com/api/nope"), {});
assert.equal(r.status, 404);

// A Cloudflare rate-limit binding that says no is honored.
r = await worker.fetch(new Request("https://www.ethanbidna.com/api/chat", { method: "POST", body: "{}" }), { LIMITER: { limit: async () => ({ success: false }) } });
assert.equal(r.status, 429);
// The status endpoint reports whether the assistant is on, and the daily limits are enforced before any model call.
{
  const { resetBudgetState } = await import("../lib/budget.js");
  resetBudgetState();
  process.env.OPENROUTER_API_KEY = "";
  let s = await worker.fetch(new Request("https://www.ethanbidna.com/api/status"), {});
  assert.deepEqual(await s.json(), { chat: false, reason: "not_configured" });
  assert.match(s.headers.get("cache-control"), /max-age/);

  const calls = [];
  const fakeLimits = (verdict) => ({ idFromName: () => "main", get: () => ({ fetch: async (url) => { calls.push(String(url)); return new Response(JSON.stringify(String(url).endsWith("/status") ? { globalLeft: verdict.left } : verdict.take)); } }) });
  process.env.ANTHROPIC_API_KEY = "x";
  s = await worker.fetch(new Request("https://www.ethanbidna.com/api/status"), { LIMITS: fakeLimits({ left: 0 }) });
  assert.deepEqual(await s.json(), { chat: false, reason: "daily" });
  s = await worker.fetch(new Request("https://www.ethanbidna.com/api/status"), { LIMITS: fakeLimits({ left: 9 }) });
  assert.equal((await s.json()).chat, true);

  const body = { messages: [{ role: "user", content: "Where does Ethan live?" }] };
  const post = (env) => worker.fetch(new Request("https://www.ethanbidna.com/api/chat", { method: "POST", headers: { "content-type": "application/json", origin: "https://www.ethanbidna.com", "cf-connecting-ip": "7.7.7.7" }, body: JSON.stringify(body) }), env);
  let r2 = await post({ LIMITS: fakeLimits({ take: { ok: false, reason: "ip_day" } }) });
  assert.equal(r2.status, 429); assert.equal((await r2.json()).error, "slow_down");
  r2 = await post({ LIMITS: fakeLimits({ take: { ok: false, reason: "global" } }) });
  assert.equal(r2.status, 429); assert.equal((await r2.json()).error, "busy");
  r2 = await post({ LIMITS: fakeLimits({ take: { ok: true } }) });
  assert.equal(r2.status, 200);
  delete process.env.ANTHROPIC_API_KEY; process.env.OPENROUTER_API_KEY = "test";
}
console.log("all worker tests passed");
