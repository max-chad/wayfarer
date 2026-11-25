import { ok, requireUser } from "@/lib/api";
import { listNotifications, markAllRead, unreadCount } from "@/lib/data/notifications";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  return ok({ items: listNotifications(auth.user.id, 20), unread: unreadCount(auth.user.id) }, { headers: { "cache-control": "no-store" } });
}

/** Marks every notification as read. */
export async function POST() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  markAllRead(auth.user.id);
  return ok({ unread: 0 });
}
