// App updates (phone app only - the website is always the latest version after a deploy).
//
// 1. OTA update (EAS Update): JavaScript changes published with `eas update --channel production`
//    are downloaded at app start and applied immediately (the app restarts by itself).
// 2. New APK (native changes): the server table app_release says which versionCode is the newest
//    and which is the oldest still allowed. Older apps see a popup; below the minimum the app is blocked.
// 3. Every API call sends X-App-Id / X-App-Build. When the server answers 426 UPDATE_REQUIRED
//    (old app that skipped the popup), the blocking update screen opens.
import { Platform } from "react-native";
import { BASE_HOST } from "../constants/config";

const isNative = Platform.OS !== "web";

// Loaded lazily so the website never touches the native modules.
const Application: typeof import("expo-application") | null = isNative ? require("expo-application") : null;
const Updates: typeof import("expo-updates") | null = isNative ? require("expo-updates") : null;

export type InstalledApp = { appId: string; build: number; versionName: string };

/** Package name + versionCode of this install. build = 0 on web / unknown. */
export function installedApp(): InstalledApp {
  const appId = Application?.applicationId || "";
  const build = parseInt(Application?.nativeBuildVersion || "0", 10);
  return {
    appId,
    build: Number.isFinite(build) ? build : 0,
    versionName: Application?.nativeApplicationVersion || "",
  };
}

/** Sent with every call to our API so the server can refuse apps that are too old. */
export function appHeaders(): Record<string, string> {
  const app = installedApp();
  if (!isNative || !app.appId || app.build <= 0) return {};
  return { "X-App-Id": app.appId, "X-App-Build": String(app.build) };
}

/** Update checks only run in real builds (not `npx expo start`, not the website). */
export const UPDATE_CHECKS_ENABLED = isNative && !__DEV__;

// ------------------------------------------------------------------ server version check
export type VersionStatus = "OK" | "OPTIONAL" | "REQUIRED";
export type VersionInfo = {
  status: VersionStatus;
  latestBuild: number;
  minBuild: number;
  latestVersionName: string | null;
  message: string | null;
  downloadUrl: string | null;
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

/** Asks the server whether this build is current. null = offline / no answer (never block on that). */
export async function checkAppVersion(timeoutMs = 8000): Promise<VersionInfo | null> {
  if (!UPDATE_CHECKS_ENABLED) return null;
  const app = installedApp();
  if (!app.appId || app.build <= 0) return null;
  const url = `${BASE_HOST}/api/app/version?app=${encodeURIComponent(app.appId)}&build=${app.build}`;
  try {
    const res = await withTimeout(fetch(url, { cache: "no-store" }), timeoutMs);
    if (!res || !res.ok) return null;
    const j: any = await res.json();
    const status: VersionStatus = j?.status === "REQUIRED" || j?.status === "OPTIONAL" ? j.status : "OK";
    return {
      status,
      latestBuild: Number(j?.latestBuild) || 0,
      minBuild: Number(j?.minBuild) || 0,
      latestVersionName: j?.latestVersionName || null,
      message: j?.message || null,
      downloadUrl: j?.downloadUrl || null,
    };
  } catch {
    return null;
  }
}

/** The link for the Update button (the server may send a path on our own host). */
export function absoluteDownloadUrl(info: VersionInfo | null): string | null {
  const raw = info?.downloadUrl;
  if (!raw) return null;
  return raw.startsWith("/") ? `${BASE_HOST}${raw}` : raw;
}

// ------------------------------------------------------------------ OTA (EAS Update)
/**
 * Downloads a newer JavaScript update when one is published for this build's channel,
 * then restarts the app on it. Returns true when the app is about to restart.
 * onDownloading(true) is called once an update was found (to show "Updating...").
 */
export async function applyOtaUpdate(
  onDownloading?: (busy: boolean) => void,
  checkTimeoutMs = 5000,
  downloadTimeoutMs = 60000,
): Promise<boolean> {
  if (!UPDATE_CHECKS_ENABLED || !Updates?.isEnabled) return false;
  try {
    const check = await withTimeout(Updates.checkForUpdateAsync(), checkTimeoutMs);
    if (!check?.isAvailable) return false;
    onDownloading?.(true);
    const fetched = await withTimeout(Updates.fetchUpdateAsync(), downloadTimeoutMs);
    if (!fetched || (!fetched.isNew && !fetched.isRollBackToEmbedded)) {
      onDownloading?.(false);
      return false; // slow network: the download carries on and is used at the next app start
    }
    await Updates.reloadAsync();
    return true;
  } catch {
    onDownloading?.(false);
    return false; // offline or update server unreachable: keep using the current version
  }
}

/** Shown in the update screen so support can see exactly what is installed. */
export function installedLabel(): string {
  const app = installedApp();
  const ota = Updates?.updateId && !Updates.isEmbeddedLaunch ? ` · update ${Updates.updateId.slice(0, 8)}` : "";
  return app.build > 0 ? `v${app.versionName} (build ${app.build})${ota}` : "";
}

// ------------------------------------------------------------------ 426 from the server
type Listener = () => void;
const updateRequiredListeners = new Set<Listener>();

export function onUpdateRequired(listener: Listener): () => void {
  updateRequiredListeners.add(listener);
  return () => {
    updateRequiredListeners.delete(listener);
  };
}

let lastNotice = 0;
export function notifyUpdateRequired(): void {
  if (Date.now() - lastNotice < 3000) return; // many calls fail together: tell the app once
  lastNotice = Date.now();
  updateRequiredListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}
