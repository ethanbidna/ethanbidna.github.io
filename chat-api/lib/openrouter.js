// A small OpenRouter client that looks like the Anthropic SDK's messages.create(), so the website endpoint
// and the eval suite work unchanged with either provider. OpenRouter follows the OpenAI chat-completions format.
// Spending is capped on OpenRouter's side: prepaid account credit plus an optional credit limit on the API key.
// When a key's limit is used up, OpenRouter answers 402 and the assistant tells visitors to email instead.

const FINISH = { stop: "end_turn", length: "max_tokens", content_filter: "refusal", tool_calls: "tool_use" };

export function createOpenRouterClient(opts = {}) {
  const apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY;
  const baseUrl = String(opts.baseUrl ?? process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const doFetch = opts.fetch ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 30000;

  async function once(body) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await doFetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://www.ethanbidna.com/", "X-Title": "Ethan Bidna website assistant" },
        body: JSON.stringify(body), signal: ctrl.signal,
      });
    } finally { clearTimeout(timer); }
  }

  return {
    provider: "openrouter",
    messages: {
      async create(params) {
        const messages = [];
        if (params.system) messages.push({ role: "system", content: params.system });
        for (const m of params.messages) messages.push({ role: m.role, content: m.content });
        // data_collection "deny" asks OpenRouter to route only to providers that do not store or train on the conversation.
        const body = { model: params.model, messages, max_tokens: params.max_tokens, provider: { data_collection: "deny" } };
        let res = await once(body);
        if (res.status >= 500) res = await once(body);          // one retry on a provider error
        if (!res.ok) { const err = new Error(`OpenRouter ${res.status}`); err.status = res.status; err.name = "OpenRouterError"; throw err; }
        const j = await res.json();
        const choice = j && j.choices && j.choices[0];
        if (!choice || !choice.message) { const err = new Error("OpenRouter returned no message"); err.status = 502; err.name = "OpenRouterError"; throw err; }
        const c = choice.message.content;
        const text = typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => (typeof p === "string" ? p : p.text || "")).join("") : "";
        const u = j.usage || {};
        return { content: [{ type: "text", text }], stop_reason: FINISH[choice.finish_reason] || choice.finish_reason || "end_turn", usage: { input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0, cost: typeof u.cost === "number" ? u.cost : undefined } };
      },
    },
  };
}
