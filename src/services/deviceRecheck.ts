// Background device check for a session restored at app start (offline start).
//
// It makes exactly the calls the login screen's auto-login makes (check-status, then direct-login), so the
// device verification rules stay on the server and stay the same:
//   OK       -> device still verified: fresh login token + the user's current role / name from the server
//   INACTIVE -> account deactivated by HR
//   DENIED   -> the server says this device must verify again (new device, OTP required, revoked, locked...)
//   OFFLINE  -> no network / server error: keep the user in and try again later (never a logout)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_HOST } from "../constants/config";
import { getClientInfo } from "./clientInfo";
import { UserSession } from "./UserSession";

const AUTH = `${BASE_HOST}/api/auth`;

export type RecheckResult =
  | { kind: "OK"; user: any; token: string | null }
  | { kind: "INACTIVE"; message?: string }
  | { kind: "DENIED"; message?: string }
  | { kind: "OFFLINE" };

const isInactiveMessage = (msg?: string) => !!msg && /inactive|deactivated/i.test(msg);

// Answers the server gives when this device may NOT sign in directly (the login screen then asks for OTP)
const NEEDS_VERIFICATION = new Set(["NEW_DEVICE", "OTP_REQUIRED", "OTP_PENDING", "NO_RECORD", "ACCOUNT_LOCKED"]);

// 5xx, 429 (busy) and 426 (outdated app: the update screen handles it) are not a refusal of this device
const notAnAnswer = (status: number) => status >= 500 || status === 429 || status === 426;

export async function recheckDevice(empId: string): Promise<RecheckResult> {
  try {
    const id = empId.trim().toUpperCase();
    const client = await getClientInfo(id);
    const body = JSON.stringify({ empId: id, deviceId: client.deviceId, platform: client.platform });
    const headers = { "Content-Type": "application/json" };

    const sres = await fetch(`${AUTH}/check-status`, { method: "POST", headers, body });
    if (notAnAnswer(sres.status)) return { kind: "OFFLINE" };
    const s: any = await sres.json().catch(() => null);
    if (!s) return { kind: "OFFLINE" };
    if (s.status === "ACCOUNT_INACTIVE" || isInactiveMessage(s.message)) return { kind: "INACTIVE", message: s.message };
    if (NEEDS_VERIFICATION.has(String(s.status))) return { kind: "DENIED", message: s.message };
    if (s.status !== "ALREADY_VERIFIED") return { kind: "OFFLINE" }; // unknown answer: never log out on a guess

    const lres = await fetch(`${AUTH}/direct-login`, { method: "POST", headers, body });
    if (notAnAnswer(lres.status)) return { kind: "OFFLINE" };
    const l: any = await lres.json().catch(() => null);
    if (!l) return { kind: "OFFLINE" };
    if (l.success && l.user) return { kind: "OK", user: l.user, token: l.token ? String(l.token) : null };
    if (isInactiveMessage(l.message)) return { kind: "INACTIVE", message: l.message };
    if (l.success === false) return { kind: "DENIED", message: l.message };
    return { kind: "OFFLINE" };
  } catch {
    return { kind: "OFFLINE" };
  }
}

/** Same fields the login screen saves, so name / role / designation stay current after a restored start. */
export async function applyServerUser(empId: string, u: any): Promise<boolean> {
  const resolvedEmpId = u?.empId || empId;
  const isAdmin = !!u?.isAdmin;
  try {
    await UserSession.setUser({
      empId: resolvedEmpId,
      name: u?.fullName || u?.name || "",
      email: u?.email || "",
      role: u?.role || "EMPLOYEE",
      designation: u?.designation || "Femi9 Employee",
    });
    const raw = await AsyncStorage.getItem("@current_user_details");
    const prev = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem(
      "@current_user_details",
      JSON.stringify({
        ...prev,
        userId: resolvedEmpId,
        empId: resolvedEmpId,
        name: u?.fullName || u?.name || prev.name || "",
        email: u?.email || prev.email || "",
        isAdmin,
        role: u?.role || prev.role || "EMPLOYEE",
        designation: u?.designation || prev.designation || "Femi9 Employee",
      })
    );
  } catch {
    /* storage problem: the in-memory session is still fine */
  }
  return isAdmin;
}
