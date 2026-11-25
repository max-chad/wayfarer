import type { Metadata } from "next";
import { Matcher } from "@/components/match/Matcher";
import { getCurrentUser } from "@/lib/auth";
import { HOME_CITIES } from "@/lib/seed/people";

export const metadata: Metadata = { title: "Destination matcher", description: "Answer six questions and get destinations matched to your month, budget, climate and vibe." };

export default async function MatchPage() {
  const user = await getCurrentUser();
  return <Matcher cities={HOME_CITIES.map((c) => c.name)} defaultCity={user?.homeCity || null} />;
}
