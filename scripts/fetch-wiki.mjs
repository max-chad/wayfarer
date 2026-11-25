#!/usr/bin/env node
// Data-prep script: enriches the hand-written destination sources with
//   - Wikipedia extracts, coordinates and freely-licensed lead/gallery photos
//   - Wikimedia Commons "Quality images" photo pools for fictional hotels/restaurants/experiences
//   - 3-year monthly climate normals from the Open-Meteo archive API
// Results are cached in data/generated/media.json so re-runs only fetch what is missing.
// Usage: node scripts/fetch-wiki.mjs [--force] [--only=pages|pools|climate]

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "data", "source", "destinations");
const OUT_FILE = path.join(ROOT, "data", "generated", "media.json");
const UA = "WayfarerTravelDemo/1.0 (educational travel-site demo; https://www.mediawiki.org/wiki/API:Etiquette)";
const WIKI_API = "https://en.wikipedia.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const ONLY = [...args].find((a) => a.startsWith("--only="))?.split("=")[1];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, params, attempt = 0) {
  const qs = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const full = params ? `${url}?${qs}` : url;
  try {
    const res = await fetch(full, { headers: { "User-Agent": UA, "Api-User-Agent": UA } });
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const err = new Error(`HTTP ${res.status}`);
      err.wait = Math.max(retryAfter * 1000, 5000 * 2 ** attempt);
      throw err;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${full}`);
    return await res.json();
  } catch (err) {
    if (attempt < 6) {
      const wait = err.wait || 1000 * 2 ** attempt;
      console.warn(`  retry in ${Math.round(wait / 1000)}s (${err.message})`);
      await sleep(wait);
      return getJson(url, params, attempt + 1);
    }
    throw err;
  }
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const BAD_FILE = /(logo|map|flag|coat[_ ]of[_ ]arms|icon|seal|locator|location|diagram|plan\b|floor[_ ]?plan|signature|symbol|emblem|banner|chart|graph|wordmark|stamp|commons-|question_book|ambox|edit-clear|wiki|portal|padlock|crystal|nuvola|disambig|p_vip|increase|decrease|steady|red_pog|blue_pog|compass)/i;

function cleanUrl(u) {
  if (!u) return u;
  return u.split("?")[0];
}

function stripHtml(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function toImageRef(title, info) {
  if (!info) return null;
  const meta = info.extmetadata || {};
  if (meta.NonFree && String(meta.NonFree.value).toLowerCase() === "true") return null;
  const license = stripHtml(meta.LicenseShortName?.value || "");
  if (!license || /fair use|non-free/i.test(license)) return null;
  if (!/^image\/(jpeg|png|webp)$/.test(info.mime || "")) return null;
  const url = info.width > 1280 && info.thumburl ? cleanUrl(info.thumburl) : cleanUrl(info.url);
  return {
    url,
    w: info.width,
    h: info.height,
    author: stripHtml(meta.Artist?.value || "Unknown").slice(0, 90),
    license,
    source: cleanUrl(info.descriptionurl) || `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
  };
}

async function imageInfo(api, fileTitles) {
  const out = {};
  for (const group of chunk([...new Set(fileTitles)], 45)) {
    const data = await getJson(api, {
      action: "query",
      titles: group.join("|"),
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiextmetadatafilter: "Artist|LicenseShortName|NonFree",
      iiurlwidth: "1280",
    });
    const norm = new Map((data.query?.normalized || []).map((n) => [n.to, n.from]));
    for (const p of data.query?.pages || []) {
      const info = p.imageinfo?.[0];
      const ref = toImageRef(p.title, info);
      out[p.title] = ref;
      if (norm.has(p.title)) out[norm.get(p.title)] = ref;
    }
    await sleep(400);
  }
  return out;
}

// ---------------------------------------------------------------- pages
async function fetchPages(titles, cache) {
  const todo = titles.filter((t) => FORCE || !cache[t]);
  console.log(`[pages] ${titles.length} titles, ${todo.length} to fetch`);
  if (!todo.length) return;

  // 1. page props + coordinates + description + page image
  const pageData = {};
  const resolve = {}; // original title -> final title
  for (const group of chunk(todo, 40)) {
    const data = await getJson(WIKI_API, {
      action: "query",
      titles: group.join("|"),
      prop: "pageimages|coordinates|description",
      piprop: "name",
      redirects: "1",
    });
    const map = {};
    for (const n of data.query?.normalized || []) map[n.from] = n.to;
    const redir = {};
    for (const r of data.query?.redirects || []) redir[r.from] = r.to;
    for (const t of group) {
      let f = map[t] || t;
      f = redir[f] || f;
      resolve[t] = f;
    }
    for (const p of data.query?.pages || []) {
      pageData[p.title] = {
        missing: !!p.missing,
        description: p.description || "",
        lat: p.coordinates?.[0]?.lat ?? null,
        lng: p.coordinates?.[0]?.lon ?? null,
        pageimage: p.pageimage ? `File:${p.pageimage}` : null,
      };
    }
    await sleep(400);
  }

  // 2. intro extracts (max 20 per request)
  const finals = [...new Set(Object.values(resolve))].filter((t) => pageData[t] && !pageData[t].missing);
  for (const group of chunk(finals, 20)) {
    const data = await getJson(WIKI_API, {
      action: "query",
      titles: group.join("|"),
      prop: "extracts",
      exintro: "1",
      explaintext: "1",
      exsentences: "5",
      exlimit: "20",
    });
    for (const p of data.query?.pages || []) if (pageData[p.title]) pageData[p.title].extract = (p.extract || "").trim();
    await sleep(400);
  }

  // 3. image lists (per page, handles continuation)
  const imageLists = {};
  for (const group of chunk(finals, 8)) {
    let cont = {};
    for (let guard = 0; guard < 10; guard++) {
      const data = await getJson(WIKI_API, {
        action: "query",
        titles: group.join("|"),
        prop: "images",
        imlimit: "max",
        ...cont,
      });
      for (const p of data.query?.pages || []) {
        imageLists[p.title] = [...(imageLists[p.title] || []), ...(p.images || []).map((i) => i.title)];
      }
      if (!data.continue) break;
      cont = data.continue;
      await sleep(300);
    }
    await sleep(400);
  }

  // 4. choose candidates and resolve their licensing/size
  const candidatesByPage = {};
  const allFiles = [];
  for (const t of finals) {
    const words = t
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .split(/[\s,\-–]+/)
      .filter((w) => w.length > 3);
    const lead = pageData[t].pageimage;
    const list = (imageLists[t] || []).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !BAD_FILE.test(f));
    const scored = list
      .map((f) => ({ f, s: words.reduce((acc, w) => acc + (f.toLowerCase().includes(w) ? 2 : 0), 0) + (/\.jpe?g$/i.test(f) ? 1 : 0) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.f);
    const cands = [];
    if (lead && !BAD_FILE.test(lead) && !/\.svg$/i.test(lead)) cands.push(lead);
    for (const f of scored) if (!cands.includes(f) && cands.length < 10) cands.push(f);
    candidatesByPage[t] = cands;
    allFiles.push(...cands);
  }
  const infos = await imageInfo(WIKI_API, allFiles);

  for (const orig of todo) {
    const t = resolve[orig];
    const pd = pageData[t];
    if (!pd || pd.missing) {
      cache[orig] = { missing: true };
      console.warn(`  ! missing page: ${orig}`);
      continue;
    }
    const refs = (candidatesByPage[t] || []).map((f) => infos[f]).filter((r) => r && r.w >= 800);
    const lead = pd.pageimage && infos[pd.pageimage] && infos[pd.pageimage].w >= 800 ? infos[pd.pageimage] : null;
    const landscape = refs.filter((r) => r.w >= r.h * 1.15);
    const image = lead && lead.w >= lead.h * 0.9 ? lead : landscape[0] || lead || refs[0] || null;
    const gallery = [image, ...landscape, ...refs].filter(Boolean).filter((r, i, a) => a.findIndex((x) => x.url === r.url) === i).slice(0, 6);
    cache[orig] = {
      title: t,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_"))}`,
      description: pd.description,
      extract: pd.extract || "",
      lat: pd.lat,
      lng: pd.lng,
      image,
      gallery,
    };
    if (!image) console.warn(`  ! no usable image: ${orig}`);
  }
}

// ---------------------------------------------------------------- commons pools
const POOLS = {
  hotel_room: ["hotel room interior", "hotel bedroom", "hotel suite bedroom", "guest room bed hotel"],
  hotel_lobby: ["hotel lobby interior", "hotel lounge interior", "hotel reception lobby"],
  hotel_pool: ["hotel swimming pool", "resort swimming pool", "infinity pool"],
  hotel_bathroom: ["hotel bathroom interior"],
  hostel: ["hostel dormitory", "hostel interior", "bunk beds room"],
  restaurant_interior: ["restaurant interior", "restaurant dining room", "bistro interior", "brasserie interior"],
  cafe: ["cafe interior", "coffee latte art", "croissant pastry", "cafe breakfast table"],
  bar: ["cocktail bar interior", "cocktail glass drink", "wine bar"],
  fine_dining: ["fine dining plated dish", "haute cuisine dish", "gourmet dish plate"],
  street_food: ["street food stall", "night market food stall", "food cart vendor"],
  food_italian: ["pasta dish", "pizza margherita", "risotto dish", "gelato"],
  food_japanese: ["sushi platter", "ramen bowl", "tempura dish", "japanese cuisine meal"],
  food_french: ["french cuisine dish", "steak frites", "french pastries"],
  food_spanish: ["tapas", "paella", "pintxos"],
  food_mexican: ["tacos", "mexican cuisine dish", "mole dish"],
  food_thai: ["thai cuisine dish", "pad thai", "green curry"],
  food_vietnamese: ["pho noodle soup", "banh mi", "vietnamese cuisine"],
  food_korean: ["korean cuisine", "bibimbap", "korean barbecue"],
  food_chinese: ["dim sum", "chinese cuisine dish", "dumplings"],
  food_indian: ["indian thali", "curry dish", "biryani"],
  food_middle_eastern: ["mezze platter", "tagine dish", "kebab grill", "hummus plate"],
  food_seafood: ["seafood platter", "grilled fish dish", "oysters plate"],
  food_grill: ["asado grill meat", "grilled steak dish", "barbecue grill"],
  food_latin: ["ceviche", "empanadas", "feijoada", "arepas"],
  food_greek: ["greek salad", "souvlaki", "moussaka"],
  food_turkish: ["turkish breakfast", "baklava", "meze turkish"],
  food_brunch: ["brunch plate", "avocado toast", "pancakes breakfast"],
  food_vegan: ["vegan dish", "salad bowl", "buddha bowl"],
  food_bakery: ["bakery bread", "pastries display", "cake slice"],
  exp_tour: ["walking tour group", "tour guide tourists", "guided tour old town"],
  exp_class: ["cooking class", "pottery workshop", "cooking workshop"],
  exp_cruise: ["river cruise boat", "sailing boat sunset", "tour boat harbour"],
  exp_daytrip: ["scenic road landscape", "countryside landscape vineyard", "mountain panorama"],
  exp_food: ["food market", "market stall vegetables", "cheese market stall"],
  exp_adventure: ["kayaking", "hiking trail mountains", "hot air balloon", "mountain biking", "zip line"],
  exp_wellness: ["spa massage", "yoga outdoor", "hot spring bath", "thermal bath"],
  exp_nightlife: ["live music concert", "night club lights", "city skyline night", "jazz club"],
};

const BRAND = /(marriott|hilton|hyatt|sheraton|ritz|four seasons|intercontinental|radisson|novotel|ibis|accor|aman|mandarin oriental|shangri|westin|kempinski|fairmont|sofitel|mcdonald|starbucks|burger king|kfc|subway|holiday inn|best western|hard rock|marina bay sands|raffles|peninsula)/i;

async function fetchPool(key, queries) {
  const seen = new Set();
  const refs = [];
  for (const q of queries) {
    for (const variant of [`${q} incategory:Quality_images`, `${q} filetype:bitmap`]) {
      const data = await getJson(COMMONS_API, {
        action: "query",
        generator: "search",
        gsrsearch: variant,
        gsrnamespace: "6",
        gsrlimit: "25",
        prop: "imageinfo",
        iiprop: "url|size|mime|extmetadata",
        iiextmetadatafilter: "Artist|LicenseShortName|NonFree",
        iiurlwidth: "1280",
      });
      const pages = (data.query?.pages || []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      let added = 0;
      for (const p of pages) {
        if (seen.has(p.title) || BRAND.test(p.title) || BAD_FILE.test(p.title)) continue;
        const ref = toImageRef(p.title, p.imageinfo?.[0]);
        if (!ref || ref.w < 1200 || ref.w < ref.h * 1.2) continue;
        seen.add(p.title);
        refs.push(ref);
        added++;
      }
      await sleep(900);
      if (added >= 6) break; // quality set was enough; skip the broad fallback
    }
  }
  return refs.slice(0, 24);
}

// ---------------------------------------------------------------- climate
async function fetchClimate(dest) {
  const data = await getJson(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${dest.lat}&longitude=${dest.lng}&start_date=2023-01-01&end_date=2025-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration&timezone=auto`
  );
  const d = data.daily;
  const months = Array.from({ length: 12 }, () => ({ tmax: [], tmin: [], precip: 0, rainy: 0, sun: [], days: 0 }));
  const years = new Set();
  d.time.forEach((t, i) => {
    const m = Number(t.slice(5, 7)) - 1;
    years.add(t.slice(0, 4));
    const acc = months[m];
    if (d.temperature_2m_max[i] != null) acc.tmax.push(d.temperature_2m_max[i]);
    if (d.temperature_2m_min[i] != null) acc.tmin.push(d.temperature_2m_min[i]);
    const p = d.precipitation_sum[i] ?? 0;
    acc.precip += p;
    if (p >= 1) acc.rainy++;
    if (d.sunshine_duration[i] != null) acc.sun.push(d.sunshine_duration[i] / 3600);
    acc.days++;
  });
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const ny = years.size || 1;
  return months.map((m, i) => ({
    month: i + 1,
    tmax: +avg(m.tmax).toFixed(1),
    tmin: +avg(m.tmin).toFixed(1),
    precip: Math.round(m.precip / ny),
    rainyDays: Math.round(m.rainy / ny),
    sunHours: +avg(m.sun).toFixed(1),
  }));
}

// ---------------------------------------------------------------- manual image fixes
// Prefer a better photo that is already in the page's gallery (substring of the file name)...
const PREFER = {
  "Statue of Liberty": "Front_view_of_Statue_of_Liberty",
  "Westminster Abbey": "Westminster_Abbey,_Westminster",
  "Wat Pho": "Vihara_of_the_Reclining_Buddha",
  "Stanley Park": "Stanley_Park_Lagoon",
  Santorini: "SantoriniPartialPano",
  Amsterdam: "20220525.Amsterdam",
  "Cairo Citadel": "Cairo_citadel_entrance",
  "St. Joseph's Cathedral, Hanoi": "Cathedral_-_Hanoi",
  Ipanema: "Ipanema_Beach",
  "San Francisco": "Aerial_view_of_San_Francisco",
};
// ...or fetch a specific Commons file.
const FORCE_FILES = {
  Louvre: "File:Louvre Museum Wikimedia Commons.jpg",
};

async function applyOverrides(pages) {
  for (const [title, needle] of Object.entries(PREFER)) {
    const p = pages[title];
    if (!p?.gallery?.length) continue;
    const hit = p.gallery.find((g) => decodeURIComponent(g.url).includes(needle));
    if (hit) {
      p.image = hit;
      p.gallery = [hit, ...p.gallery.filter((g) => g.url !== hit.url)];
      console.log(`[override] ${title} -> ${needle}`);
    }
  }
  const infos = await imageInfo(COMMONS_API, Object.values(FORCE_FILES));
  for (const [title, file] of Object.entries(FORCE_FILES)) {
    const ref = infos[file];
    if (ref && pages[title]) {
      pages[title].image = ref;
      pages[title].gallery = [ref, ...(pages[title].gallery || []).filter((g) => g.url !== ref.url)].slice(0, 6);
      console.log(`[override] ${title} -> ${file}`);
    } else console.warn(`[override] could not resolve ${file}`);
  }
}

// ---------------------------------------------------------------- main
async function main() {
  const files = (await fs.readdir(SRC_DIR)).filter((f) => f.endsWith(".json"));
  const dests = [];
  for (const f of files) dests.push(JSON.parse(await fs.readFile(path.join(SRC_DIR, f), "utf8")));
  console.log(`Loaded ${dests.length} destination source files`);

  let cache = { pages: {}, pools: {}, climate: {} };
  try {
    cache = { ...cache, ...JSON.parse(await fs.readFile(OUT_FILE, "utf8")) };
  } catch {}

  const save = () => fs.writeFile(OUT_FILE, JSON.stringify(cache, null, 1));

  if (!ONLY || ONLY === "pages") {
    const titles = [];
    for (const d of dests) {
      titles.push(d.wiki);
      for (const a of d.attractions) titles.push(a.wiki);
    }
    await fetchPages([...new Set(titles)], cache.pages);
    await save();
  }

  if (!ONLY || ONLY === "pages" || ONLY === "overrides") {
    await applyOverrides(cache.pages);
    await save();
  }

  if (!ONLY || ONLY === "pools") {
    for (const [key, queries] of Object.entries(POOLS)) {
      if (!FORCE && cache.pools[key]?.length >= 6) continue;
      cache.pools[key] = await fetchPool(key, queries);
      console.log(`[pool] ${key}: ${cache.pools[key].length} images`);
      await save();
    }
  }

  if (!ONLY || ONLY === "climate") {
    for (const d of dests) {
      if (!FORCE && cache.climate[d.slug]) continue;
      try {
        cache.climate[d.slug] = await fetchClimate(d);
        console.log(`[climate] ${d.slug} ok`);
      } catch (e) {
        console.warn(`[climate] ${d.slug} failed: ${e.message}`);
      }
      await save();
      await sleep(400);
    }
  }

  await save();
  const missing = Object.entries(cache.pages).filter(([, v]) => v.missing).map(([k]) => k);
  const noImage = Object.entries(cache.pages).filter(([, v]) => !v.missing && !v.image).map(([k]) => k);
  console.log(`\nDone. pages=${Object.keys(cache.pages).length} missing=${missing.length} noImage=${noImage.length}`);
  if (missing.length) console.log("Missing pages:", missing.join(" | "));
  if (noImage.length) console.log("Pages without image:", noImage.join(" | "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
