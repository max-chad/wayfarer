import { db } from "../db";

export type NotificationKind = "booking" | "price_drop" | "owner_response" | "answer" | "billing" | "business" | "review";

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  createdAt: string;
}

export function notify(userId: number, n: { kind: NotificationKind; title: string; body?: string; url?: string | null }) {
  try {
    db()
      .prepare("INSERT INTO notifications (user_id, kind, title, body, url) VALUES (?, ?, ?, ?, ?)")
      .run(userId, n.kind, n.title.slice(0, 160), (n.body || "").slice(0, 400), n.url ?? null);
  } catch {
    /* notifications are best-effort */
  }
}

export function listNotifications(userId: number, limit = 20): AppNotification[] {
  const rows = db()
    .prepare("SELECT id, kind, title, body, url, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
    .all(userId, limit) as { id: number; kind: NotificationKind; title: string; body: string; url: string | null; read: number; created_at: string }[];
  return rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, url: r.url, read: !!r.read, createdAt: r.created_at }));
}

export function unreadCount(userId: number) {
  return (db().prepare("SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read = 0").get(userId) as { n: number }).n;
}

export function markAllRead(userId: number) {
  db().prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0").run(userId);
}
