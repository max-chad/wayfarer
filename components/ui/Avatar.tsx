import { initials } from "@/lib/utils";

export function Avatar({ name, color, size = 36, className = "" }: { name: string; color: string; size?: number; className?: string }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 60%, #000))`, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name) || "?"}
    </span>
  );
}
