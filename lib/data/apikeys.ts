import crypto from "node:crypto";
import { db } from "../db";
import { API_PLANS, type ApiPlanId } from "../plans";
import { sweepSubscriptions } from "./billing";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export interface ApiKeyInfo {
  id: number;
  name: string;
  prefix: string;
  revoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  usedThisMonth: number;
}

export function apiPlanFor(userId: number): (typeof API_PLANS)[number] {
  sweepSubscriptions();
  const growth = db().prepare("SELECT 1 FROM subscriptions WHERE user_id = ? AND product = 'api_growth' AND status = 'active'").get(userId);
  return API_PLANS.find((p) => p.id === (growth ? "growth" : "developer"))!;
}

const period = () => new Date().toISOString().slice(0, 7);

export function listApiKeys(userId: number): ApiKeyInfo[] {
  const rows = db()
    .prepare(
      `SELECT k.id, k.name, k.prefix, k.revoked, k.last_used_at, k.created_at, COALESCE(u.n, 0) used
       FROM api_keys k LEFT JOIN api_usage u ON u.key_id = k.id AND u.period = ? WHERE k.user_id = ? ORDER BY k.revoked, k.created_at DESC`
    )
    .all(period(), userId) as { id: number; name: string; prefix: string; revoked: number; last_used_at: string | null; created_at: string; used: number }[];
  return rows.map((r) => ({ id: r.id, name: r.name, prefix: r.prefix, revoked: !!r.revoked, lastUsedAt: r.last_used_at, createdAt: r.created_at, usedThisMonth: r.used }));
}

export function monthlyApiUsage(userId: number) {
  return (
    db()
      .prepare("SELECT COALESCE(SUM(u.n), 0) n FROM api_usage u JOIN api_keys k ON k.id = u.key_id WHERE k.user_id = ? AND u.period = ?")
      .get(userId, period()) as { n: number }
  ).n;
}

/** Creates a key. The plaintext is returned once; only its SHA-256 hash is stored. */
export function createApiKey(userId: number, name: string) {
  const active = (db().prepare("SELECT COUNT(*) n FROM api_keys WHERE user_id = ? AND revoked = 0").get(userId) as { n: number }).n;
  if (active >= 5) throw new Error("You can have up to 5 active keys. Revoke one first.");
  const key = `wf_live_${crypto.randomBytes(24).toString("hex")}`;
  const id = Number(
    db().prepare("INSERT INTO api_keys (user_id, name, prefix, key_hash) VALUES (?, ?, ?, ?)").run(userId, name.slice(0, 60) || "Untitled key", key.slice(0, 14), sha256(key)).lastInsertRowid
  );
  return { id, key };
}

export function revokeApiKey(userId: number, id: number) {
  return db().prepare("UPDATE api_keys SET revoked = 1 WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}

export type ApiAuth =
  | { ok: true; keyId: number; userId: number; plan: ApiPlanId; limit: number; used: number }
  | { ok: false; status: number; error: string; limit?: number; used?: number };

/** Authenticates `Authorization: Bearer wf_live_…` (or `x-api-key`) and meters the call against the monthly quota. */
export function authenticateApiRequest(req: Request): ApiAuth {
  const header = req.headers.get("authorization") || "";
  const key = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : (req.headers.get("x-api-key") || "").trim();
  if (!key) return { ok: false, status: 401, error: "Missing API key. Send it as `Authorization: Bearer <key>`." };
  const row = db().prepare("SELECT id, user_id, revoked FROM api_keys WHERE key_hash = ?").get(sha256(key)) as { id: number; user_id: number; revoked: number } | undefined;
  if (!row || row.revoked) return { ok: false, status: 401, error: "Invalid or revoked API key." };
  const plan = apiPlanFor(row.user_id);
  const used = monthlyApiUsage(row.user_id);
  if (used >= plan.quota) return { ok: false, status: 429, error: `Monthly quota of ${plan.quota.toLocaleString("en-US")} calls reached. Upgrade at /developers.`, limit: plan.quota, used };
  const conn = db();
  conn.prepare("INSERT INTO api_usage (key_id, period, n) VALUES (?, ?, 1) ON CONFLICT(key_id, period) DO UPDATE SET n = n + 1").run(row.id, period());
  conn.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(row.id);
  return { ok: true, keyId: row.id, userId: row.user_id, plan: plan.id, limit: plan.quota, used: used + 1 };
}
