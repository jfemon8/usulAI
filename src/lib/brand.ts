export const BRAND_COLORS = {
  accent: "#4a7fb5",
  accentDeep: "#2f5a87",
  accentSoft: "#7fb2e4",
  ink: "#0d1622",
  paper: "#e8edf5",
} as const;

export function logoMarkSvg(color: string, size = 64): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
<mask id="usulMarkStar"><rect width="64" height="64" fill="black"/>
<g fill="white"><rect x="15" y="15" width="34" height="34" rx="3"/><rect x="15" y="15" width="34" height="34" rx="3" transform="rotate(45 32 32)"/></g>
<rect x="27.5" y="27.5" width="9" height="9" rx="1.5" transform="rotate(45 32 32)" fill="black"/></mask>
<rect width="64" height="64" fill="${color}" mask="url(#usulMarkStar)"/>
</svg>`;
}

export function logoMarkDataUri(color: string, size = 64): string {
  return `data:image/svg+xml;base64,${Buffer.from(logoMarkSvg(color, size)).toString("base64")}`;
}
