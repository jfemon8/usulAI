import { composeNukta } from "@/lib/utils/bangla";

const BANGLA_REPAIRS: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  "3:97": [["সামর্থ?2480;য়েছে", "সামর্থ্য রয়েছে"]],
  "5:64": [["প্রজ্জ?482;িত", "প্রজ্জ্বলিত"]],
  "6:151": [["দারিদ্রে?480;", "দারিদ্রের"]],
  "9:28": [["দারিদ্রে?480;", "দারিদ্রের"]],
  "9:86": [["সামর্থ?476;ান", "সামর্থ্যবান"]],
  "16:5": [["আহার্যে?2474;রিণত", "আহার্যে পরিণত"]],
  "17:111": [["মাহাত্ন?2476;র্ণনা", "মাহাত্ন্য বর্ণনা"]],
  "18:95": [["সামর্থ?2470;িয়েছেন", "সামর্থ্য দিয়েছেন"]],
  "22:41": [["সামর্থ?2470;ান", "সামর্থ্য দান"]],
  "24:60": [["দর্য?2474;্রকাশ", "দর্য প্রকাশ"]],
  "26:211": [["সামর্থ?451; রাখে", "সামর্থ্যও রাখে"]],
  "27:19": [["সামর্থ?2470;াও", "সামর্থ্য দাও"]],
  "27:64": [["মর্ত?2469;েকে", "মর্ত্য থেকে"]],
  "40:3": [["সামর্থ?476;ান", "সামর্থ্যবান"]],
  "46:15": [["সামর্থে?480; বয়সে", "সামর্থ্যের বয়সে"]],
  "59:23": [["মাহাত্ন?486;ীল", "মাহাত্ন্যশীল"]],
  "65:6": [["সামর্থ?2437;নুযায়ী", "সামর্থ্য অনুযায়ী"]],
};

export const BROKEN_ENTITY = /\?\d{3,5};/;

export function repairBanglaTranslation(surah: number, ayah: number, text: string): string {
  const repairs = BANGLA_REPAIRS[`${surah}:${ayah}`] ?? [];
  return repairs.reduce((current, [broken, fixed]) => {
    for (const form of [(value: string) => value, composeNukta]) {
      if (current.includes(form(broken))) return current.split(form(broken)).join(form(fixed));
    }
    return current;
  }, text);
}

export function repairedAyahCount(): number {
  return Object.keys(BANGLA_REPAIRS).length;
}
