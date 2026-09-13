export const SITE_NAME = "Usul AI";

export const SOURCE_PRIORITY = ["quran", "hadith", "ijma", "qiyas", "sirat"] as const;

type SourceName = (typeof SOURCE_PRIORITY)[number];

export const FILE_SOURCES = ["ijma", "qiyas", "sirat"] as const;

export const MODEL_CONFIG = {
  primary: {
    provider: "google",
    model: "gemini-3.6-flash",
  },
  secondary: {
    provider: "groq",
    model: "qwen/qwen3.8-27b",
  },
  fallback: {
    provider: "openrouter",
    model: "nex-agi/nex-n2.5-pro:free",
  },
  reserve: {
    provider: "zai",
    model: "glm-4.5-flash",
  },
  embedding: {
    provider: "google",
    model: "gemini-embedding-001",
  },
} as const;

export const EMBEDDING_TASK = {
  document: "RETRIEVAL_DOCUMENT",
  query: "RETRIEVAL_QUERY",
} as const;

export const MODEL_CHAIN = ["primary", "secondary", "fallback", "reserve"] as const;

export const QURAN_EDITIONS = {
  alquranCloud: {
    arabic: "quran-uthmani",
    bangla: "bn.bengali",
    english: "en.sahih",
  },
  quranCom: {
    banglaTranslationId: 161,
    englishTranslationId: 20,
  },
  fawazahmed0: {
    arabic: "ara-quranuthmanihaf",
    bangla: "ben-muhiuddinkhan",
    english: "eng-ummmuhammad",
  },
} as const;

export interface HadithBook {
  slug: string;
  name: string;
  translationLanguage: string;
  hadithApiComSlug: string | null;
  sunnahComSlug: string | null;
}

export const HADITH_BOOKS: readonly HadithBook[] = [
  {
    slug: "bukhari",
    name: "সহীহ বুখারী",
    translationLanguage: "ben",
    hadithApiComSlug: "sahih-bukhari",
    sunnahComSlug: "bukhari",
  },
  {
    slug: "muslim",
    name: "সহীহ মুসলিম",
    translationLanguage: "ben",
    hadithApiComSlug: "sahih-muslim",
    sunnahComSlug: "muslim",
  },
  {
    slug: "abudawud",
    name: "সুনানে আবু দাউদ",
    translationLanguage: "ben",
    hadithApiComSlug: "sunan-abu-dawood",
    sunnahComSlug: "abudawud",
  },
  {
    slug: "tirmidhi",
    name: "জামে তিরমিযী",
    translationLanguage: "ben",
    hadithApiComSlug: "jami-al-tirmidhi",
    sunnahComSlug: "tirmidhi",
  },
  {
    slug: "nasai",
    name: "সুনানে নাসাঈ",
    translationLanguage: "ben",
    hadithApiComSlug: "sunan-nasai",
    sunnahComSlug: "nasai",
  },
  {
    slug: "ibnmajah",
    name: "সুনানে ইবনে মাজাহ",
    translationLanguage: "ben",
    hadithApiComSlug: "sunan-ibn-e-majah",
    sunnahComSlug: "ibnmajah",
  },
  {
    slug: "malik",
    name: "মুয়াত্তা মালিক",
    translationLanguage: "ben",
    hadithApiComSlug: null,
    sunnahComSlug: "malik",
  },
  {
    slug: "nawawi",
    name: "৪০ হাদিস (নববী)",
    translationLanguage: "ben",
    hadithApiComSlug: null,
    sunnahComSlug: "nawawi40",
  },
] as const;

export const RETRIEVAL_CONFIG = {
  chunkSize: 800,
  chunkOverlap: 120,
  minChunkFill: 0.6,
  minVectorScore: 0.8,
  candidateMultiplier: 10,
  embeddingDimensions: 768,
} as const;

export const INGESTION_CONFIG = {
  requestTimeoutMs: 30_000,
  requestRetries: 2,
  retryBaseDelayMs: 1_000,
  embeddingBatchSize: 20,
  embeddingDocsPerMinute: 60,
  embeddingMaxRetries: 1,
  embeddingRateLimitWaitMs: 65_000,
  embeddingRateLimitAttempts: 40,
} as const;

export const DB_CONFIG = {
  collection: "documents",
  queryLogCollection: "query_logs",
  feedbackCollection: "answer_feedback",
  verifiedAnswerCollection: "verified_answers",
  rankingSignalCollection: "ranking_signals",
  queryEmbeddingCollection: "query_embeddings",
  quranNotesCollection: "quran_notes",
  queryInsightsCollection: "query_insights",
  corpusSourcesCollection: "corpus_sources",
  maintenanceCollection: "maintenance_state",
  vectorIndex: "documents_embedding_idx",
  textIndex: "documents_text_idx",
  embeddingPath: "embedding",
} as const;

export const HYBRID_CONFIG = {
  textCandidatesPerSource: 12,
  minTextScore: 3.0,
  lazyEmbedPerRequest: 12,
  fusionK: 60,
} as const;

export const EMBEDDING_RUNTIME_CONFIG = {
  queryCacheSize: 300,
  providerCooldownMs: 300_000,
} as const;

export const REPETITION_GUARD_CONFIG = {
  minRepeats: 4,
  maxPhraseWords: 8,
  holdbackWords: 40,
} as const;

export const QURANENC_CONFIG = {
  baseUrl: "https://quranenc.com/api/v1",
  translationKey: "bengali_zakaria",
  translator: "ড. আবু বকর মুহাম্মাদ যাকারিয়া",
  requestDelayMs: 400,
  maxNoteChars: 900,
  notesCacheSurahs: 16,
} as const;

export const QUOTE_ENRICHMENT_CONFIG = {
  minQuoteWords: 3,
  minMatchRatio: 0.5,
  minVocalizationRatio: 0.5,
  labelWindowChars: 48,
  maxAppendedEvidence: 3,
} as const;

export const ANSWER_GATE_CONFIG = {
  gatedTiers: ["secondary"] as readonly string[],
  minArabicRunWords: 3,
  minArabicMatchRatio: 0.5,
  maxForeignLatinWords: 1,
} as const;

export const MODEL_ATTEMPT_CONFIG = {
  retries: 1,
  firstTokenTimeoutMs: 45_000,
} as const;

export const OPENROUTER_FALLBACK_MODELS = [
  "nex-agi/nex-n2.5-mini:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-26b-a4b-it:free",
] as const;

export const ZAI_CONFIG = {
  baseUrl: "https://api.z.ai/api/paas/v4",
  thinking: "disabled",
  models: ["glm-4.7-flash", "glm-4.6v-flash", "glm-4.5-flash"],
} as const;

export const AUXILIARY_CONFIG = {
  temperature: 0,
  maxOutputTokens: 400,
  rewriteCacheSize: 200,
  rerankCacheSize: 300,
} as const;

export const VERIFIED_ANSWER_CONFIG = {
  enabled: true,
  autoVerifyAfterPositives: 3,
} as const;

export const FEEDBACK_LEARNING_CONFIG = {
  enabled: true,
  boostPerPositive: 0.35,
  penaltyPerNegative: 0.6,
  dropAtNetNegative: -2,
} as const;

export const RERANK_CONFIG = {
  enabled: true,
  minCandidates: 1,
  poolFactor: 2,
  snippetChars: 320,
} as const;

export const CONTEXT_CONFIG = {
  maxContextChunks: 12,
  carriedSources: 4,
  perSourceCap: {
    quran: 4,
    hadith: 4,
    ijma: 2,
    qiyas: 2,
    sirat: 2,
  },
} as const satisfies {
  maxContextChunks: number;
  carriedSources: number;
  perSourceCap: Record<SourceName, number>;
};

export const STORAGE_CONFIG = {
  rawSourcesPrefix: "raw-sources",
} as const;

export const STORAGE_BUDGET = {
  quotaMb: 512,
  warnRatio: 0.8,
  evictAtRatio: 0.9,
  targetRatio: 0.8,
  maxEvictionsPerRun: 5000,
  vectorBytesPerDocument: 3_100,
} as const;

export const RETENTION_CONFIG = {
  queryLogDays: 90,
  queryEmbeddingDays: 60,
  maxQueryEmbeddings: 15_000,
  resolvedFeedbackDays: 365,
  staleSignalDays: 365,
  rollupBatchSize: 2_000,
} as const;
