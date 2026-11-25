import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { logAiEvent } from "../data/misc";

export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
// Server-side refusal fallback: a declined request is retried on Anthropic's recommended model.
export const FALLBACK_BETA = "server-side-fallback-2026-07-01" as const;

export type AiProvider = "claude" | "local";

let disabledUntil = 0;
let lastError: string | null = null;

export function aiProvider(): AiProvider {
  const mode = (process.env.AI_PROVIDER || "auto").toLowerCase();
  if (mode === "local") return "local";
  if (Date.now() < disabledUntil) return "local";
  if (mode === "claude") return "claude";
  return process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE ? "claude" : "local";
}

export function aiStatus() {
  const provider = aiProvider();
  return {
    provider,
    model: provider === "claude" ? CLAUDE_MODEL : "wayfarer-local-1",
    label: provider === "claude" ? `Claude (${CLAUDE_MODEL})` : "Wayfarer local AI engine",
    lastError,
  };
}

let client: Anthropic | null = null;
export function claude() {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 180_000 });
  return client;
}

export class AiRefusalError extends Error {}

/** Records a Claude failure; auth/permission problems trip a 10-minute circuit breaker. */
export function noteClaudeError(feature: string, err: unknown, started: number) {
  let msg = err instanceof Error ? err.message : String(err);
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    disabledUntil = Date.now() + 10 * 60_000;
    msg = `Authentication failed — falling back to the local engine for 10 minutes (${msg})`;
  } else if (err instanceof Anthropic.RateLimitError) {
    msg = `Rate limited (${msg})`;
  } else if (err instanceof Anthropic.APIConnectionError) {
    msg = `Connection error (${msg})`;
  } else if (err instanceof Anthropic.APIError) {
    msg = `API error ${err.status} (${msg})`;
  }
  lastError = `${feature}: ${msg}`;
  console.warn(`[ai:${feature}] ${msg}`);
  logAiEvent({ feature, provider: "claude", ok: false, ms: Date.now() - started });
}

/** Structured-output call: Claude returns JSON validated against a Zod schema. */
export async function claudeJson<S extends z.ZodType>(opts: {
  feature: string;
  system: string;
  prompt: string;
  schema: S;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const started = Date.now();
  const res = await claude().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });
  if (res.stop_reason === "refusal") throw new AiRefusalError("The request was declined.");
  if (res.stop_reason === "max_tokens") throw new Error("Response truncated (max_tokens)");
  const out = res.parsed_output;
  if (out == null) throw new Error("No structured output returned");
  logAiEvent({
    feature: opts.feature,
    provider: "claude",
    ok: true,
    ms: Date.now() - started,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
  });
  return out as z.infer<S>;
}

/** Plain-text call for short generations. */
export async function claudeText(opts: { feature: string; system: string; prompt: string; effort?: "low" | "medium" | "high"; maxTokens?: number }) {
  const started = Date.now();
  const res = await claude().beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: opts.effort ?? "low" },
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });
  if (res.stop_reason === "refusal") throw new AiRefusalError("The request was declined.");
  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  logAiEvent({ feature: opts.feature, provider: "claude", ok: true, ms: Date.now() - started, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens });
  return text;
}

/** Runs the Claude implementation when available, otherwise (or on failure) the local engine. */
export async function withAi<T>(feature: string, claudeFn: () => Promise<T>, localFn: () => T | Promise<T>): Promise<{ result: T; provider: AiProvider }> {
  if (aiProvider() === "claude") {
    const started = Date.now();
    try {
      return { result: await claudeFn(), provider: "claude" };
    } catch (err) {
      noteClaudeError(feature, err, started);
    }
  }
  const started = Date.now();
  const result = await localFn();
  logAiEvent({ feature, provider: "local", ok: true, ms: Date.now() - started });
  return { result, provider: "local" };
}
