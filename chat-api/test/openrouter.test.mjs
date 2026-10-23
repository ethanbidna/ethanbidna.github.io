import http from "node:http";
import assert from "node:assert/strict";
import { createOpenRouterClient } from "../lib/openrouter.js";
import { answer } from "../lib/answer.js";

let last, mode = "ok";
const srv = http.createServer((req, res) => {
  let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => {
    last = { url: req.url, auth: req.headers.authorization, body: JSON.parse(b) };
    if (mode === "402") { res.writeHead(402, { "Content-Type": "application/json" }); return res.end("{}"); }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: "Ethan builds practical AI products." }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.0001 } }));
  });
});
await new Promise((r) => srv.listen(0, r));
const client = createOpenRouterClient({ apiKey: "sk-or-test", baseUrl: `http://127.0.0.1:${srv.address().port}/api/v1` });

const r = await client.messages.create({ model: "anthropic/claude-haiku-5.5", max_tokens: 50, system: "SYS", messages: [{ role: "user", content: "hi" }], output_config: { effort: "low" } });
assert.equal(r.content[0].text, "Ethan builds practical AI products.");
assert.equal(r.stop_reason, "end_turn");
assert.deepEqual([r.usage.input_tokens, r.usage.output_tokens, r.usage.cost], [10, 5, 0.0001]);
assert.equal(last.url, "/api/v1/chat/completions");
assert.equal(last.auth, "Bearer sk-or-test");
assert.deepEqual(last.body.messages[0], { role: "system", content: "SYS" });
assert.equal(last.body.provider.data_collection, "deny");
assert.equal(last.body.output_config, undefined);

const a = await answer([{ role: "user", content: "What is Ethan like to work with?" }], { client, model: "anthropic/claude-haiku-5.5" });
assert.equal(a.text, "Ethan builds practical AI products.");

mode = "402";
await assert.rejects(() => client.messages.create({ model: "m", max_tokens: 5, messages: [{ role: "user", content: "x" }] }), (e) => e.status === 402);
srv.close();
console.log("all openrouter tests passed");
