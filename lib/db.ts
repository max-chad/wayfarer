import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seedDatabase } from "./seed";

type DB = Database.Database;

declare global {
  // eslint-disable-next-line no-var
  var __wayfarerDb: DB | undefined;
}

export const SCHEMA_VERSION = 4;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  display_name TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#0f766e',
  bio TEXT,
  home_city TEXT,
  home_lat REAL,
  home_lng REAL,
  interests TEXT NOT NULL DEFAULT '[]',
  role TEXT NOT NULL DEFAULT 'user',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS destinations (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  country_code TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT '',
  continent TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  wiki_extract TEXT NOT NULL DEFAULT '',
  wiki_url TEXT NOT NULL DEFAULT '',
  image TEXT,
  gallery TEXT NOT NULL DEFAULT '[]',
  vibes TEXT NOT NULL DEFAULT '[]',
  info TEXT NOT NULL DEFAULT '{}',
  climate TEXT NOT NULL DEFAULT '[]',
  popularity INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('hotel','restaurant','attraction','experience')),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  wiki_extract TEXT NOT NULL DEFAULT '',
  wiki_url TEXT NOT NULL DEFAULT '',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  neighborhood TEXT NOT NULL DEFAULT '',
  price_level INTEGER NOT NULL DEFAULT 2,
  price_usd REAL NOT NULL DEFAULT 0,
  image TEXT,
  gallery TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  amenities TEXT NOT NULL DEFAULT '[]',
  details TEXT NOT NULL DEFAULT '{}',
  rating REAL NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  ranking INTEGER NOT NULL DEFAULT 0,
  ranking_total INTEGER NOT NULL DEFAULT 0,
  awards TEXT NOT NULL DEFAULT '[]',
  aspect_scores TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_places_dest_type ON places(destination_id, type);
CREATE INDEX IF NOT EXISTS idx_places_type_rating ON places(type, rating DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS places_fts USING fts5(
  name, category, description, tags, neighborhood, destination, content='', tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  trip_type TEXT NOT NULL DEFAULT 'couples',
  visit_date TEXT NOT NULL,
  sub_ratings TEXT NOT NULL DEFAULT '{}',
  language TEXT NOT NULL DEFAULT 'en',
  translation TEXT,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  trust_score INTEGER NOT NULL DEFAULT 80,
  trust_flags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'published',
  owner_response TEXT,
  photos TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_place ON reviews(place_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);

CREATE TABLE IF NOT EXISTS review_votes (
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (review_id, user_id)
);

CREATE TABLE IF NOT EXISTS review_reports (
  id INTEGER PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saves (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, place_id)
);

CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  destination_id INTEGER REFERENCES destinations(id) ON DELETE SET NULL,
  start_date TEXT,
  days INTEGER NOT NULL DEFAULT 3,
  travelers INTEGER NOT NULL DEFAULT 2,
  budget TEXT NOT NULL DEFAULT 'midrange',
  pace TEXT NOT NULL DEFAULT 'balanced',
  interests TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  share_token TEXT UNIQUE,
  is_public INTEGER NOT NULL DEFAULT 0,
  ai_summary TEXT NOT NULL DEFAULT '',
  packing TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS trip_items (
  id INTEGER PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  start_time TEXT,
  duration_min INTEGER NOT NULL DEFAULT 60,
  kind TEXT NOT NULL DEFAULT 'place',
  cost_usd REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_trip_items_trip ON trip_items(trip_id, day, position);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_questions_place ON questions(place_id, created_at DESC);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_ai INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_events (
  id INTEGER PRIMARY KEY,
  feature TEXT NOT NULL,
  provider TEXT NOT NULL,
  ok INTEGER NOT NULL DEFAULT 1,
  ms INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Business model: subscriptions, bookings, business listings, ads, API ──

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  place_id INTEGER REFERENCES places(id) ON DELETE CASCADE,
  interval TEXT NOT NULL DEFAULT 'month',
  price_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  current_period_end TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  canceled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status, current_period_end);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  stream TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_usage (
  subject TEXT NOT NULL,
  feature TEXT NOT NULL,
  period TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (subject, feature, period)
);

CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY,
  place_id INTEGER NOT NULL UNIQUE REFERENCES places(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  tier TEXT NOT NULL DEFAULT 'free',
  contact_name TEXT NOT NULL,
  contact_role TEXT NOT NULL DEFAULT '',
  website TEXT,
  phone TEXT,
  booking_url TEXT,
  announcement TEXT,
  verify_code TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_business_user ON businesses(user_id);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  daily_budget_cents INTEGER NOT NULL,
  cpc_cents INTEGER NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_campaigns_place ON campaigns(place_id, status);

CREATE TABLE IF NOT EXISTS campaign_daily (
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spend_cents INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, day)
);
CREATE INDEX IF NOT EXISTS idx_campaign_daily_day ON campaign_daily(day);

CREATE TABLE IF NOT EXISTS place_daily (
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  clickouts INTEGER NOT NULL DEFAULT 0,
  clickout_cents INTEGER NOT NULL DEFAULT 0,
  bookings INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (place_id, day)
);
CREATE INDEX IF NOT EXISTS idx_place_daily_day ON place_daily(day);

CREATE TABLE IF NOT EXISTS clickouts (
  id INTEGER PRIMARY KEY,
  place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  partner TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  party INTEGER NOT NULL DEFAULT 2,
  total_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed',
  contact_name TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_place ON bookings(place_id, date);

CREATE TABLE IF NOT EXISTS price_alerts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  check_in TEXT NOT NULL,
  nights INTEGER NOT NULL DEFAULT 2,
  guests INTEGER NOT NULL DEFAULT 2,
  last_price_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, place_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  url TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);

CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  revoked INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_usage (
  key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key_id, period)
);
`;

export function dbPath() {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "wayfarer.db");
}

export function openDatabase(file = dbPath()): DB {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new Database(file);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.pragma("synchronous = NORMAL");
  conn.pragma("busy_timeout = 8000");
  conn.exec(SCHEMA);
  return conn;
}

export function isSeeded(conn: DB) {
  const row = conn.prepare("SELECT value FROM meta WHERE key = 'seeded_version'").get() as { value: string } | undefined;
  return row?.value === String(SCHEMA_VERSION);
}

/** Shared connection; seeds the database automatically on first use. */
export function db(): DB {
  if (!globalThis.__wayfarerDb) {
    const conn = openDatabase();
    if (!isSeeded(conn)) seedDatabase(conn, { log: console.log });
    globalThis.__wayfarerDb = conn;
  }
  return globalThis.__wayfarerDb;
}

export function json<T>(value: string | null | undefined, fallback: T): T {
  if (value == null || value === "") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
