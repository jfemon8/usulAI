import { ADMIN_CONFIG } from "@/config/site";
import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import {
  STAFF_STATUSES,
  createStaff,
  listStaff,
  sendStaffAccountEmail,
  staffCreateInput,
  type StaffStatus,
} from "@/lib/admin/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusParam(value: string | null): StaffStatus | undefined {
  return (STAFF_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as StaffStatus)
    : undefined;
}

export const GET = adminRoute("staff.manage", async (request) => {
  const url = new URL(request.url);
  const search = url.searchParams.get("q")?.trim().slice(0, 100);
  const categoryId = url.searchParams.get("category")?.trim().slice(0, 64);
  const status = statusParam(url.searchParams.get("status"));

  return adminJson(
    await listStaff({
      limit: ADMIN_CONFIG.pageSize,
      cursor: url.searchParams.get("cursor"),
      ...(search ? { search } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { status } : {}),
    }),
  );
});

export const POST = adminRoute("staff.manage", async (request, session) => {
  const input = await readJson(request, staffCreateInput);
  const account = await createStaff(
    {
      categoryId: input.categoryId,
      name: input.name,
      email: input.email,
      password: input.password,
      ...(input.phone ? { phone: input.phone } : {}),
    },
    session.email,
  );
  const email = await sendStaffAccountEmail("created", account, input.password);
  await recordAudit(
    session.email,
    "staff.create",
    `staff:${account.email}`,
    `category ${account.categoryName}; role ${account.role ?? "none"}; email ${email.sent ? "sent" : "not sent"}`,
  );
  return adminJson({ account, email }, 201);
});
