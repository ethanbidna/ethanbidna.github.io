# Ask Ethan assistant (serverless endpoint)

A single Vercel function, `api/chat.js`, that powers the Ask me anything page (`/ask/`) on ethanbidna.com.
The site itself stays static on GitHub Pages. This is the only part that costs money.

## What it enforces
- Three visitor questions per conversation, each up to 300 characters. On the third, the assistant closes the conversation itself and invites the visitor to carry on with the real Ethan. The page never announces the limit up front.
- Answers only from `lib/facts.js` (edit that file to change what it knows).
- Short replies on the cheapest current model (`claude-haiku-5-5`). Override with the `CHAT_MODEL` env var.
- Only the site's own origins may call it (`ALLOWED_ORIGINS`, defaults to ethanbidna.com and www).
- A best-effort per-visitor limit in the function. It resets when the instance recycles, so it is not the cap.
- Conversations are not stored and message text is never logged.

## Set up (about ten minutes)
1. **Spend cap (do this first).** Easiest: [OpenRouter](https://openrouter.ai). Add a small prepaid balance (for example $10), then create an API key with a **credit limit** (and optionally a monthly reset). When the limit is reached OpenRouter refuses requests, the function replies "unavailable", and the page tells visitors to email you. Alternative: an Anthropic Console workspace with a monthly spend limit and its own API key.
2. **Vercel project.** Import this repo and set the Root Directory to `chat-api`. Add the environment variable `OPENROUTER_API_KEY` (or `ANTHROPIC_API_KEY`) with the key from step 1. If both are set, OpenRouter is used. Optional: `CHAT_MODEL` and `JUDGE_MODEL` override the default model names, and `BLOCKED_TERMS` (comma-separated) lists words the assistant must never say.
3. **Rate limit (recommended).** In Vercel, Firewall, add a rate limit rule on `/api/chat`, for example 20 requests per hour per IP.
4. **Turn it on.** From the repo root run `node scripts/go-live.mjs https://YOUR-DEPLOYMENT.vercel.app/api/chat`. It sets the endpoint on `/ask/`, reveals the Ask me anything links on the homepage and contact page, makes `/ask/` indexable, and adds it to the sitemap and `llms.txt`. Until then the page says it is not online and the links stay hidden.

## Cost
A three-question conversation is roughly a thousand tokens in and a few hundred out per turn, which is a fraction of a cent on Haiku. A $10 monthly cap covers thousands of conversations.

## The Ethan MCP server (`api/mcp.js`)
A read-only [Model Context Protocol](https://modelcontextprotocol.io) server on the same deployment, at `https://YOUR-DEPLOYMENT.vercel.app/api/mcp`.
- **Tools:** `get_profile`, `get_background`, `get_contact`, and `assess_fit` (takes a job description and returns Ethan's public facts plus instructions for an honest fit assessment, which the caller's own model writes).
- **Resources and a prompt:** `ethan://profile`, `ethan://facts`, `ethan://contact`, and `introduce_ethan`.
- **Costs nothing to run:** it never calls a model and holds no secrets. It only serves `lib/profile.js`, the same file the website assistant reads.
- **Transport:** Streamable HTTP, stateless, JSON responses. Tested against the official MCP client (`npm test`).
- **Add it to Claude Code:** `claude mcp add --transport http ethan-bidna https://YOUR-DEPLOYMENT.vercel.app/api/mcp`
- **A nicer address:** point a subdomain such as `mcp.ethanbidna.com` at the deployment in Vercel's domain settings, then use that URL instead.

`scripts/go-live.mjs` publishes the connection instructions on the agents page and in `llms.txt` when you turn everything on.

## Evals (`evals/`)
A test suite for the assistant, built around failure modes, binary checks, and judges that are validated against hand-labeled examples before they are trusted. See `evals/README.md` for the method and its honest limits.
- `npm test` runs everything that is free: the endpoint, the MCP server, the checks, the metrics, and the whole harness on recorded answers with deliberate failures.
- `OPENROUTER_API_KEY=... npm run evals:live -- --yes` runs the real thing (about 200 calls, roughly $1 to $3).
- `node scripts/build-evals-page.mjs` (from the repo root) regenerates the public `/evals/` page from the suite itself. It lists only the checks and test conversations, no results.
- `.github/workflows/evals.yml` runs the free tests on every change. A live run is a manual job that needs an `ANTHROPIC_API_KEY` repository secret.

## Security notes

- The site is static on GitHub Pages, which cannot send custom HTTP headers. Each page therefore carries a Content-Security-Policy in a `<meta>` tag (no inline code except hashed scripts, no third-party scripts, no framing via a small guard script). After editing any page's inline script, run `node scripts/harden.mjs` to refresh the hashes; `npm test` fails if they are stale. Turn on **Enforce HTTPS** in the repository's Pages settings. For real headers (HSTS, `frame-ancestors`), put Cloudflare in front of the domain.
- The API functions send `nosniff`, `no-store` and `no-referrer`, check the request origin, validate and rate-limit input, never log message bodies, and hold keys only in Vercel environment variables. `vercel.json` adds HSTS and a locked-down CSP.
- `/.well-known/security.txt` expires 2027-10-22; renew it before then (a test reminds you).
- Dependabot watches the npm and GitHub Actions dependencies weekly.
