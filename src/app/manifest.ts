import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME}: ইসলামিক প্রশ্নোত্তর`,
    short_name: SITE_NAME,
    description: "কুরআন, হাদিস, ইজমা, কিয়াস ও সীরাতের আলোকে দলিলসহ উত্তর, এই তারতীব মেনে।",
    lang: "bn",
    dir: "ltr",
    id: "/",
    start_url: "/",
    scope: "/",
    categories: ["education", "books", "lifestyle"],
    display: "standalone",
    orientation: "portrait",
    background_color: "#e8edf5",
    theme_color: "#e8edf5",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
