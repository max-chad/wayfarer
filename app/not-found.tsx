import { Compass } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-surface-2 text-muted animate-float">
        <Compass className="size-8" />
      </div>
      <h1 className="mt-6 font-display text-4xl font-semibold">Off the map</h1>
      <p className="mt-2 max-w-md text-muted">We couldn&apos;t find that page. Even the best explorers take a wrong turn sometimes.</p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className="btn btn-dark">
          Back home
        </Link>
        <Link href="/destinations" className="btn btn-outline">
          Browse destinations
        </Link>
      </div>
    </div>
  );
}
