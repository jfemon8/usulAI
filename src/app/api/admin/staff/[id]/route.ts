import { recordAudit } from "@/lib/admin/audit";
import { adminJson, adminRoute, readJson } from "@/lib/admin/http";
import {
  deleteStaff,
  describeStaffChanges,
  getStaff,
  staffUpdateInput,
  updateStaff,
} from "@/lib/admin/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { id: string };

export const GET = adminRoute<Params>("staff.manage", async (_request, _session, params) =>
  adminJson(await getStaff(params.id)),
);

export const PATCH = adminRoute<Params>("staff.manage", async (request, session, params) => {
  const input = await readJson(request, staffUpdateInput);
  const previous = await getStaff(params.id);
  const { account, signedOut } = await updateStaff(
    params.id,
    {
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    session.email,
  );

  const target = `staff:${previous.email}`;
  const changes = describeStaffChanges(previous, account);
  if (changes.length > 0) {
    await recordAudit(
      session.email,
      "staff.update",
      target,
      [...changes, signedOut ? "signed out" : null].filter(Boolean).join("; "),
    );
  }
  if (previous.status !== account.status) {
    await recordAudit(
      session.email,
      account.status === "suspended" ? "staff.suspend" : "staff.activate",
      target,
      account.status === "suspended" ? "signed out" : undefined,
    );
  }
  return adminJson({
    account,
    signedOut,
    changed: changes.length > 0 || previous.status !== account.status,
  });
});

export const DELETE = adminRoute<Params>("staff.manage", async (_request, session, params) => {
  const account = await deleteStaff(params.id);
  await recordAudit(
    session.email,
    "staff.delete",
    `staff:${account.email}`,
    `category ${account.categoryName}`,
  );
  return adminJson({ ok: true });
});
