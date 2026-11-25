import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getCurrentUser } from "./auth";
import type { SessionUser } from "./types";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function parseJson<T extends z.ZodType>(req: Request, schema: T): Promise<{ data: z.infer<T> } | { error: Response }> {
  // Defence in depth against CSRF: HTML forms can't send application/json cross-site without a CORS preflight.
  if (!(req.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return { error: fail("Expected a JSON request body", 415) };
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: fail("Invalid JSON body") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: fail(`Invalid input${issue ? `: ${issue.path.join(".") || "body"} — ${issue.message}` : ""}`, 422) };
  }
  return { data: parsed.data };
}

export async function requireUser(): Promise<{ user: SessionUser } | { error: Response }> {
  const user = await getCurrentUser();
  if (!user) return { error: fail("Please sign in to continue.", 401) };
  return { user };
}

// ── simple in-memory rate limiter (per process) ─────────────────────────────
const buckets = new Map<string, { tokens: number; at: number }>();

export function rateLimit(key: string, perMinute = 30): boolean {
  const now = Date.now();
  const b = buckets.get(key) || { tokens: perMinute, at: now };
  const refill = ((now - b.at) / 60000) * perMinute;
  b.tokens = Math.min(perMinute, b.tokens + refill);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  // Evict the oldest bucket (Map keeps insertion order) instead of wiping every limiter at once.
  if (buckets.size > 5000) buckets.delete(buckets.keys().next().value as string);
  return true;
}

/** Only allow same-origin relative redirects ("/path"), never "//host" or "/\host". */
export function safeRedirect(next: string | undefined | null, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\r\n]/.test(next)) return fallback;
  return next;
}

export function clientKey(req: Request, user?: SessionUser | null) {
  if (user) return `u:${user.id}`;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  // Hash like quotaSubject: raw addresses never land in the limiter map.
  return `ip:${crypto.createHash("sha256").update(`wayfarer:${ip}`).digest("hex").slice(0, 20)}`;
}
