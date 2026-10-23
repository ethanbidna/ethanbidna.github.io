import Anthropic from "@anthropic-ai/sdk";
import { createOpenRouterClient } from "./openrouter.js";
import { createRemoteClient } from "../evals/remote-client.mjs";

// Which model provider is configured. OpenRouter wins if both keys are set, because its spending cap is the safer default.
export function providerName() {
  if (process.env.EVAL_REMOTE_URL && process.env.EVAL_TOKEN) return "openrouter";   // the remote testing endpoint talks to OpenRouter
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function getClient() {
  if (process.env.EVAL_REMOTE_URL && process.env.EVAL_TOKEN) return createRemoteClient();
  const p = providerName();
  if (p === "openrouter") return createOpenRouterClient();
  if (p === "anthropic") return new Anthropic({ maxRetries: 1, timeout: 20000 });
  return null;
}

// Model names differ by provider. Override either with CHAT_MODEL / JUDGE_MODEL.
export function chatModel() {
  return process.env.CHAT_MODEL || (providerName() === "openrouter" ? "anthropic/claude-haiku-5.5" : "claude-haiku-5-5");
}
export function judgeModel() {
  return process.env.JUDGE_MODEL || (providerName() === "openrouter" ? "anthropic/claude-sonnet-5.5" : "claude-sonnet-5-5");
}
