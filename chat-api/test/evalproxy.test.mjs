import assert from "node:assert/strict";
import { evalProxy } from "../../worker/eval-proxy.js";
import { createRemoteClient } from "../evals/remote-client.mjs";
import { chatModel } from "../lib/provider.js";

const TOKEN = "t".repeat(32);
const model = "anthropic/claude-haiku-5.5";  // listed outright, whatever provider is detected
const fake = { messages: { create: async (p) => ({ content: [{ type: "text", text: "echo:" + p.messages[0].content }], stop_reason: "end_turn", usage: { input_tokens: 3, output_tokens: 2, cost: 0.0001, seen: p } }) } };
const req = (body, token = TOKEN, method = "POST") => new Request("https://www.ethanbidna.com/api/eval", { method, headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body) });
const good = { model, max_tokens: 99999, system: "S", messages: [{ role: "user", content: "hi" }] };

// Off unless a long token is configured.
assert.equal((await evalProxy(req(good), {}, { client: fake })).status, 404);
assert.equal((await evalProxy(req(good), { EVAL_TOKEN: "short" }, { client: fake })).status, 404);
// Locked.
assert.equal((await evalProxy(req(good, "wrong"), { EVAL_TOKEN: TOKEN }, { client: fake })).status, 401);
assert.equal((await evalProxy(req(good, "", "GET"), { EVAL_TOKEN: TOKEN }, { client: fake })).status, 405);
// Only allowed models, sane sizes.
assert.equal((await evalProxy(req({ ...good, model: "openai/gpt-5" }), { EVAL_TOKEN: TOKEN }, { client: fake })).status, 400);
assert.equal((await evalProxy(req({ ...good, messages: [] }), { EVAL_TOKEN: TOKEN }, { client: fake })).status, 400);
assert.equal((await evalProxy(req({ ...good, messages: [{ role: "user", content: "x".repeat(70000) }] }), { EVAL_TOKEN: TOKEN }, { client: fake })).status, 413);
// Works, and the token cap is enforced.
const ok = await evalProxy(req(good), { EVAL_TOKEN: TOKEN }, { client: fake });
assert.equal(ok.status, 200);
const j = await ok.json();
assert.equal(j.content[0].text, "echo:hi");
assert.equal(j.usage.seen.max_tokens, 1500, "max_tokens is capped");

// The remote client speaks to it and retries on server errors.
let n = 0;
const rc = createRemoteClient({ url: "https://x/api/eval", token: TOKEN, fetchFn: async (u, o) => { n++; if (n === 1) return { status: 502, ok: false, json: async () => ({}) }; const r = await evalProxy(new Request(u, o), { EVAL_TOKEN: TOKEN }, { client: fake }); return { status: r.status, ok: r.ok, json: () => r.json() }; } });
const out = await rc.messages.create({ model, max_tokens: 50, system: "S", messages: [{ role: "user", content: "yo" }] });
assert.equal(out.content[0].text, "echo:yo"); assert.equal(n, 2);
assert.throws(() => createRemoteClient({ url: "", token: "" }), /both needed/);
console.log("all eval proxy tests passed");
