import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/account/AccountForm";
import { AccountTabs } from "@/components/account/AccountTabs";
import { getCurrentUser } from "@/lib/auth";
import { HOME_CITIES } from "@/lib/seed/people";

export const metadata: Metadata = { title: "Account settings" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  return (
    <div className="container-page max-w-3xl pt-10">
      <h1 className="font-display text-4xl font-semibold">Account settings</h1>
      <p className="mt-1 text-muted">Personalise how Wayfarer&apos;s AI plans for you.</p>
      <AccountTabs active="/account" />
      <AccountForm
        user={{ displayName: user.displayName, bio: user.bio || "", homeCity: user.homeCity || "", interests: user.interests, avatarColor: user.avatarColor, email: user.email, username: user.username }}
        cities={HOME_CITIES.map((c) => c.name)}
      />
    </div>
  );
}
