// Metrics for checking an LLM judge against human labels, and for correcting its pass rate for its own error rate.
// "Positive" means pass. TPR = P(judge says pass | truly pass). TNR = P(judge says fail | truly fail).

export function confusion(pairs) { // pairs: [{ truth: "pass"|"fail", judged: "pass"|"fail" }]
  const c = { tp: 0, fn: 0, tn: 0, fp: 0 };
  for (const { truth, judged } of pairs) {
    if (truth === "pass") judged === "pass" ? c.tp++ : c.fn++; else judged === "fail" ? c.tn++ : c.fp++;
  }
  return c;
}
const div = (a, b) => (b === 0 ? null : a / b);
export function rates(c) {
  const tpr = div(c.tp, c.tp + c.fn), tnr = div(c.tn, c.tn + c.fp), precision = div(c.tp, c.tp + c.fp);
  const f1 = precision === null || tpr === null || precision + tpr === 0 ? null : (2 * precision * tpr) / (precision + tpr);
  return { n: c.tp + c.fn + c.tn + c.fp, tpr, tnr, precision, f1, accuracy: div(c.tp + c.tn, c.tp + c.fn + c.tn + c.fp) };
}

// Rogan-Gladen estimate of the true pass rate from the observed pass rate and the judge's TPR and TNR.
export function correctedRate(observed, tpr, tnr) {
  const j = tpr + tnr - 1;
  if (j <= 0.1) return null;                      // a judge this weak can't be corrected
  return Math.min(1, Math.max(0, (observed + tnr - 1) / j));
}

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Bootstrap interval for the corrected rate: resample both the judged cases and the labeled set.
export function bootstrapCorrected({ outcomes, labeled, iterations = 2000, seed = 7 }) {
  const rand = rng(seed), est = [];
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  for (let i = 0; i < iterations; i++) {
    const o = Array.from({ length: outcomes.length }, () => pick(outcomes));
    const l = Array.from({ length: labeled.length }, () => pick(labeled));
    const r = rates(confusion(l));
    if (r.tpr === null || r.tnr === null) continue;
    const v = correctedRate(o.filter((x) => x === "pass").length / o.length, r.tpr, r.tnr);
    if (v !== null) est.push(v);
  }
  if (est.length < iterations / 2) return null;
  est.sort((a, b) => a - b);
  return { lo: est[Math.floor(est.length * 0.025)], hi: est[Math.ceil(est.length * 0.975) - 1] };
}
