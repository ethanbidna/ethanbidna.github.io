# Ask Ethan assistant (serverless endpoint)

A single Vercel function, `api/chat.js`, that powers the AI clone page (`/clone/`) on ethanbidna.com.
The site itself stays static on GitHub Pages. This is the only part that costs money.

## What it enforces
- Three visitor questions per conversation, each up to 300 characters. On the third, the clone closes the conversation itself and invites the visitor to carry on with the real Ethan. The page never announces the limit up front.
- Answers only from `lib/facts.js` (edit that file to change what it knows).
- Short replies on the cheapest current model (`claude-haiku-5-5`). Override with the `CHAT_MODEL` env var.
- Only the site's own origins may call it (`ALLOWED_ORIGINS`, defaults to ethanbidna.com and www).
- A best-effort per-visitor limit in the function. It resets when the instance recycles, so it is not the cap.
- Conversations are not stored and message text is never logged.

## Set up (about ten minutes)
1. **Spend cap (do this first).** In the Anthropic Console, create a workspace just for this site, set a monthly spend limit (for example $10), and create an API key inside it. When the limit is hit, the function replies "unavailable" and the page tells visitors to email you. This is the hard monthly cap.
2. **Vercel project.** Import this repo and set the Root Directory to `chat-api`. Add the environment variable `ANTHROPIC_API_KEY` (the key from step 1).
3. **Rate limit (recommended).** In Vercel, Firewall, add a rate limit rule on `/api/chat`, for example 20 requests per hour per IP.
4. **Turn the clone on.** From the repo root run `node scripts/go-live.mjs https://YOUR-DEPLOYMENT.vercel.app/api/chat`. It sets the endpoint on `/clone/`, reveals the AI clone links on the homepage and contact page, makes `/clone/` indexable, and adds it to the sitemap and `llms.txt`. Until then the clone page says it is not online and the links stay hidden.

## Cost
A three-question conversation is roughly a thousand tokens in and a few hundred out per turn, which is a fraction of a cent on Haiku. A $10 monthly cap covers thousands of conversations.
