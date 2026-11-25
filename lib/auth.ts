import crypto from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./db";
import { getUserById } from "./data/users";
import { randomToken } from "./password";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "wf_session";
const SESSION_DAYS = 30;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** Current signed-in user (memoised per request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db()
    .prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')")
    .get(sha256(token)) as { user_id: number } | undefined;
  return row ? getUserById(row.user_id) : null;
});

export async function createSession(userId: number) {
  const token = randomToken(32);
  db()
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', ?))")
    .run(sha256(token), userId, `+${SESSION_DAYS} days`);
  db().prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE token = ?").run(sha256(token));
  store.delete(SESSION_COOKIE);
}
