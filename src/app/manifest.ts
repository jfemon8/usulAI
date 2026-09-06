import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — ইসলামিক প্রশ্নোত্তর`,
    short_name: SITE_NAME,
    description: "কুরআন, হাদিস, ইজমা, কিয়াস ও সীরাতের আলোকে দলিলসহ উত্তর — এই তারতীব মেনে।",
    lang: "bn",
    dir: "ltr",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#e8edf5",
    theme_color: "#e8edf5",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
