export const SITE_NAME = "Usul AI";

export const SITE_URL_CONFIG = {
  fallbackUrl: "https://usulai.onrender.com",
  cacheMs: 60_000,
} as const;

export const DATE_TIME_CONFIG = {
  timeZone: "Asia/Dhaka",
  locale: "en-US",
} as const;

export const SOURCE_PRIORITY = ["quran", "hadith", "ijma", "qiyas", "sirat", "fiqh"] as const;

type SourceName = (typeof SOURCE_PRIORITY)[number];

export const FILE_SOURCES = ["ijma", "qiyas", "sirat", "fiqh"] as const;

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
  feedbackTallyCollection: "feedback_tallies",
  feedbackVoteCollection: "feedback_votes",
  verifiedAnswerCollection: "verified_answers",
  rankingSignalCollection: "ranking_signals",
  queryEmbeddingCollection: "query_embeddings",
  quranNotesCollection: "quran_notes",
  queryInsightsCollection: "query_insights",
  corpusSourcesCollection: "corpus_sources",
  maintenanceCollection: "maintenance_state",
  rateLimitCollection: "rate_limits",
  sourceTranslationCollection: "source_translations",
  learningCollection: "learned_memory",
  adminAccountCollection: "admin_accounts",
  adminSessionCollection: "admin_sessions",
  adminResetTokenCollection: "admin_reset_tokens",
  adminAuditCollection: "admin_audit",
  siteContentCollection: "site_content",
  staffAccountCollection: "staff_accounts",
  staffCategoryCollection: "staff_categories",
  reviewQueueCollection: "review_items",
  helpRequestCollection: "help_requests",
  vectorIndex: "documents_embedding_idx",
  textIndex: "documents_text_idx",
  embeddingPath: "embedding",
} as const;

export const SOURCE_TRANSLATION_CONFIG = {
  maxOutputTokens: 6_000,
  minBengaliRatio: 0.6,
  minVocalizedShare: 0.7,
  minSegmentChars: 60,
  models: ["gemini-3.6-flash", "glm-4.5-flash"] as readonly string[],
  maxConcurrent: 2,
  maxPerRequest: 1,
  responseWaitMs: 45_000,
  failureCooldownMs: 600_000,
  maxConsecutiveFailures: 5,
  timeoutMs: 240_000,
  modelLabel: "AI অনুবাদ",
} as const;

export const ARABIC_TEXT_SOURCES: readonly string[] = ["ijma", "qiyas", "sirat", "fiqh"];

export const HYBRID_CONFIG = {
  textCandidatesPerSource: 12,
  minTextScore: 3.0,
  lazyEmbedPerRequest: 12,
  lazyEmbedCandidates: 96,
  fusionK: 60,
} as const;

export const QURAN_NOTE_SEARCH_CONFIG = {
  readyWaitMs: 6_000,
  maxSuffixChars: 3,
  minTermChars: 2,
  k1: 1.2,
  b: 0.75,
  minScore: 3,
  fusionWeight: 1,
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

export const QURAN_VERSE_LOOKUP_CONFIG = {
  minQuoteWords: 3,
  minMatchRatio: 0.7,
  minMatchLetters: 12,
  shingleLetters: 4,
  candidates: 25,
  readyWaitMs: 8_000,
} as const;

export const QUOTE_ENRICHMENT_CONFIG = {
  minQuoteWords: 3,
  minMatchRatio: 0.5,
  minVocalizationRatio: 0.5,
  labelWindowChars: 48,
  maxAppendedEvidence: 3,
  minSegmentWordLetters: 3,
  minSegmentOverlap: 0.5,
} as const;

export const MODEL_HEALTH_CONFIG = {
  authCooldownMs: 1_800_000,
  quotaCooldownMs: 1_800_000,
  rateCooldownMs: 45_000,
  overloadCooldownMs: 30_000,
} as const;

export const ANSWER_GATE_CONFIG = {
  trustedModels: ["gemini-3.6-flash", "glm-4.5-flash"] as readonly string[],
  excludedAnswerModels: [
    "glm-4.6v-flash",
    "glm-4.7-flash",
    "nvidia/nemotron-3-super-120b-a12b:free",
  ] as readonly string[],
  minArabicRunWords: 3,
  minArabicMatchRatio: 0.5,
  maxForeignLatinWords: 1,
} as const;

export const CHAT_HISTORY_CONFIG = {
  storageKey: "usul-ai:conversations:v1",
  storageKeyPrefix: "usul-ai:conversations:",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
  maxConversations: 30,
  maxMessagesPerConversation: 40,
  maxCompactMessages: 160,
  maxStorageBytes: 2_500_000,
  titleChars: 48,
} as const;

export const STREAM_PACING_CONFIG = {
  tickMs: 24,
  maxLagMs: 3_000,
} as const;

export const MODEL_ATTEMPT_CONFIG = {
  retries: 1,
  firstTokenTimeoutMs: 45_000,
  requestBudgetMs: 285_000,
  minAttemptMs: 15_000,
  transientRetryRounds: 2,
  transientRetryWaitMs: 15_000,
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
  maxConcurrentPerModel: 2,
  reservedForAnswers: 1,
  auxiliaryWaitMs: 30_000,
  abandonedHoldMs: 45_000,
  slotMaxHoldMs: 300_000,
} as const;

export const AUXILIARY_CONFIG = {
  temperature: 0,
  maxOutputTokens: 400,
  rewriteCacheSize: 200,
  longQuestionWords: 25,
  rewriteBudgetMs: 45_000,
  rerankCacheSize: 300,
} as const;

export const VERIFIED_ANSWER_CONFIG = {
  enabled: true,
  autoVerifyAfterPositives: 3,
  matchByTopic: true,
} as const;

export const EMAIL_CONFIG = {
  sender: { email: "usulai@demomailtrap.co", name: SITE_NAME },
  categories: {
    test: "Integration Test",
    passwordReset: "Password Reset",
    helpAnswered: "Help Answered",
    welcome: "Welcome",
  },
  defaultLocale: "bn",
  timeZone: DATE_TIME_CONFIG.timeZone,
  logoPath: "/pwa/icon-192.png",
  links: {
    passwordReset: "/reset-password",
    verifyEmail: "/verify-email",
    start: "/",
  },
  passwordResetMinutes: 60,
  verifyEmailHours: 24,
  brand: {
    tagline: { bn: "দলিলভিত্তিক ইসলামিক প্রশ্নোত্তর", en: "Evidence-based Islamic Q&A" },
    summary: {
      bn: "কুরআন, হাদিস, ইজমা, কিয়াস, সীরাত ও ফিকহের নির্ভরযোগ্য কিতাব থেকে দলিল ও সূত্রসহ আপনার প্রশ্নের উত্তর খুঁজে দেয়।",
      en: "finds answers to your questions with evidence and references from trusted books of Quran, Hadith, Ijma, Qiyas, Sirah and Fiqh.",
    },
    tips: {
      bn: [
        "যেকোনো মাসআলা বাংলা, ইংরেজি বা বাংলিশে জিজ্ঞেস করুন।",
        "উত্তরের নিচের সূত্রে ক্লিক করে মূল দলিল পড়ুন।",
        "উত্তর ভুল মনে হলে জানিয়ে দিন; এতে উত্তর আরও নির্ভুল হয়।",
      ],
      en: [
        "Ask any question in Bangla, English or Banglish.",
        "Open the references under each answer to read the original evidence.",
        "Tell us when an answer looks wrong; it helps answers get more accurate.",
      ],
    },
  },
  colors: {
    background: "#f3f6fa",
    card: "#ffffff",
    border: "#dbe3ee",
    text: "#0d1622",
    muted: "#5b6878",
    button: "#2f5a87",
    buttonText: "#ffffff",
    notice: "#eef4fb",
  },
} as const;

export const SELF_LEARNING_CONFIG = {
  enabled: true,
  memoryDays: 120,
  implicitWeight: 0.5,
  complaintMaxWords: 8,
  complaintWindowChars: 24,
  modelStatsRefreshMs: 300_000,
  modelMinAttempts: 8,
  modelDemoteBelowSuccess: 0.25,
  pretranslateLookbackDays: 30,
  pretranslatePerRun: 6,
  pretranslateBudgetMs: 180_000,
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
  maxConcurrent: 2,
  budgetMs: 60_000,
} as const;

export const CONTEXT_CONFIG = {
  maxContextChunks: 16,
  carriedSources: 4,
  scopedMinCap: 4,
  perSourceCap: {
    quran: 4,
    hadith: 4,
    ijma: 2,
    qiyas: 2,
    sirat: 2,
    fiqh: 2,
  },
} as const satisfies {
  maxContextChunks: number;
  carriedSources: number;
  scopedMinCap: number;
  perSourceCap: Record<SourceName, number>;
};

export const STORAGE_CONFIG = {
  rawSourcesPrefix: "raw-sources",
} as const;

export const INGESTION_JOB_CONFIG = {
  workflowFile: "ingest.yml",
  ref: "main",
  modes: ["embed-only", "text-only", "full", "dry-run"],
  defaultEmbedLimit: 900,
} as const;

export interface OpenItiPageRange {
  from: readonly [number, number];
  to: readonly [number, number];
  heading?: string;
}

export interface OpenItiBook {
  slug: string;
  repo: string;
  version: string;
  fileSuffix?: ".completed" | ".mARkdown";
  headingsFrom?: string;
  title: string;
  author: string;
  part?: string;
  pages?: readonly OpenItiPageRange[];
  inlineHeadings?: boolean;
}

export type OpenItiSource = "ijma" | "qiyas" | "sirat" | "fiqh";

export const OPENITI_CONFIG = {
  rawBase: "https://raw.githubusercontent.com/OpenITI",
  license:
    "CC BY-NC-SA 4.0. Text from the Open Islamicate Texts Initiative (OpenITI), KITAB project; paratext removed by OpenITI. Non-commercial use with attribution, share alike.",
  ijma: [
    {
      slug: "ibn-al-mundhir-al-ijma",
      repo: "0325AH",
      version: "0319IbnMundhirNaysaburi.Ijmac.Sham19Y0151100-ara1",
      title: "কিতাবুল ইজমা (ইবনুল মুনযির)",
      author: "আবু বকর মুহাম্মাদ ইবনু ইবরাহীম ইবনুল মুনযির আন-নাইসাবূরী (মৃ. ৩১৯ হি.)",
    },
    {
      slug: "ibn-hazm-maratib-al-ijma",
      repo: "0475AH",
      version: "0456IbnHazm.MaratibIjmac.JK000182-ara1",
      headingsFrom: "0456IbnHazm.MaratibIjmac.Shamela0012446-ara1",
      title: "মারাতিবুল ইজমা (ইবনু হাযম)",
      author: "আবু মুহাম্মাদ আলী ইবনু আহমাদ ইবনু হাযম আল-আন্দালুসী (মৃ. ৪৫৬ হি.)",
    },
    {
      slug: "ibn-al-qattan-al-iqna",
      repo: "0650AH",
      version: "0628IbnQattanFasi.Iqnac.Sham19Y0013624-ara1",
      title: "আল-ইকনা ফী মাসাইলিল ইজমা (ইবনুল কাত্তান)",
      author: "আবুল হাসান আলী ইবনু মুহাম্মাদ ইবনুল কাত্তান আল-ফাসী (মৃ. ৬২৮ হি.)",
    },
    {
      slug: "ibn-taymiyya-naqd-maratib-al-ijma",
      repo: "0750AH",
      version: "0728IbnTaymiyya.NaqdMaratibIjmac.Shamela0008630-ara1",
      title: "নাকদু মারাতিবিল ইজমা (ইবনু তাইমিয়া)",
      author: "তাকিউদ্দীন আহমাদ ইবনু আবদিল হালীম ইবনু তাইমিয়া (মৃ. ৭২৮ হি.)",
    },
  ] satisfies OpenItiBook[],
  qiyas: [
    {
      slug: "shafii-al-risala-qiyas",
      repo: "0225AH",
      version: "0204Shafici.Risala.Shamela0008180-ara1",
      title: "আর-রিসালা (ইমাম শাফিঈ)",
      author: "মুহাম্মাদ ইবনু ইদরীস আশ-শাফিঈ (মৃ. ২০৪ হি.)",
      part: "কিয়াস, ইজতিহাদ, ইসতিহসান ও মতভেদের অধ্যায়",
      pages: [{ from: [1, 476], to: [1, 600] }],
    },
    {
      slug: "ghazali-shifa-al-ghalil",
      repo: "0525AH",
      version: "0505Ghazali.ShifaGhalil.Sham19Y0017827-ara1",
      title: "শিফাউল গালীল (ইমাম গাযালী)",
      author: "আবু হামিদ মুহাম্মাদ ইবনু মুহাম্মাদ আল-গাযালী (মৃ. ৫০৫ হি.)",
    },
    {
      slug: "abu-yala-al-udda-qiyas",
      repo: "0475AH",
      version: "0458AbuYaclaIbnFarra.CuddaFiUsulFiqh.ShamAY0038640-ara1",
      title: "আল-উদ্দা ফী উসূলিল ফিকহ (কাযী আবু ইয়ালা)",
      author: "কাযী আবু ইয়ালা মুহাম্মাদ ইবনুল হুসাইন ইবনুল ফাররা (মৃ. ৪৫৮ হি.)",
      part: "কিয়াসের সংজ্ঞা, কিয়াস ও ইল্লাতের অধ্যায়",
      pages: [
        { from: [1, 174], to: [1, 178], heading: "تعريف القياس" },
        { from: [4, 1273], to: [5, 1539] },
      ],
    },
    {
      slug: "shirazi-al-luma-qiyas",
      repo: "0500AH",
      version: "0476AbuIshaqShirazi.LumacFiUsulFiqh.JK000427-ara1",
      title: "আল-লুমা ফী উসূলিল ফিকহ (আবু ইসহাক আশ-শীরাযী)",
      author: "আবু ইসহাক ইবরাহীম ইবনু আলী আশ-শীরাযী (মৃ. ৪৭৬ হি.)",
      part: "কিয়াসের অধ্যায়",
      inlineHeadings: true,
      pages: [{ from: [1, 96], to: [1, 124] }],
    },
    {
      slug: "sarakhsi-al-usul-qiyas",
      repo: "0500AH",
      version: "0483IbnAhmadSarakhsi.Usul.JK000211-ara1",
      title: "উসূলুস সারাখসী (ইমাম সারাখসী)",
      author: "আবু বকর মুহাম্মাদ ইবনু আহমাদ আস-সারাখসী (মৃ. ৪৮৩ হি.)",
      part: "কিয়াস, ইসতিহসান ও ইল্লাতের আপত্তির অধ্যায়",
      inlineHeadings: true,
      pages: [{ from: [2, 118], to: [2, 300], heading: "باب القياس" }],
    },
    {
      slug: "ghazali-al-mustasfa-qiyas",
      repo: "0525AH",
      version: "0505Ghazali.Mustasfa.JK000276-ara1",
      title: "আল-মুসতাসফা (ইমাম গাযালী)",
      author: "আবু হামিদ মুহাম্মাদ ইবনু মুহাম্মাদ আল-গাযালী (মৃ. ৫০৫ হি.)",
      part: "কিয়াসের অধ্যায় ও ইল্লাতের অগ্রাধিকার",
      inlineHeadings: true,
      pages: [
        { from: [1, 280], to: [1, 342], heading: "مقدمة في حد القياس" },
        { from: [1, 379], to: [1, 383] },
      ],
    },
    {
      slug: "ibn-rushd-al-daruri-qiyas",
      repo: "0600AH",
      version: "0595IbnRushdHafid.DaruriFiUsulFiqh.Shamela0001703-ara1",
      title: "আদ-দারূরী ফী উসূলিল ফিকহ (ইবনু রুশদ)",
      author: "আবুল ওয়ালীদ মুহাম্মাদ ইবনু আহমাদ ইবনু রুশদ আল-হাফীদ (মৃ. ৫৯৫ হি.)",
      part: "কিয়াসের অধ্যায়",
      pages: [{ from: [1, 124], to: [1, 132] }],
    },
    {
      slug: "ibn-qudama-rawdat-al-nazir-qiyas",
      repo: "0625AH",
      version: "0620IbnQudamaMaqdisi.RawdatNazir.JK000156-ara1",
      title: "রওদাতুন নাযির (ইবনু কুদামা)",
      author: "মুওয়াফফাকুদ্দীন আবদুল্লাহ ইবনু আহমাদ ইবনু কুদামা আল-মাকদিসী (মৃ. ৬২০ হি.)",
      part: "কিয়াসের অধ্যায়",
      inlineHeadings: true,
      pages: [{ from: [1, 275], to: [1, 351] }],
    },
    {
      slug: "shawkani-irshad-al-fuhul-qiyas",
      repo: "1275AH",
      version: "1255Shawkani.IrshadFuhul.JK000152-ara1",
      title: "ইরশাদুল ফুহূল (ইমাম শাওকানী)",
      author: "মুহাম্মাদ ইবনু আলী আশ-শাওকানী (মৃ. ১২৫০ হি.)",
      part: "পঞ্চম মাকসাদ: কিয়াস ও ইসতিদলাল",
      inlineHeadings: true,
      pages: [{ from: [1, 336], to: [1, 416], heading: "المقصد الخامس في القياس" }],
    },
    {
      slug: "ibn-hazm-al-ihkam-ibtal-al-qiyas",
      repo: "0475AH",
      version: "0456IbnHazm.IhkamFiUsulAhkam.JK000122-ara1",
      title: "আল-ইহকাম ফী উসূলিল আহকাম (ইবনু হাযম)",
      author: "আবু মুহাম্মাদ আলী ইবনু আহমাদ ইবনু হাযম আল-আন্দালুসী (মৃ. ৪৫৬ হি.)",
      part: "কিয়াস ও ইল্লাত অস্বীকারের অধ্যায় (যাহিরী মত)",
      inlineHeadings: true,
      pages: [{ from: [7, 368], to: [8, 586] }],
    },
  ] satisfies OpenItiBook[],
  sirat: [
    {
      slug: "ibn-hisham-al-sira-al-nabawiyya",
      repo: "0225AH",
      version: "0213IbnHisham.SiraNabawiyya.Shamela0023833-ara1",
      fileSuffix: ".completed",
      title: "আস-সীরাতুন নাবাবিয়্যা (ইবনু হিশাম)",
      author: "আবু মুহাম্মাদ আবদুল মালিক ইবনু হিশাম (মৃ. ২১৮ হি.), ইবনু ইসহাকের সীরাত অবলম্বনে",
    },
    {
      slug: "tirmidhi-al-shamail-al-muhammadiyya",
      repo: "0300AH",
      version: "0279Tirmidhi.ShamailMuhammadiyya.JK000139-ara1",
      title: "আশ-শামাইলুল মুহাম্মাদিয়্যা (ইমাম তিরমিযী)",
      author: "আবু ঈসা মুহাম্মাদ ইবনু ঈসা আত-তিরমিযী (মৃ. ২৭৯ হি.)",
      inlineHeadings: true,
    },
    {
      slug: "ibn-hazm-jawami-al-sira",
      repo: "0475AH",
      version: "0456IbnHazm.JawamicSira.Shamela0009728-ara1",
      fileSuffix: ".completed",
      title: "জাওয়ামিউস সীরাহ (ইবনু হাযম)",
      author: "আবু মুহাম্মাদ আলী ইবনু আহমাদ ইবনু হাযম আল-আন্দালুসী (মৃ. ৪৫৬ হি.)",
    },
    {
      slug: "ibn-abd-al-barr-al-durar",
      repo: "0475AH",
      version: "0463IbnCabdBarr.Durar.Shamela0010695-ara1",
      fileSuffix: ".completed",
      title: "আদ-দুরার ফী ইখতিসারিল মাগাযী ওয়াস সিয়ার (ইবনু আবদিল বার)",
      author: "আবু উমার ইউসুফ ইবনু আবদিল্লাহ ইবনু আবদিল বার আল-কুরতুবী (মৃ. ৪৬৩ হি.)",
    },
    {
      slug: "ibn-sayyid-al-nas-uyun-al-athar",
      repo: "0750AH",
      version: "0734IbnSayyidNas.CuyunAthar.Shamela0023653-ara1",
      title: "উয়ূনুল আসার (ইবনু সায়্যিদিন নাস)",
      author: "আবুল ফাতহ মুহাম্মাদ ইবনু মুহাম্মাদ ইবনু সায়্যিদিন নাস (মৃ. ৭৩৪ হি.)",
    },
    {
      slug: "ibn-kathir-al-fusul-fi-sirat-al-rasul",
      repo: "0775AH",
      version: "0774IbnKathir.FusulMinSira.JK000796-ara1",
      title: "আল-ফুসূল ফী সীরাতির রাসূল (ইবনু কাসীর)",
      author: "ইমাদুদ্দীন আবুল ফিদা ইসমাঈল ইবনু উমার ইবনু কাসীর (মৃ. ৭৭৪ হি.)",
      inlineHeadings: true,
    },
    {
      slug: "ibn-kathir-qisas-al-anbiya",
      repo: "0775AH",
      version: "0774IbnKathir.QisasAnbiya.Shamela0000932-ara1",
      title: "কাসাসুল আম্বিয়া (ইবনু কাসীর)",
      author: "ইমাদুদ্দীন আবুল ফিদা ইসমাঈল ইবনু উমার ইবনু কাসীর (মৃ. ৭৭৪ হি.)",
      part: "নবী ও রাসূলগণের জীবনী",
    },
    {
      slug: "suyuti-tarikh-al-khulafa",
      repo: "0925AH",
      version: "0911Suyuti.TarikhKhulafa.Shamela0011997-ara1",
      fileSuffix: ".completed",
      title: "তারীখুল খুলাফা (ইমাম সুয়ূতী)",
      author: "জালালুদ্দীন আবদুর রহমান ইবনু আবী বকর আস-সুয়ূতী (মৃ. ৯১১ হি.)",
      part: "খলিফাগণের জীবনী",
    },
    {
      slug: "muhibb-tabari-al-simt-al-thamin",
      repo: "0700AH",
      version: "0694MuhibbDinTabari.SimtThamin.AOCP2023090622-ara1",
      title: "আস-সিমতুস সামীন ফী মানাকিবি উম্মাহাতিল মুমিনীন (মুহিব্বুদ্দীন তাবারী)",
      author: "মুহিব্বুদ্দীন আহমাদ ইবনু আবদিল্লাহ আত-তাবারী (মৃ. ৬৯৪ হি.)",
      part: "উম্মাহাতুল মুমিনীনের জীবনী",
    },
    {
      slug: "dimyati-nisa-al-rasul",
      repo: "0725AH",
      version: "0705SharafDinDimyati.NisaRasul.ShamAY0034435-ara1",
      title: "নিসাউর রাসূল ওয়া আওলাদুহু (শারফুদ্দীন দিময়াতী)",
      author: "শারফুদ্দীন আবদুল মুমিন ইবনু খালাফ আদ-দিময়াতী (মৃ. ৭০৫ হি.)",
      part: "নবীপত্নী ও নবীসন্তানদের জীবনী",
    },
    {
      slug: "ibn-abd-al-barr-al-istiab",
      repo: "0475AH",
      version: "0463IbnCabdBarr.IsticabFiMacrifatAshab.JK000778-ara1",
      fileSuffix: ".mARkdown",
      title: "আল-ইসতীআব ফী মারিফাতিল আসহাব (ইবনু আবদিল বার)",
      author: "আবু উমার ইউসুফ ইবনু আবদিল্লাহ ইবনু আবদিল বার আল-কুরতুবী (মৃ. ৪৬৩ হি.)",
      part: "সাহাবী ও সাহাবিয়াগণের জীবনী",
      inlineHeadings: true,
    },
    {
      slug: "ibn-al-jawzi-sifat-al-safwa",
      repo: "0600AH",
      version: "0597IbnJawzi.SifatSafwa.Shamela0012031-ara1",
      fileSuffix: ".mARkdown",
      title: "সিফাতুস সাফওয়া (ইবনুল জাওযী)",
      author: "জামালুদ্দীন আবুল ফারাজ আবদুর রহমান ইবনুল জাওযী (মৃ. ৫৯৭ হি.)",
      part: "সাহাবী, মহীয়সী নারী ও নেককার আলেমদের জীবনী",
    },
    {
      slug: "dhahabi-tadhkirat-al-huffaz",
      repo: "0750AH",
      version: "0748Dhahabi.TadhkiratHuffaz.JK000532-ara1",
      fileSuffix: ".mARkdown",
      title: "তাযকিরাতুল হুফফায (ইমাম যাহাবী)",
      author: "শামসুদ্দীন আবু আবদিল্লাহ মুহাম্মাদ ইবনু আহমাদ আয-যাহাবী (মৃ. ৭৪৮ হি.)",
      part: "হাদিসের ইমাম ও আলেমদের জীবনী",
      inlineHeadings: true,
    },
    {
      slug: "dhahabi-manaqib-abi-hanifa",
      repo: "0750AH",
      version: "0748Dhahabi.ManaqibAbiHanifa.Shamela0010461BK1-ara1",
      fileSuffix: ".mARkdown",
      title: "মানাকিবুল ইমাম আবী হানীফা (ইমাম যাহাবী)",
      author: "শামসুদ্দীন মুহাম্মাদ ইবনু আহমাদ আয-যাহাবী (মৃ. ৭৪৮ হি.)",
      part: "ইমাম আবু হানীফার জীবনী",
    },
    {
      slug: "suyuti-tazyin-al-mamalik",
      repo: "0925AH",
      version: "0911Suyuti.TazyinMamalik.ShamAY0034223-ara1",
      title: "তাযয়ীনুল মামালিক বিমানাকিবিল ইমাম মালিক (ইমাম সুয়ূতী)",
      author: "জালালুদ্দীন আবদুর রহমান আস-সুয়ূতী (মৃ. ৯১১ হি.)",
      part: "ইমাম মালিকের জীবনী",
    },
    {
      slug: "ibn-abi-hatim-adab-al-shafii",
      repo: "0350AH",
      version: "0327IbnAbiHatimRazi.AdabShafici.Shamela0001485-ara1",
      title: "আদাবুশ শাফিঈ ওয়া মানাকিবুহু (ইবনু আবী হাতিম)",
      author: "আবু মুহাম্মাদ আবদুর রহমান ইবনু আবী হাতিম আর-রাযী (মৃ. ৩২৭ হি.)",
      part: "ইমাম শাফিঈর জীবনী",
    },
    {
      slug: "ibn-al-jawzi-manaqib-al-imam-ahmad",
      repo: "0600AH",
      version: "0597IbnJawzi.ManaqibImamAhmad.Sham19Y0013250-ara1",
      title: "মানাকিবুল ইমাম আহমাদ (ইবনুল জাওযী)",
      author: "আবুল ফারাজ আবদুর রহমান ইবনুল জাওযী (মৃ. ৫৯৭ হি.)",
      part: "ইমাম আহমাদ ইবনু হাম্বলের জীবনী",
    },
  ] satisfies OpenItiBook[],
  fiqh: [
    {
      slug: "quduri-al-mukhtasar",
      repo: "0450AH",
      version: "0428AbuHusaynQuduri.Mukhtasar.Sham19Y0124336-ara1",
      title: "মুখতাসারুল কুদূরী (ইমাম কুদূরী)",
      author: "আবুল হুসাইন আহমাদ ইবনু মুহাম্মাদ আল-কুদূরী (মৃ. ৪২৮ হি.)",
      part: "হানাফি ফিকহ",
    },
    {
      slug: "marghinani-al-hidaya",
      repo: "0600AH",
      version: "0593BurhanDinFarghaniMarghinani.HidayaFiSharhBidaya.JK000242-ara1",
      title: "আল-হিদায়া (ইমাম মারগীনানী)",
      author: "বুরহানুদ্দীন আলী ইবনু আবী বকর আল-মারগীনানী (মৃ. ৫৯৩ হি.)",
      part: "হানাফি ফিকহ, দলিলসহ",
      inlineHeadings: true,
    },
    {
      slug: "mawsili-al-ikhtiyar",
      repo: "0700AH",
      version: "0683IbnMahmudMajdDinMawsili.IkhtiyarLiTaclil.JK009404-ara1",
      title: "আল-ইখতিয়ার লি-তা'লীলিল মুখতার (ইবনু মাওদূদ আল-মাওসিলী)",
      author: "আবদুল্লাহ ইবনু মাহমূদ ইবনু মাওদূদ আল-মাওসিলী (মৃ. ৬৮৩ হি.)",
      part: "হানাফি ফিকহ, দলিলসহ",
      inlineHeadings: true,
    },
    {
      slug: "ibn-abidin-radd-al-muhtar",
      repo: "1275AH",
      version: "1252IbnCabidinDimashqi.RaddMukhtar.JK000170-ara1",
      title: "রাদ্দুল মুহতার আলাদ দুররিল মুখতার (ইবনু আবিদীন)",
      author: "মুহাম্মাদ আমীন ইবনু উমার ইবনু আবিদীন আশ-শামী (মৃ. ১২৫২ হি.)",
      part: "হানাফি মাযহাবের ফতোয়ার প্রধান কিতাব (ফাতাওয়া শামী)",
      inlineHeadings: true,
    },
    {
      slug: "ibn-abi-zayd-al-risala",
      repo: "0400AH",
      version: "0386IbnAbiZaydQayrawani.Risala.JK000171-ara1",
      title: "আর-রিসালা (ইবনু আবী যাইদ আল-কাইরাওয়ানী)",
      author: "আবু মুহাম্মাদ আবদুল্লাহ ইবনু আবী যাইদ আল-কাইরাওয়ানী (মৃ. ৩৮৬ হি.)",
      part: "মালিকি ফিকহ",
      inlineHeadings: true,
    },
    {
      slug: "abu-shuja-matn-al-ghaya-wa-al-taqrib",
      repo: "0600AH",
      version: "0593IbnHusaynShihabDinIsbahani.GhayaWaTaqrib.Shamela0011370-ara1",
      title: "মাতনুল গায়াতি ওয়াত তাকরীব (আবু শুজা)",
      author: "আবু শুজা আহমাদ ইবনুল হুসাইন আল-আসফাহানী (মৃ. ৫৯৩ হি.)",
      part: "শাফিঈ ফিকহ",
    },
    {
      slug: "nawawi-minhaj-al-talibin",
      repo: "0700AH",
      version: "0676Nawawi.MinhajTalibin.JK001168-ara1",
      title: "মিনহাজুত তালিবীন (ইমাম নববী)",
      author: "মুহিউদ্দীন আবু যাকারিয়া ইয়াহইয়া ইবনু শারাফ আন-নববী (মৃ. ৬৭৬ হি.)",
      part: "শাফিঈ ফিকহ",
      inlineHeadings: true,
    },
    {
      slug: "ibn-qudama-umdat-al-fiqh",
      repo: "0625AH",
      version: "0620IbnQudamaMaqdisi.CumdatFiqh.JK000287-ara1",
      title: "উমদাতুল ফিকহ (ইবনু কুদামা)",
      author: "মুওয়াফফাকুদ্দীন আবদুল্লাহ ইবনু আহমাদ ইবনু কুদামা আল-মাকদিসী (মৃ. ৬২০ হি.)",
      part: "হাম্বলি ফিকহ",
      inlineHeadings: true,
    },
    {
      slug: "ibn-rushd-bidayat-al-mujtahid",
      repo: "0600AH",
      version: "0595IbnRushdHafid.BidayatMujtahid.JK000222-ara1",
      title: "বিদায়াতুল মুজতাহিদ (ইবনু রুশদ)",
      author: "আবুল ওয়ালীদ মুহাম্মাদ ইবনু আহমাদ ইবনু রুশদ আল-হাফীদ (মৃ. ৫৯৫ হি.)",
      part: "চার মাযহাবের তুলনামূলক ফিকহ",
      inlineHeadings: true,
    },
    {
      slug: "ibn-al-salah-fatawa",
      repo: "0650AH",
      version: "0643IbnSalahShahrazuri.Fatawa.JK006986-ara1",
      title: "ফাতাওয়া ইবনিস সালাহ",
      author: "তাকিউদ্দীন আবু আমর উসমান ইবনু আবদির রহমান ইবনুস সালাহ আশ-শাহরাযূরী (মৃ. ৬৪৩ হি.)",
      part: "ফতোয়া সংকলন (শাফিঈ)",
      inlineHeadings: true,
    },
  ] satisfies OpenItiBook[],
} as const;

export type PublicDomainFormat = "gutenberg" | "wikisource" | "archive";

export interface ArchiveVolumeSource {
  item: string;
  file: string;
  kind: "searchtext" | "djvuxml";
  fromLeaf: number;
  toLeaf: number;
  volume?: number;
}

export interface ArchiveBookSource {
  volumes: readonly ArchiveVolumeSource[];
  runningHead: string;
  footnote?: string;
  ignoreCaseHead?: boolean;
}

export interface PublicDomainBook {
  slug: string;
  sourceType: "sirat" | "fiqh";
  format: PublicDomainFormat;
  url: string;
  title: string;
  author: string;
  license: string;
  note: string;
  gutenberg?: { startLine: string; endLine: string };
  archive?: ArchiveBookSource;
}

const ARCHIVE_OCR_NOTE =
  "স্ক্যান করা বইয়ের OCR লেখা, তাই কিছু নাম ও শব্দের বানানে ভুল থাকতে পারে। অনুবাদকের পাদটীকা বাদ দেওয়া হয়েছে।";

export const PUBLIC_DOMAIN_BOOKS: readonly PublicDomainBook[] = [
  {
    slug: "dinet-life-of-mohammad",
    sourceType: "sirat",
    format: "gutenberg",
    url: "https://www.gutenberg.org/cache/epub/39523/pg39523.txt",
    title: "The Life of Mohammad (দিনে ও সুলাইমান ইবনু ইবরাহীম, ১৯১৮, ইংরেজি)",
    author: "Étienne (Nasreddine) Dinet (d. 1929) and Sliman ben Ibrahim (d. 1953)",
    license:
      "Public domain (Project Gutenberg eBook #39523; both authors died more than 70 years ago)",
    note: "আধুনিক যুগের ইংরেজি সীরাত, সহায়ক উৎস। ইবনু হিশাম, ইবনু সা'দ ও বুখারী অবলম্বনে লেখা, তবে সীরাতে হালাবিয়্যা থেকে কিছু দুর্বল কাহিনিও আছে।",
    gutenberg: { startLine: "CHAPTER THE FIRST", endLine: "BIBLIOGRAPHY" },
  },
  {
    slug: "pickthall-introduction-life-of-the-prophet",
    sourceType: "sirat",
    format: "wikisource",
    url: "https://en.wikisource.org/w/index.php?title=The_Meaning_of_the_Glorious_Koran_(1930)/Introduction&action=render",
    title: "The Meaning of the Glorious Koran, Introduction (মারমাডিউক পিকথল, ১৯৩০, ইংরেজি)",
    author: "Muhammad Marmaduke Pickthall (d. 1936)",
    license: "Public domain (published 1930, author died 1936; Wikisource PD-US)",
    note: "আধুনিক যুগের ইংরেজি সীরাত-সারাংশ, সহায়ক উৎস। নবীজীবনের সংক্ষিপ্ত বিবরণ, প্রচলিত দুর্বল কাহিনি ছাড়া।",
  },
  {
    slug: "suyuti-history-of-the-caliphs-jarrett",
    sourceType: "sirat",
    format: "archive",
    url: "https://archive.org/details/cu31924023164654",
    title: "History of the Caliphs (তারীখুল খুলাফা, ইমাম সুয়ূতী; অনুবাদ: জ্যারেট, ১৮৮১, ইংরেজি)",
    author: "Jalal al-Din al-Suyuti (d. 911 AH), translated by H. S. Jarrett (d. 1919)",
    license:
      "Public domain (Calcutta 1881, translator died 1919; Cornell University Library scan on the Internet Archive)",
    note: `খলিফাগণের জীবনী, তারীখুল খুলাফার ইংরেজি অনুবাদ, সহায়ক উৎস। মূল আরবি কিতাবও এই সংকলনে আছে। ${ARCHIVE_OCR_NOTE}`,
    archive: {
      volumes: [
        {
          item: "cu31924023164654",
          file: "cu31924023164654",
          kind: "searchtext",
          fromLeaf: 30,
          toLeaf: 579,
        },
      ],
      runningHead: String.raw`^\W{0,3}[\dlI]{1,3}\s*\W{0,3}$`,
      footnote: String.raw`^(?:[*§¶†‡•«%+^]|\*\*|II|[tfXJUH])\s+\p{Lu}`,
    },
  },
  {
    slug: "ibn-khallikan-biographical-dictionary-de-slane",
    sourceType: "sirat",
    format: "archive",
    url: "https://archive.org/details/32882019293961-ibnkhallikansbi",
    title:
      "Ibn Khallikan's Biographical Dictionary (ওয়াফায়াতুল আ'ইয়ান, ইবনু খাল্লিকান; অনুবাদ: দ্য স্লেন, ১৮৪২-১৮৭১, ইংরেজি)",
    author: "Ibn Khallikan (d. 681 AH), translated by William MacGuckin de Slane (d. 1878)",
    license:
      "Public domain (Paris 1842 to 1871, translator died 1878; scans on the Internet Archive)",
    note: `ইমাম, ফকীহ, মুহাদ্দিস, খলিফা, উযীর ও কবিদের জীবনী, ওয়াফায়াতুল আ'ইয়ানের ইংরেজি অনুবাদ, সহায়ক উৎস। সাহাবীদের জীবনী এতে প্রায় নেই। ${ARCHIVE_OCR_NOTE}`,
    archive: {
      volumes: [
        {
          item: "de-slane.-w.-m.-trans.-ibn-khallikans-biographical-dictionary-vol.-i-1843",
          file: "de Slane,. W.M. (Trans.), Ibn Khallikan's Biographical Dictionary, Vol. I, 1843",
          kind: "searchtext",
          fromLeaf: 50,
          toLeaf: 709,
          volume: 1,
        },
        {
          item: "de-slane.-w.-m.-trans.-ibn-khallikans-biographical-dictionary-vol.-ii-1843",
          file: "de Slane,. W.M. (Trans.), Ibn Khallikan's Biographical Dictionary, Vol. II, 1843",
          kind: "searchtext",
          fromLeaf: 23,
          toLeaf: 700,
          volume: 2,
        },
        {
          item: "32882019293961-ibnkhallikansbi",
          file: "HighRes_32882019293961",
          kind: "searchtext",
          fromLeaf: 8,
          toLeaf: 685,
          volume: 3,
        },
        {
          item: "32882019293979-ibnkhallikansbi",
          file: "HighRes_32882019293979",
          kind: "djvuxml",
          fromLeaf: 24,
          toLeaf: 625,
          volume: 4,
        },
      ],
      runningHead: String.raw`^\W{0,3}(?:[\dt]{1,3}\s*\W?\s*)?(?:I\w{1,2}\s+\w{2,4}LL\w{1,3}AN.S|BIOGRAPHI\w{1,2}AL\s+DICTIONARY\.?)(?:\s*\W?\s*\d{1,3})?(?:\s+BIOGRAPHICAL\s+DICTIONARY\.?)?\W{0,3}$`,
      footnote: String.raw`^\(\d{1,2}\)\s`,
      ignoreCaseHead: true,
    },
  },
  {
    slug: "nawawi-minhaj-et-talibin-howard",
    sourceType: "fiqh",
    format: "archive",
    url: "https://archive.org/details/cu31924023205390",
    title: "Minhaj et Talibin (মিনহাজুত তালিবীন, ইমাম নববী; অনুবাদ: হাওয়ার্ড, ১৯১৪, ইংরেজি)",
    author:
      "Imam al-Nawawi (d. 676 AH), translated by E. C. Howard from the French of L. W. C. van den Berg",
    license:
      "Public domain in the United States (London 1914; Cornell University Library scan on the Internet Archive)",
    note: `শাফিঈ মাযহাবের মূল মতন মিনহাজের ইংরেজি অনুবাদ (ফরাসি অনুবাদ থেকে), সহায়ক উৎস। মূল আরবি মিনহাজও এই সংকলনে আছে। ${ARCHIVE_OCR_NOTE}`,
    archive: {
      volumes: [
        {
          item: "cu31924023205390",
          file: "cu31924023205390",
          kind: "searchtext",
          fromLeaf: 20,
          toLeaf: 577,
        },
      ],
      runningHead: String.raw`^(?:\d{1,3}\s+MINHAJ ET TALIBIN\b.*|[A-Z][A-Z ,.'’()—-]+\s+\d{1,3})$`,
    },
  },
  {
    slug: "khalil-maliki-law-ruxton",
    sourceType: "fiqh",
    format: "archive",
    url: "https://archive.org/details/ruxton1916maliki-law-khalil",
    title: "Maliki Law (মুখতাসারু খলীল-এর সারসংক্ষেপ; রাক্সটন, ১৯১৬, ইংরেজি)",
    author:
      "Khalil ibn Ishaq al-Jundi (d. 776 AH), summarised by F. H. Ruxton from the French of Perron",
    license: "Public domain in the United States (London 1916; scan on the Internet Archive)",
    note: `মালিকী মাযহাবের মূল মতন মুখতাসারু খলীল-এর ইংরেজি সারসংক্ষেপ, পূর্ণ অনুবাদ নয়, সহায়ক উৎস। ${ARCHIVE_OCR_NOTE}`,
    archive: {
      volumes: [
        {
          item: "ruxton1916maliki-law-khalil",
          file: "Ruxton,F.H.[Trans.](1916)Maliki Law-Khalil",
          kind: "searchtext",
          fromLeaf: 29,
          toLeaf: 411,
        },
      ],
      runningHead: String.raw`^(?:\d{1,3}\s+[A-Z(][A-Z ,.'’‘()—-]+|[A-Z(‘][A-Z ,.'’‘()—-]+\s+[\dIl]{1,3})$`,
      footnote: String.raw`^(?:\d{1,2}[a-z]?|[*¢+†‡§]|\(\*\))\s+(?!\d)`,
    },
  },
  {
    slug: "ibn-abi-zayd-first-steps-in-muslim-jurisprudence",
    sourceType: "fiqh",
    format: "archive",
    url: "https://archive.org/details/firststepsinmus00suhrgoog",
    title:
      "First Steps in Muslim Jurisprudence (আর-রিসালা থেকে নির্বাচিত, ইবনু আবী যায়দ; অনুবাদ: রাসেল ও সোহরাওয়ার্দী, ১৯০৬, ইংরেজি)",
    author:
      "Ibn Abi Zayd al-Qayrawani (d. 386 AH), translated by Alexander David Russell (d. 1934) and Abdullah al-Mamun Suhrawardy (d. 1935)",
    license:
      "Public domain (London 1906, both translators died more than 70 years ago; Google scan on the Internet Archive)",
    note: `মালিকী মাযহাবের আর-রিসালা থেকে বিবাহ, তালাক, উত্তরাধিকার ইত্যাদি বিধানের ইংরেজি অনুবাদ ও ব্যাখ্যা, সহায়ক উৎস। মূল আরবি রিসালাও এই সংকলনে আছে। ${ARCHIVE_OCR_NOTE}`,
    archive: {
      volumes: [
        {
          item: "firststepsinmus00suhrgoog",
          file: "firststepsinmus00suhrgoog",
          kind: "djvuxml",
          fromLeaf: 28,
          toLeaf: 123,
        },
      ],
      runningHead: String.raw`^(?:\d{1,3}\s+[A-Z][A-Z ,.'’()—-]+|[A-Z][A-Z ,.'’()—-]+\s+\d{1,3})$`,
    },
  },
  {
    slug: "baillie-digest-of-moohummudan-law-hanafi",
    sourceType: "fiqh",
    format: "archive",
    url: "https://archive.org/details/digestmoohummud00bailgoog",
    title:
      "A Digest of Moohummudan Law, Part I (ফাতাওয়া আলমগীরী থেকে সংকলিত; বেইলি, ১৮৭৫, ইংরেজি)",
    author:
      "Compiled from the Fatawa Alamgiri and other Hanafi works by Neil B. E. Baillie (d. 1883)",
    license: "Public domain (London 1875, author died 1883; Google scan on the Internet Archive)",
    note: `হানাফী মাযহাবের ফাতাওয়া আলমগীরী (ফাতাওয়া হিন্দিয়া) থেকে বিবাহ, তালাক, ক্রয়-বিক্রয়, ওয়াকফ ইত্যাদি বিধানের ইংরেজি সংকলন, সহায়ক উৎস। ${ARCHIVE_OCR_NOTE}`,
    archive: {
      volumes: [
        {
          item: "digestmoohummud00bailgoog",
          file: "digestmoohummud00bailgoog",
          kind: "searchtext",
          fromLeaf: 58,
          toLeaf: 867,
        },
      ],
      runningHead: String.raw`^(?:\d{1,3}\s+[A-Z][A-Z ,.'’()—-]+|[A-Z"][A-Z ,.'’()—-]+\s+\d{1,3})$`,
      footnote: String.raw`^\d{1,2}\s+(?=\p{Lu})`,
    },
  },
  {
    slug: "sajawandi-al-sirajiyyah-jones-rumsey",
    sourceType: "fiqh",
    format: "archive",
    url: "https://archive.org/details/alsirajiyyahorm00rumsgoog",
    title: "Al Sirajiyyah (আস-সিরাজিয়্যা, মিরাস; অনুবাদ: উইলিয়াম জোন্স, ১৮৬৯, ইংরেজি)",
    author:
      "Siraj al-Din al-Sajawandi (d. c. 600 AH), translated by Sir William Jones (d. 1794), edited by Almaric Rumsey",
    license:
      "Public domain (London 1869, translator died 1794; Google scan on the Internet Archive)",
    note: `হানাফী মাযহাবে মিরাস (উত্তরাধিকার) বণ্টনের প্রসিদ্ধ মতন আস-সিরাজিয়্যার ইংরেজি অনুবাদ, সহায়ক উৎস। ${ARCHIVE_OCR_NOTE}`,
    archive: {
      volumes: [
        {
          item: "alsirajiyyahorm00rumsgoog",
          file: "alsirajiyyahorm00rumsgoog",
          kind: "djvuxml",
          fromLeaf: 21,
          toLeaf: 77,
        },
      ],
      runningHead: String.raw`^(?:\d{1,3}\s+[A-Z][A-Z ,.'’()—-]+|[A-Z][A-Z ,.'’()—-]+\s+\d{1,3})$`,
      footnote: String.raw`^[*†‡§tf]\s+`,
    },
  },
];

export const SOURCE_VIEW_CONFIG = {
  maxReferenceChars: 300,
  maxChunkOverlapChars: 400,
  minChunkOverlapChars: 20,
  maxFileNameChars: 120,
  downloadFeedbackMs: 2_500,
  cacheSeconds: 86_400,
  page: { width: 420, height: 595, margin: 36 },
  fontSize: { title: 14, detail: 9.5, label: 9.5, text: 11, arabic: 16, footer: 7.5 },
  colors: {
    text: "#1b1d21",
    muted: "#5f6368",
    accent: "#0f766e",
    highlight: "#fff1a8",
    highlightEdge: "#e0b400",
    rule: "#dadce0",
  },
  fonts: {
    bangla: "HindSiliguri-Regular.ttf",
    banglaBold: "HindSiliguri-SemiBold.ttf",
    arabic: "Amiri-Regular.ttf",
  },
  renderScale: 2.5,
  clientCacheMs: 30 * 60_000,
  clientCacheEntries: 16,
  translationWaitMs: 40_000,
  pendingRetryMs: 60_000,
  revokeDelayMs: 5_000,
  wheelLineHeight: 16,
  keyboardPanStep: 80,
  zoomStep: 0.25,
  wheelZoomRate: 0.0025,
  minScale: 0.5,
  maxScale: 5,
} as const;

export const FILE_INGESTION_CONFIG = {
  minCharsPerPage: 20,
  maxChapterChars: 60,
  minBanglaLetterShare: 0.3,
  minAnsiSignatureShare: 0.01,
} as const;

export const RATE_LIMIT_CONFIG = {
  scopes: {
    chat: { minute: 5, hour: 30, day: 100 },
    feedback: { minute: 10, hour: 60, day: 200 },
    maintenance: { minute: 1, hour: 2, day: 4 },
    sourceView: { minute: 30, hour: 300, day: 1000 },
    usage: { minute: 20, hour: 200, day: 1000 },
    admin: { minute: 240, hour: 5000, day: 40000 },
    adminLogin: { minute: 5, hour: 20, day: 60 },
    adminReset: { minute: 6, hour: 30, day: 60 },
    helpRequest: { minute: 2, hour: 6, day: 12 },
    helpTrack: { minute: 30, hour: 300, day: 2000 },
    masail: { minute: 60, hour: 1200, day: 12000 },
  },
  maxQuestionChars: 1000,
  maxMessages: 30,
} as const;

export const ADMIN_CONFIG = {
  command: "/admin",
  accounts: ["jfemon8@gmail.com", "emon.usulai@gmail.com"],
  sessionCookie: "usul_admin_session",
  sessionDays: 7,
  sessionTouchMinutes: 10,
  resetMinutes: 60,
  maxResetRequestsPerHour: 3,
  minPasswordChars: 6,
  maxPasswordChars: 128,
  auditDays: 365,
  pageSize: 25,
  databasePageSize: 20,
  filesPageSize: 30,
  maxJsonDocumentBytes: 2_000_000,
  scrypt: { cost: 32_768, blockSize: 8, parallelization: 1, keyLength: 64, maxMemory: 67_108_864 },
  paths: {
    dashboard: "/admin",
    login: "/admin/login",
    forgotPassword: "/admin/forgot-password",
    resetPassword: "/admin/reset-password",
  },
  protectedCollections: ["admin_accounts", "admin_sessions", "admin_reset_tokens"],
} as const;

export const STAFF_CONFIG = {
  defaultCategories: [
    { slug: "moderator", name: "মডারেটর", role: "moderator" },
    { slug: "mufti", name: "মুফতি", role: "scholar" },
    { slug: "alem", name: "আলেম", role: "scholar" },
    { slug: "ulama", name: "ওলামা", role: "scholar" },
    { slug: "imam", name: "ইমাম", role: "scholar" },
    { slug: "shaykh", name: "শায়েখ", role: "scholar" },
  ],
  maxNameChars: 80,
  maxCategoryNameChars: 40,
  maxPhoneChars: 20,
  generatedPasswordChars: 12,
  categoryCacheMs: 30_000,
} as const;

export const FEEDBACK_VOTE_CONFIG = {
  retentionDays: 365,
  maxAnswerChars: 8_000,
  storageKey: "usul-ai:feedback:v1",
  maxStoredVotes: 1_000,
} as const;

export const REVIEW_CONFIG = {
  maxOpenItems: 5_000,
  maxQuestionChars: 2_000,
  maxAnswerChars: 8_000,
  maxNoteChars: 2_000,
  claimMinutes: 60,
} as const;

export const HELP_CONFIG = {
  path: "/help",
  maxQuestionChars: 2_000,
  maxDetailsChars: 4_000,
  maxAnswerChars: 20_000,
  claimMinutes: 120,
  answeredRetentionDays: 180,
  openRetentionDays: 365,
  storageKey: "usul-ai:help-requests:v1",
  maxStoredRequests: 50,
} as const;

export const MASAIL_CONFIG = {
  path: "/masail",
  pageSize: 20,
  revalidateSeconds: 300,
  maxSearchChars: 200,
  sitemapPageSize: 200,
  sitemapPages: 25,
} as const;

export const CLIENT_CACHE_CONFIG = {
  routerStaleSeconds: { dynamic: 30, static: 300 },
  widget: { maxAge: 3_600, staleWhileRevalidate: 86_400 },
  brand: { maxAge: 86_400, staleWhileRevalidate: 604_800 },
  appIcon: { maxAge: 604_800, staleWhileRevalidate: 2_592_000 },
  masailList: { maxAge: 60, staleWhileRevalidate: 300 },
} as const;

export function browserCacheControl(policy: {
  maxAge: number;
  staleWhileRevalidate: number;
}): string {
  return `public, max-age=${policy.maxAge}, stale-while-revalidate=${policy.staleWhileRevalidate}`;
}

export interface ChatCommandEntry {
  command: string;
  description: string;
  kind: "usage" | "new-chat" | "link";
  href?: string;
  hidden?: boolean;
}

export const CHAT_COMMANDS = [
  { command: "/new", description: "নতুন চ্যাট শুরু করুন", kind: "new-chat" },
  {
    command: "/masail",
    description: "আলেমদের প্রকাশিত মাসআলা দেখুন",
    kind: "link",
    href: "/masail",
  },
  {
    command: "/ask",
    description: "আলেমের কাছে নতুন প্রশ্ন পাঠান",
    kind: "link",
    href: "/help?ask=1",
  },
  {
    command: "/help",
    description: "আলেমের কাছে পাঠানো আমার প্রশ্ন ও উত্তর",
    kind: "link",
    href: "/help",
  },
  { command: "/usage", description: "ব্যবহার এবং সংরক্ষিত তথ্যের হিসাব দেখুন", kind: "usage" },
  { command: "/login", description: "মডারেটর ও আলেমদের লগইন", kind: "link", href: "/admin/login" },
  {
    command: "/admin",
    description: "অ্যাডমিন প্যানেল",
    kind: "link",
    href: "/admin",
    hidden: true,
  },
] as const satisfies readonly ChatCommandEntry[];

export const USAGE_CONFIG = {
  command: "/usage",
  warnRatio: 0.7,
  criticalRatio: 0.9,
  reportedScopes: ["chat", "sourceView", "feedback"],
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
  feedbackTallyDays: 365,
  feedbackDrainBatch: 2_000,
  staleSignalDays: 365,
  rollupBatchSize: 2_000,
} as const;
