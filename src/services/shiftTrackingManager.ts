import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Battery from "expo-battery";
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { BASE_HOST } from "../constants/config";

export const SHIFT_LOCATION_TASK = "BACKGROUND_HOURLY_LOCATION_TASK";
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
const MAX_OUTBOX = 100;

const KEY = {
  empId: "active_tracking_emp_id",
  active: "is_shift_tracking_active",
  lastSent: "tracking_last_sent_point",
  outbox: "tracking_outbox_v1",
  lastGood: "tracking_last_good_fix",
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
async function loadOutbox(): Promise<PingPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY.outbox);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveOutbox(items: PingPayload[]) {
  await AsyncStorage.setItem(KEY.outbox, JSON.stringify(items.slice(-MAX_OUTBOX)));
}

function enqueue(p: PingPayload) {
  return withLock(async () => {
    const items = await loadOutbox();
    if (!items.some((i) => i.pingId === p.pingId)) items.push(p);
    await saveOutbox(items);
  });
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
    if (res.status === 403 && code === "ROLE_NOT_ELIGIBLE") return "STOP";
    if (res.status === 409 && code === "SHIFT_NOT_ACTIVE") return "STOP";
    if (res.status >= 500 || res.status === 408 || res.status === 429) return "RETRY";
    return "DROP"; // other 4xx: this payload will never be accepted
  } catch {
    return "RETRY"; // offline, timeout, DNS...
  } finally {
    clearTimeout(timer);
  }
}

// Sends queued pings oldest-first, 3 attempts each. Stops at the first network failure and keeps the rest.
export function flushOutbox(): Promise<void> {
  return withLock(async () => {
    let items = await loadOutbox();
    while (items.length > 0) {
      const next = items[0];
      let result: SendResult = "RETRY";
      for (const wait of SEND_BACKOFF_MS) {
        if (wait) await sleep(wait);
        result = await sendOnce(next);
        if (result !== "RETRY") break;
      }
      if (result === "RETRY") break; // still offline: try again at the next opportunity
      if (result === "STOP") {
        await saveOutbox([]);
        await teardownTracking();
        return;
      }
      items = items.slice(1); // OK or DROP
      await saveOutbox(items);
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

// ------------------------------- public API -------------------------------
async function teardownTracking() {
  await AsyncStorage.setItem(KEY.active, "false");
  await AsyncStorage.multiRemove([KEY.empId, KEY.lastSent, KEY.lastGood]);
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
  if (Platform.OS !== "android") return { started: false };

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

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    return { started: false, warning: "Location permission is required for shift tracking." };
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    return {
      started: false,
      warning: "Please choose 'Allow all the time' in location permission so your shift route can be recorded.",
    };
  }

  let warning: string | undefined;
  if ((fg as any).android?.accuracy === "coarse") {
    warning =
      "'Precise location' is turned off. Turn it on in app settings, otherwise locations can be about 2 km off.";
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
    await Location.startLocationUpdatesAsync(SHIFT_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: SAMPLE_INTERVAL_MS, // Android only (iPhone is not tracked)
      distanceInterval: 0, // time-based: a stationary rep still needs an entry
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Shift Tracking Active",
        notificationBody: "Logging periodic location for your shift.",
        notificationColor: "#5B4FD1",
      },
    });
  }
  return { started: true, warning };
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