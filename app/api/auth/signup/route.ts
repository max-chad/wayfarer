import { z } from "zod";
import { clientKey, fail, ok, parseJson, rateLimit } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { AVATAR_COLORS } from "@/lib/utils";

const Body = z.object({
  displayName: z.string().trim().min(2, "Name is too short").max(60),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(24)
    .regex(/^[a-zA-Z0-9_.]+$/, "Only letters, numbers, dots and underscores"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  homeCity: z.string().trim().max(80).optional(),
});

export async function POST(req: Request) {
  if (!rateLimit(`signup:${clientKey(req)}`, 5)) return fail("Too many attempts — please wait a minute.", 429);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const { displayName, username, email, password, homeCity } = parsed.data;
  const conn = db();
  if (conn.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) return fail("That username is taken.", 409);
  if (conn.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) return fail("An account with that email already exists.", 409);
  const id = Number(
    conn
      .prepare("INSERT INTO users (username, email, password_hash, display_name, avatar_color, home_city) VALUES (?, ?, ?, ?, ?, ?)")
      .run(username, email, hashPassword(password), displayName, AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)], homeCity || null).lastInsertRowid
  );
  await createSession(id);
  return ok({ ok: true, username });
}
