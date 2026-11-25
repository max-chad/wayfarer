import Link from "next/link";
import type { SessionUser } from "@/lib/types";
import { useT, type Locale } from "@/lib/locale-core";
import { HeaderSearch } from "./HeaderSearch";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { NotificationBell } from "./NotificationBell";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

export function SiteHeader({ user, plan, unread, isOwner, locale }: { user: SessionUser | null; plan: "free" | "plus"; unread: number; isOwner: boolean; locale: Locale }) {
  const t = useT(locale);
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/70">
      <div className="container-page flex h-16 items-center gap-3">
        <Logo />
        <div className="hidden flex-1 justify-center px-4 md:flex">
          <HeaderSearch placeholder={t("header.searchPlaceholder")} />
        </div>
        <div className="flex-1 md:hidden" />
        <NavLinks />
        <div className="flex items-center gap-1.5">
          <LocaleSwitcher />
          <ThemeToggle />
          {user ? (
            <>
              <NotificationBell initialUnread={unread} />
              <UserMenu user={{ username: user.username, displayName: user.displayName, avatarColor: user.avatarColor, role: user.role, plan, isOwner }} />
            </>
          ) : (
            <Link href="/login" className="btn btn-dark btn-sm hidden sm:inline-flex">
              {t("header.signIn")}
            </Link>
          )}
          <MobileMenu />
        </div>
      </div>
      <div className="container-page pb-3 md:hidden">
        <HeaderSearch placeholder={t("header.searchPlaceholder")} />
      </div>
    </header>
  );
}
