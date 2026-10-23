import { SYSTEM, FINAL_TURN } from "./prompt.js";
import { getClient, chatModel } from "./provider.js";
import { isPersonalQuestion, guardOutput, PERSONAL_REPLY } from "./guard.js";

export const MAX_TURNS = 3;

export function userTurns(messages) { return messages.filter((m) => m.role === "user").length; }
export function systemFor(used) { return used >= MAX_TURNS ? SYSTEM + FINAL_TURN : SYSTEM; }

// One assistant answer. Used by the website endpoint and by the eval suite, so the evals test exactly what visitors get.
export async function answer(messages, { client, model = chatModel() } = {}) {
  const used = userTurns(messages);
  const last = messages[messages.length - 1].content;
  // Layer 1: personal questions never reach the model.
  if (isPersonalQuestion(last)) return { text: PERSONAL_REPLY, stop_reason: "guard_input", usage: { input_tokens: 0, output_tokens: 0 }, used, model, guarded: "input" };
  const c = client || getClient();
  if (!c) throw new Error("No model provider is configured");
  const response = await c.messages.create({
    model,
    max_tokens: 800,
    system: systemFor(used),
    output_config: { effort: "low" },
    messages,
  });
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  // Layer 3: a reply containing personal details is replaced before anyone sees it.
  const g = guardOutput(text);
  if (!g.ok) return { text: PERSONAL_REPLY, stop_reason: "guard_output", usage: response.usage, used, model, guarded: "output", reason: g.reason };
  return { text, stop_reason: response.stop_reason, usage: response.usage, used, model };
}
