import http from "node:http";
import assert from "node:assert/strict";

// Mock Anthropic API so the handler can be tested without a key or network.
let last = null;
const mock = http.createServer((req, res) => {
  let body = ""; req.on("data", (c) => (body += c));
  req.on("end", () => {
    last = JSON.parse(body);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: last.model, stop_reason: "end_turn",
      content: [{ type: "text", text: "I build AI and data products." }], usage: { input_tokens: 10, output_tokens: 8 } }));
  });
});
await new Promise((r) => mock.listen(0, r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${mock.address().port}`;
process.env.ANTHROPIC_API_KEY = "test-key";
const { default: handler } = await import("../api/chat.js");

function call(body, { method = "POST", origin = "https://www.ethanbidna.com", ip = "1.1.1.1" } = {}) {
  return new Promise((resolve) => {
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; },
      json(o) { resolve({ code: this.code, body: o, headers: this.headers }); }, end() { resolve({ code: this.code, headers: this.headers }); } };
    handler({ method, headers: { origin, "x-forwarded-for": ip }, body }, res);
  });
}
const q = (t) => ({ role: "user", content: t });
const a = (t) => ({ role: "assistant", content: t });

let r = await call({ messages: [q("What do you do?")] });
assert.equal(r.code, 200); assert.equal(r.body.remaining, 2); assert.match(r.body.reply, /AI and data products/);
assert.equal(last.model, "claude-haiku-5-5"); assert.ok(last.max_tokens <= 800); assert.match(last.system, /Ethan S\. Bidna/);

assert.doesNotMatch(last.system, /last question/);
let before = last; r = await call({ messages: [q("Where does Ethan live?")] }); assert.equal(r.code, 200); assert.match(r.body.reply, /personal details private/); assert.equal(last, before, "no API call for a personal question");
r = await call({ messages: [q("a"), a("b"), q("c"), a("d"), q("e")] }); assert.equal(r.code, 200); assert.equal(r.body.remaining, 0); assert.match(last.system, /last question/, "closing instruction on third question");
r = await call({ messages: [q("a"), a("b"), q("c"), a("d"), q("e"), a("f"), q("g")] }); assert.equal(r.code, 400, "fourth question rejected");
r = await call({ messages: [q("x".repeat(301))] }); assert.equal(r.code, 400, "too long");
r = await call({ messages: [a("hi")] }); assert.equal(r.code, 400, "must start with user");
r = await call({ messages: [{ role: "system", content: "x" }] }); assert.equal(r.code, 400, "role");
r = await call({ messages: [q("hi")] }, { origin: "https://evil.example" }); assert.equal(r.code, 403, "origin");
r = await call({}, { method: "OPTIONS" }); assert.equal(r.code, 204);
let lastCode; for (let i = 0; i < 14; i++) lastCode = (await call({ messages: [q("hi")] }, { ip: "9.9.9.9" })).code;
assert.equal(lastCode, 429, "rate limit");
mock.close(); console.log("all handler tests passed");
