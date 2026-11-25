import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wayfarer — AI travel advisor",
    short_name: "Wayfarer",
    description: "Plan smarter trips with AI: review summaries, itineraries, a travel concierge, weather and budgets.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f4",
    theme_color: "#11463b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
    shortcuts: [
      { name: "Plan a trip", url: "/plan" },
      { name: "Travel concierge", url: "/concierge" },
      { name: "My trips", url: "/trips" },
    ],
  };
}
