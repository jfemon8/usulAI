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
- **LLM:** Gemini (primary) → Groq (secondary) → OpenRouter (fallback), via the Vercel AI SDK
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

## Ingestion

Quran/Hadith সরাসরি ফ্রি public API থেকে আসে — **কোনো API key লাগে না**, প্রতিটা সোর্সে ৩টা করে provider fallback হিসেবে সাজানো। Ijma/Qiyas/Sirat-এর raw ফাইল (`.pdf` / `.docx` / `.txt` / `.md`) `data/ijma`, `data/qiyas`, `data/sirat` ফোল্ডারে রেখে চালাও:

```bash
npm run ingest                   # সব সোর্স
npm run ingest -- quran hadith   # শুধু নির্দিষ্ট সোর্স
npm run ingest -- --replace      # পুরনো চাংক মুছে নতুন করে বসায়
```

সোর্স-ভিত্তিক বিস্তারিত: [`docs/data-sources.md`](docs/data-sources.md)

## Floating widget

অন্য যেকোনো ওয়েবসাইটে বসানোর জন্য:

```html
<script src="https://<your-domain>/widget.js" defer></script>
```

Widget বিল্ড করতে: `npm run build:widget`

## Scripts

| Command                | কাজ                                                        |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`          | লোকাল ডেভেলপমেন্ট সার্ভার                                  |
| `npm run build`        | প্রোডাকশন বিল্ড                                            |
| `npm run lint`         | ESLint                                                     |
| `npm run typecheck`    | TypeScript চেক                                             |
| `npm test`             | Vitest ইউনিট টেস্ট                                         |
| `npm run setup:db`     | MongoDB Atlas কালেকশন + vector search index তৈরি/আপডেট     |
| `npm run ingest`       | Quran/Hadith/Ijma/Qiyas ডেটা প্রসেস করে vector DB-তে বসানো |
| `npm run build:widget` | `public/widget.js` বিল্ড করা                               |

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
