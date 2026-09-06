import { ImageResponse } from "next/og";
import { BRAND_COLORS, logoMarkDataUri } from "@/lib/brand";
import { SITE_NAME } from "@/config/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — Islamic Q&A grounded in Quran, Hadith, Ijma, Qiyas and Sirat`;

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 34,
        background: `linear-gradient(150deg, ${BRAND_COLORS.paper} 0%, #cfdcec 100%)`,
      }}
    >
      <img src={logoMarkDataUri(BRAND_COLORS.accentDeep, 180)} width={180} height={180} alt="" />
      <div
        style={{
          display: "flex",
          fontSize: 86,
          fontWeight: 700,
          letterSpacing: -2,
          color: BRAND_COLORS.ink,
        }}
      >
        {SITE_NAME}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 30,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: BRAND_COLORS.accentDeep,
        }}
      >
        Quran · Hadith · Ijma · Qiyas · Sirat
      </div>
      <div style={{ display: "flex", fontSize: 25, color: "#5c6f88" }}>
        Every answer cited. Every source in order.
      </div>
    </div>,
    size,
  );
}
