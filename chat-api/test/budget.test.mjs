import assert from "node:assert/strict";
import { chatStatus, markExhausted, isPaused, resetBudgetState } from "../lib/budget.js";
import { Limits } from "../../worker/limits.js";

const jsonResp = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const env = { OPENROUTER_API_KEY: "k" };

// The key's remaining credit decides whether the assistant is on.
resetBudgetState();
assert.deepEqual(await chatStatus({ env, fetchFn: async () => jsonResp(200, { data: { limit: 2, limit_remaining: 1.4 } }), now: 1_000 }), { chat: true, reason: "ok" });
resetBudgetState();
assert.deepEqual(await chatStatus({ env, fetchFn: async () => jsonResp(200, { data: { limit: 2, limit_remaining: 0 } }), now: 1_000 }), { chat: false, reason: "budget" });
resetBudgetState();
assert.equal((await chatStatus({ env, fetchFn: async () => jsonResp(402, {}), now: 1_000 })).chat, false);
resetBudgetState();
assert.equal((await chatStatus({ env, fetchFn: async () => jsonResp(401, {}), now: 1_000 })).reason, "key");
resetBudgetState();
assert.equal((await chatStatus({ env, fetchFn: async () => { throw new Error("network"); }, now: 1_000 })).chat, true, "if we cannot tell, stay on");
resetBudgetState();
assert.equal((await chatStatus({ env: {}, now: 1_000 })).chat, false, "no key means off");
// A key with no limit set reports null remaining: stay on.
resetBudgetState();
assert.equal((await chatStatus({ env, fetchFn: async () => jsonResp(200, { data: { limit: null, limit_remaining: null } }), now: 1_000 })).chat, true);
// It is cached for a minute, then re-checked: this is how it comes back when the monthly limit resets.
resetBudgetState();
let calls = 0, left = 0;
const fetchFn = async () => { calls++; return jsonResp(200, { data: { limit_remaining: left } }); };
assert.equal((await chatStatus({ env, fetchFn, now: 10_000 })).chat, false);
assert.equal((await chatStatus({ env, fetchFn, now: 20_000 })).chat, false); assert.equal(calls, 1, "cached");
left = 2;
assert.equal((await chatStatus({ env, fetchFn, now: 80_000 })).chat, true, "back on after the limit resets"); assert.equal(calls, 2);
// A 402 from the model pauses everything for a while.
resetBudgetState();
markExhausted(1000, 5_000);
assert.equal(isPaused(5_500), true); assert.equal(isPaused(6_500), false);
assert.equal((await chatStatus({ env, fetchFn, now: 5_500 })).chat, false);

// The Durable Object's counters.
function makeStorage() { const m = new Map(); return { get: async (k) => m.get(k), put: async (k, v) => { m.set(k, JSON.parse(JSON.stringify(v))); } }; }
const lim = new Limits({ storage: makeStorage() }, { MAX_PER_IP_DAY: "4", MAX_PER_IP_BURST: "2", MAX_GLOBAL_DAY: "5" });
const take = async (ip) => (await lim.fetch(new Request("https://limits/take", { method: "POST", body: JSON.stringify({ ip }) }))).json();
assert.equal((await take("1.1.1.1")).ok, true);
assert.equal((await take("1.1.1.1")).ok, true);
assert.deepEqual(await take("1.1.1.1"), { ok: false, reason: "ip_burst" }, "burst limit per visitor");
assert.equal((await take("2.2.2.2")).ok, true, "other visitors are unaffected");
assert.equal((await take("3.3.3.3")).ok, true);
assert.equal((await take("4.4.4.4")).ok, true);
assert.deepEqual(await take("5.5.5.5"), { ok: false, reason: "global" }, "global daily cap");
const st = await (await lim.fetch(new Request("https://limits/status"))).json();
assert.equal(st.globalLeft, 0);
// When the model says the credit limit is used up (402), the handler pauses itself and stops calling the model.
{
  const http = await import("node:http");
  let hits = 0;
  const srv = http.createServer((q, r) => { hits++; q.resume(); r.writeHead(402, { "Content-Type": "application/json" }); r.end("{}"); });
  await new Promise((r) => srv.listen(0, r));
  process.env.OPENROUTER_API_KEY = "k"; process.env.OPENROUTER_BASE_URL = `http://127.0.0.1:${srv.address().port}/api/v1`;
  const { default: handler } = await import("../api/chat.js");
  resetBudgetState();
  const call = () => new Promise((resolve) => {
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, body: o }); }, end() { resolve({ code: this.code }); } };
    handler({ method: "POST", headers: { origin: "https://www.ethanbidna.com", "x-forwarded-for": "8.8.8.8" }, body: { messages: [{ role: "user", content: "What do you do?" }] } }, res);
  });
  let r = await call(); assert.equal(r.code, 503); assert.equal(hits, 1);
  r = await call(); assert.equal(r.code, 503); assert.equal(r.body.error, "paused"); assert.equal(hits, 1, "no further model calls while paused");
  assert.equal((await chatStatus({ env: process.env, now: Date.now() })).chat, false, "and the site is told to hide the assistant");
  srv.close(); resetBudgetState();
}
console.log("all budget tests passed");
