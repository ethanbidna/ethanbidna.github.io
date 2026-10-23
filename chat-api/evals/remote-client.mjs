// A drop-in stand-in for the model client that sends calls to the site's locked testing endpoint (worker/eval-proxy.js).
// Lets the eval harness run anywhere using the site's model key, which never leaves Cloudflare.
export function createRemoteClient({ url = process.env.EVAL_REMOTE_URL, token = process.env.EVAL_TOKEN, fetchFn = fetch } = {}) {
  if (!url || !token) throw new Error("EVAL_REMOTE_URL and EVAL_TOKEN are both needed");
  return {
    provider: "remote",
    messages: {
      async create(params) {
        const body = { model: params.model, max_tokens: params.max_tokens, system: params.system, messages: params.messages };
        let res;
        for (let attempt = 0; attempt < 3; attempt++) {
          res = await fetchFn(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
          if (res.status < 500 && res.status !== 429) break;
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
        if (!res.ok) { const err = new Error(`eval endpoint ${res.status}`); err.status = res.status; throw err; }
        return res.json();
      },
    },
  };
}
