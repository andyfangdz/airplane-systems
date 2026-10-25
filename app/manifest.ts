import type { MetadataRoute } from "next";

export const dynamic = "force-static";

/** One same-origin app identity and scope, including every airplane, engine and component route. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Airplane Systems",
    short_name: "Airplane Systems",
    description: "Interactive aircraft systems, engine and component study models.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#111a21",
    theme_color: "#111a21",
    icons: [
      { src: "/icons/airplane-systems-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/airplane-systems-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/airplane-systems-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
