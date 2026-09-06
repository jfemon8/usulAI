import { z } from "zod";

function blank<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema,
  );
}

const appSchema = z.object({
  NEXT_PUBLIC_APP_URL: blank(z.string().url().default("http://localhost:3000")),
  INGEST_API_SECRET: z.string().min(1, "INGEST_API_SECRET missing"),
});

const aiSchema = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1, "Gemini API key missing"),
  GROQ_API_KEY: z.string().min(1, "Groq API key missing"),
  OPENROUTER_API_KEY: z.string().min(1, "OpenRouter API key missing"),
});

const embeddingSchema = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1, "Gemini API key missing"),
});

const dbSchema = z.object({
  MONGODB_URI: z.string().startsWith("mongodb", "MONGODB_URI must be a MongoDB connection string"),
  MONGODB_DB: blank(z.string().min(1).default("usul_ai")),
  MONGODB_MAX_POOL_SIZE: blank(z.coerce.number().int().min(1).max(200).default(10)),
});

const storageSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1, "R2_ACCOUNT_ID missing"),
  R2_ACCESS_KEY_ID: z.string().min(1, "R2_ACCESS_KEY_ID missing"),
  R2_SECRET_ACCESS_KEY: z.string().min(1, "R2_SECRET_ACCESS_KEY missing"),
  R2_BUCKET: blank(z.string().min(1).default("usul-raw-sources")),
  R2_PUBLIC_BASE_URL: blank(z.string().url().optional()),
});

const sourcesSchema = z.object({
  QURAN_API_BASE_URL: blank(z.string().url().default("https://api.alquran.cloud/v1")),
  HADITH_API_BASE_URL: blank(z.string().url().optional()),
  HADITH_API_KEY: blank(z.string().min(1).optional()),
  SUNNAH_API_KEY: blank(z.string().min(1).optional()),
});

const envSchema = appSchema
  .merge(aiSchema)
  .merge(dbSchema)
  .merge(storageSchema)
  .merge(sourcesSchema);

export type Env = z.infer<typeof envSchema>;

function scoped<T extends z.ZodTypeAny>(schema: T) {
  let cached: z.infer<T> | null = null;

  return (): z.infer<T> => {
    if (cached === null) {
      cached = schema.parse(process.env);
    }
    return cached;
  };
}

export const getAppEnv = scoped(appSchema);
export const getAiEnv = scoped(aiSchema);
export const getEmbeddingEnv = scoped(embeddingSchema);
export const getDbEnv = scoped(dbSchema);
export const getStorageEnv = scoped(storageSchema);
export const getSourcesEnv = scoped(sourcesSchema);
export const getEnv = scoped(envSchema);
