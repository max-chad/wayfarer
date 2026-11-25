import crypto from "node:crypto";
import { db } from "./db";

let cached: string | null = null;

/** HMAC secret: APP_SECRET env var, or a random secret generated once and stored in the database. */
function secret() {
  if (cached) return cached;
  if (process.env.APP_SECRET && process.env.APP_SECRET.length >= 16) return (cached = process.env.APP_SECRET);
  const conn = db();
  const row = conn.prepare("SELECT value FROM meta WHERE key = 'app_secret'").get() as { value: string } | undefined;
  if (row) return (cached = row.value);
  const value = crypto.randomBytes(32).toString("hex");
  conn.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('app_secret', ?)").run(value);
  return (cached = (conn.prepare("SELECT value FROM meta WHERE key = 'app_secret'").get() as { value: string }).value);
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** Tamper-proof token for click-out links (prices and partners can't be forged to inflate payouts). */
export function signToken(payload: Record<string, unknown>, ttlSeconds = 60 * 60 * 24) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = b64(crypto.createHmac("sha256", secret()).update(body).digest()).slice(0, 32);
  return `${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64(crypto.createHmac("sha256", secret()).update(body).digest()).slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp?: number };
    if (typeof data.exp === "number" && data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}
