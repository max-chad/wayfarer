import { z } from "zod";
import { clientKey, fail, ok, parseJson, rateLimit } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { getUserForLogin } from "@/lib/data/users";
import { verifyPassword } from "@/lib/password";

const Body = z.object({ identifier: z.string().trim().min(1), password: z.string().min(1) });

export async function POST(req: Request) {
  if (!rateLimit(`login:${clientKey(req)}`, 10)) return fail("Too many attempts — please wait a minute.", 429);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const user = getUserForLogin(parsed.data.identifier.toLowerCase()) || getUserForLogin(parsed.data.identifier);
  if (!user || !verifyPassword(parsed.data.password, user.password_hash)) return fail("Incorrect email/username or password.", 401);
  await createSession(user.id);
  return ok({ ok: true, username: user.username });
}
