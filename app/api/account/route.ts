import { z } from "zod";
import { fail, ok, parseJson, rateLimit, requireUser } from "@/lib/api";
import { destroySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountError, deleteAccount } from "@/lib/data/account";
import { verifyPassword } from "@/lib/password";
import { updateProfile } from "@/lib/data/users";
import { HOME_CITIES } from "@/lib/seed/people";

const Body = z.object({
  displayName: z.string().trim().min(2).max(60).optional(),
  bio: z.string().max(400).optional(),
  homeCity: z.string().max(80).optional(),
  interests: z.array(z.string().max(30)).max(12).optional(),
  avatarColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

export async function PATCH(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const d = parsed.data;
  let coords: { homeLat?: number | null; homeLng?: number | null } = {};
  if (d.homeCity !== undefined) {
    const city = HOME_CITIES.find((c) => c.name.toLowerCase() === d.homeCity!.toLowerCase());
    coords = city ? { homeLat: city.lat, homeLng: city.lng } : { homeLat: null, homeLng: null };
  }
  const user = updateProfile(auth.user.id, { ...d, ...coords });
  return ok({ user });
}

/** Permanently deletes the signed-in account. Requires the current password. */
export async function DELETE(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!rateLimit(`delete-account:${auth.user.id}`, 5)) return fail("Too many attempts — please wait a minute.", 429);
  const parsed = await parseJson(req, z.object({ password: z.string().min(1) }));
  if ("error" in parsed) return parsed.error;
  const row = db().prepare("SELECT password_hash FROM users WHERE id = ?").get(auth.user.id) as { password_hash: string | null };
  if (!verifyPassword(parsed.data.password, row.password_hash)) return fail("Password is incorrect", 401);
  try {
    deleteAccount(auth.user.id);
  } catch (e) {
    if (e instanceof AccountError) return fail(e.message, 403);
    throw e;
  }
  await destroySession();
  return ok({ ok: true });
}
