import type { PlaceType } from "@/lib/types";
import { aspectIndex, detectAspects } from "./bank";
import { analyzeSentiment, splitSentences } from "./sentiment";

export interface OwnerReplyInput {
  author: string;
  rating: number;
  title: string;
  body: string;
  placeName: string;
  placeType: PlaceType;
  contactName: string;
  contactRole: string;
  tone?: "warm" | "formal" | "brief";
}

const FOLLOW_UP: Record<string, string> = {
  service: "I've shared your comments with our front-of-house team so we can learn from them",
  staff: "I've shared your comments with the team so we can learn from them",
  cleanliness: "our housekeeping lead is reviewing our checklists as a result",
  noise: "we're looking at what we can do to keep things quieter, including room allocation",
  value: "we review our pricing regularly and your feedback is part of that",
  food: "our chef has read your feedback and is looking at the dishes you mentioned",
  wait: "we're reviewing our staffing at peak times so waits are shorter",
  room: "we've passed this on to our rooms team to inspect",
  breakfast: "our breakfast team is reviewing the offer",
  guide: "we've discussed your feedback with our guides",
  crowds: "we're adjusting departure times to avoid the busiest periods",
};

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** Template-based owner response that acknowledges what the guest actually wrote about. */
export function draftOwnerReply(input: OwnerReplyInput) {
  const first = input.author.split(/\s+/)[0] || "there";
  const labels = new Map(aspectIndex(input.placeType).map((a) => [a.key, a.label.toLowerCase()]));
  const pos = new Set<string>();
  const neg = new Set<string>();
  for (const s of splitSentences(`${input.title}. ${input.body}`)) {
    const aspects = detectAspects(input.placeType, s);
    if (!aspects.length) continue;
    const label = analyzeSentiment(s).label;
    for (const a of aspects) {
      if (label === "positive") pos.add(a);
      else if (label === "negative" || label === "mixed") neg.add(a);
    }
  }
  for (const a of neg) pos.delete(a);
  const posLabels = [...pos].slice(0, 2).map((a) => labels.get(a) || a);
  const negKeys = [...neg].slice(0, 2);
  const negLabels = negKeys.map((a) => labels.get(a) || a);
  const brief = input.tone === "brief";
  const formal = input.tone === "formal";
  const greet = formal ? `Dear ${first},` : `Hi ${first},`;

  const parts: string[] = [greet];
  if (input.rating >= 4) {
    parts.push(`Thank you so much for your ${input.rating}-star review and for choosing ${input.placeName}.`);
    if (posLabels.length) parts.push(`We're delighted the ${list(posLabels)} made your visit — I'll pass your kind words on to the whole team.`);
    if (negLabels.length && !brief) parts.push(`Thank you too for the note about the ${list(negLabels)}; it's helpful and we're on it.`);
    parts.push(formal ? "We look forward to welcoming you again." : "We hope to welcome you back soon!");
  } else if (input.rating === 3) {
    parts.push(`Thank you for taking the time to share such balanced feedback about ${input.placeName}.`);
    if (posLabels.length) parts.push(`I'm glad you enjoyed the ${list(posLabels)}.`);
    if (negLabels.length) parts.push(`I'm sorry the ${list(negLabels)} didn't meet expectations — ${FOLLOW_UP[negKeys[0]] || "we're looking into what happened"}.`);
    parts.push("We'd love the chance to show you a five-star visit next time.");
  } else {
    parts.push(`Thank you for your honest review. I'm sorry your experience at ${input.placeName} fell short of what we aim for.`);
    if (negLabels.length) parts.push(`You're right to raise the ${list(negLabels)}: ${FOLLOW_UP[negKeys[0]] || "we're looking into exactly what went wrong"}.`);
    if (posLabels.length && !brief) parts.push(`I'm glad the ${list(posLabels)} was a bright spot.`);
    parts.push(`I'd really like to make this right — please contact me directly and mention this review.`);
  }
  parts.push(formal ? `Kind regards,\n${input.contactName}, ${input.contactRole}` : `Warm regards,\n${input.contactName}, ${input.contactRole}`);
  const [g, ...rest] = parts;
  const sign = rest.pop()!;
  return `${g}\n\n${rest.join(" ")}\n\n${sign}`;
}
