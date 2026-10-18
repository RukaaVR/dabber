import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dabber",
    short_name: "Dabber",
    description: "Chat, servers, voice and screen sharing with your people. Free.",
    start_url: "/app",
    display: "standalone",
    background_color: "#121318",
    theme_color: "#121318",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
