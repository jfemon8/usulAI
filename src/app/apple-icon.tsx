import { ImageResponse } from "next/og";
import { BRAND_COLORS, logoMarkDataUri } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, ${BRAND_COLORS.accent} 0%, ${BRAND_COLORS.accentDeep} 100%)`,
      }}
    >
      <img src={logoMarkDataUri("#ffffff", 120)} width={120} height={120} alt="" />
    </div>,
    size,
  );
}
