/**
 * Policy documents. These are working templates for a demo product: bracketed placeholders must be
 * filled in and every document reviewed by qualified counsel in each launch market before going live.
 */

export interface LegalDoc {
  slug: string;
  title: string;
  updated: string;
  summary: string;
  sections: { id: string; heading: string; body: string[] }[];
}

const OPERATOR = "[Company legal name], a company registered in [jurisdiction] under number [number], with its registered office at [address]";

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "terms",
    title: "Terms of Use",
    updated: "2026-10-01",
    summary: "The rules for using Wayfarer: your account, the content you post, bookings through partners, AI features and the API.",
    sections: [
      {
        id: "who",
        heading: "Who we are",
        body: [
          `Wayfarer is operated by ${OPERATOR} ("Wayfarer", "we", "us"). By using Wayfarer you agree to these terms, our [Privacy Policy](/legal/privacy) and our [Review Guidelines](/legal/guidelines).`,
          "If you use Wayfarer on behalf of a business, the [Business & Advertising Terms](/legal/business-terms) also apply.",
        ],
      },
      {
        id: "account",
        heading: "Your account",
        body: [
          "You must be at least 16 to create an account. Keep your password secret; you're responsible for activity on your account. One person, one account — accounts created to manipulate ratings are removed.",
          "You can download your data or delete your account at any time in Account settings. Deleting removes your profile, reviews, trips and saved places immediately, and ratings are recalculated without your reviews. Booking and invoice records are kept, without your name, for accounting.",
        ],
      },
      {
        id: "content",
        heading: "Reviews, photos and other content you post",
        body: [
          "You keep ownership of what you post. You give us a worldwide, non-exclusive, royalty-free licence to host, display, translate, summarise (including with AI), and distribute it in connection with Wayfarer and our API, for as long as it's on the service.",
          "Your content must describe your own genuine experience and follow the [Review Guidelines](/legal/guidelines). We may moderate, hold or remove content that breaks them, and we'll tell you why.",
        ],
      },
      {
        id: "ai",
        heading: "AI features",
        body: [
          "Summaries, itineraries, answers and drafts are generated automatically and can be wrong or out of date. Check important details — opening hours, prices, entry requirements, safety advice — with the provider or official sources before you rely on them.",
          "AI features are labelled. We describe how they work in [AI Transparency](/legal/ai). Free accounts have usage limits; Wayfarer Plus raises them subject to fair use.",
        ],
      },
      {
        id: "bookings",
        heading: "Bookings and partner sites",
        body: [
          "When you click a price from a booking partner you leave Wayfarer, and the partner's terms govern your booking. We're not a party to that contract and the partner is responsible for the stay.",
          "When you book an experience, ticket or table on Wayfarer, we act as an intermediary for the venue or operator, who provides the service. Prices, cancellation rules and what's included are shown before you confirm. We earn a commission, as explained in [How we make money](/how-we-make-money).",
        ],
      },
      {
        id: "plus",
        heading: "Wayfarer Plus",
        body: [
          "Plus is a subscription billed monthly or yearly in advance. It renews automatically until you cancel; you can cancel anytime in Plan & billing and keep access until the end of the paid period.",
          "If you're a consumer in the EU or UK you have a 14-day right of withdrawal from the start of the subscription. If you use Plus during that time we may deduct a proportionate amount from the refund. [Add local consumer-law terms for each launch market.]",
        ],
      },
      {
        id: "api",
        heading: "Developer API",
        body: [
          "API keys are personal to your account. Show \"Data from Wayfarer\" with a link when you display our ratings or insights, and keep the author and licence attribution for photos and Wikipedia text.",
          "Don't use the API to build a competing review platform, to re-identify reviewers, to scrape beyond your quota, or to train machine-learning models on review text. We may suspend keys that break these terms or our rate limits.",
        ],
      },
      {
        id: "conduct",
        heading: "Things you must not do",
        body: [
          "Don't post fake, paid-for or conflict-of-interest reviews; harass people; scrape the site; interfere with security; use the service to break the law; or impersonate anyone.",
        ],
      },
      {
        id: "liability",
        heading: "Our responsibility to you",
        body: [
          "We provide Wayfarer with reasonable care and skill. Nothing in these terms limits liability that can't be limited by law, including for death or personal injury caused by negligence, or for fraud.",
          "[Insert market-appropriate limitation of liability, governing law and dispute-resolution clauses, including EU online dispute resolution information where required.]",
        ],
      },
      {
        id: "changes",
        heading: "Changes and contact",
        body: ["We'll give you notice of material changes before they take effect. Questions: [legal@your-domain]."],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    updated: "2026-10-01",
    summary: "What we collect, why, who we share it with (including AI providers and booking partners), how long we keep it and your rights.",
    sections: [
      {
        id: "controller",
        heading: "Who is responsible for your data",
        body: [`${OPERATOR} is the controller of your personal data. Contact our privacy team at [privacy@your-domain]. [Add EU/UK representative and DPO details if required.]`],
      },
      {
        id: "collect",
        heading: "What we collect",
        body: [
          "**Account data:** email, username, display name, password (stored only as a salted scrypt hash), home city and interests you choose to add.",
          "**Content:** reviews, photos, questions, answers, trips, notes and saved places.",
          "**Bookings & billing:** bookings you make (venue, date, party size, name for the reservation) and subscription history. In production, card payments are handled by our payment provider; we never see or store full card numbers.",
          "**Usage:** pages and features used, AI usage counts for plan limits, and — only if you allow analytics cookies — which partner deals you clicked. Anonymous rate-limit counters use a one-way hash of your IP address, never the address itself.",
        ],
      },
      {
        id: "why",
        heading: "Why we use it (and our legal bases)",
        body: [
          "To run your account and provide the service, including bookings and subscriptions (contract). To keep reviews trustworthy, prevent fraud and secure the service (legitimate interests, and legal obligations under consumer-protection and platform laws). To personalise plans and recommendations from the interests you give us (contract / legitimate interests). To attribute partner clicks to your account (consent). To send service messages (contract) and, only if you opt in, marketing (consent).",
        ],
      },
      {
        id: "ai",
        heading: "AI processing",
        body: [
          "When Claude-powered features are enabled, the text needed to answer your request — for example your concierge message, trip preferences, or the reviews being summarised — is sent to our AI provider, Anthropic, acting as our processor. We don't send your email or password, and API inputs aren't used to train their models under our commercial terms. [Confirm against the current provider agreement.]",
          "Our authenticity model scores reviews automatically. A low score holds a review for human moderation; it isn't removed without review, and you can ask us to look again.",
        ],
      },
      {
        id: "share",
        heading: "Who we share data with",
        body: [
          "**Venues and operators** receive the details needed to fulfil a booking you make. **Booking partners** receive your search (dates, guests) when you click through to them — not your account details. **Processors** host our service, process payments, send email and provide AI features, under contract. **Authorities** where the law requires it.",
          "We don't sell your personal data and we don't share it with advertisers. Businesses that advertise on Wayfarer only see aggregated statistics.",
        ],
      },
      {
        id: "retention",
        heading: "How long we keep it",
        body: [
          "Account data and content until you delete them or your account; deletion is immediate, and backups roll off within [30] days. Booking and invoice records for [6–10] years for tax and accounting, with your name removed if you delete your account. AI usage counters for 60 days. Read notifications for 180 days.",
        ],
      },
      {
        id: "rights",
        heading: "Your rights",
        body: [
          "Depending on where you live, you can access, correct, export or delete your data — export and deletion are self-service in **Account settings → Your data** — object to or restrict processing, and withdraw consent at any time (for cookies, use **Cookie settings** in the footer). California residents can also request information about categories of data and opt out of any \"sale\" or \"sharing\" — we do neither. You can complain to your local data-protection authority.",
        ],
      },
      {
        id: "transfers",
        heading: "International transfers",
        body: ["Our providers may process data outside your country. Where required we use Standard Contractual Clauses or equivalent safeguards. [List hosting regions.]"],
      },
      {
        id: "children",
        heading: "Children",
        body: ["Wayfarer isn't intended for children under 16 and we don't knowingly collect their data."],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    updated: "2026-10-01",
    summary: "The few cookies and browser-storage items Wayfarer uses, and how to change your choice.",
    sections: [
      {
        id: "essential",
        heading: "Essential (always on)",
        body: [
          "- **wf_session** — keeps you signed in (HTTP-only, 30 days).",
          "- **wf_consent** — remembers your cookie choice (6 months).",
          "- **wf-theme** (local storage) — your light/dark preference.",
          "- **Concierge history, recently viewed, compare tray** (local storage) — stored only in your browser so these features work; never sent to advertisers.",
        ],
      },
      {
        id: "analytics",
        heading: "Analytics (only with your consent)",
        body: [
          "If you choose **Allow analytics**, partner clicks and bookings are linked to your account so we can show your history and measure which features help travelers. Without consent we only keep aggregated, anonymous counts (for example, how many people viewed a page today).",
          "We don't use third-party advertising or cross-site tracking cookies.",
        ],
      },
      {
        id: "change",
        heading: "Changing your choice",
        body: ["Use **Cookie settings** in the footer at any time, or clear cookies for this site in your browser."],
      },
    ],
  },
  {
    slug: "guidelines",
    title: "Review & Content Guidelines",
    updated: "2026-10-01",
    summary: "What makes a review welcome on Wayfarer, what we remove, how moderation works and the rules for owners.",
    sections: [
      {
        id: "genuine",
        heading: "Write about your own, recent experience",
        body: [
          "Reviews must describe a visit, stay or booking you personally experienced in the last 24 months. Be specific: what you did, when, who you travelled with and what stood out — good or bad.",
          "The AI writing assistant can help you draft, polish or title a review, but the content must be yours and true. Don't ask it to invent details.",
        ],
      },
      {
        id: "conflicts",
        heading: "No conflicts of interest or incentives",
        body: [
          "Don't review a business you own, work for, are related to, or compete with. Businesses must not offer discounts, gifts or anything of value in exchange for reviews, and must not ask only happy customers to post (\"review gating\").",
          "Fake reviews, paid reviews and reviews written to harm a competitor are removed, and the accounts involved may be closed. In many countries they are also illegal.",
        ],
      },
      {
        id: "content",
        heading: "Keep it respectful and relevant",
        body: [
          "No hate speech, threats, sexual content, personal information about staff or other guests, or allegations of crimes better reported to the authorities. Photos must be your own and show the place.",
        ],
      },
      {
        id: "moderation",
        heading: "How moderation works",
        body: [
          "Every review is scored by our authenticity model, which looks at signals like account age, rating/text mismatch, promotional language, repetition and copy-pasted text. Reviews scoring under the threshold are **held for a human moderator** and excluded from ratings until reviewed.",
          "Anyone can report a review. We tell the author and reporter what we decided and why, and either can ask us to look again. We publish aggregate numbers in our [Trust & transparency report](/trust).",
          "**Verification disclosure:** Wayfarer does not currently confirm that every reviewer used the service they review. Reviews are checked for authenticity using the signals above; bookings made through Wayfarer will be labelled as verified in a future release.",
        ],
      },
      {
        id: "owners",
        heading: "For owners",
        body: [
          "Verified owners can reply publicly to any review. Replies must be professional, must not reveal a guest's personal information and must not offer compensation in exchange for changing a review. Owners can't edit, hide or remove reviews, and paying for a business plan or advertising never affects moderation.",
        ],
      },
    ],
  },
  {
    slug: "ai",
    title: "AI Transparency",
    updated: "2026-10-01",
    summary: "Which parts of Wayfarer use AI, how they're grounded, what data they see and their limits.",
    sections: [
      {
        id: "where",
        heading: "Where we use AI",
        body: [
          "- **Concierge chat** — a conversational assistant that searches our places, weather and destination data.",
          "- **Trip planner** — builds day-by-day itineraries from places in our database.",
          "- **Review summaries & owner insights** — summarise what reviewers say, with quotes linked to real reviews.",
          "- **Smart search, Q&A answers, comparisons, translations** — interpret and answer using listing facts and reviews.",
          "- **Writing assistants** — help travelers draft reviews and help owners draft replies; a person always edits and publishes.",
          "- **Authenticity scoring** — a non-generative model that scores reviews for moderation.",
        ],
      },
      {
        id: "labels",
        heading: "How you can tell",
        body: [
          "AI-generated content is marked with an AI badge or labelled \"AI\", and the concierge identifies itself as an AI assistant. Each feature shows whether it was produced by Claude or by our built-in local engine.",
        ],
      },
      {
        id: "grounding",
        heading: "Grounded in our data — and never for sale",
        body: [
          "The concierge and planner can only recommend places that exist in our database, and quotes in summaries must match real reviews. **Advertising data is never given to the AI**: no business can pay to be recommended in an AI answer, itinerary or summary.",
        ],
      },
      {
        id: "data",
        heading: "What the AI sees",
        body: [
          "Only what's needed for your request: your message or trip preferences, plus place data and review excerpts. We don't send your email address or payment details. See the [Privacy Policy](/legal/privacy#ai) for processors and retention.",
        ],
      },
      {
        id: "limits",
        heading: "Limits",
        body: [
          "AI can be wrong. Opening hours, prices and travel rules change; check critical details with official sources. Itinerary costs and travel times are estimates. If something looks off, use the feedback or report options so we can fix it.",
        ],
      },
      {
        id: "oversight",
        heading: "Human oversight",
        body: [
          "No review is removed by AI alone — held reviews go to a moderator. Owners and reviewers always publish their own text. We monitor AI quality and usage in our admin tools and can switch any feature to the local engine instantly.",
        ],
      },
    ],
  },
  {
    slug: "business-terms",
    title: "Business & Advertising Terms",
    updated: "2026-10-01",
    summary: "Terms for claiming listings, business subscriptions, bookings commissions and sponsored listings.",
    sections: [
      {
        id: "claims",
        heading: "Claiming a listing",
        body: [
          "You may claim a listing only if you're authorised to represent the business. We verify claims (for example with a code sent to contact details on file) and may ask for further proof. We can revoke a claim that was made in error or in bad faith.",
        ],
      },
      {
        id: "plans",
        heading: "Business plans",
        body: [
          "Business Insights and Business Pro are per-listing subscriptions billed monthly or yearly in advance and renew until cancelled. You can cancel anytime and keep paid features until the end of the period. Fees exclude applicable taxes.",
          "Plans give you tools and information. They **never** change rankings, ratings, awards, review moderation or AI recommendations.",
        ],
      },
      {
        id: "bookings",
        heading: "Bookings and commissions",
        body: [
          "If you accept bookings through Wayfarer, you agree to honour them at the price and conditions shown, and to pay our commission on completed bookings: [8]% of the booking value for experiences and tickets, and [$1.50] per seated guest for restaurant reservations, invoiced monthly. Cancelled bookings within the free-cancellation window are not commissionable.",
        ],
      },
      {
        id: "ads",
        heading: "Sponsored listings policy",
        body: [
          "Sponsored listings are cost-per-click. You set a maximum bid and daily budget; we never charge more than your bid per billable click or more than your daily budget per day. Repeat clicks from the same visitor within 30 minutes aren't billable.",
          "Sponsored placements are always labelled \"Sponsored\", appear in dedicated slots, and are only available to places with a rating of 3.5 or higher. Slots are ranked by bid multiplied by a quality factor based on rating.",
          "Ads are never shown inside AI answers or itineraries, never shown to Wayfarer Plus members, and never affect organic ranking.",
        ],
      },
      {
        id: "conduct",
        heading: "Prohibited conduct",
        body: [
          "No incentivised or fake reviews, review gating, threats against reviewers, or reviews of competitors. Owner replies must follow the [Review Guidelines](/legal/guidelines#owners). Breaches can lead to a public notice on your listing, loss of business features and termination without refund.",
        ],
      },
      {
        id: "data",
        heading: "Data",
        body: [
          "Business analytics are aggregated and don't identify individual travelers. Booking details are shared with you only to fulfil the booking and must be used only for that purpose, in line with data-protection law.",
        ],
      },
    ],
  },
];

export function getLegalDoc(slug: string) {
  return LEGAL_DOCS.find((d) => d.slug === slug) ?? null;
}
