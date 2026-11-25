import type { Destination, PackingList, TripType } from "@/lib/types";

interface PackingInput {
  destination: Pick<Destination, "name" | "countryCode" | "lat" | "climate" | "vibes" | "info" | "slug">;
  month: number;
  days: number;
  interests: string[];
  tripType: TripType | string;
  budget?: string;
}

const MODEST_DRESS = new Set(["MA", "EG", "AE", "TR", "TH", "ID", "VN", "IN", "IT", "KH", "LK", "MY", "JO", "OM", "QA", "SA"]);
const HIGH_ALTITUDE = new Set(["cusco"]);

export function buildPackingList(input: PackingInput): PackingList {
  const { destination: d, month, interests, tripType } = input;
  const days = Math.max(1, Math.min(30, input.days));
  const c = d.climate[month - 1] || { tmax: 22, tmin: 14, rainyDays: 6, sunHours: 6, precip: 50, month };
  const hot = c.tmax >= 26;
  const warm = c.tmax >= 20;
  const cold = c.tmin <= 8;
  const freezing = c.tmin <= 2;
  const wet = c.rainyDays >= 8 || c.precip >= 80;
  const tropical = Math.abs(d.lat) <= 23.5;
  const sunny = c.sunHours >= 7 || hot;
  const has = (...xs: string[]) => xs.some((x) => interests.includes(x) || d.vibes.includes(x));
  const item = (name: string, reason?: string) => ({ name, checked: false, reason });

  const essentials = [
    item("Passport / ID", "Check it's valid 6+ months beyond your return"),
    item("Travel insurance details"),
    item("Phone & charger"),
    item(`Plug adapter (type ${d.info.plugType})`, `${d.name} uses ${d.info.voltage}`),
    item("Bank cards + a little local cash", `${d.info.currency.name} (${d.info.currency.code})`),
    item("Digital & paper copies of bookings"),
    item("Reusable water bottle"),
    item("Offline map of the city downloaded"),
  ];

  const tops = Math.min(10, Math.ceil(days * 0.7) + 1);
  const clothing = [
    item(`${Math.min(10, days + 1)}× underwear & socks`),
    item(`${tops}× ${hot ? "light, breathable tops" : "tops / t-shirts"}`),
    item(`${Math.max(2, Math.ceil(days / 3))}× ${hot ? "shorts / light trousers" : "trousers / skirts"}`),
    item("Comfortable walking shoes", "You'll likely walk 15,000+ steps a day"),
    item("Sleepwear"),
  ];
  if (cold) clothing.push(item(freezing ? "Insulated winter coat" : "Warm jacket", `Lows around ${Math.round(c.tmin)}°C`));
  if (cold) clothing.push(item("Warm layers (fleece / merino)"));
  if (freezing) clothing.push(item("Hat, gloves & scarf"), item("Thermal base layers"));
  if (!cold && !hot) clothing.push(item("Light jacket or cardigan for evenings", `Evenings drop to ~${Math.round(c.tmin)}°C`));
  if (wet) clothing.push(item("Packable rain jacket", `~${c.rainyDays} rainy days in this month`), item("Water-resistant shoes"));
  if (hot || sunny) clothing.push(item("Sun hat & sunglasses"));
  if (hot || has("beach") || tropical) clothing.push(item("Swimwear"));
  if (MODEST_DRESS.has(d.countryCode)) clothing.push(item("Modest outfit (shoulders & knees covered)", "Required at many religious sites"));
  if (input.budget === "luxury" || has("romantic")) clothing.push(item("One smart outfit for a nice dinner"));

  const toiletries = [item("Toothbrush & toothpaste"), item("Deodorant"), item("Personal medication (+ prescriptions)"), item("Hand sanitiser & tissues")];
  if (sunny || warm) toiletries.push(item("Sunscreen SPF 50", c.sunHours ? `~${c.sunHours} h of sun per day` : undefined));
  if (tropical || (hot && wet)) toiletries.push(item("Insect repellent (DEET/picaridin)", "Mosquitoes are common"));
  if (cold || HIGH_ALTITUDE.has(d.slug)) toiletries.push(item("Lip balm & moisturiser", "Dry air"));

  const tech = [item("Power bank"), item("Headphones")];
  if (has("photography")) tech.push(item("Camera + spare battery & memory card"));
  if (tripType === "business") tech.push(item("Laptop & charger"), item("Business cards / presentation adapter"));

  const health = [item("Mini first-aid kit (plasters, painkillers, rehydration salts)")];
  if (HIGH_ALTITUDE.has(d.slug)) health.push(item("Altitude sickness plan (acclimatise, coca tea, ask a doctor about meds)", "Cusco sits at ~3,400 m"));
  if (has("adventure", "hiking", "nature")) health.push(item("Blister plasters"));
  if (has("beach") || /cruise|boat/i.test(d.vibes.join(" "))) health.push(item("Motion-sickness tablets"));

  const activities = [];
  if (has("hiking", "nature", "adventure")) activities.push(item("Daypack"), item("Hiking shoes / trail runners"), item("Refillable electrolytes"));
  if (has("beach")) activities.push(item("Quick-dry beach towel"), item("Snorkel mask (optional)"), item("Waterproof phone pouch"));
  if (has("nightlife")) activities.push(item("Going-out outfit"), item("Small cross-body bag"));
  if (tripType === "family") activities.push(item("Snacks & travel games for the kids"), item("Kids' sunscreen & hats"), item("Stroller or baby carrier"));
  if (has("wellness")) activities.push(item("Yoga / workout clothes"));
  if (has("food")) activities.push(item("Foldable tote for market finds"));
  activities.push(item(`Phrasebook basics: "${d.info.phrases?.[1]?.local || "Thank you"}"`, d.info.languages?.[0]));

  return {
    generatedAt: new Date().toISOString(),
    categories: [
      { name: "Essentials", items: essentials },
      { name: "Clothing", items: clothing },
      { name: "Toiletries", items: toiletries },
      { name: "Tech", items: tech },
      { name: "Health", items: health },
      { name: "Activities & extras", items: activities },
    ].filter((cat) => cat.items.length),
  };
}
