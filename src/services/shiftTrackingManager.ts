import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Battery from "expo-battery";
import * as Notifications from "expo-notifications";
import { Alert, AppState, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { BASE_HOST } from "../constants/config";

export const SHIFT_LOCATION_TASK = "BACKGROUND_HOURLY_LOCATION_TASK";
export const PING_PUSH_TASK = "PING_PUSH_TASK";
const API_URL = `${BASE_HOST}/api/attendance/location-ping`;

// ------------------------------- tuning -------------------------------
const TRACKING_TEST_MODE = false; // set to false for the production build
// Movement-based tracking. The phone is asked for a position every SAMPLE_INTERVAL_MS, but a point is only SENT when
//   - the person moved at least MOVE_THRESHOLD_M (a new place, or travelling), or
//   - HEARTBEAT_MS passed while standing still (this is what measures how long they stay at one place).
const SAMPLE_INTERVAL_MS = TRACKING_TEST_MODE ? 60 * 1000 : 2 * 60 * 1000;
const HEARTBEAT_MS = TRACKING_TEST_MODE ? 3 * 60 * 1000 : 10 * 60 * 1000;
const MOVE_THRESHOLD_M = 75;
const UNKNOWN_POS = 999; // marker: the last point had no usable position
const GOOD_ACCURACY_M = 100;
const FIX_ATTEMPT_TIMEOUTS_MS = [15000, 20000, 25000]; // 3 attempts to get a position
const SEND_BACKOFF_MS = [0, 3000, 10000]; // 3 attempts to send to the server
const SEND_TIMEOUT_MS = 20000;
const MAX_OUTBOX = 2000; // a full day without network
const BATCH_SIZE = 50; // points per upload request
// Battery saving: after this long without moving, the phone samples with low power (a precise fix is still taken
// for every 10-minute heartbeat). Any movement switches back to high accuracy at once.
const LOW_POWER_AFTER_MS = 30 * 60 * 1000;
const LOW_SAMPLE_INTERVAL_MS = 4 * 60 * 1000;
const BATCH_URL = `${BASE_HOST}/api/attendance/location-ping/batch`;

const KEY = {
  empId: "active_tracking_emp_id",
  active: "is_shift_tracking_active",
  lastSent: "tracking_last_sent_point",
  outbox: "tracking_outbox_v1",
  lastGood: "tracking_last_good_fix",
  mode: "tracking_power_mode", // HIGH | LOW
  lastMoveAt: "tracking_last_move_at",
};

// GOOD = accurate fix, LOW = weak fix, STALE = no usable fix (last known position is shown)
type Quality = "GOOD" | "LOW" | "STALE";

interface PingPayload {
  pingId: string;
  empId: string;
  quality: Quality;
  remarks?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number | null;
  batteryPercentage?: number | null;
  isMock: boolean;
  capturedAtMs: number;
}

type SendResult = "OK" | "RETRY" | "DROP" | "STOP";

// ------------------------------- helpers -------------------------------
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Simple in-process mutex so outbox read-modify-write never interleaves
let lockChain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lockChain.then(fn, fn);
  lockChain = run.catch(() => undefined);
  return run;
}

const makePingId = (empId: string, ms: number) =>
  `${empId.replace(/[^A-Za-z0-9]/g, "")}-${ms}`;

async function readBattery(): Promise<number | null> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    return level >= 0 ? Math.round(level * 100) : null;
  } catch {
    return null;
  }
}

const accuracyOf = (l: Location.LocationObject | null) =>
  l?.coords.accuracy ?? Number.POSITIVE_INFINITY;

// Distance between two coordinates in meters
const distanceM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ------------------------------- outbox (send retry) -------------------------------
// Points are saved here FIRST and deleted only after the server confirmed them.
// New app builds: SQLite (one row per point, crash-safe). Older builds without the SQLite module (OTA update):
// the same list in AsyncStorage as before. The module is loaded at run time, so an older build never crashes.
let sqliteDb: any = null;
let sqliteTried = false;

async function queueDb(): Promise<any> {
  if (sqliteTried) return sqliteDb;
  sqliteTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SQLite = require("expo-sqlite");
    const db = await SQLite.openDatabaseAsync("tracking_queue.db");
    await db.execAsync(
      "CREATE TABLE IF NOT EXISTS outbox (ping_id TEXT PRIMARY KEY NOT NULL, captured_at INTEGER NOT NULL, payload TEXT NOT NULL)"
    );
    sqliteDb = db;
    // points queued by an older app version: move them into SQLite once
    const raw = await AsyncStorage.getItem(KEY.outbox);
    const old: PingPayload[] = raw ? JSON.parse(raw) : [];
    for (const p of old) {
      await db.runAsync("INSERT OR IGNORE INTO outbox (ping_id, captured_at, payload) VALUES (?, ?, ?)", [
        p.pingId, p.capturedAtMs || Date.now(), JSON.stringify(p),
      ]);
    }
    if (old.length) await AsyncStorage.removeItem(KEY.outbox);
  } catch {
    sqliteDb = null; // no SQLite in this build: AsyncStorage below
  }
  return sqliteDb;
}

async function loadOutboxAsync(): Promise<PingPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY.outbox);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function queueCount(): Promise<number> {
  const db = await queueDb();
  if (db) {
    try {
      const r: { n: number } | null = await db.getFirstAsync("SELECT COUNT(*) AS n FROM outbox");
      return r?.n ?? 0;
    } catch {
      return 0;
    }
  }
  return (await loadOutboxAsync()).length;
}

/** Oldest points first. */
async function queuePeek(limit: number): Promise<PingPayload[]> {
  const db = await queueDb();
  if (db) {
    const rows: { payload: string }[] = await db.getAllAsync("SELECT payload FROM outbox ORDER BY captured_at LIMIT ?", [limit]);
    return rows.map((r) => JSON.parse(r.payload));
  }
  return (await loadOutboxAsync()).slice(0, limit);
}

async function queueRemove(ids: string[]) {
  if (!ids.length) return;
  const db = await queueDb();
  if (db) {
    for (const id of ids) await db.runAsync("DELETE FROM outbox WHERE ping_id = ?", [id]);
    return;
  }
  const gone = new Set(ids);
  const items = (await loadOutboxAsync()).filter((i) => !gone.has(i.pingId));
  await AsyncStorage.setItem(KEY.outbox, JSON.stringify(items));
}

async function queueClear() {
  const db = await queueDb();
  if (db) {
    await db.runAsync("DELETE FROM outbox");
    return;
  }
  await AsyncStorage.setItem(KEY.outbox, JSON.stringify([]));
}

function enqueue(p: PingPayload) {
  return withLock(async () => {
    const db = await queueDb();
    if (db) {
      await db.runAsync("INSERT OR IGNORE INTO outbox (ping_id, captured_at, payload) VALUES (?, ?, ?)", [
        p.pingId, p.capturedAtMs || Date.now(), JSON.stringify(p),
      ]);
      // keep the newest MAX_OUTBOX points
      await db.runAsync(
        "DELETE FROM outbox WHERE ping_id IN (SELECT ping_id FROM outbox ORDER BY captured_at DESC LIMIT -1 OFFSET ?)",
        [MAX_OUTBOX]
      );
      return;
    }
    const items = await loadOutboxAsync();
    if (!items.some((i) => i.pingId === p.pingId)) items.push(p);
    await AsyncStorage.setItem(KEY.outbox, JSON.stringify(items.slice(-MAX_OUTBOX)));
  });
}

// Diagnostics only: remembers why tracking stopped or a point was refused, so "Phone status" can show it.
// Never changes what is sent or when tracking stops. Failures here are ignored.
const KEY_DIAG = "tracking_diag";
async function noteDiag(kind: "stop" | "drop", detail: string) {
  try {
    const raw = await AsyncStorage.getItem(KEY_DIAG);
    const cur = raw ? JSON.parse(raw) : {};
    cur[kind] = { at: Date.now(), detail };
    await AsyncStorage.setItem(KEY_DIAG, JSON.stringify(cur));
  } catch {
    /* diagnostics must never break tracking */
  }
}

async function sendOnce(p: PingPayload): Promise<SendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
      signal: controller.signal,
    });
    if (res.ok) return "OK";

    let code = "";
    try {
      code = (await res.json())?.code ?? "";
    } catch {
      /* body was not JSON */
    }
    // Only these two explicit server codes stop tracking
    if (res.status === 403 && code === "ROLE_NOT_ELIGIBLE") {
      await noteDiag("stop", "Server said ROLE_NOT_ELIGIBLE (work mode is not sales)");
      return "STOP";
    }
    if (res.status === 409 && code === "SHIFT_NOT_ACTIVE") {
      await noteDiag("stop", "Server said SHIFT_NOT_ACTIVE (no active check-in)");
      return "STOP";
    }
    // busy server, expired login (the token is renewed and tried again later) or outdated app: keep the point
    if (res.status >= 500 || res.status === 408 || res.status === 429 || res.status === 401 || res.status === 426) return "RETRY";
    await noteDiag("drop", `Server refused a point (HTTP ${res.status}${code ? " " + code : ""})`);
    return "DROP"; // other 4xx: this payload will never be accepted
  } catch {
    return "RETRY"; // offline, timeout, DNS...
  } finally {
    clearTimeout(timer);
  }
}

// The whole batch in one request (server /location-ping/batch). UNSUPPORTED = older server: send one by one.
type BatchResult =
  | { kind: "OK"; done: string[] }
  | { kind: "RETRY" }
  | { kind: "STOP"; code: string }
  | { kind: "UNSUPPORTED" };
let batchUnsupported = false;

async function sendBatch(empId: string, points: PingPayload[]): Promise<BatchResult> {
  if (batchUnsupported) return { kind: "UNSUPPORTED" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS * 2);
  try {
    const res = await fetch(BATCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empId, points }),
      signal: controller.signal,
    });
    if (res.status === 404 || res.status === 405) {
      batchUnsupported = true;
      return { kind: "UNSUPPORTED" };
    }
    if (!res.ok) return { kind: "RETRY" }; // 5xx, 401 (token renewed next time), 426, 429 ...
    const j: any = await res.json().catch(() => null);
    if (!j) return { kind: "RETRY" };
    if (j.stop) {
      await noteDiag("stop", `Server said ${j.stop}`);
      return { kind: "STOP", code: String(j.stop) };
    }
    const done: string[] = [...(Array.isArray(j.accepted) ? j.accepted : [])];
    for (const d of Array.isArray(j.dropped) ? j.dropped : []) {
      if (d?.pingId) done.push(String(d.pingId));
      await noteDiag("drop", `Server refused a point (${d?.code || "?"})`);
    }
    return { kind: "OK", done };
  } catch {
    return { kind: "RETRY" }; // offline, timeout
  } finally {
    clearTimeout(timer);
  }
}

// Sends queued points oldest-first, in batches (3 attempts each). A point is deleted only after the server
// confirmed it (stored or refused for good). Stops at the first network failure and keeps the rest.
export function flushOutbox(): Promise<void> {
  return withLock(async () => {
    for (let guard = 0; guard < 100; guard++) {
      const items = await queuePeek(BATCH_SIZE);
      if (items.length === 0) return;
      const empId = items[0].empId;
      const group = items.filter((i) => i.empId === empId);

      let result: BatchResult = { kind: "RETRY" };
      for (const wait of SEND_BACKOFF_MS) {
        if (wait) await sleep(wait);
        result = await sendBatch(empId, group);
        if (result.kind !== "RETRY") break;
      }

      if (result.kind === "UNSUPPORTED") {
        // older server: one point per request (as before)
        for (const next of group) {
          let r: SendResult = "RETRY";
          for (const wait of SEND_BACKOFF_MS) {
            if (wait) await sleep(wait);
            r = await sendOnce(next);
            if (r !== "RETRY") break;
          }
          if (r === "RETRY") return; // still offline: try again at the next opportunity
          if (r === "STOP") {
            await queueClear();
            await teardownTracking();
            return;
          }
          await queueRemove([next.pingId]); // OK or DROP
        }
        continue;
      }
      if (result.kind === "RETRY") return;
      if (result.kind === "STOP") {
        // the server refuses every point of this employee (not a sales / tracked role today)
        await queueClear();
        await teardownTracking();
        return;
      }
      if (result.done.length === 0) return; // nothing confirmed (server problem): keep everything, try later
      await queueRemove(result.done);
    }
  });
}

// ------------------------------- location -------------------------------
// Returns a reason when something on the phone is blocking location, otherwise null
async function blockerReason(): Promise<string | null> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) {
      return "Phone location was turned off";
    }
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") return "Location permission was removed";
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== "granted") return "'Allow all the time' permission was removed";
  } catch {
    /* if the check itself fails, carry on and try to get a position */
  }
  return null;
}

async function lowAccuracyRemark(accuracy: number | null): Promise<string> {
  const base = `Low accuracy (±${accuracy != null ? Math.round(accuracy) : "?"}m)`;
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if ((fg as any).android?.accuracy === "coarse") {
      return `${base}: only 'Approximate' location permission is granted`;
    }
  } catch {
    /* ignore */
  }
  return `${base}: weak GPS signal or battery saver`;
}

// Up to 3 attempts to get (or improve) a position; keeps the best one seen
async function acquireBestFix(
  seed: Location.LocationObject | null,
  allowRetry: boolean
): Promise<Location.LocationObject | null> {
  let best = seed;
  if (best && accuracyOf(best) <= GOOD_ACCURACY_M) return best;
  if (!allowRetry) return best;

  for (const timeoutMs of FIX_ATTEMPT_TIMEOUTS_MS) {
    try {
      const fix = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("fix timeout")), timeoutMs)
        ),
      ]);
      if (accuracyOf(fix) < accuracyOf(best)) best = fix;
      if (accuracyOf(best) <= GOOD_ACCURACY_M) break;
    } catch {
      /* try the next attempt */
    }
  }
  return best;
}

// Last accurate position seen on this phone, else the OS-cached one
async function lastKnownFix(): Promise<{ lat: number; lng: number; ts: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY.lastGood);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  try {
    const l = await Location.getLastKnownPositionAsync();
    if (l) return { lat: l.coords.latitude, lng: l.coords.longitude, ts: l.timestamp };
  } catch {
    /* ignore */
  }
  return null;
}

// One entry per interval. It is always created; "remarks" explains a weak or missing position.
async function buildPoint(
  empId: string,
  seed: Location.LocationObject | null,
  battery: number | null,
  allowRetry: boolean
): Promise<PingPayload> {
  const nowMs = Date.now();
  const base = { empId, batteryPercentage: battery, isMock: false };

  // If the phone itself blocks location there is nothing to retry
  const blocker = seed ? null : await blockerReason();
  const best = blocker ? null : await acquireBestFix(seed, allowRetry);

  if (best) {
    const accuracy = best.coords.accuracy ?? null;
    const isMock = !!(best.mocked || (best as any).isFromMockProvider);
    const good = accuracy != null && accuracy <= GOOD_ACCURACY_M;

    if (good && !isMock) {
      await AsyncStorage.setItem(
        KEY.lastGood,
        JSON.stringify({ lat: best.coords.latitude, lng: best.coords.longitude, ts: best.timestamp })
      );
    }
    return {
      ...base,
      isMock,
      pingId: makePingId(empId, best.timestamp),
      quality: good ? "GOOD" : "LOW",
      remarks: good ? undefined : await lowAccuracyRemark(accuracy),
      latitude: best.coords.latitude,
      longitude: best.coords.longitude,
      accuracyMeters: accuracy != null ? Math.round(accuracy) : null,
      capturedAtMs: best.timestamp,
    };
  }

  // No usable position after the attempts: keep the entry and show the last known position
  const reason = blocker ?? "No GPS fix after 3 attempts";
  const last = await lastKnownFix();
  return {
    ...base,
    pingId: makePingId(empId, nowMs),
    quality: "STALE",
    remarks: last ? `${reason} - showing last known position from ${hhmm(last.ts)}` : reason,
    latitude: last?.lat, // when the phone has none, the server copies the previous stored position
    longitude: last?.lng,
    accuracyMeters: null,
    capturedAtMs: nowMs,
  };
}

// ------------------------------- main cycle -------------------------------
// The last point that was sent: movement and standing-still time are measured from it
interface LastSent {
  lat: number;
  lng: number;
  ts: number;
}

async function readLastSent(): Promise<LastSent | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY.lastSent);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Is this sample worth sending? FIRST = nothing sent yet, MOVED = went somewhere, HEARTBEAT = still there after a while
function sendReason(sample: Location.LocationObject, last: LastSent | null): "FIRST" | "MOVED" | "HEARTBEAT" | null {
  if (!last) return "FIRST";
  const acc = sample.coords.accuracy ?? 0;

  if (last.lat === UNKNOWN_POS) {
    return acc <= GOOD_ACCURACY_M || sample.timestamp - last.ts >= HEARTBEAT_MS ? "FIRST" : null;
  }

  const moved = distanceM(last.lat, last.lng, sample.coords.latitude, sample.coords.longitude);
  // A weak fix can jump around by its own accuracy: do not mistake that for walking
  if (moved >= Math.max(MOVE_THRESHOLD_M, 2 * acc)) return "MOVED";
  if (sample.timestamp - last.ts >= HEARTBEAT_MS) return "HEARTBEAT";
  return null;
}

// seeds = locations delivered by the OS (may be several in one batch).
// Empty seeds = a foreground/health-check trigger.
async function captureAndQueue(seeds: Location.LocationObject[]): Promise<void> {
  const empId = await AsyncStorage.getItem(KEY.empId);
  const active = await AsyncStorage.getItem(KEY.active);
  if (!empId || active !== "true") return;

  const ordered = [...seeds].sort((a, b) => a.timestamp - b.timestamp);
  const last = await readLastSent();

  const toSend: { seed: Location.LocationObject | null; reason: string }[] = [];
  if (ordered.length > 0) {
    let ref = last;
    for (const s of ordered) {
      const reason = sendReason(s, ref);
      if (reason) {
        toSend.push({ seed: s, reason });
        ref = { lat: s.coords.latitude, lng: s.coords.longitude, ts: s.timestamp };
      }
    }
  } else if (!last || Date.now() - last.ts >= HEARTBEAT_MS) {
    toSend.push({ seed: null, reason: "HEARTBEAT" }); // app opened: nothing was sent for a while
  }

  if (ordered.length > 0) await adjustPowerMode(toSend.some((t) => t.reason === "MOVED" || t.reason === "FIRST"));

  if (toSend.length === 0) {
    await flushOutbox(); // nothing new, but deliver anything still pending
    return;
  }

  const battery = await readBattery();
  for (let i = 0; i < toSend.length; i++) {
    const { seed, reason } = toSend[i];
    const isNewest = i === toSend.length - 1;
    // retries to improve a weak position are only worth the battery for a standing-still check
    const point = await buildPoint(empId, seed, battery, isNewest && reason === "HEARTBEAT");
    await enqueue(point);

    if (point.latitude != null && point.longitude != null && point.quality !== "STALE") {
      await AsyncStorage.setItem(
        KEY.lastSent,
        JSON.stringify({ lat: point.latitude, lng: point.longitude, ts: point.capturedAtMs })
      );
    } else {
      // no new position: keep the old one but restart the clock, so a dead GPS does not send on every sample
      const prev = await readLastSent();
      await AsyncStorage.setItem(
        KEY.lastSent,
        JSON.stringify({ lat: prev?.lat ?? UNKNOWN_POS, lng: prev?.lng ?? UNKNOWN_POS, ts: Date.now() })
      );
    }
  }

  await flushOutbox();
}

// Battery saving: standing still for LOW_POWER_AFTER_MS -> low-power sampling (the 10-minute heartbeat still takes
// a precise fix); any movement -> high accuracy again. A failed switch simply keeps the current mode.
async function adjustPowerMode(moved: boolean): Promise<void> {
  try {
    const now = Date.now();
    const mode = (await AsyncStorage.getItem(KEY.mode)) || "HIGH";
    if (moved) {
      await AsyncStorage.setItem(KEY.lastMoveAt, String(now));
      if (mode === "LOW") {
        await startLocationService("HIGH");
      }
      return;
    }
    if (mode !== "HIGH") return;
    const lastMove = Number((await AsyncStorage.getItem(KEY.lastMoveAt)) || 0);
    if (!lastMove) {
      await AsyncStorage.setItem(KEY.lastMoveAt, String(now));
      return;
    }
    if (now - lastMove >= LOW_POWER_AFTER_MS) {
      await startLocationService("LOW");
    }
  } catch (e: any) {
    console.warn("Power mode switch failed:", e?.message);
  }
}

// Must run at root bundle level (App.tsx imports this file)
// The background task does not exist on the web, so it is only defined on phones
if (Platform.OS !== "web") TaskManager.defineTask(SHIFT_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error("Background task error:", error);
    return;
  }
  try {
    await captureAndQueue((data?.locations as Location.LocationObject[]) ?? []);
  } catch (e: any) {
    console.warn("Tracking cycle failed:", e?.message);
  }
});

// ------------------------------- "Ping now" from the admin -------------------------------
// The admin taps "Ping now" -> the server sends a silent push -> this takes a position the same way as a normal
// shift point and sends it through the same outbox, so it lands in route_data_json. Only during a checked-in shift.
const handledPings = new Set<string>();

export async function respondToPing(requestId: string, reason?: string, pushEmpId?: string) {
  if (requestId) {
    if (handledPings.has(requestId)) return;
    handledPings.add(requestId);
  }
  const watchdog = reason === "WATCHDOG";
  // Server watchdog (no point for 30 min): restart the tracking service if the phone stopped it, or start it again
  // from the server's check-in state when this phone lost it (reinstall, logout, check-in on another phone).
  if (Platform.OS === "android") {
    try {
      const localActive = (await AsyncStorage.getItem(KEY.active)) === "true";
      if (!localActive && pushEmpId) {
        await syncTrackingWithServer(pushEmpId, "push");
      } else if (localActive) {
        const running = await Location.hasStartedLocationUpdatesAsync(SHIFT_LOCATION_TASK).catch(() => false);
        if (!running) {
          await startLocationService("HIGH");
          const id = (await AsyncStorage.getItem(KEY.empId)) || pushEmpId || "";
          reportTrackingStatus(id, "RESTARTED", `Tracking was stopped by the phone - restarted by the server at ${hhmm(Date.now())}`).catch(() => {});
        }
      }
    } catch (e: any) {
      const id = (await AsyncStorage.getItem(KEY.empId)) || pushEmpId || "";
      reportTrackingStatus(id, "START_FAILED", `Phone refused to restart tracking: ${String(e?.message || e).slice(0, 120)}`).catch(() => {});
    }
  }

  const empId = await AsyncStorage.getItem(KEY.empId);
  const active = await AsyncStorage.getItem(KEY.active);
  if (!empId || active !== "true") return; // not checked in: never share location

  const battery = await readBattery();
  const point = await buildPoint(empId, null, battery, true); // always builds a point; remarks explain a weak/missing position
  point.pingId = `${point.pingId}-REQ${Date.now().toString(36)}`; // unique, so it is never treated as a duplicate
  const label = watchdog ? "Tracking check" : "Manager ping";
  point.remarks = point.remarks ? `${label} - ${point.remarks}` : label;
  await enqueue(point);

  if (point.latitude != null && point.longitude != null && point.quality !== "STALE") {
    await AsyncStorage.setItem(
      KEY.lastSent,
      JSON.stringify({ lat: point.latitude, lng: point.longitude, ts: point.capturedAtMs })
    );
  }
  await flushOutbox();

  // Tell the employee, so a manager's location request is never invisible (the automatic tracking check is
  // part of the shift tracking the employee already sees in the "Shift Tracking Active" notification)
  if (!watchdog) {
    Notifications.scheduleNotificationAsync({
      content: { title: "Location shared", body: "Your manager requested your current location." },
      trigger: null,
    }).catch(() => {});
  }
}

// "Phone status" from the admin: reply with the phone's own settings. No location is sent and nothing is saved.
export async function respondToStatus(requestId: string, empId: string) {
  if (!requestId || !empId || handledPings.has(`S${requestId}`)) return;
  handledPings.add(`S${requestId}`);

  let gpsEnabled: boolean | null = null;
  let permission: "GRANTED" | "FOREGROUND_ONLY" | "DENIED" | "NOT_ASKED" = "NOT_ASKED";
  let preciseLocation: boolean | null = null;
  try {
    gpsEnabled = await Location.hasServicesEnabledAsync();
  } catch {
    /* unknown */
  }
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status === "granted") {
      const bg = await Location.getBackgroundPermissionsAsync();
      permission = bg.status === "granted" ? "GRANTED" : "FOREGROUND_ONLY";
      const acc = (fg as any).android?.accuracy;
      preciseLocation = acc ? acc === "fine" : null;
    } else if (fg.status === "denied") {
      permission = "DENIED";
    }
  } catch {
    /* unknown */
  }
  const trackingRunning = await Location.hasStartedLocationUpdatesAsync(SHIFT_LOCATION_TASK).catch(() => false);
  const shiftActive = (await AsyncStorage.getItem(KEY.active)) === "true";

  let lastStop: any = null;
  let lastDrop: any = null;
  let outboxPending: number | null = null;
  try {
    const raw = await AsyncStorage.getItem(KEY_DIAG);
    const d = raw ? JSON.parse(raw) : {};
    lastStop = d.stop ?? null;
    lastDrop = d.drop ?? null;
    outboxPending = await queueCount();
  } catch {
    /* optional extras */
  }

  const body = JSON.stringify({
    requestId,
    empId,
    lastStop,
    lastDrop,
    outboxPending,
    gpsEnabled,
    permission,
    preciseLocation,
    trackingRunning,
    shiftActive,
    battery: await readBattery(),
    appState: AppState.currentState === "active" ? "OPEN" : "BACKGROUND",
    platform: Platform.OS,
  });
  for (const wait of SEND_BACKOFF_MS) {
    if (wait) await sleep(wait);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE_HOST}/api/tracking/status-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      if (res.ok) return;
    } catch {
      /* try again */
    } finally {
      clearTimeout(timer);
    }
  }
}

// The push payload differs between phones and can hold JSON inside a string: look for the marker anywhere in it
interface PushRequest {
  type: "PING_REQUEST" | "STATUS_REQUEST";
  requestId: string;
  empId?: string;
  reason?: string; // "WATCHDOG" = the server's automatic tracking check
}

function findRequest(node: any, depth = 0): PushRequest | null {
  if (node == null || depth > 5) return null;
  if (typeof node === "string") {
    const t = node.trim();
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        return findRequest(JSON.parse(t), depth + 1);
      } catch {
        return null;
      }
    }
    return null;
  }
  if (typeof node !== "object") return null;
  if ((node.type === "PING_REQUEST" || node.type === "STATUS_REQUEST") && typeof node.requestId === "string") {
    return {
      type: node.type,
      requestId: node.requestId,
      empId: typeof node.empId === "string" ? node.empId : undefined,
      reason: typeof node.reason === "string" ? node.reason : undefined,
    };
  }
  for (const k of Object.keys(node)) {
    const found = findRequest(node[k], depth + 1);
    if (found) return found;
  }
  return null;
}

function handleRequest(req: PushRequest | null) {
  if (!req) return Promise.resolve();
  return req.type === "STATUS_REQUEST"
    ? respondToStatus(req.requestId, req.empId ?? "")
    : respondToPing(req.requestId, req.reason, req.empId);
}

// Runs when a ping / status push arrives while the app is closed or in the background
if (Platform.OS !== "web") TaskManager.defineTask(PING_PUSH_TASK, async ({ data, error }: any) => {
  if (error) return;
  await handleRequest(findRequest(data));
});

// Call once from a screen that is always open after login (for example Home):
//     useEffect(() => registerPingListeners(), []);
export function registerPingListeners(): () => void {
  if (Platform.OS !== "android") return () => {};
  const sub = Notifications.addNotificationReceivedListener((n) => {
    handleRequest(findRequest(n?.request?.content?.data)).catch(() => {}); // push while the app is open
  });
  Notifications.registerTaskAsync(PING_PUSH_TASK).catch(() => {}); // ping push while the app is closed
  return () => sub.remove();
}

// ------------------------------- tracking status for the admin page -------------------------------
// The phone tells the server WHY tracking cannot start or run (or that it runs again), while the app is open.
// No push (FCM) needed. The same report is sent at most once every 10 minutes. Never throws.
type ClientStatusCode =
  | "STARTED"
  | "RESTARTED"
  | "DISCLOSURE_DECLINED"
  | "PERMISSION_DENIED"
  | "BACKGROUND_DENIED"
  | "PRECISE_OFF"
  | "GPS_OFF"
  | "START_FAILED"
  | "OUTBOX_PENDING"
  | "BATTERY_RESTRICTED"
  | "IOS_NOT_SUPPORTED";

const KEY_STATUS_SENT = "tracking_client_status_sent";
const STATUS_REPEAT_MS = 10 * 60 * 1000;

export async function reportTrackingStatus(empId: string, code: ClientStatusCode, message: string): Promise<void> {
  if (!empId) return;
  try {
    const raw = await AsyncStorage.getItem(KEY_STATUS_SENT);
    const last = raw ? JSON.parse(raw) : null;
    if (last && last.empId === empId && last.code === code && last.message === message && Date.now() - last.at < STATUS_REPEAT_MS) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE_HOST}/api/tracking/client-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empId, code, message }),
        signal: controller.signal,
      });
      if (res.ok) {
        await AsyncStorage.setItem(KEY_STATUS_SENT, JSON.stringify({ empId, code, message, at: Date.now() }));
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    /* offline or old server: the admin page still works it out from the missing points */
  }
}

// ------------------------------- public API -------------------------------
// "Prominent disclosure" required by Google Play before asking for background location.
// Resolves true when the employee chooses Continue.
function showBackgroundLocationDisclosure(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Location use during your shift",
      "PayCore collects your location to record your work route during your shift, " +
        "even when the app is closed or not in use.\n\n" +
        "Location is collected only between check-in and check-out, and is shared only with your employer. " +
        "On the next screen, choose \"Allow all the time\".",
      [
        { text: "No thanks", style: "cancel", onPress: () => resolve(false) },
        { text: "Continue", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

async function teardownTracking() {
  await AsyncStorage.setItem(KEY.active, "false");
  await AsyncStorage.multiRemove([KEY.empId, KEY.lastSent, KEY.lastGood, KEY.mode, KEY.lastMoveAt]);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(SHIFT_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(SHIFT_LOCATION_TASK);
    }
  } catch (e: any) {
    console.warn("Could not stop location task:", e?.message);
  }
}

// Call on check-in, and again whenever the app resumes mid-shift (safe to call repeatedly)
export async function startShiftTracking(
  empId: string,
  workMode?: string
): Promise<{ started: boolean; warning?: string }> {
  // Live tracking is Android-only for now: on iPhone no background task or "Always" permission is requested.
  // Check-in and check-out locations are still saved by the punch itself.
  if (Platform.OS !== "android") {
    if (Platform.OS === "ios" && (workMode || "").toUpperCase() === "SALES") {
      reportTrackingStatus(empId, "IOS_NOT_SUPPORTED", "iPhone: route tracking runs on Android phones only").catch(() => {});
    }
    return { started: false };
  }

  // Expo Go cannot run background location on Android at all: skip quietly instead of throwing its error.
  // Use a development build or the installed APK to test tracking.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    console.log("Live tracking skipped: Expo Go does not support background location. Use a development build.");
    return { started: false };
  }

  if ((workMode || "").toUpperCase() !== "SALES") return { started: false };

  // Fast path: already tracking this employee, so no permission prompts and no settings redirects on resume
  const alreadyRunning =
    (await AsyncStorage.getItem(KEY.active)) === "true" &&
    (await AsyncStorage.getItem(KEY.empId)) === empId &&
    (await Location.hasStartedLocationUpdatesAsync(SHIFT_LOCATION_TASK).catch(() => false));
  if (alreadyRunning) return { started: true };

  // Google Play policy: explain background location in the app BEFORE the system permission prompt
  const bgBefore = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (bgBefore?.status !== "granted") {
    const accepted = await showBackgroundLocationDisclosure();
    if (!accepted) {
      reportTrackingStatus(empId, "DISCLOSURE_DECLINED", `Employee declined location tracking at ${hhmm(Date.now())}`).catch(() => {});
      return { started: false, warning: "Shift route tracking is off because location access was not allowed." };
    }
  }

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    reportTrackingStatus(empId, "PERMISSION_DENIED", `Location permission denied (${hhmm(Date.now())})`).catch(() => {});
    return { started: false, warning: "Location permission is required for shift tracking." };
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    reportTrackingStatus(
      empId,
      "BACKGROUND_DENIED",
      `Location permission is 'While using the app' - tracking cannot run in background (${hhmm(Date.now())})`
    ).catch(() => {});
    return {
      started: false,
      warning: "Please choose 'Allow all the time' in location permission so your shift route can be recorded.",
    };
  }

  let warning: string | undefined;
  let statusCode: ClientStatusCode = "STARTED";
  let statusMsg = `Tracking started at ${hhmm(Date.now())}`;
  if ((fg as any).android?.accuracy === "coarse") {
    warning =
      "'Precise location' is turned off. Turn it on in app settings, otherwise locations can be about 2 km off.";
    statusCode = "PRECISE_OFF";
    statusMsg = "Precise location is off - points may be about 2 km off";
  }
  const gpsOn = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!gpsOn) {
    statusCode = "GPS_OFF";
    statusMsg = `Phone location (GPS) is OFF (${hhmm(Date.now())})`;
  }

  const wasActive =
    (await AsyncStorage.getItem(KEY.active)) === "true" &&
    (await AsyncStorage.getItem(KEY.empId)) === empId;

  await AsyncStorage.multiSet([
    [KEY.empId, empId],
    [KEY.active, "true"],
  ]);
  // Fresh start: the first sample after check-in is sent right away, then movement is measured from it
  if (!wasActive) {
    await AsyncStorage.removeItem(KEY.lastSent);
  }

  if (!(await Location.hasStartedLocationUpdatesAsync(SHIFT_LOCATION_TASK))) {
    try {
      await startLocationService();
    } catch (e: any) {
      reportTrackingStatus(empId, "START_FAILED", `Phone refused to start tracking: ${String(e?.message || e).slice(0, 120)}`).catch(() => {});
      throw e;
    }
    // it was running for this employee before, but the phone stopped it (battery saver / app closed)
    if (wasActive) {
      statusCode = statusCode === "STARTED" ? "RESTARTED" : statusCode;
      if (statusCode === "RESTARTED") {
        statusMsg = `Tracking was stopped by the phone (battery saver / app closed) - restarted at ${hhmm(Date.now())}`;
      }
    }
  }
  reportTrackingStatus(empId, statusCode, statusMsg).catch(() => {});
  return { started: true, warning };
}

// The background location service with the shift tracking settings.
// HIGH = GPS every 2 minutes (moving); LOW = low-power position every 4 minutes (standing still for 30+ minutes).
// Calling it again while running just changes the settings.
async function startLocationService(mode: "HIGH" | "LOW" = "HIGH") {
  await Location.startLocationUpdatesAsync(SHIFT_LOCATION_TASK, {
    accuracy: mode === "HIGH" ? Location.Accuracy.High : Location.Accuracy.Balanced,
    timeInterval: mode === "HIGH" ? SAMPLE_INTERVAL_MS : LOW_SAMPLE_INTERVAL_MS, // Android only (iPhone is not tracked)
    distanceInterval: 0, // time-based: a stationary rep still needs an entry
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Shift Tracking Active",
      notificationBody: "Logging periodic location for your shift.",
      notificationColor: "#5B4FD1",
    },
  });
  await AsyncStorage.setItem(KEY.mode, mode);
  if (mode === "HIGH") await AsyncStorage.setItem(KEY.lastMoveAt, String(Date.now()));
}

/**
 * Call when the app opens or comes back to the front (App.tsx does). Only for a shift that is already being
 * tracked on this phone: never asks for permissions and never starts tracking for someone new.
 *  - the phone stopped the tracking service -> start it again and report it
 *  - permission removed / phone location off -> report the reason (the admin page shows it)
 *  - then a due point is taken and anything waiting is uploaded (runTrackingHealthCheck)
 */
export async function resumeTrackingIfActive(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
  try {
    const empId = await AsyncStorage.getItem(KEY.empId);
    const active = (await AsyncStorage.getItem(KEY.active)) === "true";
    if (!empId || !active) return;

    const fg = await Location.getForegroundPermissionsAsync().catch(() => null);
    if (fg && fg.status !== "granted") {
      await reportTrackingStatus(empId, "PERMISSION_DENIED", `Location permission was removed (${hhmm(Date.now())})`);
      return;
    }
    const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
    if (bg && bg.status !== "granted") {
      await reportTrackingStatus(
        empId,
        "BACKGROUND_DENIED",
        `'Allow all the time' permission was removed - tracking cannot run in background (${hhmm(Date.now())})`
      );
      return;
    }
    const gpsOn = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!gpsOn) {
      await reportTrackingStatus(empId, "GPS_OFF", `Phone location (GPS) is OFF (${hhmm(Date.now())})`);
    }

    const running = await Location.hasStartedLocationUpdatesAsync(SHIFT_LOCATION_TASK).catch(() => false);
    if (!running) {
      try {
        await startLocationService();
        await reportTrackingStatus(
          empId,
          "RESTARTED",
          `Tracking was stopped by the phone (battery saver / app closed) - restarted at ${hhmm(Date.now())}`
        );
      } catch (e: any) {
        await reportTrackingStatus(empId, "START_FAILED", `Phone refused to restart tracking: ${String(e?.message || e).slice(0, 120)}`);
        return;
      }
    } else if (gpsOn) {
      await reportTrackingStatus(empId, "STARTED", "Tracking running");
    }

    await runTrackingHealthCheck();

    const pending = await queueCount();
    if (pending >= 5) {
      await reportTrackingStatus(empId, "OUTBOX_PENDING", `${pending} points waiting to upload (no internet)`);
    }
  } catch (e: any) {
    console.warn("Tracking resume check failed:", e?.message);
  }
}

/**
 * App open / back to the front, and the server's tracking check (push): asks the server whether this employee is
 * checked in and tracked today, and makes this phone match:
 *   - checked in + tracked, phone already tracking  -> resumeTrackingIfActive (restart if stopped, report status)
 *   - checked in + tracked, phone NOT tracking       -> start without any prompt when the permissions allow it
 *     (after a logout, reinstall, or a check-in on another phone); otherwise report the missing permission
 *   - checked out                                    -> stop
 * Only for the employee logged in on this phone. Offline: falls back to what this phone knows.
 */
export async function syncTrackingWithServer(empId: string, source: "app" | "push" = "app"): Promise<void> {
  if (Platform.OS !== "android" || !empId) return;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
  const id = empId.trim().toUpperCase();
  try {
    const remembered = (await AsyncStorage.getItem("paycore_remembered_emp_id")) || "";
    if (remembered.trim().toUpperCase() !== id) return; // never track another ID on this phone
  } catch {
    return;
  }

  let data: any = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${BASE_HOST}/api/attendance/today?empId=${encodeURIComponent(id)}`, { signal: controller.signal });
    if (res.ok) data = await res.json();
  } catch {
    data = null;
  } finally {
    clearTimeout(timer);
  }
  if (!data) {
    await resumeTrackingIfActive(); // offline: keep what this phone knows
    return;
  }

  const localActive =
    (await AsyncStorage.getItem(KEY.active)) === "true" && ((await AsyncStorage.getItem(KEY.empId)) || "").toUpperCase() === id;
  if (data.last_punch_out) {
    if (localActive) await stopShiftTracking(); // checked out (on another phone, or automatically)
    return;
  }
  const checkedIn = !!data.first_punch_in;
  if (!checkedIn || data.requires_live_tracking !== true) return;

  if (localActive) {
    await resumeTrackingIfActive();
    return;
  }

  // checked in and tracked, but this phone is not tracking
  const fg = await Location.getForegroundPermissionsAsync().catch(() => null);
  const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (fg?.status !== "granted" || bg?.status !== "granted") {
    await reportTrackingStatus(
      id,
      fg?.status !== "granted" ? "PERMISSION_DENIED" : "BACKGROUND_DENIED",
      "Checked in, but tracking cannot start: location 'Allow all the time' is missing (open the Punch screen to fix)"
    );
    return;
  }
  await AsyncStorage.multiSet([
    [KEY.empId, id],
    [KEY.active, "true"],
  ]);
  await AsyncStorage.removeItem(KEY.lastSent);
  try {
    if (!(await Location.hasStartedLocationUpdatesAsync(SHIFT_LOCATION_TASK).catch(() => false))) {
      await startLocationService("HIGH");
    }
    await reportTrackingStatus(
      id,
      "RESTARTED",
      `Tracking started ${source === "push" ? "by the server's tracking check" : "when the app opened"} at ${hhmm(Date.now())}`
    );
  } catch (e: any) {
    await reportTrackingStatus(id, "START_FAILED", `Phone refused to start tracking: ${String(e?.message || e).slice(0, 120)}`);
    return;
  }
  if (source === "app") await runTrackingHealthCheck();
}

// Call on check-out. Delivers pending entries first, then stops.
export async function stopShiftTracking() {
  try {
    await flushOutbox();
  } catch {
    /* best effort */
  }
  await teardownTracking();
}

// Call when the app returns to the foreground during a tracked shift.
// Creates a due entry (with remarks if the phone blocks location) and delivers anything queued.
export async function runTrackingHealthCheck() {
  await captureAndQueue([]);
}

// Backward-compatible names used by your screens
export const startHourlyTracking = startShiftTracking;
export const stopHourlyTracking = stopShiftTracking;