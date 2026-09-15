<p align="center">
  <img src="public/logo.svg" width="96" height="96" alt="Usul AI" />
</p>

# Usul AI

Usul AI (উসূল AI) একটা Islamic Q&A assistant, যেটার প্রতিটা উত্তর কঠোরভাবে চারটা উৎস থেকে আসে — এবং সবসময় এই priority অনুসরণ করে:

1. **Quran**
2. **Hadith**
3. **Ijma** (scholarly consensus)
4. **Qiyas** (analogical reasoning)
5. **Sirat** (নবী জীবনী ও ফিকহ কিতাব — supplementary)

প্রতিটা উত্তরের সাথে সোর্স রেফারেন্স দেখানো হয় (UI-তে ক্লিকযোগ্য চিপ হিসেবে), আর ইউজার বাংলা বা বাংলিশে প্রশ্ন করলে উত্তরও বাংলাতেই আসে।

কোনো উত্তর এই উৎসগুলোর বাইরে থেকে দেওয়া হয় না — মডেল শুধু retrieval দিয়ে পাওয়া প্রাসঙ্গিক অংশের উপর ভিত্তি করে উত্তর তৈরি করে (Retrieval-Augmented Generation)।

## Stack

- **Framework:** Next.js (App Router) + TypeScript
- **LLM:** Gemini → Groq → OpenRouter → Z.ai GLM, মডেল ধরে ধরে fallback, via the Vercel AI SDK
- **Vector DB:** MongoDB Atlas Vector Search
- **Object storage:** Cloudinary (raw Ijma/Qiyas/Sirat source files)
- **Styling:** Tailwind CSS
- **Parsing:** unpdf (PDF), mammoth (DOCX)

## Getting started

```bash
npm install
cp .env.example .env.local   # ও প্রয়োজনীয় key বসাও
npm run setup:db             # MongoDB Atlas collection + vector index
npm run dev
```

বিস্তারিত সেটআপ: [`docs/setup.md`](docs/setup.md)

## Vercel-এ deploy (GitHub থেকে সরাসরি)

কোনো `vercel.json` বদলাতে বা build command লিখতে হয় না। Vercel-এ **Add New Project → GitHub repo import → Deploy**। Framework, build (`npm run build`, যেটা widget.js-ও বানায়), Node সংস্করণ, দৈনিক maintenance cron আর function-এর সময়সীমা সব repo থেকেই আসে।

শুধু গোপন key গুলো Vercel-এর **Settings → Environment Variables**-এ একবার বসাতে হয়, কারণ গোপন তথ্য repo-তে রাখা যায় না:

| Variable                                                                               | লাগবে?     | কাজ                                                                                           |
| -------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                                                                          | হ্যাঁ      | Atlas connection string (Atlas Network Access-এ `0.0.0.0/0` দিতে হয়, Vercel-এর IP স্থির নয়) |
| `GOOGLE_GENERATIVE_AI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `ZAI_API_KEY` | অন্তত একটা | যেগুলো দেওয়া থাকবে শুধু সেই মডেলগুলোই চেষ্টা হবে; Gemini key থাকলে embedding-ও চালু হয়      |
| `INGEST_API_SECRET`                                                                    | ঐচ্ছিক     | ingest trigger ও rate-limit salt-এর গোপন মান                                                  |
| `CRON_SECRET`                                                                          | ঐচ্ছিক     | দিলে দৈনিক cron এই secret দিয়ে যাচাই হয়; না দিলে শুধু Vercel cron, কড়া rate limit-সহ       |
| `NEXT_PUBLIC_APP_URL`                                                                  | ঐচ্ছিক     | না দিলে Vercel-এর production URL নিজে থেকে ব্যবহার হয়                                        |
| `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPOSITORY`                                           | ঐচ্ছিক     | `/api/ingest` থেকে GitHub Actions ingestion চালু করতে                                         |

Deploy শেষে `https://<your-domain>/api/health` খোলো: `"status": "ok"` মানে database আর অন্তত একটা মডেল ঠিকঠাক কনফিগার করা; কোনটা নেই সেটাও ওখানে দেখা যায়।

ইজমার কিতাবগুলো (OpenITI, CC BY-NC-SA 4.0) Atlas ও Cloudinary-তে আগেই তোলা আছে, তাই deploy-এর জন্য `data/` লাগে না। আবার ingest করতে হলে `npm run import:ijma` চালিয়ে তারপর ingest করো, বা GitHub Actions-এর **Ingest** workflow চালাও।

## Ingestion

Quran/Hadith সরাসরি ফ্রি public API থেকে আসে — **কোনো API key লাগে না**, প্রতিটা সোর্সে ৩টা করে provider fallback হিসেবে সাজানো। Ijma/Qiyas/Sirat-এর raw ফাইল (`.pdf` / `.docx` / `.txt` / `.md`) `data/ijma`, `data/qiyas`, `data/sirat` ফোল্ডারে রেখে চালাও:

```bash
npm run ingest                   # সব সোর্স
npm run ingest -- quran hadith   # শুধু নির্দিষ্ট সোর্স
npm run ingest -- --dry-run      # কী বদলাবে শুধু দেখায়, কিছু লেখে না
npm run ingest -- --replace      # উৎস থেকে হারিয়ে যাওয়া রেফারেন্স মুছে দেয়
```

সোর্স-ভিত্তিক বিস্তারিত: [`docs/data-sources.md`](docs/data-sources.md)

## Floating widget

অন্য যেকোনো ওয়েবসাইটে বসানোর জন্য:

```html
<script src="https://<your-domain>/widget.js" defer></script>
```

`npm run build` নিজেই `public/widget.js` তৈরি করে; আলাদা করে লাগলে `npm run build:widget`।

## Scripts

| Command                     | কাজ                                                                       |
| --------------------------- | ------------------------------------------------------------------------- |
| `npm run dev`               | লোকাল ডেভেলপমেন্ট সার্ভার                                                 |
| `npm run build`             | প্রোডাকশন বিল্ড                                                           |
| `npm run lint`              | ESLint                                                                    |
| `npm run typecheck`         | TypeScript চেক                                                            |
| `npm test`                  | Vitest ইউনিট টেস্ট                                                        |
| `npm run setup:db`          | MongoDB Atlas কালেকশন + vector search index তৈরি/আপডেট                    |
| `npm run ingest`            | Quran/Hadith/Ijma/Qiyas ডেটা প্রসেস করে vector DB-তে বসানো                |
| `npm run build:widget`      | `public/widget.js` বিল্ড করা                                              |
| `npm run import:ijma`       | OpenITI থেকে ইজমার চারটি কিতাব `data/ijma`-তে নামানো                      |
| `npm run translate:sources` | ইজমার অংশগুলো আগেভাগে অনুবাদ করে cache-এ রাখা (ঐচ্ছিক; উত্তরের সময়ও হয়) |
| `npm run storage:report`    | Atlas storage ব্যবহারের হিসাব                                             |
| `npm run maintain`          | লগ রোলআপ, পুরনো ডেটা ছাঁটাই                                               |

## Brand assets

লোগোটা **রুবউল হিজ্‌ব** (۞) — কুরআনের পারা-বিভাজন চিহ্ন — থেকে নেওয়া আট-কোণা জ্যামিতিক তারা: দুটি বর্গ ৪৫° ঘুরিয়ে বসানো, মাঝে হীরক-আকৃতির শূন্যস্থান। অ-অবয়বী ইসলামি জ্যামিতি, আর প্রতীকীভাবে স্তরে স্তরে কেন্দ্রে (উসূল/মূলে) মিলিত হওয়া।

| ফাইল                                                         | কাজ                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------- |
| [`public/logo.svg`](public/logo.svg)                         | মূল মার্ক (গ্রেডিয়েন্ট), README/ডক-এ ব্যবহারের জন্য |
| [`public/logo-wordmark.svg`](public/logo-wordmark.svg)       | মার্ক + "Usul AI" লকআপ                               |
| [`src/app/icon.svg`](src/app/icon.svg)                       | favicon — ছোট সাইজে পড়া যায় এমন সলিড ভার্সন        |
| [`src/app/apple-icon.tsx`](src/app/apple-icon.tsx)           | iOS হোম-স্ক্রিন আইকন, ১৮০×১৮০ PNG                    |
| [`src/app/opengraph-image.tsx`](src/app/opengraph-image.tsx) | সোশ্যাল শেয়ার কার্ড, ১২০০×৬৩০ PNG                   |
| [`src/app/manifest.ts`](src/app/manifest.ts)                 | PWA manifest                                         |
| [`src/components/ui/Logo.tsx`](src/components/ui/Logo.tsx)   | অ্যাপের ভেতরের `LogoMark` / `LogoBadge`              |

PNG দুটো বিল্ডের সময় `next/og` দিয়ে তৈরি হয় — রিপোতে কোনো বাইনারি ইমেজ রাখতে হয় না, রঙ বা জ্যামিতি বদলালে দুটোই নিজে থেকে আপডেট হয়। রঙের টোকেন [`src/lib/brand.ts`](src/lib/brand.ts)-এ।

আরও দেখো: [`docs/architecture.md`](docs/architecture.md)
