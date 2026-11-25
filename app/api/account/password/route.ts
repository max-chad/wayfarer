import { z } from "zod";
import { fail, ok, parseJson, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = await parseJson(req, z.object({ current: z.string().min(1), next: z.string().min(8, "New password must be at least 8 characters").max(200) }));
  if ("error" in parsed) return parsed.error;
  const row = db().prepare("SELECT password_hash FROM users WHERE id = ?").get(auth.user.id) as { password_hash: string | null };
  if (!verifyPassword(parsed.data.current, row.password_hash)) return fail("Current password is incorrect", 401);
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(parsed.data.next), auth.user.id);
  return ok({ ok: true });
}
