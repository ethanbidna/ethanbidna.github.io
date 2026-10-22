import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM, FINAL_TURN } from "./prompt.js";

export const MODEL = process.env.CHAT_MODEL || "claude-haiku-5-5";
export const MAX_TURNS = 3;

export function userTurns(messages) { return messages.filter((m) => m.role === "user").length; }
export function systemFor(used) { return used >= MAX_TURNS ? SYSTEM + FINAL_TURN : SYSTEM; }

// One assistant answer. Used by the website endpoint and by the eval suite, so the evals test exactly what visitors get.
export async function answer(messages, { client, model = MODEL } = {}) {
  const used = userTurns(messages);
  const c = client || new Anthropic({ maxRetries: 1, timeout: 20000 });
  const response = await c.messages.create({
    model,
    max_tokens: 800,
    system: systemFor(used),
    output_config: { effort: "low" },
    messages,
  });
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return { text, stop_reason: response.stop_reason, usage: response.usage, used, model };
}
