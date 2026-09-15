import { describe, expect, it, vi } from "vitest";
import { ADMIN_CONFIG, STAFF_CONFIG } from "@/config/site";

vi.mock("@/lib/db/mongoClient", () => ({ getDb: vi.fn(() => Promise.reject(new Error("no db"))) }));

const {
  categoryCreateInput,
  categoryOrderInput,
  categoryUpdateInput,
  describeStaffChanges,
  emailFailureReason,
  generatePassword,
  isDemoSender,
  planCategoryOrder,
  staffCreateInput,
  staffPasswordInput,
  staffUpdateInput,
} = await import("@/lib/admin/staff");

type StaffView = Parameters<typeof describeStaffChanges>[0];

const base: StaffView = {
  id: "665f00000000000000000001",
  email: "mufti@example.com",
  name: "মুফতি আব্দুল্লাহ",
  phone: null,
  categoryId: "mufti",
  categoryName: "মুফতি",
  role: "scholar",
  status: "active",
  mustChangePassword: true,
  lastLoginAt: null,
  passwordChangedAt: null,
  createdAt: "2026-09-15T00:00:00.000Z",
  createdBy: "jfemon8@gmail.com",
  updatedAt: "2026-09-15T00:00:00.000Z",
  updatedBy: "jfemon8@gmail.com",
};

describe("staff account input", () => {
  const valid = {
    categoryId: "mufti",
    name: "  মুফতি   আব্দুল্লাহ ",
    email: "  Mufti@Example.COM ",
    phone: "+880 1711-000000",
    password: "Strong#Pass1",
  };

  it("normalises the email and accepts a well-formed account", () => {
    const parsed = staffCreateInput.parse(valid);
    expect(parsed.email).toBe("mufti@example.com");
    expect(parsed.name).toBe("মুফতি   আব্দুল্লাহ");
  });

  it("refuses a bad email, phone, name or short password", () => {
    expect(staffCreateInput.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(staffCreateInput.safeParse({ ...valid, phone: "01711<script>" }).success).toBe(false);
    expect(
      staffCreateInput.safeParse({ ...valid, phone: "1".repeat(STAFF_CONFIG.maxPhoneChars + 1) })
        .success,
    ).toBe(false);
    expect(staffCreateInput.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(
      staffCreateInput.safeParse({
        ...valid,
        password: "x".repeat(ADMIN_CONFIG.minPasswordChars - 1),
      }).success,
    ).toBe(false);
    expect(staffCreateInput.safeParse({ ...valid, phone: "(০১৭১১) ০০০০০০" }).success).toBe(true);
  });

  it("requires at least one field on update and allows clearing the phone", () => {
    expect(staffUpdateInput.safeParse({}).success).toBe(false);
    expect(staffUpdateInput.parse({ phone: null })).toEqual({ phone: null });
    expect(staffUpdateInput.safeParse({ status: "deleted" }).success).toBe(false);
    expect(staffUpdateInput.parse({ status: "suspended" })).toEqual({ status: "suspended" });
    expect(staffPasswordInput.safeParse({ password: "short" }).success).toBe(false);
  });
});

describe("staff categories", () => {
  it("validates names, roles and descriptions", () => {
    expect(categoryCreateInput.parse({ name: " খতিব ", role: "scholar" })).toEqual({
      name: "খতিব",
      role: "scholar",
      description: "",
    });
    expect(categoryCreateInput.safeParse({ name: "অ্যাডমিন", role: "admin" }).success).toBe(false);
    expect(
      categoryCreateInput.safeParse({
        name: "ক".repeat(STAFF_CONFIG.maxCategoryNameChars + 1),
        role: "moderator",
      }).success,
    ).toBe(false);
    expect(categoryUpdateInput.safeParse({}).success).toBe(false);
    expect(categoryOrderInput.safeParse({ ids: [] }).success).toBe(false);
  });

  it("plans only the order changes and refuses a stale list", () => {
    const current = [
      { id: "moderator", order: 0 },
      { id: "mufti", order: 1 },
      { id: "alem", order: 2 },
    ];
    expect(planCategoryOrder(current, ["mufti", "moderator", "alem"])).toEqual([
      { id: "mufti", order: 0 },
      { id: "moderator", order: 1 },
    ]);
    expect(planCategoryOrder(current, ["moderator", "mufti", "alem"])).toEqual([]);
    expect(() => planCategoryOrder(current, ["mufti", "moderator"])).toThrow();
    expect(() => planCategoryOrder(current, ["mufti", "mufti", "alem"])).toThrow();
    expect(() => planCategoryOrder(current, ["mufti", "moderator", "imam"])).toThrow();
  });
});

describe("staff helpers", () => {
  it("generates passwords of the configured length from a safe alphabet", () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generatePassword()));
    expect(passwords.size).toBe(20);
    for (const password of passwords) {
      expect(password).toHaveLength(STAFF_CONFIG.generatedPasswordChars);
      expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9@#%+=?]+$/);
    }
  });

  it("describes changes for the audit log without secrets", () => {
    expect(describeStaffChanges(base, base)).toEqual([]);
    const changes = describeStaffChanges(base, {
      ...base,
      email: "new@example.com",
      phone: "01711",
      categoryId: "moderator",
      categoryName: "মডারেটর",
      role: "moderator",
    });
    expect(changes).toEqual([
      "email mufti@example.com -> new@example.com",
      "phone changed",
      "category মুফতি -> মডারেটর",
      "role scholar -> moderator",
    ]);
  });

  it("explains Mailtrap failures in Bangla", () => {
    expect(emailFailureReason("MAILTRAP_API_TOKEN is not set")).toContain("MAILTRAP_API_TOKEN");
    expect(
      emailFailureReason(
        "MailtrapError: Demo domains can only be used to send emails to account owners",
      ),
    ).toContain("ডেমো ডোমেইন");
    expect(emailFailureReason("Error: Unauthorized")).toContain("টোকেন");
    expect(emailFailureReason("TypeError: fetch failed")).toContain("পৌঁছানো যায়নি");
    expect(emailFailureReason(undefined)).toContain("কারণ জানা যায়নি");
    expect(emailFailureReason("something odd")).toContain("something odd");
    expect(isDemoSender("usulai@DemoMailtrap.co")).toBe(true);
    expect(isDemoSender("noreply@usulai.is-a.bot")).toBe(false);
  });
});
