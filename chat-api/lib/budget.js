// Is the assistant allowed to answer right now? It turns off when the OpenRouter key's credit limit is used up.
// The key's monthly limit does the real capping; this only notices it, so the site can hide the assistant until the limit resets.
const state = { pausedUntil: 0, cache: null, cacheAt: 0 };
const MIN_REMAINING = 0.02;      // dollars left on the key below which we call it empty
const TTL = 60 * 1000;

export function markExhausted(ms = 10 * 60 * 1000, now = Date.now()) { state.pausedUntil = now + ms; state.cache = null; }
export const isPaused = (now = Date.now()) => now < state.pausedUntil;
export function resetBudgetState() { state.pausedUntil = 0; state.cache = null; state.cacheAt = 0; }

export async function chatStatus({ fetchFn = fetch, env = process.env, now = Date.now() } = {}) {
  if (isPaused(now)) return { chat: false, reason: "budget" };
  const key = env.OPENROUTER_API_KEY;
  if (!key) return env.ANTHROPIC_API_KEY ? { chat: true, reason: "ok" } : { chat: false, reason: "not_configured" };
  if (state.cache && now - state.cacheAt < TTL) return state.cache;
  const base = String(env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  let out;
  try {
    const r = await fetchFn(`${base}/key`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(4000) });
    if (r.status === 402) out = { chat: false, reason: "budget" };
    else if (r.status === 401 || r.status === 403) out = { chat: false, reason: "key" };
    else if (r.ok) {
      const d = ((await r.json()) || {}).data || {};
      const left = d.limit_remaining;
      out = typeof left === "number" && left <= MIN_REMAINING ? { chat: false, reason: "budget" } : { chat: true, reason: "ok" };
    } else out = state.cache || { chat: true, reason: "unknown" };
  } catch {
    out = state.cache || { chat: true, reason: "unknown" };   // when we cannot tell, leave it on; the key limit still protects the budget
  }
  state.cache = out; state.cacheAt = now;
  return out;
}
