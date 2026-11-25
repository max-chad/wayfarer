import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { leaderboard } from "@/lib/data/users";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Top contributors" };

export default function LeaderboardPage() {
  const rows = leaderboard(30);
  const podium = rows.slice(0, 3);
  return (
    <div className="container-page max-w-4xl pt-10">
      <div className="flex items-center gap-2 text-sm font-semibold text-sun-500">
        <Trophy className="size-4" /> Community
      </div>
      <h1 className="mt-1 font-display text-4xl font-semibold">Top contributors</h1>
      <p className="mt-1 text-muted">Points: 100 per review, 10 per helpful vote, 30 per photo review, 40 per answer.</p>

      <div className="mt-8 grid grid-cols-3 items-end gap-3">
        {[podium[1], podium[0], podium[2]].filter(Boolean).map((u) => {
          const place = rows.indexOf(u) + 1;
          return (
            <Link key={u.id} href={`/profile/${u.username}`} className={cn("card flex flex-col items-center p-4 text-center hover:shadow-lift", place === 1 ? "pb-10" : place === 2 ? "pb-6" : "pb-3")}>
              <div className="text-3xl">{["🥇", "🥈", "🥉"][place - 1]}</div>
              <Avatar name={u.displayName} color={u.avatarColor} size={place === 1 ? 72 : 56} className="mt-2" />
              <div className="mt-2 font-semibold">{u.displayName}</div>
              <div className="text-xs text-muted">{u.points.toLocaleString("en-US")} pts</div>
            </Link>
          );
        })}
      </div>

      <div className="card mt-8 divide-y divide-line">
        {rows.map((u, i) => (
          <Link key={u.id} href={`/profile/${u.username}`} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-2">
            <span className="w-6 text-right font-display text-lg font-semibold text-muted">{i + 1}</span>
            <Avatar name={u.displayName} color={u.avatarColor} size={40} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{u.displayName}</div>
              <div className="text-xs text-muted">
                {u.homeCity} · {u.cities} cities
              </div>
            </div>
            <div className="hidden text-right text-sm sm:block">
              <div>{u.reviews} reviews</div>
              <div className="text-xs text-muted">{u.helpful} helpful votes</div>
            </div>
            <div className="w-20 text-right font-semibold">{u.points.toLocaleString("en-US")}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
