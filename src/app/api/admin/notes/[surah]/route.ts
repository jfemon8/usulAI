import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import {
  loadSurahForEdit,
  noteChangesInput,
  parseSurahNumber,
  saveSurahEdits,
} from "@/lib/admin/notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { surah: string };

export const GET = adminRoute<Params>("notes.manage", async (_request, _session, params) =>
  adminJson(await loadSurahForEdit(parseSurahNumber(params.surah))),
);

export const PUT = adminRoute<Params>("notes.manage", async (request, session, params) => {
  const surah = parseSurahNumber(params.surah);
  const input = await readJson(request, noteChangesInput);
  const { changed, result } = await saveSurahEdits(surah, input);
  if (changed.length > 0) {
    await recordAudit(
      session.email,
      "notes.update",
      `surah ${surah}`,
      `${changed.length} ayahs changed: ${changed.join(", ")}`,
    );
  }
  return adminJson({ changed: changed.length, ...result });
});
