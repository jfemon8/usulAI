import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { authorLabel } from "@/components/masail/MasailChrome";
import { SITE_NAME } from "@/config/site";
import { getPublishedMasala, masalaIdFromSlug } from "@/lib/analytics/verifiedAnswers";
import { BRAND_COLORS, logoMarkDataUri } from "@/lib/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME}: মাসআলা`;

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");

async function bangla(): Promise<{ name: string; data: ArrayBuffer; weight: 400 | 600 }[]> {
  const [regular, semibold] = await Promise.all([
    readFile(path.join(FONT_DIR, "HindSiliguri-Regular.ttf")),
    readFile(path.join(FONT_DIR, "HindSiliguri-SemiBold.ttf")),
  ]);

  return [
    { name: "Hind Siliguri", data: regular.buffer as ArrayBuffer, weight: 400 },
    { name: "Hind Siliguri", data: semibold.buffer as ArrayBuffer, weight: 600 },
  ];
}

export default async function MasalaOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const id = masalaIdFromSlug(slug);
  const masala = id ? await getPublishedMasala(id).catch(() => null) : null;
  const question = masala?.question ?? "মাসআলা ও ফতোয়া";
  const author = masala ? authorLabel(masala.author) : null;
  const fonts = await bangla();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: `linear-gradient(150deg, ${BRAND_COLORS.paper} 0%, #cfdcec 100%)`,
          fontFamily: "Hind Siliguri",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={logoMarkDataUri(BRAND_COLORS.accentDeep, 64)} width={64} height={64} alt="" />
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: BRAND_COLORS.ink }}>
            {SITE_NAME}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: question.length > 90 ? 48 : 60,
            lineHeight: 1.4,
            fontWeight: 600,
            color: BRAND_COLORS.ink,
          }}
        >
          {question.slice(0, 140)}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {author ? (
            <div style={{ display: "flex", fontSize: 28, color: BRAND_COLORS.accentDeep }}>
              {author}
            </div>
          ) : null}
          <div style={{ display: "flex", fontSize: 24, color: "#5c6f88" }}>
            কুরআন · হাদিস · ইজমা · কিয়াস · সীরাত · ফিকহ
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
