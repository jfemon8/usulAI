export type BaseRole = "admin" | "moderator" | "scholar";

export type StaffRole = Exclude<BaseRole, "admin">;

export const ROLE_LABELS: Record<BaseRole, string> = {
  admin: "অ্যাডমিন",
  moderator: "মডারেটর",
  scholar: "আলেম",
};

const EVERYONE: readonly BaseRole[] = ["admin", "moderator", "scholar"];
const STAFF_MANAGERS: readonly BaseRole[] = ["admin", "moderator"];
const SCHOLARS: readonly BaseRole[] = ["admin", "scholar"];
const ADMIN_ONLY: readonly BaseRole[] = ["admin"];

export const PERMISSIONS = {
  "panel.use": EVERYONE,
  "dashboard.view": EVERYONE,
  "monitor.view": STAFF_MANAGERS,
  "site.manage": STAFF_MANAGERS,
  "ai.manage": STAFF_MANAGERS,
  "maintenance.run": STAFF_MANAGERS,
  "reviews.view": EVERYONE,
  "reviews.handle": SCHOLARS,
  "help.view": EVERYONE,
  "help.handle": SCHOLARS,
  "masail.write": SCHOLARS,
  "masail.override": ADMIN_ONLY,
  "answers.manage": ADMIN_ONLY,
  "corpus.manage": ADMIN_ONLY,
  "notes.manage": ADMIN_ONLY,
  "files.manage": ADMIN_ONLY,
  "database.manage": ADMIN_ONLY,
  "staff.manage": ADMIN_ONLY,
  "audit.view": ADMIN_ONLY,
} as const satisfies Record<string, readonly BaseRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: BaseRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly BaseRole[]).includes(role);
}

export function permissionsFor(role: BaseRole): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) => can(role, permission));
}

export interface PrincipalView {
  kind: "admin" | "staff";
  id: string;
  email: string;
  name: string;
  role: BaseRole;
  roleLabel: string;
  categoryName: string;
  mustChangePassword: boolean;
  permissions: Permission[];
}
