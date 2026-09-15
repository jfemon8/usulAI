import { describe, expect, it } from "vitest";
import { can, permissionsFor, type Permission } from "@/lib/admin/roles";

const CORE: Permission[] = [
  "corpus.manage",
  "notes.manage",
  "files.manage",
  "database.manage",
  "staff.manage",
  "audit.view",
  "answers.manage",
  "masail.override",
];

describe("role permissions", () => {
  it("gives the admin every permission", () => {
    expect(permissionsFor("admin").length).toBeGreaterThan(0);
    for (const permission of permissionsFor("admin")) expect(can("admin", permission)).toBe(true);
    for (const permission of CORE) expect(can("admin", permission)).toBe(true);
  });

  it("keeps moderators and scholars away from core data", () => {
    for (const permission of CORE) {
      expect(can("moderator", permission), permission).toBe(false);
      expect(can("scholar", permission), permission).toBe(false);
    }
  });

  it("lets moderators monitor and maintain the site and AI, but not act for scholars", () => {
    for (const permission of [
      "monitor.view",
      "site.manage",
      "ai.manage",
      "maintenance.run",
    ] as const) {
      expect(can("moderator", permission)).toBe(true);
      expect(can("scholar", permission)).toBe(false);
    }
    expect(can("moderator", "reviews.view")).toBe(true);
    expect(can("moderator", "reviews.handle")).toBe(false);
    expect(can("moderator", "help.handle")).toBe(false);
    expect(can("moderator", "masail.write")).toBe(false);
  });

  it("lets scholars review answers, help people and write masail", () => {
    for (const permission of ["reviews.handle", "help.handle", "masail.write"] as const) {
      expect(can("scholar", permission)).toBe(true);
    }
  });

  it("lets every role use the panel and its own account", () => {
    for (const role of ["admin", "moderator", "scholar"] as const) {
      expect(can(role, "panel.use")).toBe(true);
      expect(can(role, "dashboard.view")).toBe(true);
    }
  });
});
