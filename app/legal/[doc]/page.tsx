import { FileText, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/ui/Markdown";
import { getLegalDoc, LEGAL_DOCS } from "@/lib/content/legal";
import { cn, formatDate } from "@/lib/utils";

type Props = { params: Promise<{ doc: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = getLegalDoc((await params).doc);
  return doc ? { title: doc.title, description: doc.summary } : { title: "Not found" };
}

export default async function LegalPage({ params }: Props) {
  const { doc: slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();
  return (
    <div className="container-page pt-10">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Policies</div>
          <nav className="mt-3 flex gap-1 overflow-x-auto scrollbar-none lg:flex-col" aria-label="Policies">
            {LEGAL_DOCS.map((d) => (
              <Link key={d.slug} href={`/legal/${d.slug}`} className={cn("shrink-0 rounded-lg px-3 py-2 text-sm", d.slug === doc.slug ? "bg-surface-2 font-semibold" : "text-ink-2 hover:bg-surface-2")}>
                {d.title}
              </Link>
            ))}
            <Link href="/how-we-make-money" className="shrink-0 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
              How we make money
            </Link>
            <Link href="/trust" className="shrink-0 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
              Trust report
            </Link>
          </nav>
        </aside>
        <article className="max-w-3xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-400">
            <FileText className="size-4" /> Legal
          </div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{doc.title}</h1>
          <p className="mt-2 text-muted">{doc.summary}</p>
          <p className="mt-1 text-xs text-muted">Last updated {formatDate(doc.updated)}</p>
          <div className="mt-5 flex gap-2 rounded-xl bg-sun-300/20 p-3 text-xs leading-relaxed dark:bg-sun-500/10">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-sun-500" />
            <span>Template for the Wayfarer demo. Bracketed items are placeholders; have qualified counsel review this document for each market before launch.</span>
          </div>
          <nav className="card mt-6 p-4 text-sm" aria-label="On this page">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">On this page</div>
            <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {doc.sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="hover:underline">
                    {i + 1}. {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          {doc.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="mt-10 scroll-mt-24">
              <h2 className="font-display text-2xl font-semibold">
                {i + 1}. {s.heading}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-2">
                {s.body.map((p, j) => (
                  <Markdown key={j} text={p} />
                ))}
              </div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
