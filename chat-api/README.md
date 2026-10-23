# Ask Ethan assistant (serverless endpoint)

The chat function (`api/chat.js`), served by a Cloudflare Worker, that powers the Ask me anything page (`/ask/`) on ethanbidna.com.
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
2. **Cloudflare.** The whole site (pages plus the chat and MCP functions) is one Cloudflare Worker with static assets, built from this repository. In the Cloudflare dashboard: Workers & Pages, Create, Import a repository, pick this repo and the production branch. Build command `npm run build`, deploy command `npx wrangler deploy`. Then under the project's Settings, Variables and Secrets, add the secret `OPENROUTER_API_KEY` (or `ANTHROPIC_API_KEY`). If both are set, OpenRouter is used. Optional: `CHAT_MODEL` and `JUDGE_MODEL` override the default model names, and `BLOCKED_TERMS` (comma-separated) lists words the assistant must never say. Finally, add `www.ethanbidna.com` and `ethanbidna.com` under Settings, Domains and routes.
3. **Rate limit.** Already configured in `wrangler.jsonc` (10 requests a minute per visitor). For a stricter rule, add one under Security, WAF, Rate limiting rules in Cloudflare.
4. **Turn it on.** From the repo root run `node scripts/go-live.mjs`. It sets the endpoint on `/ask/`, reveals the Ask me anything links on the homepage and contact page, makes `/ask/` indexable, and adds it to the sitemap and `llms.txt`. Until then the page says it is not online and the links stay hidden.

## Cost
A three-question conversation is roughly a thousand tokens in and a few hundred out per turn, which is a fraction of a cent on Haiku. A $10 monthly cap covers thousands of conversations.

## The Ethan MCP server (`api/mcp.js`)
A read-only [Model Context Protocol](https://modelcontextprotocol.io) server on the same site, at `https://www.ethanbidna.com/api/mcp`.
- **Tools:** `get_profile`, `get_bio`, `get_background`, `get_contact`, `get_evals` (the published eval suite), and three that take your input and return a method plus instructions for the caller's own model: `assess_fit` (a project brief), `approach_problem` (a product problem, worked through the six-step decision method) and `plan_ai_evals` (an AI feature, planned with the method used to test the assistant).
- **Resources and a prompt:** `ethan://profile`, `ethan://facts`, `ethan://contact`, and `introduce_ethan`.
- **Costs nothing to run:** it never calls a model and holds no secrets. It only serves `lib/profile.js`, the same file the website assistant reads.
- **Transport:** Streamable HTTP, stateless, JSON responses. Tested against the official MCP client (`npm test`).
- **Add it to Claude Code:** `claude mcp add --transport http ethan-bidna https://www.ethanbidna.com/api/mcp`
- **A nicer address:** add a custom domain such as `mcp.ethanbidna.com` to the Worker in Cloudflare, then use that URL instead.

`scripts/go-live.mjs` publishes the connection instructions on the agents page and in `llms.txt` when you turn everything on.

## Evals (`evals/`)
A test suite for the assistant, built around failure modes, binary checks, and judges that are validated against hand-labeled examples before they are trusted. See `evals/README.md` for the method and its honest limits.
- `npm test` runs everything that is free: the endpoint, the MCP server, the checks, the metrics, and the whole harness on recorded answers with deliberate failures.
- `OPENROUTER_API_KEY=... npm run evals:live -- --yes` runs the real thing (about 200 calls, roughly $1 to $3).
- `node scripts/build-evals-page.mjs` (from the repo root) regenerates the public `/evals/` page from the suite itself. It lists only the checks and test conversations, no results.
- `.github/workflows/evals.yml` runs the free tests on every change. A live run is a manual job that needs an `ANTHROPIC_API_KEY` repository secret.

## Security notes

- The site is static on GitHub Pages, which cannot send custom HTTP headers. Each page therefore carries a Content-Security-Policy in a `<meta>` tag (no inline code except hashed scripts, no third-party scripts, no framing via a small guard script). After editing any page's inline script, run `node scripts/harden.mjs` to refresh the hashes; `npm test` fails if they are stale. Turn on **Enforce HTTPS** in the repository's Pages settings. For real headers (HSTS, `frame-ancestors`), put 
- The API functions send `nosniff`, `no-store` and `no-referrer`, check the request origin, validate and rate-limit input, never log message bodies, and hold keys only as Cloudflare secrets. `_headers` (copied to `dist/` by `npm run build`) adds HSTS, `frame-ancestors 'none'` and the other headers to every page, and `wrangler.jsonc` adds a Cloudflare rate limit of 10 requests a minute per visitor on top of the handlers' own limit.
- `/.well-known/security.txt` expires 2027-10-22; renew it before then (a test reminds you).
- Dependabot watches the npm and GitHub Actions dependencies weekly.
