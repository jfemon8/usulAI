import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongoClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL_KEYS = {
  gemini: "GOOGLE_GENERATIVE_AI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  zai: "ZAI_API_KEY",
} as const;

function configured(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  const models = Object.entries(MODEL_KEYS)
    .filter(([, key]) => configured(key))
    .map(([name]) => name);

  let database: "ok" | "missing" | "unreachable" = configured("MONGODB_URI") ? "ok" : "missing";
  if (database === "ok") {
    try {
      await (await getDb()).command({ ping: 1 });
    } catch {
      database = "unreachable";
    }
  }

  const ready = database === "ok" && models.length > 0;

  return NextResponse.json(
    {
      status: ready ? "ok" : "misconfigured",
      database,
      models,
      embeddings: configured(MODEL_KEYS.gemini),
      cronSecret: configured("CRON_SECRET"),
      reviewSecret: configured("INGEST_API_SECRET"),
    },
    { status: ready ? 200 : 503 },
  );
}
