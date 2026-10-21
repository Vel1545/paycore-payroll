// utils/access.ts - small role -> pages map that uses the role already stored in UserSession (no extra API call).
// The same lists are in the backend table role_features (role_access.sql): keep them equal.
// Later (organization version) replace roleFeatures() with the list returned by the backend.
import { UserSession } from "../services/UserSession";

export type FeatureKey =
  | "HOME" | "ATTENDANCE" | "APPLY" | "PAYSLIP" | "MY_HUB"
  | "LEAVE_APPROVALS" | "OT_APPROVALS" | "CHECKOUT_APPROVALS" | "ATTENDANCE_AUDIT" | "SALARY_VIEW" | "LIVE_TRACKING";

const EMPLOYEE: FeatureKey[] = ["HOME", "ATTENDANCE", "APPLY", "PAYSLIP", "MY_HUB"];
const ADMIN_ONLY: FeatureKey[] = ["LEAVE_APPROVALS", "OT_APPROVALS", "CHECKOUT_APPROVALS", "ATTENDANCE_AUDIT", "SALARY_VIEW", "LIVE_TRACKING"];
const SALES_HEAD:FeatureKey[] = ["HOME", "ATTENDANCE", "APPLY", "PAYSLIP", "MY_HUB","LIVE_TRACKING"];

const ROLE_FEATURES: Record<string, FeatureKey[]> = {
  EMPLOYEE: EMPLOYEE,
  ADMIN: [...EMPLOYEE, ...ADMIN_ONLY],   // normal app + admin pages (today's admin)
  SUPER_ADMIN: ADMIN_ONLY,               // admin pages only, no user pages
  SALES_HEAD:SALES_HEAD ,         // live tracking only
};

/** "Super Admin", "superadmin" -> SUPER_ADMIN;  "Sales", "Sales Head" -> SALES_HEAD;  "User" -> EMPLOYEE */
export function normalizeRole(raw?: string | null, isAdminFlag?: boolean): string {
  const r = String(raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  const flat = r.replace(/_/g, "");
  if (flat === "SUPERADMIN") return "SUPER_ADMIN";
  if (flat === "SALES" || flat === "SALESHEAD") return "SALES_HEAD";
  if (flat === "ADMIN" || flat === "ADMINISTRATOR") return "ADMIN";
  if (flat === "USER" || flat === "EMPLOYEE" || flat === "STAFF") return "EMPLOYEE";
  if (!r) return isAdminFlag ? "ADMIN" : "EMPLOYEE";
  return r;
}
const EMP_ROLE_OVERRIDES: Record<string, string> = {
  F9CEO: "SUPER_ADMIN",
  F9CAO: "SUPER_ADMIN",
  F9005: "SALES_HEAD",
};
export function currentRole(isAdminFlag?: boolean) {
  const empId = String((UserSession as any).empId ?? "").toUpperCase();
  const raw = EMP_ROLE_OVERRIDES[empId] ?? (UserSession as any).role;
  return normalizeRole(raw, isAdminFlag);
}

export function roleFeatures(isAdminFlag?: boolean): FeatureKey[] {
  return ROLE_FEATURES[currentRole(isAdminFlag)] ?? EMPLOYEE;
}

/** can("LIVE_TRACKING") */
export function can(feature: FeatureKey, isAdminFlag?: boolean): boolean {
  return roleFeatures(isAdminFlag).includes(feature);
}

/** The first page this role should land on (route names are yours: adjust the map). */
export function homeRoute(isAdminFlag?: boolean): string {
  const f = roleFeatures(isAdminFlag)[0];
  const map: Record<string, string> = { HOME: "Home", LIVE_TRACKING: "LiveTracking", LEAVE_APPROVALS: "Approvals" };
  return map[f] ?? "Home";
}