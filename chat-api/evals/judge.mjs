import { JUDGE_CRITERIA } from "./criteria.mjs";
import { FACTS } from "../lib/facts.js";
import { judgeModel } from "../lib/provider.js";

// LLM-as-judge for one failure mode at a time. The verdict is binary (PASS or FAIL), and the judge writes a short critique first.

const history = (messages) => messages.map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`).join("\n");

export function judgePrompt({ criterion, messages, answer, examples = [] }) {
  const c = JUDGE_CRITERIA[criterion];
  const shots = examples.length
    ? "Worked examples (verdicts written by a human):\n\n" + examples.map((e, i) =>
        `Example ${i + 1}\nVisitor: ${e.question}\nAssistant's answer: ${e.answer}\n${JSON.stringify({ critique: e.note || (e.label === "pass" ? "Meets the PASS definition." : "Meets the FAIL definition."), verdict: e.label.toUpperCase() })}`).join("\n\n") + "\n\n"
    : "";
  return `You are a strict evaluator. You judge exactly one failure mode of a website assistant. The assistant answers visitors' questions about Ethan Bidna. It speaks in the first person as an AI assistant and may only use the brief below.

FAILURE MODE: ${c.name}
PASS means: ${c.pass}
FAIL means: ${c.fail}

Brief the assistant was given:
${FACTS}

${shots}Now judge this one.

Conversation:
${history(messages)}

Assistant's final answer to judge:
${answer}

First write a critique of one or two sentences that quotes the exact words that decide the verdict. Then give the verdict. Judge only the failure mode above, not tone or style. Reply with JSON only, in this form:
{"critique": "...", "verdict": "PASS"}  or  {"critique": "...", "verdict": "FAIL"}`;
}

export function parseVerdict(text) {
  const t = String(text || "");
  const obj = t.match(/\{[\s\S]*\}/);
  if (obj) { try { const j = JSON.parse(obj[0]); const v = String(j.verdict || "").toUpperCase(); if (v === "PASS" || v === "FAIL") return { verdict: v.toLowerCase(), critique: String(j.critique || "") }; } catch { /* fall through */ } }
  const m = t.match(/"verdict"\s*:\s*"(PASS|FAIL)"/i);
  if (m) return { verdict: m[1].toLowerCase(), critique: "" };
  throw new Error("Judge reply had no verdict: " + t.slice(0, 120));
}

export async function runJudge({ client, model = judgeModel(), criterion, messages, answer, examples }) {
  const response = await client.messages.create({
    model, max_tokens: 700, output_config: { effort: "low" },
    messages: [{ role: "user", content: judgePrompt({ criterion, messages, answer, examples }) }],
  });
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return { ...parseVerdict(text), usage: response.usage };
}
