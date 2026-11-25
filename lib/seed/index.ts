import type Database from "better-sqlite3";
import { detectAspects, loadReviewBank, type BankType, type ReviewBank } from "../ai/local/bank";
import { splitSentences } from "../ai/local/sentiment";
import { scoreReviewTrust, TRUST_HOLD_THRESHOLD } from "../ai/local/trust";
import { haversineKm, offsetMeters } from "../geo";
import { hashPassword } from "../password";
import { SUB_RATINGS } from "../review-meta";
import type { ImageRef, PlaceType, TripType } from "../types";
import { AVATAR_COLORS, clamp, imgUrl, MONTHS, rng, slugify, type Rng } from "../utils";
import { seedBusinessModel } from "./business";
import { seedDemoContent } from "./demo";
import { BIOS, COMPANIONS, FIRST_NAMES, HOME_CITIES, LAST_NAMES, OWNER_RESPONSES, STAFF_NAMES } from "./people";
import { loadMedia, loadSources, syntheticClimate, type DestinationSource, type MediaFile } from "./sources";

type DB = Database.Database;

export const SEED_VERSION = "4";
export const DEMO_EMAIL = "demo@wayfarer.travel";
export const DEMO_PASSWORD = "wayfarer-demo";

interface SeedOptions {
  log?: (...args: unknown[]) => void;
  force?: boolean;
}

interface PlaceSeed {
  id: number;
  slug: string;
  type: PlaceType;
  name: string;
  category: string;
  destSlug: string;
  city: string;
  lat: number;
  lng: number;
  neighborhood: string;
  tags: string[];
  amenities: string[];
  priceUsd: number;
  bestMonths: number[];
  avoidMonths: number[];
  dish?: string;
  nearby: string;
  gallery: ImageRef[];
  iconic: boolean;
  quality: number;
  aspectQ: Record<string, number>;
  subcat: string;
}

interface GenReview {
  placeId: number;
  userId: number;
  rating: number;
  title: string;
  body: string;
  tripType: TripType;
  visitDate: string;
  subRatings: Record<string, number>;
  language: string;
  translation: { title: string; body: string } | null;
  helpful: number;
  ownerResponse: string | null;
  photos: string[];
  createdAt: string;
  suspicious: boolean;
  aspectHits: number;
}

const WIPE = `
DELETE FROM notifications; DELETE FROM price_alerts; DELETE FROM bookings; DELETE FROM clickouts; DELETE FROM place_daily;
DELETE FROM campaign_daily; DELETE FROM campaigns; DELETE FROM businesses; DELETE FROM invoices; DELETE FROM subscriptions;
DELETE FROM ai_usage; DELETE FROM api_usage; DELETE FROM api_keys; DELETE FROM ai_events;
DELETE FROM answers; DELETE FROM questions; DELETE FROM trip_items; DELETE FROM trips; DELETE FROM saves;
DELETE FROM review_reports; DELETE FROM review_votes; DELETE FROM reviews; DELETE FROM places;
DELETE FROM destinations; DELETE FROM sessions; DELETE FROM uploads; DELETE FROM ai_cache; DELETE FROM users;
DELETE FROM meta;
DROP TABLE IF EXISTS places_fts;
CREATE VIRTUAL TABLE places_fts USING fts5(
  name, category, description, tags, neighborhood, destination, content='', tokenize='unicode61 remove_diacritics 2'
);
`;

export function seedDatabase(conn: DB, opts: SeedOptions = {}) {
  const log = opts.log ?? (() => {});
  const sources = loadSources();
  if (!sources.length) {
    log("[seed] no destination sources found — skipping seed");
    return;
  }
  const media = loadMedia();
  const bank = loadReviewBank();
  const t0 = Date.now();

  const tx = conn.transaction(() => {
    const seeded = conn.prepare("SELECT value FROM meta WHERE key='seeded_version'").get() as { value: string } | undefined;
    if (seeded?.value === SEED_VERSION && !opts.force) return false;
    conn.exec(WIPE);
    const R = rng("wayfarer-seed-2026");
    const users = seedUsers(conn, R);
    const places = seedPlaces(conn, sources, media, R);
    const reviews = generateReviews(places, users, bank, R);
    insertReviews(conn, reviews, users, places);
    computeAggregates(conn, places, reviews);
    seedQuestions(conn, places, users, R);
    buildSearchIndex(conn);
    seedDemoContent(conn, R);
    seedBusinessModel(conn, rng("wayfarer-business-2026"));
    conn.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded_version', ?), ('seeded_at', datetime('now'))").run(SEED_VERSION);
    return true;
  });
  const did = tx.immediate();
  if (did) {
    const counts = conn
      .prepare(
        "SELECT (SELECT COUNT(*) FROM destinations) d, (SELECT COUNT(*) FROM places) p, (SELECT COUNT(*) FROM reviews) r, (SELECT COUNT(*) FROM users) u"
      )
      .get() as { d: number; p: number; r: number; u: number };
    log(`[seed] ${counts.d} destinations, ${counts.p} places, ${counts.r} reviews, ${counts.u} users in ${Date.now() - t0} ms`);
  }
}

// ─────────────────────────────────────────────────────────────── users

interface SeedUser {
  id: number;
  createdAt: Date;
  weight: number;
}

function sqlDate(d: Date) {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function seedUsers(conn: DB, R: Rng) {
  const insert = conn.prepare(
    `INSERT INTO users (username, email, password_hash, display_name, avatar_color, bio, home_city, home_lat, home_lng, interests, role, is_demo, created_at)
     VALUES (@username, @email, @password_hash, @display_name, @avatar_color, @bio, @home_city, @home_lat, @home_lng, @interests, @role, @is_demo, @created_at)`
  );
  const now = Date.now();
  // Demo account (real login)
  insert.run({
    username: "demo",
    email: DEMO_EMAIL,
    password_hash: hashPassword(DEMO_PASSWORD),
    display_name: "Demo Traveler",
    avatar_color: "#0f766e",
    bio: "Exploring the world with Wayfarer. This is the demo account — feel free to write reviews and plan trips!",
    home_city: "London, UK",
    home_lat: 51.5072,
    home_lng: -0.1276,
    interests: JSON.stringify(["food", "culture", "architecture", "photography"]),
    // No admin in the seed: on a public install the README's demo login must not reach moderation or /admin.
    role: "user",
    is_demo: 0,
    created_at: sqlDate(new Date(now - 400 * 86400000)),
  });

  const users: SeedUser[] = [];
  const taken = new Set<string>(["demo"]);
  const N = 260;
  for (let i = 0; i < N; i++) {
    const first = R.pick(FIRST_NAMES);
    const last = R.pick(LAST_NAMES);
    const f = slugify(first).replace(/-/g, "");
    const l = slugify(last).replace(/-/g, "");
    const variants = [`${f}${l[0]}`, `${f}_${l}`, `${f}.travels`, `${f}${R.int(7, 99)}`, `${l}${f[0]}`, `wander${f}`, `${f}_on_tour`];
    let username = R.pick(variants);
    while (taken.has(username)) username = `${R.pick(variants)}${R.int(1, 999)}`;
    taken.add(username);
    const home = R.pick(HOME_CITIES);
    const createdAt = new Date(now - R.int(90, 2600) * 86400000);
    const info = insert.run({
      username,
      email: null,
      password_hash: null,
      display_name: `${first} ${last[0]}.`,
      avatar_color: R.pick(AVATAR_COLORS),
      bio: R.pick(BIOS) || null,
      home_city: home.name,
      home_lat: home.lat,
      home_lng: home.lng,
      interests: JSON.stringify(R.sample(["food", "culture", "history", "art", "nature", "nightlife", "beach", "adventure", "shopping", "relaxation"], 3)),
      role: "user",
      is_demo: 1,
      created_at: sqlDate(createdAt),
    });
    users.push({ id: Number(info.lastInsertRowid), createdAt, weight: 1 / Math.pow(i + 4, 0.85) });
  }
  return { list: users, weights: users.map((u) => u.weight), insert };
}

type Users = ReturnType<typeof seedUsers>;

// ─────────────────────────────────────────────────────────────── places & images

class ImagePicker {
  private usage = new Map<string, number>();
  constructor(private pools: Record<string, ImageRef[]>) {}
  pick(key: string, R: Rng, avoid: Set<string> = new Set()): ImageRef | null {
    const pool = (this.pools[key] || []).filter((i) => !avoid.has(i.url));
    if (!pool.length) return null;
    let best: ImageRef[] = [];
    let min = Infinity;
    for (const img of pool) {
      const u = this.usage.get(img.url) || 0;
      if (u < min) {
        min = u;
        best = [img];
      } else if (u === min) best.push(img);
    }
    const choice = R.pick(best);
    this.usage.set(choice.url, (this.usage.get(choice.url) || 0) + 1);
    avoid.add(choice.url);
    return choice;
  }
}

function cuisinePool(cuisine: string, priceLevel: number, tags: string[]): string {
  const c = cuisine.toLowerCase();
  const rules: [RegExp, string][] = [
    [/pizza|pasta|italian|trattoria|osteria|gelat|tuscan|roman|florentine|enoteca/, "food_italian"],
    [/sushi|ramen|izakaya|japanese|kaiseki|tempura|yakitori|udon|soba|tonkatsu|kissaten|omakase|okonomiyaki/, "food_japanese"],
    [/korean|kimchi|bibimbap|hanjeongsik|pojangmacha|galbi/, "food_korean"],
    [/vietnam|pho|phở|banh|bún|bun cha/, "food_vietnamese"],
    [/thai|isan|som tam/, "food_thai"],
    [/hawker|street|market|stall|food truck|night market|warung/, "street_food"],
    [/chinese|dim sum|cantonese|sichuan|dumpling|peranakan|nyonya/, "food_chinese"],
    [/indian|curry|tandoor|south asian/, "food_indian"],
    [/turkish|ottoman|anatolian|kebab|meyhane|meze/, "food_turkish"],
    [/greek|taverna|cycladic|aegean/, "food_greek"],
    [/moroccan|lebanese|middle eastern|egyptian|emirati|arab|levant|persian|tagine|mezze|koshary|bedouin|north african/, "food_middle_eastern"],
    [/french|bistro|brasserie|provençal|provencal/, "food_french"],
    [/tapas|spanish|catalan|paella|pintxo|basque|andalus/, "food_spanish"],
    [/mexican|taco|taquer|oaxac|mezcal|cantina|yucat/, "food_mexican"],
    [/peru|brazil|argentin|latin|empanada|andean|nikkei|colombian|churrasc|feijoada|novo-andina|novoandina|boteco|pisco/, "food_latin"],
    [/steak|asado|parrilla|grill|bbq|barbecue|braai|chophouse/, "food_grill"],
    [/seafood|fish|oyster|ceviche|crab|lobster|harbour|harbor/, "food_seafood"],
    [/vegan|vegetarian|plant/, "food_vegan"],
    [/bakery|pastry|patisserie|pâtisserie|boulangerie|cake/, "food_bakery"],
    [/brunch|breakfast|all-day/, "food_brunch"],
    [/café|cafe|coffee|tea house|teahouse|kaffee/, "cafe"],
    [/bar|cocktail|wine|pub|brew|speakeasy|tavern|beer/, "bar"],
  ];
  for (const [re, key] of rules) if (re.test(c)) return key;
  if (priceLevel >= 4 || tags.includes("fine-dining")) return "fine_dining";
  return "restaurant_interior";
}

const EXP_POOL: Record<string, string> = {
  Tour: "exp_tour",
  Class: "exp_class",
  Cruise: "exp_cruise",
  "Day Trip": "exp_daytrip",
  "Food Tour": "exp_food",
  Adventure: "exp_adventure",
  Wellness: "exp_wellness",
  Nightlife: "exp_nightlife",
};

function priceLevelFromUsd(type: PlaceType, usd: number) {
  if (type === "hotel") return usd < 90 ? 1 : usd < 200 ? 2 : usd < 380 ? 3 : 4;
  if (type === "attraction") return usd === 0 ? 1 : usd < 20 ? 1 : usd < 40 ? 2 : usd < 80 ? 3 : 4;
  return usd < 40 ? 1 : usd < 90 ? 2 : usd < 180 ? 3 : 4;
}

const ICONIC_TAG = "iconic";

function seedPlaces(conn: DB, sources: DestinationSource[], media: MediaFile, R: Rng): PlaceSeed[] {
  const insertDest = conn.prepare(
    `INSERT INTO destinations (slug, name, country, country_code, region, continent, lat, lng, tagline, description, wiki_extract, wiki_url, image, gallery, vibes, info, climate)
     VALUES (@slug, @name, @country, @country_code, @region, @continent, @lat, @lng, @tagline, @description, @wiki_extract, @wiki_url, @image, @gallery, @vibes, @info, @climate)`
  );
  const insertPlace = conn.prepare(
    `INSERT INTO places (slug, destination_id, type, name, category, description, wiki_extract, wiki_url, lat, lng, neighborhood, price_level, price_usd, image, gallery, tags, amenities, details)
     VALUES (@slug, @destination_id, @type, @name, @category, @description, @wiki_extract, @wiki_url, @lat, @lng, @neighborhood, @price_level, @price_usd, @image, @gallery, @tags, @amenities, @details)`
  );
  const picker = new ImagePicker(media.pools);
  const slugs = new Set<string>();
  const uniqueSlug = (base: string) => {
    let s = base;
    let i = 2;
    while (slugs.has(s)) s = `${base}-${i++}`;
    slugs.add(s);
    return s;
  };
  const out: PlaceSeed[] = [];

  for (const d of sources) {
    const page = media.pages[d.wiki];
    const attractionImgs = d.attractions.map((a) => media.pages[a.wiki]?.image).filter(Boolean) as ImageRef[];
    const destImage = page?.image || attractionImgs[0] || null;
    // City galleries use the landmarks' lead photos (curated, iconic) rather than random article images.
    const destGallery = [destImage, ...attractionImgs, ...(page?.gallery || []).slice(0, 2)]
      .filter(Boolean)
      .filter((x, i, arr) => arr.findIndex((y) => y!.url === x!.url) === i)
      .slice(0, 10) as ImageRef[];
    const { attractions, hotels, restaurants, experiences, slug, name, country, countryCode, region, continent, wiki, lat, lng, tagline, description, vibes, ...infoRest } = d;
    void attractions; void hotels; void restaurants; void experiences; void wiki;
    const destId = Number(
      insertDest.run({
        slug,
        name,
        country,
        country_code: countryCode,
        region: region || "",
        continent,
        lat,
        lng,
        tagline,
        description,
        wiki_extract: page?.extract || "",
        wiki_url: page?.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(d.wiki.replace(/ /g, "_"))}`,
        image: destImage ? JSON.stringify(destImage) : null,
        gallery: JSON.stringify(destGallery),
        vibes: JSON.stringify(vibes),
        info: JSON.stringify(infoRest),
        climate: JSON.stringify(media.climate[slug] || syntheticClimate(lat)),
      }).lastInsertRowid
    );

    // attractions first: they anchor everything else on the map
    const anchor = new Map<string, { lat: number; lng: number; image: ImageRef | null }>();
    const neighborhoodVotes = new Map<string, Map<string, number>>();
    const vote = (attr: string, hood: string) => {
      if (!hood) return;
      const m = neighborhoodVotes.get(attr) || new Map<string, number>();
      m.set(hood, (m.get(hood) || 0) + 1);
      neighborhoodVotes.set(attr, m);
    };
    for (const h of d.hotels) vote(h.nearAttraction, h.neighborhood);
    for (const r of d.restaurants) vote(r.nearAttraction, r.neighborhood);

    const base = (type: PlaceType, quality: number) => ({ type, quality, destSlug: slug, city: name, bestMonths: d.bestMonths || [], avoidMonths: d.avoidMonths || [] });

    for (const a of d.attractions) {
      const pm = media.pages[a.wiki];
      let plat = a.lat;
      let plng = a.lng;
      if (pm?.lat != null && pm?.lng != null && haversineKm({ lat: pm.lat, lng: pm.lng }, { lat: a.lat, lng: a.lng }) < 40) {
        plat = pm.lat;
        plng = pm.lng!;
      }
      const hoodMap = neighborhoodVotes.get(a.name);
      const neighborhood = hoodMap ? [...hoodMap.entries()].sort((x, y) => y[1] - x[1])[0][0] : "";
      const image = pm?.image || null;
      anchor.set(a.name, { lat: plat, lng: plng, image });
      const iconic = a.tags.includes(ICONIC_TAG);
      const quality = clamp(R.normal(iconic ? 4.5 : 4.3, iconic ? 0.18 : 0.28), 3.4, 4.92);
      const row = {
        slug: uniqueSlug(slugify(`${a.name}-${slug}`)),
        destination_id: destId,
        type: "attraction",
        name: a.name,
        category: a.category,
        description: a.description,
        wiki_extract: pm?.extract || "",
        wiki_url: pm?.url || "",
        lat: plat,
        lng: plng,
        neighborhood,
        price_level: priceLevelFromUsd("attraction", a.priceUSD),
        price_usd: a.priceUSD,
        image: image ? JSON.stringify(image) : null,
        gallery: JSON.stringify(pm?.gallery?.length ? pm.gallery : image ? [image] : []),
        tags: JSON.stringify(a.priceUSD === 0 && !a.tags.includes("free") ? [...a.tags, "free"] : a.tags),
        amenities: "[]",
        details: JSON.stringify({
          hours: a.hours,
          bookingTip: a.bookingTip,
          accessibility: a.accessibility,
          durationMin: a.durationMin,
          bestTime: a.bestTime,
          indoor: a.indoor,
          wikiTitle: a.wiki,
        }),
      };
      const id = Number(insertPlace.run(row).lastInsertRowid);
      out.push({
        ...base("attraction", quality),
        id,
        slug: row.slug,
        name: a.name,
        category: a.category,
        lat: plat,
        lng: plng,
        neighborhood,
        tags: JSON.parse(row.tags),
        amenities: [],
        priceUsd: a.priceUSD,
        nearby: "",
        gallery: JSON.parse(row.gallery),
        iconic,
        aspectQ: {},
        subcat: a.category,
      });
    }

    const near = (attrName: string, minM: number, maxM: number) => {
      const anc = anchor.get(attrName) || [...anchor.values()][0] || { lat, lng, image: null };
      const angle = R.next() * Math.PI * 2;
      const dist = R.int(minM, maxM);
      return { ...offsetMeters(anc, Math.cos(angle) * dist, Math.sin(angle) * dist), image: anc.image };
    };

    for (const h of d.hotels) {
      const pos = near(h.nearAttraction, 140, 650);
      const avoid = new Set<string>();
      const primaryKey = h.style === "Hostel" ? "hostel" : h.style === "Resort" ? "hotel_pool" : R.chance(0.55) ? "hotel_room" : "hotel_lobby";
      const gallery = [
        picker.pick(primaryKey, R, avoid),
        picker.pick(primaryKey === "hotel_room" ? "hotel_lobby" : "hotel_room", R, avoid),
        R.chance(0.6) ? picker.pick("hotel_bathroom", R, avoid) : null,
        h.amenities.includes("Pool") ? picker.pick("hotel_pool", R, avoid) : null,
        h.amenities.includes("Restaurant") || h.amenities.includes("Breakfast included") ? picker.pick(R.chance(0.5) ? "restaurant_interior" : "cafe", R, avoid) : null,
        h.amenities.includes("Bar") ? picker.pick("bar", R, avoid) : null,
        pos.image,
      ].filter(Boolean) as ImageRef[];
      const quality = clamp(R.normal(h.style === "Hostel" ? 4.0 : h.stars >= 5 ? 4.45 : 4.2, 0.32), 2.7, 4.9);
      const row = {
        slug: uniqueSlug(slugify(`${h.name}-${slug}`)),
        destination_id: destId,
        type: "hotel",
        name: h.name,
        category: `${h.style} hotel`.replace("Hostel hotel", "Hostel").replace("Apartment hotel", "Aparthotel").replace("Resort hotel", "Resort"),
        description: h.description,
        wiki_extract: "",
        wiki_url: "",
        lat: pos.lat,
        lng: pos.lng,
        neighborhood: h.neighborhood,
        price_level: priceLevelFromUsd("hotel", h.pricePerNightUSD),
        price_usd: h.pricePerNightUSD,
        image: gallery[0] ? JSON.stringify(gallery[0]) : null,
        gallery: JSON.stringify(gallery),
        tags: JSON.stringify(h.tags),
        amenities: JSON.stringify(h.amenities),
        details: JSON.stringify({ stars: h.stars, style: h.style, highlights: h.highlights, nearAttraction: h.nearAttraction }),
      };
      const id = Number(insertPlace.run(row).lastInsertRowid);
      out.push({
        ...base("hotel", quality),
        id,
        slug: row.slug,
        name: h.name,
        category: row.category,
        lat: pos.lat,
        lng: pos.lng,
        neighborhood: h.neighborhood,
        tags: h.tags,
        amenities: h.amenities,
        priceUsd: h.pricePerNightUSD,
        nearby: h.nearAttraction,
        gallery,
        iconic: false,
        aspectQ: {},
        subcat: h.style,
      });
    }

    for (const r of d.restaurants) {
      const pos = near(r.nearAttraction, 60, 480);
      const avoid = new Set<string>();
      const key = cuisinePool(r.cuisine, r.priceLevel, r.tags);
      const gallery = [
        picker.pick(key, R, avoid),
        picker.pick(key === "restaurant_interior" ? "fine_dining" : "restaurant_interior", R, avoid),
        picker.pick(key, R, avoid),
        r.tags.includes("wine") || /bar|wine|cocktail/i.test(r.cuisine) ? picker.pick("bar", R, avoid) : null,
        r.meals.includes("breakfast") ? picker.pick("cafe", R, avoid) : null,
        pos.image,
      ].filter(Boolean) as ImageRef[];
      const quality = clamp(R.normal(4.25, 0.33), 2.8, 4.9);
      const row = {
        slug: uniqueSlug(slugify(`${r.name}-${slug}`)),
        destination_id: destId,
        type: "restaurant",
        name: r.name,
        category: r.cuisine,
        description: r.description,
        wiki_extract: "",
        wiki_url: "",
        lat: pos.lat,
        lng: pos.lng,
        neighborhood: r.neighborhood,
        price_level: clamp(r.priceLevel, 1, 4),
        price_usd: [0, 15, 35, 70, 150][clamp(r.priceLevel, 1, 4)],
        image: gallery[0] ? JSON.stringify(gallery[0]) : null,
        gallery: JSON.stringify(gallery),
        tags: JSON.stringify(r.tags),
        amenities: "[]",
        details: JSON.stringify({ hours: r.hours, signatureDish: r.signatureDish, meals: r.meals, dietary: r.dietary, nearAttraction: r.nearAttraction }),
      };
      const id = Number(insertPlace.run(row).lastInsertRowid);
      out.push({
        ...base("restaurant", quality),
        id,
        slug: row.slug,
        name: r.name,
        category: r.cuisine,
        lat: pos.lat,
        lng: pos.lng,
        neighborhood: r.neighborhood,
        tags: r.tags,
        amenities: [],
        priceUsd: row.price_usd,
        dish: r.signatureDish,
        nearby: r.nearAttraction,
        gallery,
        iconic: false,
        aspectQ: {},
        subcat: r.cuisine,
      });
    }

    for (const e of d.experiences) {
      const pos = near(e.nearAttraction, 0, 160);
      const avoid = new Set<string>();
      const key = EXP_POOL[e.category] || "exp_tour";
      const gallery = [
        picker.pick(key, R, avoid),
        pos.image,
        picker.pick(key, R, avoid),
        e.category === "Food Tour" || e.category === "Class" ? picker.pick("street_food", R, avoid) : null,
      ].filter(Boolean) as ImageRef[];
      const quality = clamp(R.normal(4.4, 0.28), 3.2, 4.95);
      const row = {
        slug: uniqueSlug(slugify(`${e.name}-${slug}`)),
        destination_id: destId,
        type: "experience",
        name: e.name,
        category: e.category,
        description: e.description,
        wiki_extract: "",
        wiki_url: "",
        lat: pos.lat,
        lng: pos.lng,
        neighborhood: neighborhoodVotes.get(e.nearAttraction) ? [...neighborhoodVotes.get(e.nearAttraction)!.keys()][0] : "",
        price_level: priceLevelFromUsd("experience", e.priceUSD),
        price_usd: e.priceUSD,
        image: gallery[0] ? JSON.stringify(gallery[0]) : null,
        gallery: JSON.stringify(gallery),
        tags: JSON.stringify(e.tags),
        amenities: "[]",
        details: JSON.stringify({ durationMin: e.durationMin, includes: e.includes, bestTime: e.bestTime, nearAttraction: e.nearAttraction }),
      };
      const id = Number(insertPlace.run(row).lastInsertRowid);
      out.push({
        ...base("experience", quality),
        id,
        slug: row.slug,
        name: e.name,
        category: e.category,
        lat: pos.lat,
        lng: pos.lng,
        neighborhood: row.neighborhood,
        tags: e.tags,
        amenities: [],
        priceUsd: e.priceUSD,
        nearby: e.nearAttraction,
        gallery,
        iconic: false,
        aspectQ: {},
        subcat: e.category,
      });
    }

    // nearest attraction as "nearby" for attractions
    const attrs = out.filter((p) => p.destSlug === slug && p.type === "attraction");
    for (const a of attrs) {
      const other = attrs.filter((o) => o.id !== a.id).sort((x, y) => haversineKm(a, x) - haversineKm(a, y))[0];
      a.nearby = other?.name || name;
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────── reviews

function applicableAspects(p: PlaceSeed, bankType: BankType, R: Rng): string[] {
  const keys = Object.keys(bankType.aspects);
  const has = (k: string) => keys.includes(k);
  const tags = new Set(p.tags);
  const cat = p.category.toLowerCase();
  return keys.filter((k) => {
    if (p.type === "hotel") {
      if (k === "amenities") return p.amenities.some((a) => /Pool|Spa|Fitness|Sauna|Hot tub/.test(a));
      if (k === "breakfast") return p.amenities.includes("Breakfast included") || p.amenities.includes("Restaurant");
      if (k === "views") return tags.has("views") || tags.has("rooftop") || tags.has("waterfront") || /Luxury|Resort/.test(p.subcat);
    }
    if (p.type === "attraction") {
      if (k === "kids") return tags.has("family-friendly") || tags.has("kid-friendly") || R.chance(0.25);
      if (k === "queue") return p.iconic || p.priceUsd > 0;
      if (k === "history") return /museum|historic|religious|landmark|architecture|gallery|neighborhood/.test(cat) || tags.has("history");
      if (k === "views") return /viewpoint|nature|park|beach|landmark/.test(cat) || tags.has("views");
    }
    if (p.type === "experience") {
      if (k === "food") return /food|class|cruise|wine/i.test(p.category) || tags.has("foodie") || tags.has("wine");
      if (k === "safety") return /adventure|cruise|day trip/i.test(p.category);
    }
    return has(k);
  });
}

function initAspectQuality(p: PlaceSeed, aspects: string[], R: Rng) {
  const q: Record<string, number> = {};
  for (const k of aspects) {
    let v = p.quality + R.normal(0, 0.55);
    if (p.type === "attraction") {
      if ((k === "crowds" || k === "queue") && p.iconic) v -= 1.3;
      if (k === "value" && p.priceUsd === 0) v += 0.7;
      if (k === "views" && p.tags.includes("views")) v += 0.4;
    }
    if (p.type === "hotel") {
      if (k === "value" && /Luxury/.test(p.subcat)) v -= 0.5;
      if (k === "value" && /Budget|Hostel/.test(p.subcat)) v += 0.5;
      if (k === "room" && /Budget|Hostel/.test(p.subcat)) v -= 0.5;
      if (k === "noise" && /Hostel/.test(p.subcat)) v -= 0.9;
      if (k === "location") v += 0.35;
    }
    if (p.type === "restaurant") {
      if (k === "wait" && p.tags.includes("local-favorite")) v -= 0.7;
      if (k === "value" && p.priceUsd >= 150) v -= 0.4;
    }
    q[k] = clamp(v, 1.2, 5);
  }
  return q;
}

const SUB_RATING_MAP = SUB_RATINGS;

function tripTypeWeights(p: PlaceSeed): [TripType[], number[]] {
  const types: TripType[] = ["couples", "family", "friends", "solo", "business"];
  const w = [3, 2, 2.2, 1.3, p.type === "hotel" ? 1.2 : 0.4];
  if (p.tags.includes("romantic")) w[0] += 2.5;
  if (p.tags.includes("family-friendly") || p.tags.includes("kid-friendly")) w[1] += 2.5;
  if (p.tags.includes("nightlife") || p.tags.includes("lively")) w[2] += 2;
  if (p.tags.includes("budget") || /Hostel/.test(p.subcat)) {
    w[3] += 2;
    w[2] += 1;
  }
  if (p.tags.includes("workspace") || p.amenities.includes("Business center")) w[4] += 2;
  return [types, w];
}

function fill(template: string, vars: Record<string, string>) {
  let s = template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
  s = s.replace(/\s+([,.!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pickTemplate(list: string[], R: Rng, solo: boolean) {
  const usable = solo ? list.filter((t) => !t.includes("{companion}")) : list;
  return R.pick(usable.length ? usable : list);
}

function generateReviews(places: PlaceSeed[], users: Users, bank: ReviewBank, R: Rng): GenReview[] {
  const out: GenReview[] = [];
  const now = new Date();
  const foreignByType = new Map<PlaceType, ReviewBank["foreign"]>();
  for (const f of bank.foreign || []) foreignByType.set(f.type, [...(foreignByType.get(f.type) || []), f]);

  for (const p of places) {
    const bt = bank.types[p.type];
    if (!bt) continue;
    const aspects = applicableAspects(p, bt, R);
    p.aspectQ = initAspectQuality(p, aspects, R);
    const n =
      p.type === "attraction" ? (p.iconic ? R.int(26, 42) : R.int(13, 26)) : p.type === "hotel" ? R.int(12, 26) : p.type === "restaurant" ? R.int(10, 24) : R.int(8, 18);
    const [tt, tw] = tripTypeWeights(p);

    for (let i = 0; i < n; i++) {
      // visit date, seasonally weighted
      const monthsAgo = R.weighted(
        Array.from({ length: 36 }, (_, k) => k + 1),
        Array.from({ length: 36 }, (_, k) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (k + 1), 1);
          const m = d.getMonth() + 1;
          const seasonal = p.bestMonths.includes(m) ? 1.7 : p.avoidMonths.includes(m) ? 0.55 : 1;
          return seasonal * (1 + (36 - k) / 36); // more recent reviews are more common
        })
      );
      const visit = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      const visitDate = `${visit.getFullYear()}-${String(visit.getMonth() + 1).padStart(2, "0")}`;
      const created = new Date(visit.getTime() + R.int(20, 50) * 86400000 + R.int(0, 86399) * 1000);
      if (created > now) created.setTime(now.getTime() - R.int(1, 5) * 86400000);
      const tripType = R.weighted(tt, tw);
      const vars = {
        place: p.name,
        city: p.city,
        neighborhood: p.neighborhood || "the neighbourhood",
        dish: p.dish || "the house speciality",
        nearby: p.nearby || p.city,
        companion: R.pick(COMPANIONS[tripType]),
        month: MONTHS[visit.getMonth()],
        staff: R.pick(STAFF_NAMES),
      };

      // suspicious (fake-looking) review
      if (R.chance(0.028) && bank.suspicious?.bodies?.length) {
        out.push({
          placeId: p.id,
          userId: -1, // burner account created at insert time
          rating: R.chance(0.85) ? 5 : 1,
          title: fill(R.pick(bank.suspicious.titles), vars),
          body: fill(R.pick(bank.suspicious.bodies), vars),
          tripType,
          visitDate,
          subRatings: {},
          language: "en",
          translation: null,
          helpful: 0,
          ownerResponse: null,
          photos: [],
          createdAt: sqlDate(created),
          suspicious: true,
          aspectHits: 0,
        });
        continue;
      }

      const userId = R.weighted(users.list, users.weights).id;
      const foreignPool = foreignByType.get(p.type) || [];
      if (foreignPool.length && R.chance(0.04)) {
        const f = R.pick(foreignPool);
        out.push({
          placeId: p.id,
          userId,
          rating: f.rating,
          title: fill(f.title, vars),
          body: fill(f.text, vars),
          tripType,
          visitDate,
          subRatings: subRatingsFor(p, f.rating, R),
          language: f.lang,
          translation: { title: fill(f.english_title, vars), body: fill(f.english, vars) },
          helpful: R.int(0, 6),
          ownerResponse: null,
          photos: [],
          createdAt: sqlDate(created),
          suspicious: false,
          aspectHits: 2,
        });
        continue;
      }

      // rating: J-shaped around the place's latent quality
      let x = p.quality + R.normal(0, 0.72) + ((userId % 7) - 3) * 0.06;
      if (R.chance(0.045) && p.quality < 4.7) x = 1 + R.next() * 1.4;
      const rating = clamp(Math.round(x), 1, 5);
      const tone = rating >= 4 ? "positive" : rating === 3 ? "mixed" : "negative";
      const solo = tripType === "solo";

      const sentences: string[] = [];
      if (R.chance(0.85)) sentences.push(fill(pickTemplate(bt.openers[tone], R, solo), vars));
      const chosen = R.sample(aspects, R.int(2, Math.min(4, aspects.length)));
      for (const k of chosen) {
        const a = bt.aspects[k];
        const s = p.aspectQ[k] + R.normal(0, 0.5) + (rating - p.quality) * 0.75;
        let tone3: "positive" | "neutral" | "negative" = s >= 3.8 ? "positive" : s >= 2.9 ? "neutral" : "negative";
        // keep sentences consistent with the overall star rating
        if (rating === 5 && tone3 === "negative") tone3 = "neutral";
        if (rating <= 2 && tone3 === "positive") tone3 = "neutral";
        const list = a[tone3];
        if (list?.length) sentences.push(fill(pickTemplate(list, R, solo), vars));
      }
      if (R.chance(0.3) && bt.tips?.length) sentences.push(`Tip: ${fill(R.pick(bt.tips), vars).replace(/^Tip:\s*/i, "")}`);
      if (R.chance(0.7)) sentences.push(fill(pickTemplate(bt.closers[tone], R, solo), vars));
      const unique = sentences.filter((s, idx) => sentences.indexOf(s) === idx);
      const body =
        unique.length >= 5
          ? `${unique.slice(0, Math.ceil(unique.length / 2)).join(" ")}\n\n${unique.slice(Math.ceil(unique.length / 2)).join(" ")}`
          : unique.join(" ");

      const helpful = Math.min(90, Math.floor(Math.max(0, R.normal(0.3, 1.5)) ** 2 * (0.5 + body.length / 500)));
      const ownerP = p.type === "attraction" ? 0 : rating <= 2 ? 0.55 : rating === 3 ? 0.35 : 0.1;
      const ownerResponse = R.chance(ownerP) ? fill(R.pick(OWNER_RESPONSES[tone]), vars) : null;
      const photos = R.chance(0.16) && p.gallery.length ? R.sample(p.gallery, R.int(1, Math.min(3, p.gallery.length))).map((g) => imgUrl(g, 960)!) : [];

      out.push({
        placeId: p.id,
        userId,
        rating,
        title: fill(pickTemplate(bt.titles[tone], R, solo), vars),
        body,
        tripType,
        visitDate,
        subRatings: subRatingsFor(p, rating, R),
        language: "en",
        translation: null,
        helpful,
        ownerResponse,
        photos,
        createdAt: sqlDate(created),
        suspicious: false,
        aspectHits: new Set(splitSentences(body).flatMap((s) => detectAspects(p.type, s))).size,
      });
    }
  }
  return out;
}

function subRatingsFor(p: PlaceSeed, rating: number, R: Rng) {
  const out: Record<string, number> = {};
  for (const [label, keys] of SUB_RATING_MAP[p.type]) {
    const vals = keys.map((k) => p.aspectQ[k]).filter((v) => v != null);
    const base = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : p.quality;
    out[label] = clamp(Math.round(base + R.normal(0, 0.45) + (rating - p.quality) * 0.55), 1, 5);
  }
  return out;
}

function insertReviews(conn: DB, reviews: GenReview[], users: Users, places: PlaceSeed[]) {
  const R = rng("burners");
  const now = Date.now();
  const userCreated = new Map(users.list.map((u) => [u.id, u.createdAt]));
  const counts = new Map<number, number>();
  for (const r of reviews) if (r.userId > 0) counts.set(r.userId, (counts.get(r.userId) || 0) + 1);
  const placeById = new Map(places.map((p) => [p.id, p]));

  const insert = conn.prepare(
    `INSERT INTO reviews (place_id, user_id, rating, title, body, trip_type, visit_date, sub_ratings, language, translation, helpful_count, trust_score, trust_flags, status, owner_response, photos, created_at)
     VALUES (@place_id, @user_id, @rating, @title, @body, @trip_type, @visit_date, @sub_ratings, @language, @translation, @helpful_count, @trust_score, @trust_flags, @status, @owner_response, @photos, @created_at)`
  );
  for (const r of reviews) {
    let userId = r.userId;
    let accountAgeDays: number;
    if (r.suspicious) {
      const created = new Date(new Date(r.createdAt.replace(" ", "T") + "Z").getTime() - R.int(0, 6) * 86400000);
      userId = Number(
        users.insert.run({
          username: `traveler${R.int(10000, 999999)}${R.int(0, 9)}`,
          email: null,
          password_hash: null,
          display_name: `Traveler ${R.int(100, 9999)}`,
          avatar_color: "#64748b",
          bio: null,
          home_city: null,
          home_lat: null,
          home_lng: null,
          interests: "[]",
          role: "user",
          is_demo: 1,
          created_at: sqlDate(created),
        }).lastInsertRowid
      );
      accountAgeDays = (new Date(r.createdAt.replace(" ", "T") + "Z").getTime() - created.getTime()) / 86400000;
    } else {
      const c = userCreated.get(userId)!;
      accountAgeDays = (new Date(r.createdAt.replace(" ", "T") + "Z").getTime() - c.getTime()) / 86400000;
      if (accountAgeDays < 0) accountAgeDays = (now - c.getTime()) / 86400000;
    }
    const trust = scoreReviewTrust({
      title: r.title,
      body: r.body,
      rating: r.rating,
      userReviewCount: r.suspicious ? 1 : counts.get(userId) || 1,
      accountAgeDays,
      aspectHits: r.aspectHits,
    });
    const p = placeById.get(r.placeId)!;
    void p;
    insert.run({
      place_id: r.placeId,
      user_id: userId,
      rating: r.rating,
      title: r.title,
      body: r.body,
      trip_type: r.tripType,
      visit_date: r.visitDate,
      sub_ratings: JSON.stringify(r.subRatings),
      language: r.language,
      translation: r.translation ? JSON.stringify(r.translation) : null,
      helpful_count: r.helpful,
      trust_score: trust.score,
      trust_flags: JSON.stringify(trust.flags),
      status: trust.score < TRUST_HOLD_THRESHOLD ? "flagged" : "published",
      owner_response: r.ownerResponse,
      photos: JSON.stringify(r.photos),
      created_at: r.createdAt,
    });
  }
}

// ─────────────────────────────────────────────────────────────── aggregates

export function computeAggregates(conn: DB, places?: PlaceSeed[], reviews?: GenReview[]) {
  void places;
  void reviews;
  recomputePlaceStats(conn);
}

/**
 * Recomputes ratings, rankings, awards and aspect scores. With placeIds the work is scoped to
 * those places plus the destination/type groups they belong to (rankings are per group, awards
 * and the Bayesian prior are per type); without it, everything is rebuilt (the seed path).
 */
export function recomputePlaceStats(conn: DB, placeIds?: number[]) {
  const TYPES = ["hotel", "restaurant", "attraction", "experience"] as const;
  const stats = conn
    .prepare(
      `SELECT place_id, COUNT(*) n, AVG(rating) avg FROM reviews WHERE status = 'published' ${placeIds ? `AND place_id IN (${placeIds.map(Number).join(",")})` : ""} GROUP BY place_id`
    )
    .all() as { place_id: number; n: number; avg: number }[];
  const upd = conn.prepare("UPDATE places SET rating = ?, review_count = ?, aspect_scores = ? WHERE id = ?");
  const subStmt = conn.prepare("SELECT sub_ratings FROM reviews WHERE place_id = ? AND status = 'published'");
  if (placeIds) for (const id of placeIds) conn.prepare("UPDATE places SET rating = 0, review_count = 0 WHERE id = ?").run(id);
  for (const s of stats) {
    const acc: Record<string, { sum: number; n: number }> = {};
    for (const row of subStmt.all(s.place_id) as { sub_ratings: string }[]) {
      const sr = JSON.parse(row.sub_ratings || "{}") as Record<string, number>;
      for (const [k, v] of Object.entries(sr)) {
        acc[k] = acc[k] || { sum: 0, n: 0 };
        acc[k].sum += v;
        acc[k].n++;
      }
    }
    const aspects = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, Math.round((v.sum / v.n) * 10) / 10]));
    upd.run(Math.round(s.avg * 100) / 100, s.n, JSON.stringify(aspects), s.place_id);
  }

  // Only the types touched by this change need a re-rank; the Bayesian prior stays global-per-type.
  const touched = TYPES.filter((t) => (placeIds ? (conn.prepare(`SELECT type FROM places WHERE id IN (${placeIds.map(Number).join(",")})`).all() as { type: PlaceType }[]).some((p) => p.type === t) : true));
  if (!touched.length) return;
  const ph = touched.map(() => "?").join(",");

  const typeMean: Record<string, number> = {};
  for (const r of conn
    .prepare(`SELECT type, SUM(rating * review_count) num, SUM(review_count) den FROM places WHERE type IN (${ph}) AND review_count > 0 GROUP BY type`)
    .all(...touched) as { type: string; num: number; den: number }[]) {
    typeMean[r.type] = r.num / Math.max(1, r.den) || 4;
  }
  const C = 8;
  const bayes = (p: { type: string; rating: number; review_count: number }) => (C * (typeMean[p.type] || 4) + p.rating * p.review_count) / (C + p.review_count);

  const all = conn.prepare(`SELECT id, destination_id, type, rating, review_count FROM places WHERE type IN (${ph})`).all(...touched) as {
    id: number;
    destination_id: number;
    type: PlaceType;
    rating: number;
    review_count: number;
  }[];

  // rankings per destination & type — only the groups the touched places live in.
  const groups = new Map<string, typeof all>();
  for (const p of all) {
    const k = `${p.destination_id}:${p.type}`;
    groups.set(k, [...(groups.get(k) || []), p]);
  }
  const rank = conn.prepare("UPDATE places SET ranking = ?, ranking_total = ? WHERE id = ?");
  const affectedGroups = new Set(
    (placeIds ? (conn.prepare(`SELECT destination_id, type FROM places WHERE id IN (${placeIds.map(Number).join(",")})`).all() as { destination_id: number; type: PlaceType }[]) : []).map((p) => `${p.destination_id}:${p.type}`)
  );
  for (const [k, list] of groups) {
    if (placeIds && !affectedGroups.has(k)) continue;
    list.sort((a, b) => bayes(b) - bayes(a)).forEach((p, i) => rank.run(i + 1, list.length, p.id));
  }

  // awards (positions are per type across the whole catalogue, so every place of a touched type re-ranks)
  const awardStmt = conn.prepare("UPDATE places SET awards = ? WHERE id = ?");
  const recent = new Map(
    (
      conn
        .prepare(
          `SELECT r.place_id, SUM(CASE WHEN r.created_at >= datetime('now','-120 days') THEN 1 ELSE 0 END) * 1.0 / COUNT(*) share FROM reviews r JOIN places p ON p.id = r.place_id WHERE r.status='published' AND p.type IN (${ph}) GROUP BY r.place_id`
        )
        .all(...touched) as { place_id: number; share: number }[]
    ).map((r) => [r.place_id, r.share])
  );
  for (const t of touched) {
    const xs = all.filter((p) => p.type === t).sort((a, b) => bayes(b) - bayes(a));
    const median = [...xs].sort((a, b) => a.review_count - b.review_count)[Math.floor(xs.length / 2)]?.review_count || 0;
    xs.forEach((p, i) => {
      const awards: string[] = [];
      const pct = i / xs.length;
      if (pct < 0.04 && p.rating >= 4.5) awards.push("best-of-the-best");
      if (pct < 0.22 && p.rating >= 4.3) awards.push("travelers-choice");
      if (p.rating >= 4.5 && p.review_count > 0 && p.review_count < median) awards.push("hidden-gem");
      if ((recent.get(p.id) || 0) > 0.3 && p.rating >= 4.0) awards.push("trending");
      awardStmt.run(JSON.stringify(awards), p.id);
    });
  }

  // destination popularity — only the destinations that were touched (all on the seed path)
  const destPh = placeIds ? `WHERE destinations.id IN (SELECT destination_id FROM places WHERE id IN (${placeIds.map(Number).join(",")}))` : "";
  conn.exec(
    `UPDATE destinations SET popularity = (SELECT COALESCE(SUM(review_count),0) FROM places WHERE places.destination_id = destinations.id) ${destPh}`
  );
}

// ─────────────────────────────────────────────────────────────── Q&A

const QUESTIONS: Record<PlaceType, { q: string; a: (p: PlaceSeed) => string }[]> = {
  hotel: [
    {
      q: "Is breakfast included in the room rate?",
      a: (p) =>
        p.amenities.includes("Breakfast included")
          ? "Yes, breakfast was included for us and it was a proper spread — worth getting down before 9 when it's quieter."
          : "It wasn't included on our booking. There are plenty of cafés nearby though, so we didn't miss it.",
    },
    {
      q: "How far is it from the main sights?",
      a: (p) => `Very central — we walked to ${p.nearby} in about ${5 + (p.id % 12)} minutes. Public transport is close too.`,
    },
    {
      q: "Is there parking or an airport shuttle?",
      a: (p) =>
        p.amenities.includes("Airport shuttle")
          ? "They run an airport shuttle — book it a day ahead through reception."
          : p.amenities.includes("Parking")
            ? "There's on-site parking for a daily fee; ask for a space when you book."
            : "No shuttle or parking when we stayed. A taxi or public transport from the airport was easy enough.",
    },
    {
      q: "Is it suitable for families with young kids?",
      a: (p) =>
        p.amenities.includes("Family rooms") || p.tags.includes("family-friendly")
          ? "Absolutely — we had a family room and the staff brought a cot without us asking."
          : "It's more geared to couples, rooms are on the smaller side. Doable with one child though.",
    },
  ],
  restaurant: [
    {
      q: "Do they have vegetarian or vegan options?",
      a: () => "Yes, there were several vegetarian dishes on the menu and the staff were happy to adapt things.",
    },
    {
      q: "Do I need a reservation?",
      a: (p) => (p.priceUsd >= 70 ? "Definitely book ahead, especially for weekend dinners — we reserved a week in advance." : "We walked in at lunchtime without a problem, but evenings get busy so booking helps."),
    },
    {
      q: "What should I order?",
      a: (p) => `Don't leave without trying the ${p.dish || "house speciality"}. Ask about the daily specials too.`,
    },
  ],
  attraction: [
    {
      q: "Do I need to book tickets in advance?",
      a: (p) => (p.priceUsd > 0 ? "Yes, booking a timed slot online saved us a long queue at the entrance." : "It's free to visit — no booking needed, just arrive early to beat the crowds."),
    },
    {
      q: "How much time should I plan for a visit?",
      a: () => "We spent about two hours and felt that was right. Add more if you want to take it slowly.",
    },
    {
      q: "Is it wheelchair accessible?",
      a: () => "Most of the main areas are accessible, though a few sections have steps. Staff were very helpful.",
    },
    {
      q: "What's the best time of day to visit?",
      a: () => "Go right at opening or in the last hour before closing — mid-day is the busiest.",
    },
  ],
  experience: [
    {
      q: "What's included in the price?",
      a: () => "Everything listed was included, and our guide threw in a few extra stops. Bring cash for tips.",
    },
    {
      q: "Is it suitable for kids?",
      a: (p) => (p.tags.includes("family-friendly") || p.tags.includes("kid-friendly") ? "Yes! Our 8-year-old loved it." : "I'd say it's better for adults and teens — the pace is fairly brisk."),
    },
    {
      q: "What happens if it rains?",
      a: () => "They'll either run it with adjustments or offer a free reschedule — check the weather the day before.",
    },
  ],
};

function seedQuestions(conn: DB, places: PlaceSeed[], users: Users, R: Rng) {
  const insQ = conn.prepare("INSERT INTO questions (place_id, user_id, body, created_at) VALUES (?, ?, ?, ?)");
  const insA = conn.prepare("INSERT INTO answers (question_id, user_id, body, is_ai, created_at) VALUES (?, ?, ?, 0, ?)");
  const now = Date.now();
  for (const p of places) {
    if (!R.chance(0.55)) continue;
    const qs = R.sample(QUESTIONS[p.type], R.int(1, 3));
    for (const q of qs) {
      const asked = new Date(now - R.int(20, 700) * 86400000);
      const qid = Number(insQ.run(p.id, R.weighted(users.list, users.weights).id, q.q, sqlDate(asked)).lastInsertRowid);
      const nAns = R.int(1, 2);
      for (let i = 0; i < nAns; i++) {
        const answered = new Date(Math.min(now, asked.getTime() + R.int(1, 30) * 86400000));
        insA.run(qid, R.weighted(users.list, users.weights).id, q.a(p), sqlDate(answered));
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────── search index

export function buildSearchIndex(conn: DB) {
  conn.exec(`
    INSERT INTO places_fts (rowid, name, category, description, tags, neighborhood, destination)
    SELECT p.id, p.name, p.category, p.description, REPLACE(REPLACE(REPLACE(p.tags, '[', ''), ']', ''), '"', ''), p.neighborhood, d.name || ' ' || d.country
    FROM places p JOIN destinations d ON d.id = p.destination_id
  `);
}
