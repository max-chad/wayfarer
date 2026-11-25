import Link from "next/link";

const TABS = [
  ["/account", "Profile"],
  ["/account/billing", "Plan & billing"],
  ["/bookings", "Bookings"],
] as const;

export function AccountTabs({ active }: { active: (typeof TABS)[number][0] }) {
  return (
    <nav className="mt-6 flex gap-1 overflow-x-auto scrollbar-none" aria-label="Account sections">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className="chip shrink-0" data-active={active === href} aria-current={active === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
