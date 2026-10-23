// A small Durable Object that keeps one global tally of assistant use, so limits hold across all of Cloudflare's servers.
// It stores only hashed visitor addresses, and only for the current day.
const MIN10 = 10 * 60 * 1000;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

async function hash(s, salt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${s}`));
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class Limits {
  constructor(state, env) { this.state = state; this.env = env || {}; }
  limits() {
    const n = (v, d) => (Number(v) > 0 ? Number(v) : d);
    return { perIpDay: n(this.env.MAX_PER_IP_DAY, 30), perIpBurst: n(this.env.MAX_PER_IP_BURST, 8), globalDay: n(this.env.MAX_GLOBAL_DAY, 400) };
  }
  async load(now) {
    const day = new Date(now).toISOString().slice(0, 10);
    let d = await this.state.storage.get("d");
    if (!d || d.day !== day) d = { day, global: 0, ips: {}, burst: {} };
    return d;
  }
  async fetch(request) {
    const now = Date.now(), url = new URL(request.url), L = this.limits(), d = await this.load(now);
    if (url.pathname === "/status") return json({ globalLeft: Math.max(0, L.globalDay - d.global) });
    if (url.pathname !== "/take" || request.method !== "POST") return json({ error: "not_found" }, 404);
    const { ip } = await request.json().catch(() => ({}));
    const id = await hash(String(ip || "unknown"), d.day);
    if (d.global >= L.globalDay) return json({ ok: false, reason: "global" });
    if ((d.ips[id] || 0) >= L.perIpDay) return json({ ok: false, reason: "ip_day" });
    const recent = (d.burst[id] || []).filter((t) => now - t < MIN10);
    if (recent.length >= L.perIpBurst) return json({ ok: false, reason: "ip_burst" });
    recent.push(now); d.burst[id] = recent;
    d.ips[id] = (d.ips[id] || 0) + 1; d.global += 1;
    if (Object.keys(d.ips).length > 5000) { d.ips = {}; d.burst = {}; }
    await this.state.storage.put("d", d);
    return json({ ok: true, globalLeft: Math.max(0, L.globalDay - d.global) });
  }
}
