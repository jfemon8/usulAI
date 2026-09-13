import { describe, expect, it } from "vitest";
import { formatQuranEncNote } from "@/lib/retrieval/quranNotes";
import { QURANENC_CONFIG } from "@/config/site";

describe("formatQuranEncNote", () => {
  it("joins the translation and its footnotes", () => {
    const note = formatQuranEncNote({
      translation: "যারা সুদ [১] খায় [২]",
      footnotes: "[১] রিবা শব্দের অর্থ সুদ। [২] অর্থাৎ গ্রহণ করে।",
    });

    expect(note).toBe(
      "যারা সুদ (১) খায় (২) টীকা: (১) রিবা শব্দের অর্থ সুদ। (২) অর্থাৎ গ্রহণ করে।",
    );
  });

  it("turns footnote brackets into parentheses so they cannot pass for citation markers", () => {
    expect(formatQuranEncNote({ translation: "বলুন [১]" })).not.toMatch(/\[[০-৯]+\]/);
  });

  it("strips the HTML QuranEnc puts in its footnotes", () => {
    const note = formatQuranEncNote({
      translation: "বলুন",
      footnotes: "<b> সূরা সম্পর্কিত তথ্য: </b> মক্কী",
    });

    expect(note).toBe("বলুন টীকা: সূরা সম্পর্কিত তথ্য: মক্কী");
  });

  it("caps a long note so one ayah cannot flood the prompt", () => {
    const note = formatQuranEncNote({ translation: "অনুবাদ", footnotes: "ব্যাখ্যা ".repeat(500) });

    expect(note!.length).toBeLessThanOrEqual(QURANENC_CONFIG.maxNoteChars + 1);
    expect(note!.endsWith("…")).toBe(true);
  });

  it("returns nothing for an ayah that was not imported", () => {
    expect(formatQuranEncNote(undefined)).toBeUndefined();
  });
});
