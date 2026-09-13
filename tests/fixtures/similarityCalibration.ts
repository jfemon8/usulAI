export interface CalibrationCase {
  question: string;
  references: string[];
}

export const RELEVANT_CASES: CalibrationCase[] = [
  { question: "রোজা কাদের উপর ফরজ করা হয়েছে", references: ["Al-Baqara 2:183"] },
  { question: "রমজান মাসে কী নাজিল হয়েছে", references: ["Al-Baqara 2:185"] },
  { question: "মদ ও জুয়া সম্পর্কে বিধান", references: ["Al-Baqara 2:219"] },
  { question: "সুদ কেন হারাম", references: ["Al-Baqara 2:275"] },
  { question: "কিবলা পরিবর্তনের আয়াত", references: ["Al-Baqara 2:144"] },
  { question: "আয়াতুল কুরসি", references: ["Al-Baqara 2:255"] },
  { question: "ঋণের লেনদেন লিখে রাখার নির্দেশ", references: ["Al-Baqara 2:282"] },
  { question: "হায়েজ অবস্থায় স্ত্রীর কাছে যাওয়া", references: ["Al-Baqara 2:222"] },
  { question: "তালাক কতবার দেওয়া যায়", references: ["Al-Baqara 2:229"] },
  { question: "ধৈর্য ও নামাজের মাধ্যমে সাহায্য চাওয়া", references: ["Al-Baqara 2:153"] },
  { question: "আমরা শুধু তোমারই ইবাদত করি", references: ["Al-Faatiha 1:5"] },
  { question: "ধর্মে কোনো জবরদস্তি নেই", references: ["Al-Baqara 2:256"] },
  { question: "no compulsion in religion", references: ["Al-Baqara 2:256"] },
  { question: "fasting is prescribed for you", references: ["Al-Baqara 2:183"] },
];

export const NOISE_QUESTIONS: string[] = [
  "বিটকয়েনের দাম কত",
  "আজকের আবহাওয়া কেমন",
  "ফুটবল খেলার নিয়ম কী",
  "মোবাইল ফোন কীভাবে চার্জ দিব",
  "ঢাকা থেকে চট্টগ্রামের দূরত্ব কত",
  "how to cook rice",
  "best programming language",
];
