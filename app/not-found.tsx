import { Compass } from "lucide-react";
import Link from "next/link";
import { getLocale, useT } from "@/lib/locale";

export default async function NotFound() {
  const t = useT(await getLocale());
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-surface-2 text-muted animate-float">
        <Compass className="size-8" />
      </div>
      <h1 className="mt-6 font-display text-4xl font-semibold">{t("nf.title")}</h1>
      <p className="mt-2 max-w-md text-muted">{t("nf.sub")}</p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className="btn btn-dark">
          {t("nf.home")}
        </Link>
        <Link href="/destinations" className="btn btn-outline">
          {t("nf.browse")}
        </Link>
      </div>
    </div>
  );
}
