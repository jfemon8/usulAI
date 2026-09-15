import { describe, expect, it } from "vitest";
import { AdminError } from "@/lib/admin/http";
import {
  buildSearchExpression,
  isProtectedPath,
  isSearchCursor,
  mapAsset,
  mapUsage,
  normalizeFolderPath,
  normalizePublicId,
  normalizeTags,
  parseOffsetCursor,
  splitListing,
  toAdminError,
  uploadPublicId,
  type AssetSummary,
} from "@/lib/admin/cloudinaryAdmin";

function asset(publicId: string, bytes = 10): AssetSummary {
  const mapped = mapAsset(
    { public_id: publicId, bytes, resource_type: "raw", type: "upload" },
    { resourceType: "raw", type: "upload" },
  );
  if (!mapped) throw new Error("unmapped");
  return mapped;
}

describe("normalizeFolderPath", () => {
  it("trims slashes, backslashes and empty segments", () => {
    expect(normalizeFolderPath("/raw-sources//ijma/ ")).toBe("raw-sources/ijma");
    expect(normalizeFolderPath("a\\b")).toBe("a/b");
    expect(normalizeFolderPath("")).toBe("");
    expect(normalizeFolderPath(null)).toBe("");
  });

  it("rejects traversal, reserved and invisible characters", () => {
    expect(() => normalizeFolderPath("a/../b")).toThrow(AdminError);
    expect(() => normalizeFolderPath("./a")).toThrow(AdminError);
    expect(() => normalizeFolderPath("a?b")).toThrow(AdminError);
    expect(() => normalizeFolderPath("a#b")).toThrow(AdminError);
    expect(() => normalizeFolderPath("a\u200bb")).toThrow(AdminError);
    expect(() => normalizeFolderPath("a\u0000b")).toThrow(AdminError);
  });

  it("rejects paths that are too long", () => {
    expect(() => normalizeFolderPath("a".repeat(256))).toThrow(AdminError);
  });
});

describe("normalizePublicId", () => {
  it("requires a value and keeps unicode names", () => {
    expect(() => normalizePublicId(" / ")).toThrow(AdminError);
    expect(normalizePublicId("বই/মারাতিবুল ইজমা.md")).toBe("বই/মারাতিবুল ইজমা.md");
  });
});

describe("uploadPublicId", () => {
  it("keeps the extension for raw files and drops it for media", () => {
    expect(uploadPublicId("books", "My Book (1).PDF", "raw")).toBe("books/My_Book_(1).pdf");
    expect(uploadPublicId("", "photo.final.jpg", "image")).toBe("photo.final");
    expect(uploadPublicId("", "a?b#c.mp4", "video")).toBe("a_b_c");
  });

  it("uses a custom public id inside the folder", () => {
    expect(uploadPublicId("books", "x.pdf", "raw", "sub/name")).toBe("books/sub/name.pdf");
    expect(uploadPublicId("books", "x.png", "image", "cover.png")).toBe("books/cover");
    expect(() => uploadPublicId("books", "x.pdf", "raw", "../up")).toThrow(AdminError);
  });

  it("falls back to a generic name", () => {
    expect(uploadPublicId("", "???.png", "image")).toBe("file");
  });
});

describe("normalizeTags", () => {
  it("trims and deduplicates", () => {
    expect(normalizeTags([" book ", "book", "", "ijma"])).toEqual(["book", "ijma"]);
  });

  it("rejects commas and too many tags", () => {
    expect(() => normalizeTags(["a,b"])).toThrow(AdminError);
    expect(() => normalizeTags(Array.from({ length: 31 }, (_, index) => `t${index}`))).toThrow(
      AdminError,
    );
  });
});

describe("buildSearchExpression", () => {
  it("builds prefix clauses with filters", () => {
    expect(
      buildSearchExpression({
        term: "al-iqna",
        resourceType: "raw",
        type: "upload",
        folder: "raw-sources/ijma",
      }),
    ).toBe(
      "(filename:al-iqna* OR public_id:al-iqna* OR tags=al-iqna OR al-iqna*) AND resource_type:raw AND type:upload AND public_id:raw-sources/ijma/*",
    );
  });

  it("strips query syntax from terms", () => {
    expect(buildSearchExpression({ term: 'ibn" OR (x:*)' })).toBe(
      "(filename:ibn* OR public_id:ibn* OR tags=ibn OR ibn*) AND (filename:x* OR public_id:x* OR tags=x OR x*)",
    );
    expect(() => buildSearchExpression({ term: "  ()  " })).toThrow(AdminError);
  });
});

describe("cursors", () => {
  it("parses offsets and validates search cursors", () => {
    expect(parseOffsetCursor("30")).toBe(30);
    expect(parseOffsetCursor("-1")).toBe(0);
    expect(parseOffsetCursor(null)).toBe(0);
    expect(isSearchCursor("abc123DEF")).toBe(true);
    expect(isSearchCursor("abc/..")).toBe(false);
  });
});

describe("mapAsset", () => {
  it("maps SDK fields and hides URLs of restricted types", () => {
    const mapped = mapAsset(
      {
        public_id: "raw-sources/sirat/book.pdf",
        resource_type: "raw",
        type: "authenticated",
        bytes: 1200,
        created_at: "2026-09-13T09:55:14Z",
        tags: ["a", 3],
        secure_url: "https://example.com/x",
      },
      { resourceType: "image", type: "upload" },
      () => "thumb",
    );
    expect(mapped).toEqual({
      publicId: "raw-sources/sirat/book.pdf",
      name: "book.pdf",
      folder: "raw-sources/sirat",
      resourceType: "raw",
      type: "authenticated",
      format: null,
      bytes: 1200,
      width: null,
      height: null,
      createdAt: "2026-09-13T09:55:14Z",
      tags: ["a"],
      secureUrl: null,
      thumbnailUrl: "thumb",
    });
    expect(mapAsset({ bytes: 1 }, { resourceType: "raw", type: "upload" })).toBeNull();
  });
});

describe("splitListing", () => {
  it("separates direct files from sub folders with counts", () => {
    const result = splitListing(
      [
        asset("raw-sources/ijma/b.md", 5),
        asset("raw-sources/ijma/a.md", 5),
        asset("raw-sources/hadith/grades/abudawud.json", 7),
        asset("raw-sources/top.md", 1),
        asset("other/x.md", 1),
      ],
      "raw-sources",
    );
    expect(result.assets.map((item) => item.publicId)).toEqual(["raw-sources/top.md"]);
    expect(result.folders).toEqual([
      { name: "hadith", path: "raw-sources/hadith", assets: 1, bytes: 7, real: false },
      { name: "ijma", path: "raw-sources/ijma", assets: 2, bytes: 10, real: false },
    ]);
  });
});

describe("isProtectedPath", () => {
  it("matches the raw sources prefix only", () => {
    expect(isProtectedPath("raw-sources")).toBe(true);
    expect(isProtectedPath("raw-sources/ijma/a.md")).toBe(true);
    expect(isProtectedPath("raw-sources-old/a.md")).toBe(false);
  });
});

describe("mapUsage", () => {
  it("maps the usage response", () => {
    const usage = mapUsage({
      plan: "Free",
      last_updated: "2026-09-14",
      storage: { usage: 230184009, credits_usage: 0.21 },
      bandwidth: { usage: 2974947, credits_usage: 0 },
      transformations: { usage: 0, credits_usage: 0 },
      credits: { usage: 0.21, limit: 25, used_percent: 0.84 },
      resources: 118,
      derived_resources: 0,
      media_limits: { image_max_size_bytes: 10485760, raw_max_size_bytes: 10485760 },
    });
    expect(usage.storage).toEqual({
      usage: 230184009,
      limit: null,
      usedPercent: null,
      creditsUsage: 0.21,
    });
    expect(usage.credits).toEqual({ usage: 0.21, limit: 25, usedPercent: 0.84 });
    expect(usage.mediaLimits).toEqual({
      imageMaxBytes: 10485760,
      videoMaxBytes: null,
      rawMaxBytes: 10485760,
    });
    expect(mapUsage(null).storage).toBeNull();
  });
});

describe("toAdminError", () => {
  it("maps Cloudinary errors without leaking request details", () => {
    const notFound = toAdminError({
      request_options: { auth: "key:secret" },
      error: { message: "Resource not found - x", http_code: 404 },
    });
    expect(notFound.status).toBe(404);
    expect(notFound.message).not.toContain("secret");

    expect(toAdminError({ error: { message: "Folder is not empty", http_code: 400 } }).status).toBe(
      409,
    );
    expect(toAdminError({ message: "Rate Limit Exceeded", http_code: 420 }).status).toBe(429);
    const bad = toAdminError({ error: { message: "Invalid public id", http_code: 400 } });
    expect(bad.status).toBe(400);
    expect(bad.message).toContain("Invalid public id");
  });
});
