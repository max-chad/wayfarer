import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { allDestinationNames, getDestination } from "../data/destinations";
import { logAiEvent } from "../data/misc";
import { flightEstimate } from "../geo";
import type { SessionUser } from "../types";
import { MONTHS, formatUsd } from "../utils";
import { AiRefusalError, aiProvider, claude, CLAUDE_MODEL, FALLBACK_BETA, noteClaudeError } from "./claude";
import { parseTravelQuery, type ParsedQuery } from "./local/nlu";
import { buildPackingList } from "./local/packing";
import { runTool, TOOL_DESCRIPTIONS, TOOL_SCHEMAS, type ChatCard, type ToolName } from "./tools";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  pagePath?: string;
  destinationSlug?: string;
  placeName?: string;
  user?: SessionUser | null;
}

export type ChatEvent =
  | { type: "status"; text: string }
  | { type: "text"; delta: string }
  | { type: "cards"; cards: ChatCard[] }
  | { type: "suggestions"; items: string[] }
  | { type: "done"; provider: "claude" | "local" }
  | { type: "error"; message: string };

const TOOL_STATUS: Record<ToolName, string> = {
  search_places: "Searching places",
  get_destination_info: "Reading the destination guide",
  get_weather: "Checking the weather",
  plan_trip: "Drafting an itinerary",
  recommend_destinations: "Matching destinations",
  get_place_details: "Looking up details",
  convert_currency: "Converting currency",
};

export async function* runConcierge(messages: ChatMessage[], ctx: ChatContext): AsyncGenerator<ChatEvent> {
  if (aiProvider() === "claude") {
    const started = Date.now();
    let yielded = false;
    try {
      for await (const ev of claudeConcierge(messages, ctx)) {
        yielded = true;
        yield ev;
      }
      return;
    } catch (err) {
      noteClaudeError("concierge", err, started);
      if (yielded) {
        yield { type: "text", delta: "\n\n_(The AI service hit a problem mid-answer — switching to the built-in engine.)_\n\n" };
      }
    }
  }
  yield* localConcierge(messages, ctx);
}

// ─────────────────────────────────────────────────────────────── Claude

const SYSTEM_PROMPT = `You are Wayfarer's AI travel concierge — a warm, knowledgeable, concise travel advisor inside the Wayfarer travel website.

Ground every recommendation in Wayfarer's database by calling tools:
- search_places for hotels, restaurants, attractions and experiences (results are shown to the user as rich cards automatically).
- get_destination_info, get_weather, recommend_destinations, plan_trip, get_place_details, convert_currency as needed.
Only recommend specific hotels, restaurants, tours or attractions that tools returned; never invent venues, prices or ratings. If a city isn't covered, say so and suggest covered destinations.

Style:
- Keep answers short and skimmable (usually under 170 words). Use **bold** names and short bullet lists. Link places as [Name](/place/slug) and destinations as [City](/destinations/slug) using the url fields from tool results.
- Don't repeat every detail from the cards — add judgement: why it fits, a tip, a trade-off.
- Prices are in USD unless the user asks otherwise. Ratings come from Wayfarer's sample traveler reviews.
- For multi-day itineraries call plan_trip and point the user to the "Open in planner" card to edit, save and map the plan.
- Ask at most one short clarifying question, and only when you truly can't proceed.`;

let toolDefs: Anthropic.Beta.BetaTool[] | null = null;
function tools(): Anthropic.Beta.BetaTool[] {
  if (toolDefs) return toolDefs;
  toolDefs = (Object.keys(TOOL_SCHEMAS) as ToolName[]).map((name) => {
    const schema = z.toJSONSchema(TOOL_SCHEMAS[name]) as Record<string, unknown>;
    delete schema.$schema;
    return {
      name,
      description: TOOL_DESCRIPTIONS[name],
      input_schema: schema as Anthropic.Beta.BetaTool["input_schema"],
      // Stream tool inputs as generated; some proxies reject the field, so only send it to the first-party API.
      ...(usingFirstPartyApi() ? { eager_input_streaming: true } : {}),
    };
  });
  return toolDefs;
}

function usingFirstPartyApi() {
  const base = process.env.ANTHROPIC_BASE_URL;
  return !base || /^https:\/\/api\.anthropic\.com\/?$/.test(base);
}

function contextPreamble(ctx: ChatContext) {
  const bits = [`Today is ${new Date().toISOString().slice(0, 10)}.`];
  if (ctx.user?.homeCity) bits.push(`The user lives in ${ctx.user.homeCity}.`);
  if (ctx.user?.interests?.length) bits.push(`Their travel interests: ${ctx.user.interests.join(", ")}.`);
  if (ctx.placeName) bits.push(`They are currently viewing the page for "${ctx.placeName}".`);
  else if (ctx.destinationSlug) bits.push(`They are currently browsing the ${ctx.destinationSlug} destination page.`);
  bits.push(`Destinations covered: ${allDestinationNames().map((d) => d.name).join(", ")}.`);
  return `<context>\n${bits.join("\n")}\n</context>\n\n`;
}

async function* claudeConcierge(messages: ChatMessage[], ctx: ChatContext): AsyncGenerator<ChatEvent> {
  const started = Date.now();
  const history: Anthropic.Beta.BetaMessageParam[] = messages.slice(-16).map((m, i, arr) => ({
    role: m.role,
    content: i === arr.length - 1 && m.role === "user" ? contextPreamble(ctx) + m.content : m.content,
  }));
  if (history[0]?.role !== "user") history.shift();

  let inputTokens = 0;
  let outputTokens = 0;
  let jsonRetries = 0;
  for (let iteration = 0; iteration < 6; iteration++) {
    const stream = claude().beta.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      tools: tools(),
      messages: history,
    });

    let message: Anthropic.Beta.BetaMessage;
    try {
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield { type: "text", delta: ev.delta.text };
        else if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") {
          const n = ev.content_block.name as ToolName;
          yield { type: "status", text: `${TOOL_STATUS[n] || "Working"}…` };
        }
      }
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // A tool input that isn't parseable JSON (eager streaming) — re-issue the turn; API errors propagate.
      if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
      continue;
    }
    inputTokens += message.usage.input_tokens;
    outputTokens += message.usage.output_tokens;

    if (message.stop_reason === "refusal") {
      yield { type: "text", delta: "\n\nI can't help with that one — but I'm happy to help plan a trip, find places to stay or eat, or check the weather." };
      break;
    }
    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (message.stop_reason !== "tool_use" || !toolUses.length) break;
    if (message.stop_reason === "tool_use" && message.content.length === 0) break;

    history.push({ role: "assistant", content: message.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    const cards: ChatCard[] = [];
    await Promise.all(
      toolUses.map(async (tu) => {
        const name = tu.name as ToolName;
        if (!(name in TOOL_SCHEMAS)) {
          results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Unknown tool ${tu.name}` });
          return;
        }
        const parsed = TOOL_SCHEMAS[name].safeParse(tu.input);
        if (!parsed.success) {
          results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: JSON.stringify({ INVALID_JSON: JSON.stringify(tu.input) }) });
          return;
        }
        try {
          const out = await runTool(name, parsed.data);
          cards.push(...out.cards);
          results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out.data) });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Tool failed: ${(e as Error).message}` });
        }
      })
    );
    // keep results in the same order as the tool_use blocks
    results.sort((a, b) => toolUses.findIndex((t) => t.id === a.tool_use_id) - toolUses.findIndex((t) => t.id === b.tool_use_id));
    if (cards.length) yield { type: "cards", cards: dedupeCards(cards) };
    history.push({ role: "user", content: results });
  }
  logAiEvent({ feature: "concierge", provider: "claude", ok: true, ms: Date.now() - started, inputTokens, outputTokens });
  const lastUser = messages[messages.length - 1]?.content || "";
  yield { type: "suggestions", items: followUps(parseTravelQuery(lastUser, allDestinationNames(), { destinationSlug: ctx.destinationSlug })) };
  yield { type: "done", provider: "claude" };
}

export { AiRefusalError };

// ─────────────────────────────────────────────────────────────── Local engine

function dedupeCards(cards: ChatCard[]) {
  const seen = new Set<string>();
  return cards.filter((c) => {
    const k = c.kind === "place" ? `p${c.place.id}` : c.kind === "destination" ? `d${c.destination.slug}` : `${c.kind}${JSON.stringify(c).length}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function* streamText(text: string): AsyncGenerator<ChatEvent> {
  const parts = text.match(/\S+\s*|\s+/g) || [];
  for (let i = 0; i < parts.length; i += 3) {
    yield { type: "text", delta: parts.slice(i, i + 3).join("") };
    await new Promise((r) => setTimeout(r, 14));
  }
}

function followUps(p: ParsedQuery): string[] {
  const city = p.destinationName;
  if (!city) return ["Where should I go in November?", "Plan 3 days in Lisbon", "Romantic dinner in Paris", "Cheap eats in Bangkok"];
  const base = [
    `Plan ${p.days || 3} days in ${city}`,
    `Best restaurants in ${city}`,
    `What's the weather in ${city}?`,
    `Hidden gems in ${city}`,
    `What should I pack for ${city}?`,
    `How much does ${city} cost per day?`,
    `Useful phrases for ${city}`,
  ];
  const skip = { plan: 0, search: 1, weather: 2, packing: 4, budget: 5, phrases: 6 } as Record<string, number>;
  return base.filter((_, i) => i !== skip[p.intent]).slice(0, 4);
}

async function* localConcierge(messages: ChatMessage[], ctx: ChatContext): AsyncGenerator<ChatEvent> {
  const started = Date.now();
  const dests = allDestinationNames();
  const last = messages[messages.length - 1]?.content || "";
  // carry the destination forward from earlier turns
  let ctxDest = ctx.destinationSlug;
  for (let i = messages.length - 2; i >= 0 && !ctxDest; i--) {
    if (messages[i].role !== "user") continue;
    const prev = parseTravelQuery(messages[i].content, dests);
    if (prev.destinationSlug) ctxDest = prev.destinationSlug;
  }
  const p = parseTravelQuery(last, dests, { destinationSlug: ctxDest });
  const cityName = p.destinationName;
  let text = "";
  let cards: ChatCard[] = [];

  const needCity = (what: string) =>
    `Happy to help with ${what}! Which city are you thinking of? I cover ${dests
      .slice(0, 8)
      .map((d) => d.name)
      .join(", ")} and ${dests.length - 8} more.`;

  switch (p.intent) {
    case "greeting":
      text = `Hi${ctx.user ? ` ${ctx.user.displayName.split(" ")[0]}` : ""}! 👋 I'm Wayfarer's travel concierge. I can **find places to stay, eat and explore**, **plan day-by-day itineraries**, check **weather**, estimate **budgets**, build **packing lists** and suggest **where to go**. What are you dreaming about?`;
      break;
    case "thanks":
      text = "Anytime! Have a wonderful trip — ping me if you need anything else. ✈️";
      break;
    case "help":
      text = `Here's what I can do:\n\n- **Find places** — "quiet boutique hotel in Kyoto", "cheap tacos in Mexico City"\n- **Plan trips** — "plan 4 days in Rome for a couple who love food"\n- **Where to go** — "somewhere warm in February on a budget"\n- **Weather & climate** — "weather in Reykjavik", "Bali in August?"\n- **Budgets** — "how much is a week in Tokyo?"\n- **Packing lists & phrases** — "what should I pack for Cusco?"\n- **Compare** — "Lisbon vs Barcelona"`;
      break;
    case "search": {
      yield { type: "status", text: "Searching places…" };
      const out = await runTool("search_places", {
        destination: cityName,
        type: p.type,
        query: p.keywords || (p.category && /^[a-z]/.test(p.category) ? p.category : undefined),
        tags: p.tags.filter((t) => t !== "iconic"),
        price_levels: p.priceLevels,
        min_rating: p.minRating,
        limit: 5,
      });
      cards = out.cards;
      const data = out.data as { results?: ReturnType<typeof Object>[]; note?: string };
      const results = (data.results || []) as { name: string; slug: string; rating: number; reviews: number; price: string; neighborhood?: string; tags: string[]; blurb: string }[];
      if (!results.length) {
        text = `I couldn't find anything for "${p.interpretation}" — try loosening a filter, or ask me about a different area.`;
      } else {
        text =
          `Here are my top picks — **${p.interpretation}**${data.note ? " (I relaxed a filter to find matches)" : ""}:\n\n` +
          results
            .map((r) => `- **[${r.name}](/place/${r.slug})** — ★ ${r.rating.toFixed(1)} (${r.reviews} reviews) · ${r.price}${r.neighborhood ? ` · ${r.neighborhood}` : ""}. ${firstSentence(r.blurb)}`)
            .join("\n") +
          `\n\nWant me to add one of these to a trip plan, or narrow it down further?`;
      }
      break;
    }
    case "plan": {
      if (!cityName) {
        text = needCity("an itinerary");
        break;
      }
      yield { type: "status", text: "Drafting an itinerary…" };
      const days = p.days || 3;
      const out = await runTool("plan_trip", {
        destination: cityName,
        days,
        interests: p.interests,
        budget: p.budget,
        pace: /relax|slow|chill/.test(last.toLowerCase()) ? "relaxed" : /packed|busy|lot/.test(last.toLowerCase()) ? "packed" : "balanced",
        travelers: p.tripType === "solo" ? 1 : p.tripType === "family" ? 4 : 2,
      });
      cards = out.cards;
      const d = out.data as { summary: string; days: { day: number; title: string; stops: string[] }[]; estimatedCostUsd: { total: number; perPerson: number } };
      text =
        `Here's a **${days}-day plan for ${cityName}** ✨\n\n${d.summary}\n\n` +
        d.days.map((x) => `**Day ${x.day} — ${x.title}**\n${x.stops.slice(0, 5).map((s) => `- ${s}`).join("\n")}`).join("\n\n") +
        `\n\nEstimated total: **${formatUsd(d.estimatedCostUsd.total)}** (${formatUsd(d.estimatedCostUsd.perPerson)} per person). Open it in the planner to tweak, map and save it.`;
      break;
    }
    case "weather": {
      if (!cityName) {
        text = needCity("the weather");
        break;
      }
      yield { type: "status", text: "Checking the weather…" };
      const out = await runTool("get_weather", { destination: cityName, month: p.month });
      cards = out.cards;
      const d = out.data as { forecast?: { date: string; high: number; low: number; rainChance: number; summary: string }[]; month?: string; avgHighC?: number; avgLowC?: number; rainyDays?: number; feel?: string };
      if (d.forecast) {
        const f = d.forecast;
        const rainy = f.filter((x) => x.rainChance >= 50);
        text = `**${cityName} — next ${f.length} days:** highs ${Math.min(...f.map((x) => x.high))}–${Math.max(...f.map((x) => x.high))}°C, lows around ${Math.round(f.reduce((s, x) => s + x.low, 0) / f.length)}°C. ${rainy.length ? `Rain is likely on ${rainy.length} day${rainy.length > 1 ? "s" : ""} — pack a light umbrella.` : "Looks mostly dry. 🌤️"}`;
      } else {
        text = `**${cityName} in ${d.month || MONTHS[new Date().getMonth()]}** is typically ${d.feel}: average highs of **${d.avgHighC}°C**, lows of ${d.avgLowC}°C, with about ${d.rainyDays} rainy days in the month.`;
      }
      break;
    }
    case "budget": {
      if (!cityName) {
        text = needCity("a budget estimate");
        break;
      }
      const dest = getDestination(p.destinationSlug!)!;
      const b = dest.info.dailyBudgetUSD;
      const c = dest.info.costs;
      const days = p.days || 7;
      text =
        `**Daily budget in ${dest.name}** (per person, incl. accommodation):\n\n- 🎒 Budget: **${formatUsd(b.budget)}**\n- 🧳 Mid-range: **${formatUsd(b.midrange)}**\n- 💎 Luxury: **${formatUsd(b.luxury)}**\n\n` +
        `For ${days} days that's roughly **${formatUsd(b.budget * days)} / ${formatUsd(b.midrange * days)} / ${formatUsd(b.luxury * days)}**. Typical prices: coffee ${formatUsd(c.coffee)}, casual meal ${formatUsd(c.meal)}, transit ticket ${formatUsd(c.transitTicket)}, museum ${formatUsd(c.museum)}. Local currency: ${dest.info.currency.name} (${dest.info.currency.code}).`;
      break;
    }
    case "packing": {
      if (!cityName) {
        text = needCity("a packing list");
        break;
      }
      const dest = getDestination(p.destinationSlug!)!;
      const month = p.month || new Date().getMonth() + 1;
      const list = buildPackingList({ destination: dest, month, days: p.days || 5, interests: p.interests, tripType: p.tripType || "couples" });
      text =
        `**Packing list for ${dest.name} in ${MONTHS[month - 1]}** (avg ${dest.climate[month - 1]?.tmax ?? "?"}°C highs):\n\n` +
        list.categories
          .slice(0, 5)
          .map((c) => `**${c.name}:** ${c.items.slice(0, 6).map((i) => i.name).join(", ")}`)
          .join("\n\n") +
        `\n\nSave a trip to get an interactive, check-off-able version of this list.`;
      break;
    }
    case "phrases": {
      if (!cityName) {
        text = needCity("phrases");
        break;
      }
      const dest = getDestination(p.destinationSlug!)!;
      text = `**Handy ${dest.info.languages[0]} phrases for ${dest.name}:**\n\n${dest.info.phrases
        .slice(0, 8)
        .map((ph) => `- ${ph.english} → **${ph.local}** _(${ph.pronunciation})_`)
        .join("\n")}\n\nThe destination page has the full phrasebook with audio. 🔊`;
      break;
    }
    case "compare": {
      const slugs = [p.destinationSlug, ...p.otherDestinationSlugs].filter(Boolean) as string[];
      if (slugs.length < 2) {
        text = "Tell me the two destinations you're weighing up — e.g. \"Lisbon vs Barcelona\".";
        break;
      }
      const [a, b] = slugs.slice(0, 2).map((s) => getDestination(s)!);
      const home = ctx.user?.homeLat != null ? { lat: ctx.user.homeLat!, lng: ctx.user.homeLng! } : null;
      const row = (d: typeof a) => {
        const f = home ? flightEstimate(home, d) : null;
        return `**${d.name}** — ${d.vibes.slice(0, 3).join(", ")}; best in ${d.info.bestMonths.map((m) => MONTHS[m - 1].slice(0, 3)).join("/")}; ~${formatUsd(d.info.dailyBudgetUSD.midrange)}/day mid-range; safety ${d.info.safety.score}/5${f ? `; ${f.hours}h flight from home` : ""}.`;
      };
      const cheaper = a.info.dailyBudgetUSD.midrange < b.info.dailyBudgetUSD.midrange ? a : b;
      text = `${row(a)}\n\n${row(b)}\n\n**Verdict:** ${cheaper.name} is kinder on the wallet. Pick **${a.name}** for ${a.vibes[0]} and ${a.vibes[1]}; pick **${b.name}** for ${b.vibes[0]} and ${b.vibes[1]}.`;
      cards = [a, b].map((d) => ({ kind: "destination" as const, destination: { ...d, bestMonths: d.info.bestMonths, dailyBudgetUSD: d.info.dailyBudgetUSD } }));
      break;
    }
    case "recommend-destination": {
      yield { type: "status", text: "Matching destinations…" };
      const out = await runTool("recommend_destinations", { month: p.month, vibes: p.interests.length ? p.interests : p.tags, budget: p.budget, climate: p.climate, limit: 4 });
      cards = out.cards;
      const d = out.data as { name: string; country: string; vibes: string[]; bestMonths: string[]; midrangeDailyUsd: number; climate?: { avgHighC: number; feel: string } }[];
      text =
        `Here are destinations I'd suggest${p.month ? ` for **${MONTHS[p.month - 1]}**` : ""}${p.interests.length ? ` if you love **${p.interests.join(", ")}**` : ""}:\n\n` +
        d
          .map(
            (x) =>
              `- **${x.name}, ${x.country}** — ${x.vibes.slice(0, 3).join(", ")}${x.climate ? `; ${x.climate.feel} (~${x.climate.avgHighC}°C)` : `; best ${x.bestMonths.join("/")}`}; ~${formatUsd(x.midrangeDailyUsd)}/day`
          )
          .join("\n") +
        `\n\nTry the **Destination Matcher** quiz for a personalised ranking.`;
      break;
    }
    case "destination-info":
    case "unknown":
    default: {
      if (cityName) {
        const out = await runTool("get_destination_info", { destination: cityName });
        const top = await runTool("search_places", { destination: cityName, type: "attraction", limit: 3 });
        cards = [...out.cards, ...top.cards];
        const d = out.data as { name: string; tagline: string; bestMonths: string[]; dailyBudgetUSD: { midrange: number }; safety: { score: number; notes: string }; tips: string[] };
        const lower = last.toLowerCase();
        let focus = "";
        if (/safe|safety|danger/.test(lower)) focus = `\n\n**Safety (${d.safety.score}/5):** ${d.safety.notes}`;
        else if (/when|best time|season/.test(lower)) focus = `\n\n**Best time to visit:** ${d.bestMonths.join(", ")}.`;
        else if (/tip|advice|know/.test(lower)) focus = `\n\n**Insider tips:**\n${d.tips.slice(0, 4).map((t) => `- ${t}`).join("\n")}`;
        text = `**${d.name}** — ${d.tagline}.\n\nBest months: ${d.bestMonths.join(", ")} · Mid-range budget ~${formatUsd(d.dailyBudgetUSD.midrange)}/day · Safety ${d.safety.score}/5.${focus}\n\nTop sights are below — want restaurants, hotels or a full itinerary next?`;
      } else if (p.keywords) {
        const out = await runTool("search_places", { query: p.keywords, limit: 5 });
        cards = out.cards;
        text = cards.length
          ? `Here's what I found for "${p.keywords}" across all destinations:`
          : `I'm not sure I understood that. Try asking things like "family-friendly hotels in Singapore" or "where should I go in March?"`;
      } else {
        text = `I'm not sure I understood that. Try asking things like **"family-friendly hotels in Singapore"**, **"plan 3 days in Kyoto"** or **"where should I go in March?"**`;
      }
    }
  }

  yield* streamText(text);
  if (cards.length) yield { type: "cards", cards: dedupeCards(cards) };
  yield { type: "suggestions", items: followUps(p) };
  logAiEvent({ feature: "concierge", provider: "local", ok: true, ms: Date.now() - started });
  yield { type: "done", provider: "local" };
}

function firstSentence(s: string) {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}
