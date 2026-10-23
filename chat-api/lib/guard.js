import { PROFILE } from "./profile.js";

// The assistant exists to present Ethan professionally. It must never share anything personal.
// Three layers: (1) an input gate that keeps personal questions away from the model entirely,
// (2) the instructions in prompt.js, and (3) an output guard that blocks a reply containing personal details.
// Company, employer and school names are NOT in this repository. Put them in the BLOCKED_TERMS environment
// variable (comma-separated) in the deployment settings, and the output guard blocks them too.

export const PERSONAL_REPLIES = [
  "That's private, so I'll leave it there. I'm glad to talk about how I approach AI product work instead, and the contact page is the best way to reach me directly.",
  "I keep that private. What I can do is walk you through how I think about AI products, or you can use the contact page to reach me.",
  "That one's private, so I won't get into it. Ask me how I'd approach a product problem instead, or reach out through the contact page.",
  "I keep personal details private. I'm happy to dig into my work and how I make product decisions, and the contact page is the best place to follow up.",
];
export const PERSONAL_REPLY = PERSONAL_REPLIES[0];
// Varies the wording so repeated questions do not get the identical sentence. Deterministic for a given question.
export const personalReply = (seed = "") => PERSONAL_REPLIES[[...String(seed)].reduce((n, ch) => n + ch.charCodeAt(0), 0) % PERSONAL_REPLIES.length];

// Questions that are about his private life, identity, location, money, employers or schools.
const PERSONAL_QUESTION = [
  // where he lives, is from, or can be found
  /\b(home|house|street|mailing|postal)\s+address\b/i, /\bwhere\b.{0,20}\b(you|he|ethan)\b.{0,15}\b(live|lives|living|based|located|from|grew up|raised|born|stay|stays|reside|resides)\b/i, /\b(hometown|neighbou?rhood|zip ?code|what (city|state|town|country) (do|does|is|are))\b/i,
  /\b(phone|cell|cellphone|mobile|whatsapp|telegram|snapchat|instagram|facebook|tiktok|text (him|you)|call (him|you))\b/i, /\b(social media|username|dm (him|you))\b/i,
  // relationships and family
  /\b(girlfriend|boyfriend|spouse|wife|husband|fianc[eé]e?|dating|married|marriage|divorce\w*|romantic|love life|significant other|life partner|crush|in a relationship|relationship status)\b/i, /\b(are you|is he|is ethan) single\b/i,
  /\b(kids?|child|children|son|daughter|baby|pregnan\w*|famil(y|ies)|parents?|mother|father|mom|dad|sisters?|brothers?|sibling|cousin|grand(ma|pa|mother|father)|in-laws?|pets?|dog|cat)\b/i,
  // age and body
  /\b(how old|birthday|birth ?date|date of birth|born|millennial|gen ?z|(your|his|ethan'?s) age|what age)\b/i,
  /\b(your health|his health|health (condition|issues?|problems?)|medical|disabilit\w*|diagnos\w*|illness|surgery|therapy|therapist|medication|mental health|diet|drink|drinks|alcohol|smoke|smokes|drugs?)\b/i,
  // beliefs and identity
  /\b(religio\w*|church|faith|god|politic\w*|vote|voted|democrat\w*|republican\w*|conservative|liberal|party)\b/i, /\b(gay|straight|lgbt\w*|sexual\w*|orientation|ethnic\w*|racial|(your|his) (race|nationality|ethnicity)|what race|nationality|citizen\w*|visa|immigra\w*|green card)\b/i,
  // money
  /\b(salary|compensation|income|net worth|how much (do|does|did) (you|he|ethan) (make|earn|get paid)|what (do|does) (you|he|ethan) (earn|make)|hourly rate|day rate|your rates?|his rates?|equity|bonus|wealth)\b/i,
  // employers, clients, colleagues, schools, history
  /\b(employer|employed|who do you work for|who does he work for|where (do|does|did) (you|he|ethan) work|work(s|ed)? (at|for)|current (job|company|employer)|previous (job|jobs|employer|employers|compan\w+)|former (job|employer|employers|compan\w+)|which (company|companies|firm|firms|startup|startups|business)|what (company|companies|firm|startup)|laid off|layoffs?|fired|resign\w*|quit|boss|supervisor|colleagues?|co-?workers?|clients?)\b/i,
  /\b(school|college|university|alma mater|what degree|(your|his) degree|graduat\w*|gpa|studied)\b/i,
  /\b(resume|r[eé]sum[eé]|cv|work history|job history|career history|career path|linkedin (history|profile)|past roles)\b/i,
  // private life
  /\b(hobb(y|ies)|free time|outside (of )?work|weekends?|vacation|holiday|travel\w*|favou?rite|personal life|private life|gossip|rumou?rs?)\b/i,
  /\b(secret|embarrass\w*|scandal|lawsuit|arrest\w*|criminal)\b/i, /\b(something|anything) personal\b|\bpersonal (info|information|details|stuff|question)\b/i,
];

export function isPersonalQuestion(text) { return PERSONAL_QUESTION.some((r) => r.test(String(text || ""))); }

// Things a reply must never contain, whatever the question was.
export const BLOCKED_IN_REPLY = [
  /(\+?\d[\d\s().-]{8,}\d)/,
  /\b\d{1,5}\s+[A-Z][\w.]*\s+(Street|St|Ave|Avenue|Road|Rd|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct)\b/,
  /\b(girlfriend|boyfriend|wife|husband|fianc[eé]e?|divorced|grew up|hometown|born in|birthday|years old)\b/i,
  /\b(is|are|was|got|recently)\s+(now\s+)?(married|dating|single|engaged)\b/i,
  /\b(his|he has|he's got|he had|ethan'?s?)\b[^.!?]{0,40}\b(kids?|children|daughter|son|famil(y|ies)|parents?|mother|father|sisters?|brothers?|siblings?)\b/i,
  /\b(he|ethan|i)\s+(currently\s+|now\s+|still\s+)?(lives?|resides?|moved|relocated)\s+(in|to|near)\b/i,
  /\b(he|ethan|i)\s+(is|am|'s|'m)\s+(currently\s+)?(based|located)\s+(in|near)\b/i,
  /\b(his|ethan'?s?|my)\s+(home|street)\s+address\b|\b(home address|street address)\b/i,
  /\b(he|ethan|i)\s+(currently\s+|previously\s+|used to\s+)?(works?|worked|was employed|is employed)\s+(at|for|by)\b/i,
  /\b(his|ethan'?s?)\s+(current\s+|former\s+|previous\s+)?(employer|salary|compensation|pay)\b/i,
  /\b(laid off|fired from|formerly (at|with)|previously (at|with) [A-Z])\b/,
  /\b(graduated from|alma mater|attended (the )?(university|college|school)|studied at)\b/i,
];

const blockedTerms = () => (process.env.BLOCKED_TERMS || "").split(",").map((s) => s.trim().toLowerCase()).filter((s) => s.length > 1);

export function guardOutput(text) {
  const t = String(text || "");
  for (const e of t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []) if (e.replace(/[.,;:!?)]+$/, "").toLowerCase() !== PROFILE.contact.email) return { ok: false, reason: "other email address" };
  for (const r of BLOCKED_IN_REPLY) if (r.test(t)) return { ok: false, reason: "personal detail" };
  const lower = t.toLowerCase();
  for (const term of blockedTerms()) if (lower.includes(term)) return { ok: false, reason: "blocked term" };
  return { ok: true, reason: "" };
}
