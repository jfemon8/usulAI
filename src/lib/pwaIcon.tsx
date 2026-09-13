import { ImageResponse } from "next/og";
import { BRAND_COLORS, logoMarkDataUri } from "@/lib/brand";

export const PWA_ICONS = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
} as const;

export type PwaIconName = keyof typeof PWA_ICONS;

export function isPwaIconName(name: string): name is PwaIconName {
  return Object.hasOwn(PWA_ICONS, name);
}

export function renderPwaIcon(name: PwaIconName): ImageResponse {
  const { size, maskable } = PWA_ICONS[name];
  const mark = Math.round(size * (maskable ? 0.74 : 0.92));

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: maskable ? 0 : Math.round(size * 0.22),
        background: `linear-gradient(135deg, ${BRAND_COLORS.accent} 0%, ${BRAND_COLORS.accentDeep} 100%)`,
      }}
    >
      <img src={logoMarkDataUri("#ffffff", mark)} width={mark} height={mark} alt="" />
    </div>,
    { width: size, height: size },
  );
}
