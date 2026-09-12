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
  embedding: {
    provider: "google",
    model: "gemini-embedding-001",
  },
} as const;

export const EMBEDDING_TASK = {
  document: "RETRIEVAL_DOCUMENT",
  query: "RETRIEVAL_QUERY",
} as const;

export const MODEL_CHAIN = ["primary", "secondary", "fallback"] as const;

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
  topKPerSource: 5,
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
  vectorIndex: "documents_embedding_idx",
  textIndex: "documents_text_idx",
  embeddingPath: "embedding",
} as const;

export const HYBRID_CONFIG = {
  textCandidatesPerSource: 12,
  minTextScore: 3.5,
  lazyEmbedPerRequest: 12,
} as const;

export const EMBEDDING_RUNTIME_CONFIG = {
  queryCacheSize: 300,
  providerCooldownMs: 300_000,
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
  minCandidates: 2,
  snippetChars: 260,
} as const;

export const CONTEXT_CONFIG = {
  maxContextChunks: 12,
  perSourceCap: {
    quran: 4,
    hadith: 4,
    ijma: 2,
    qiyas: 2,
    sirat: 2,
  },
} as const satisfies { maxContextChunks: number; perSourceCap: Record<SourceName, number> };

export const STORAGE_CONFIG = {
  rawSourcesPrefix: "raw-sources",
} as const;
