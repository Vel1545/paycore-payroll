// Login token for every call to our server.
//
// installAuthFetch() (called once in App.tsx) wraps the global fetch, so EVERY existing
// fetch(`${BASE_HOST}/api/...`) automatically sends "Authorization: Bearer <token>" - no screen needs to change.
// When the server answers 401 (token expired), the token is renewed silently with the verified device
// (same call as the auto-login) and the request is sent once more. If the server refuses the renewal,
// listeners from onSessionExpired() are told, and App.tsx logs the user out.
//
// Links that open outside fetch (browser downloads, Linking.openURL, FileSystem.downloadAsync)
// use withAuthToken(url) or authHeaders().
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { BASE_HOST } from "../constants/config";
import { getClientInfo } from "./clientInfo";
import { appHeaders, notifyUpdateRequired } from "./appUpdate";

const TOKEN_KEY = "jwt_token";
const REMEMBERED_EMP_KEY = "paycore_remembered_emp_id";

let memToken: string | null = null;
let loaded = false;

export async function loadAuthToken(): Promise<string | null> {
  if (!loaded) {
    try {
      memToken = await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
      memToken = null;
    }
    loaded = true;
  }
  return memToken;
}

export async function setAuthToken(token: string | null): Promise<void> {
  memToken = token || null;
  loaded = true;
  try {
    if (memToken) await AsyncStorage.setItem(TOKEN_KEY, memToken);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the in-memory token still works for this session */
  }
}

/** The token known right now (sync). loadAuthToken() runs at app start, so this is filled after login / restart. */
export function currentAuthToken(): string | null {
  return memToken;
}

const isOurApi = (url: string) => url.startsWith(`${BASE_HOST}/api/`);
const isAuthApi = (url: string) => url.startsWith(`${BASE_HOST}/api/auth/`);

/** For URLs opened outside fetch (browser download, Linking.openURL, <Image>): adds ?access_token=... */
export function withAuthToken(url: string): string {
  if (!url || !memToken || !isOurApi(url) || /[?&]access_token=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(memToken)}`;
}

/** Headers for FileSystem.downloadAsync and similar. */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return memToken ? { ...(extra || {}), Authorization: `Bearer ${memToken}` } : { ...(extra || {}) };
}

// ------------------------------- session expired -------------------------------
type ExpiredListener = (reason: string) => void;
const expiredListeners = new Set<ExpiredListener>();

/** App.tsx: log out when the server no longer accepts this login. Returns an unsubscribe function. */
export function onSessionExpired(listener: ExpiredListener): () => void {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

let lastExpiredNotice = 0;
function notifyExpired(reason: string) {
  // many requests can fail together: tell the app once
  if (Date.now() - lastExpiredNotice < 5000) return;
  lastExpiredNotice = Date.now();
  expiredListeners.forEach((l) => {
    try {
      l(reason);
    } catch {
      /* a listener must not break the request */
    }
  });
}

// ------------------------------- silent renewal -------------------------------
type RefreshResult = { token: string | null; denied: boolean };
let refreshing: Promise<RefreshResult> | null = null;

async function rememberedEmpId(): Promise<string | null> {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.localStorage.getItem(REMEMBERED_EMP_KEY);
    }
    return await AsyncStorage.getItem(REMEMBERED_EMP_KEY);
  } catch {
    return null;
  }
}

function refreshToken(rawFetch: typeof fetch): Promise<RefreshResult> {
  if (refreshing) return refreshing;
  refreshing = (async (): Promise<RefreshResult> => {
    try {
      const empId = await rememberedEmpId();
      if (!empId) return { token: null, denied: true }; // logged out
      const client = await getClientInfo(empId);
      const res = await rawFetch(`${BASE_HOST}/api/auth/direct-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empId, deviceId: client.deviceId, platform: client.platform }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data?.success && data?.token) {
        await setAuthToken(String(data.token));
        return { token: String(data.token), denied: false };
      }
      // the server answered and said no (device no longer verified, account inactive...): log out
      // a 5xx is a server problem, not a refusal: keep the user logged in
      return { token: null, denied: res.status < 500 };
    } catch {
      return { token: null, denied: false }; // offline: keep the user logged in
    } finally {
      // let a later expiry renew again
      setTimeout(() => {
        refreshing = null;
      }, 0);
    }
  })();
  return refreshing;
}

// ------------------------------- fetch wrapper -------------------------------
function withAuth(init: RequestInit | undefined, token: string | null): RequestInit | undefined {
  if (!token) return init;
  const headers = new Headers(init?.headers || undefined);
  if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  return { ...(init || {}), headers };
}

async function errorCode(res: Response): Promise<string> {
  try {
    const j: any = await res.clone().json();
    return String(j?.code || "");
  } catch {
    return "";
  }
}

function withAppHeaders(init: RequestInit | undefined): RequestInit | undefined {
  const extra = appHeaders();
  const keys = Object.keys(extra);
  if (keys.length === 0) return init;
  const headers = new Headers(init?.headers || undefined);
  keys.forEach((k) => {
    if (!headers.has(k)) headers.set(k, extra[k]);
  });
  return { ...(init || {}), headers };
}

function checkOutdated(res: Response): Response {
  if (res.status === 426) notifyUpdateRequired();
  return res;
}

let installed = false;

export function installAuthFetch(): void {
  if (installed || typeof globalThis.fetch !== "function") return;
  installed = true;
  const rawFetch: typeof fetch = globalThis.fetch.bind(globalThis);

  const authFetch = async (input: any, rawInit?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : "";
    // only plain string / URL calls to our own API get the token (never third-party URLs)
    if (!url || !isOurApi(url)) return rawFetch(input, rawInit);

    // phone app: tell the server which build is calling (an outdated build gets 426)
    const init = withAppHeaders(rawInit);
    if (isAuthApi(url)) return checkOutdated(await rawFetch(input, init));

    const used = await loadAuthToken();
    const res = checkOutdated(await rawFetch(input, withAuth(init, used)));
    if (res.status !== 401) return res;

    const code = await errorCode(res);
    if (code === "ACCOUNT_INACTIVE") {
      notifyExpired(code);
      return res;
    }

    // another request may already have renewed the token
    if (memToken && memToken !== used) return rawFetch(input, withAuth(init, memToken));

    const fresh = await refreshToken(rawFetch);
    if (fresh.token) return rawFetch(input, withAuth(init, fresh.token));
    if (fresh.denied) notifyExpired(code || "TOKEN_INVALID");
    return res;
  };

  globalThis.fetch = authFetch as typeof fetch;
}
