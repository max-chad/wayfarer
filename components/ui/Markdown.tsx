import Link from "next/link";
import { Fragment } from "react";

/** Minimal, safe markdown renderer (bold, italics, links, lists, headings, paragraphs). No raw HTML. */
export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className={`space-y-2.5 leading-relaxed ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (!lines.length) return null;
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={bi} className="list-disc space-y-1 pl-5 marker:text-brand-500">
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return (
            <ol key={bi} className="list-decimal space-y-1 pl-5">
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>
              ))}
            </ol>
          );
        }
        return (
          <div key={bi}>
            {lines.map((l, i) => {
              const h = l.match(/^(#{1,4})\s+(.*)$/);
              if (h) return <div key={i} className="mt-1 font-semibold">{inline(h[2])}</div>;
              if (/^\s*[-*•]\s+/.test(l))
                return (
                  <div key={i} className="flex gap-2 pl-1">
                    <span className="text-brand-500">•</span>
                    <span>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</span>
                  </div>
                );
              return (
                <Fragment key={i}>
                  {inline(l)}
                  {i < lines.length - 1 && <br />}
                </Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const TOKEN = /(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*\s][^*]*)\*)|(_([^_\s][^_]*)_)|(`([^`]+)`)/g;

function inline(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) {
      const href = m[3];
      const safe = /^(\/|https?:\/\/)/.test(href);
      if (!safe) out.push(m[2]);
      else if (href.startsWith("/"))
        out.push(
          <Link key={k++} href={href} className="font-medium text-brand-600 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-600 dark:text-brand-400">
            {m[2]}
          </Link>
        );
      else
        out.push(
          <a key={k++} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 underline underline-offset-2 dark:text-brand-400">
            {m[2]}
          </a>
        );
    } else if (m[4]) out.push(<strong key={k++} className="font-semibold">{m[5]}</strong>);
    else if (m[6]) out.push(<strong key={k++} className="font-semibold">{m[7]}</strong>);
    else if (m[8]) out.push(<em key={k++}>{m[9]}</em>);
    else if (m[10]) out.push(<em key={k++} className="text-muted">{m[11]}</em>);
    else if (m[12]) out.push(<code key={k++} className="rounded bg-surface-2 px-1 py-0.5 text-[0.85em]">{m[13]}</code>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
