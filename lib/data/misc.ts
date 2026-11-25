import crypto from "node:crypto";
import { db } from "../db";
import { bumpPlaceDaily } from "./commerce";
import type { PlaceCardData } from "../types";
import { placeSelect, toCard, type PlaceRow } from "./mappers";

// ── Saves ───────────────────────────────────────────────────────────────────

export function toggleSave(userId: number, placeId: number) {
  const conn = db();
  const exists = conn.prepare("SELECT 1 FROM saves WHERE user_id = ? AND place_id = ?").get(userId, placeId);
  if (exists) conn.prepare("DELETE FROM saves WHERE user_id = ? AND place_id = ?").run(userId, placeId);
  else {
    conn.prepare("INSERT INTO saves (user_id, place_id) VALUES (?, ?)").run(userId, placeId);
    bumpPlaceDaily(placeId, "saves");
  }
  return !exists;
}

export function savedPlaceIds(userId: number): number[] {
  return (db().prepare("SELECT place_id FROM saves WHERE user_id = ?").all(userId) as { place_id: number }[]).map((r) => r.place_id);
}

export function savedPlaces(userId: number): (PlaceCardData & { savedAt: string })[] {
  const rows = db()
    .prepare(`${placeSelect("s.created_at AS saved_at")} JOIN saves s ON s.place_id = p.id WHERE s.user_id = ? ORDER BY s.created_at DESC`)
    .all(userId) as (PlaceRow & { saved_at: string })[];
  return rows.map((r) => ({ ...toCard(r), savedAt: r.saved_at }));
}

// ── Q&A ─────────────────────────────────────────────────────────────────────

export interface QA {
  id: number;
  body: string;
  createdAt: string;
  user: { username: string; displayName: string; avatarColor: string } | null;
  answers: { id: number; body: string; isAi: boolean; provider: string | null; createdAt: string; user: { username: string; displayName: string; avatarColor: string } | null }[];
}

export function listQuestions(placeId: number): QA[] {
  const conn = db();
  const qs = conn
    .prepare(
      `SELECT q.id, q.body, q.created_at, u.username, u.display_name, u.avatar_color FROM questions q LEFT JOIN users u ON u.id = q.user_id WHERE q.place_id = ? ORDER BY q.created_at DESC`
    )
    .all(placeId) as { id: number; body: string; created_at: string; username: string | null; display_name: string | null; avatar_color: string | null }[];
  const ans = conn
    .prepare(
      `SELECT a.id, a.question_id, a.body, a.is_ai, a.provider, a.created_at, u.username, u.display_name, u.avatar_color
       FROM answers a LEFT JOIN users u ON u.id = a.user_id WHERE a.question_id IN (SELECT id FROM questions WHERE place_id = ?) ORDER BY a.is_ai DESC, a.created_at ASC`
    )
    .all(placeId) as {
    id: number;
    question_id: number;
    body: string;
    is_ai: number;
    provider: string | null;
    created_at: string;
    username: string | null;
    display_name: string | null;
    avatar_color: string | null;
  }[];
  return qs.map((q) => ({
    id: q.id,
    body: q.body,
    createdAt: q.created_at,
    user: q.username ? { username: q.username, displayName: q.display_name!, avatarColor: q.avatar_color! } : null,
    answers: ans
      .filter((a) => a.question_id === q.id)
      .map((a) => ({
        id: a.id,
        body: a.body,
        isAi: !!a.is_ai,
        provider: a.provider,
        createdAt: a.created_at,
        user: a.username ? { username: a.username, displayName: a.display_name!, avatarColor: a.avatar_color! } : null,
      })),
  }));
}

export function addQuestion(placeId: number, userId: number | null, body: string) {
  return Number(db().prepare("INSERT INTO questions (place_id, user_id, body) VALUES (?, ?, ?)").run(placeId, userId, body.slice(0, 600)).lastInsertRowid);
}

export function addAnswer(questionId: number, userId: number | null, body: string, ai?: { provider: string }) {
  return Number(
    db()
      .prepare("INSERT INTO answers (question_id, user_id, body, is_ai, provider) VALUES (?, ?, ?, ?, ?)")
      .run(questionId, userId, body.slice(0, 3000), ai ? 1 : 0, ai?.provider ?? null).lastInsertRowid
  );
}

export function getQuestion(id: number) {
  return db().prepare("SELECT id, place_id, body FROM questions WHERE id = ?").get(id) as { id: number; place_id: number; body: string } | undefined;
}

// ── Uploads ─────────────────────────────────────────────────────────────────

export function saveUpload(userId: number | null, mime: string, data: Buffer) {
  const id = crypto.randomBytes(12).toString("hex");
  db().prepare("INSERT INTO uploads (id, user_id, mime, data) VALUES (?, ?, ?, ?)").run(id, userId, mime, data);
  return id;
}

export function getUpload(id: string) {
  return db().prepare("SELECT mime, data FROM uploads WHERE id = ?").get(id) as { mime: string; data: Buffer } | undefined;
}

// ── AI cache & telemetry ────────────────────────────────────────────────────

export function cacheGet<T>(key: string, maxAgeHours = 24 * 30): { value: T; provider: string } | null {
  const r = db()
    .prepare(`SELECT value, provider FROM ai_cache WHERE key = ? AND created_at >= datetime('now', ?)`)
    .get(key, `-${maxAgeHours} hours`) as { value: string; provider: string } | undefined;
  if (!r) return null;
  try {
    return { value: JSON.parse(r.value) as T, provider: r.provider };
  } catch {
    return null;
  }
}

export function cacheSet(key: string, value: unknown, provider: string) {
  db().prepare("INSERT OR REPLACE INTO ai_cache (key, value, provider, created_at) VALUES (?, ?, ?, datetime('now'))").run(key, JSON.stringify(value), provider);
}

export function logAiEvent(e: { feature: string; provider: string; ok: boolean; ms: number; inputTokens?: number; outputTokens?: number }) {
  try {
    db()
      .prepare("INSERT INTO ai_events (feature, provider, ok, ms, input_tokens, output_tokens) VALUES (?, ?, ?, ?, ?, ?)")
      .run(e.feature, e.provider, e.ok ? 1 : 0, Math.round(e.ms), e.inputTokens || 0, e.outputTokens || 0);
  } catch {
    /* telemetry must never break a request */
  }
}

// ── Site stats ──────────────────────────────────────────────────────────────

export function siteStats() {
  return db()
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM destinations) destinations,
        (SELECT COUNT(*) FROM places) places,
        (SELECT COUNT(*) FROM reviews WHERE status = 'published') reviews,
        (SELECT COUNT(*) FROM users) users,
        (SELECT COUNT(DISTINCT country) FROM destinations) countries,
        (SELECT COUNT(*) FROM trips) trips,
        (SELECT COUNT(*) FROM reviews WHERE status = 'flagged') flagged,
        (SELECT COUNT(*) FROM review_reports WHERE resolved = 0) reports,
        (SELECT COUNT(*) FROM ai_events) aiCalls,
        (SELECT COUNT(*) FROM ai_events WHERE provider = 'claude') claudeCalls`
    )
    .get() as Record<string, number>;
}

export function reviewsPerMonth(months = 12) {
  return db()
    .prepare(
      `SELECT substr(created_at, 1, 7) ym, COUNT(*) n, ROUND(AVG(rating), 2) avg FROM reviews
       WHERE created_at >= date('now', ?) GROUP BY ym ORDER BY ym`
    )
    .all(`-${months} months`) as { ym: string; n: number; avg: number }[];
}

export function aiUsage() {
  return db()
    .prepare(
      `SELECT feature, provider, COUNT(*) n, ROUND(AVG(ms)) ms, SUM(ok) ok, SUM(input_tokens) input, SUM(output_tokens) output
       FROM ai_events GROUP BY feature, provider ORDER BY n DESC`
    )
    .all() as { feature: string; provider: string; n: number; ms: number; ok: number; input: number; output: number }[];
}

// ── Trust & transparency report ─────────────────────────────────────────────

export function trustReport() {
  const conn = db();
  const r = conn
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM reviews) total,
        (SELECT COUNT(*) FROM reviews WHERE status = 'published') published,
        (SELECT COUNT(*) FROM reviews WHERE status = 'flagged') held,
        (SELECT COUNT(*) FROM reviews WHERE status = 'removed') removed,
        (SELECT ROUND(AVG(trust_score), 1) FROM reviews WHERE status = 'published') avgTrust,
        (SELECT COUNT(*) FROM review_reports) reports,
        (SELECT COUNT(*) FROM review_reports WHERE resolved = 1) reportsResolved,
        (SELECT COUNT(*) FROM reviews WHERE owner_response IS NOT NULL AND status = 'published') ownerReplies,
        (SELECT COUNT(*) FROM businesses WHERE status = 'verified') verifiedBusinesses,
        (SELECT COUNT(*) FROM reviews WHERE language != 'en') foreignLang`
    )
    .get() as {
    total: number;
    published: number;
    held: number;
    removed: number;
    avgTrust: number;
    reports: number;
    reportsResolved: number;
    ownerReplies: number;
    verifiedBusinesses: number;
    foreignLang: number;
  };
  const flags = conn.prepare("SELECT trust_flags FROM reviews WHERE trust_flags != '[]'").all() as { trust_flags: string }[];
  const byFlag = new Map<string, number>();
  for (const f of flags) {
    for (const x of JSON.parse(f.trust_flags) as string[]) byFlag.set(x, (byFlag.get(x) || 0) + 1);
  }
  return { ...r, flags: [...byFlag.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([flag, n]) => ({ flag, n })) };
}
