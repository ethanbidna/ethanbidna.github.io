// A locked testing endpoint: it lets the eval harness (run somewhere else) borrow the site's model key without ever seeing it.
// It does nothing unless the secret EVAL_TOKEN is set. It only forwards model calls, to an allowlist of models, with a token cap.
import { getClient, chatModel, judgeModel } from "../chat-api/lib/provider.js";
import { createOpenRouterClient } from "../chat-api/lib/openrouter.js";

// The allowed models are listed outright, so the check does not depend on which provider is detected.
const BASE_MODELS = ["anthropic/claude-haiku-5.5", "anthropic/claude-sonnet-5.5"];

const MAX_TOKENS = 1500;
const MAX_CHARS = 60000;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

function sameToken(a, b) {                       // constant-time comparison
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function evalProxy(request, env = {}, { client = null } = {}) {
  const secret = env.EVAL_TOKEN || (typeof process !== "undefined" && process.env && process.env.EVAL_TOKEN);
  if (!secret || secret.length < 24) return json({ error: "not_found" }, 404);            // off unless a long token is configured
  if (request.method !== "POST") return json({ error: "method" }, 405);
  const given = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!sameToken(given, secret)) return json({ error: "unauthorized" }, 401);
  let body; try { body = JSON.parse((await request.text()).slice(0, MAX_CHARS * 2)); } catch { return json({ error: "bad_request" }, 400); }
  const allowed = new Set([...BASE_MODELS, chatModel(), judgeModel(), env.CHAT_MODEL, env.JUDGE_MODEL, ...String(env.EVAL_ALLOWED_MODELS || "").split(",").map((s) => s.trim()).filter(Boolean)]);
  if (!body || !allowed.has(body.model) || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 12) return json({ error: "bad_request" }, 400);
  if (JSON.stringify(body).length > MAX_CHARS) return json({ error: "too_large" }, 413);
  const c = client || (env.OPENROUTER_API_KEY ? createOpenRouterClient({ apiKey: env.OPENROUTER_API_KEY, baseUrl: env.OPENROUTER_BASE_URL }) : getClient());
  if (!c) return json({ error: "unavailable" }, 503);
  try {
    const r = await c.messages.create({ model: body.model, max_tokens: Math.min(Number(body.max_tokens) || 800, MAX_TOKENS), system: typeof body.system === "string" ? body.system : undefined, output_config: body.output_config && ["low", "medium", "high"].includes(body.output_config.effort) ? { effort: body.output_config.effort } : undefined, messages: body.messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content) })) });
    return json({ content: r.content, stop_reason: r.stop_reason, usage: r.usage });
  } catch (e) {
    return json({ error: "upstream", status: e && e.status ? e.status : 502 }, e && e.status === 402 ? 402 : 502);
  }
}
