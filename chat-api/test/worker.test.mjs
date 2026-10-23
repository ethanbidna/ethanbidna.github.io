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
console.log("all worker tests passed");
