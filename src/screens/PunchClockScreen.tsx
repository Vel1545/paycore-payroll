import React, { useState, useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import {
  View,
  Text,
  RefreshControl,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
  Image,
  ActivityIndicator,
  ScrollView,
  Modal,
  Linking,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import {
  ChevronLeft,
  Camera as CameraIcon,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Sparkles,
  Check,
  Coffee,
  Utensils,
  Play,
  Pause,
  Building2,
  Home,
  Briefcase,
  Undo2,
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";
import { UserSession } from "../services/UserSession";
import { startShiftTracking, stopShiftTracking } from "../services/shiftTrackingManager";
import { BASE_HOST } from "../constants/config";
import { useIsFocused } from "@react-navigation/native";

// Optional: shrinks the selfie so low-memory phones do not crash on a full-size photo.
// Install with: npx expo install expo-image-manipulator (needs a new build)
let ImageManipulator: any = null;
try {
  ImageManipulator = require("expo-image-manipulator");
} catch {
  /* not installed: the photo is used as taken */
}

interface PunchClockScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    canGoBack?: () => boolean;
  };
}

type PunchState = "NOT_CHECKED_IN" | "WORKING" | "ON_BREAK" | "CHECKED_OUT";
type AttendanceMode = "OFFICE" | "WFH" | "SALES";

interface BreakSessionItem {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  durationSeconds?: number;
  type: "TEA" | "LUNCH" | "PERSONAL";
}

interface GeofenceConfig {
  branch_name?: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
}

interface PunchResponsePayload {
  status: string;
  statusCode?: number;
  workMode?: string;
  punchId?: string;
  message?: string;
  requiresLiveTracking?: boolean;
  recovered?: boolean;
  [key: string]: any;
}

interface Fix {
  latitude: number;
  longitude: number;
  isMock: boolean;
  accuracy: number | null; // meters; a large value means a weak / approximate position
  ts: number;
}

interface GeoResult {
  eligible: boolean;
  distance: number | null;
  branch: GeofenceConfig | null;
}

interface FetchResult {
  state: PunchState;
  requiresTracking?: boolean;
}

const API_BASE_URL = `${BASE_HOST}/api/attendance`;
const TOTAL_BREAK_LIMIT_MINS = 80;
const NETWORK_TIMEOUT_MS = 10000;
const PUNCH_TIMEOUT_MS = 25000; // slow servers / cold starts
const LOCATION_TIMEOUT_MS = 8000;
const LOCATION_MAX_AGE_MS = 20000; // a punch may reuse a fix this fresh
// Geofenced punches need a position at least this accurate. Stricter on iPhone (Precise Location can be off);
// lenient on Android for the first rollout, only clearly useless fixes (e.g. +-2000 m) are refused.
const MAX_PUNCH_ACCURACY_M = Platform.OS === "android" ? 300 : 150;
const PRECISE_LOCATION_HINT =
  Platform.OS === "ios"
    ? "Open Settings > Privacy & Security > Location Services, choose this app and turn on Precise Location."
    : Platform.OS === "web"
    ? "In Settings > Privacy & Security > Location Services, set Safari Websites to While Using the App and turn on Precise Location."
    : "Turn on 'Precise location' for this app in Settings.";
const CAMERA_CAPTURE_TIMEOUT_MS = 10000;
const CAMERA_REMOUNT_AFTER_BG_MS = 10000; // remount the camera only after a REAL background period
const CAMERA_READY_TIMEOUT_MS = 8000;
const RESUME_REFRESH_MIN_AWAY_MS = 3000; // ignore brief focus blips (permission dialogs etc.)
const RESTART_WINDOW_MINUTES = 15; // matches the server-side window in restartShift()
// The selfie is only a camera check on the phone and is NOT stored, so no upload ticket is requested.
// Set to true only if you later store photos and /upload-ticket returns a real key.
const USE_UPLOAD_TICKET = false;
const SELFIE_NOT_STORED = "NOT_STORED";

// ---------------------------------------------------------------------------
// Helpers (pure, outside the component so they never re-create)
// ---------------------------------------------------------------------------
const notify = (title: string, message: string) => {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

// react-native-web has no Alert.alert, so confirmations use the browser dialog there
const confirmAction = (title: string, message: string, confirmText: string, onConfirm: () => void) => {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmText, style: "destructive", onPress: onConfirm },
  ]);
};

const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs: number = NETWORK_TIMEOUT_MS
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Full-size front-camera photos (12-48 MP) can run a 2-3 GB phone out of memory and white-screen the app
const shrinkPhoto = async (uri: string): Promise<string> => {
  if (!ImageManipulator) return uri;
  try {
    return await withTimeout(
      (async () => {
        if (typeof ImageManipulator.manipulate === "function") {
          const ctx = ImageManipulator.manipulate(uri); // current API
          ctx.resize({ width: 720 });
          const image = await ctx.renderAsync();
          const out = await image.saveAsync({ compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
          return out.uri as string;
        }
        const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 720 } }], {
          compress: 0.6,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        return out.uri as string;
      })(),
      8000,
      "Photo resize"
    );
  } catch (e) {
    console.warn("Photo resize failed, using the original:", e);
    return uri;
  }
};

// Sends the punch. A busy server (500 / 503 / 429) saved nothing, so it is retried up to 3 times.
// A timeout is NOT retried blindly: the server may still be working, so the caller asks the server instead.
const postPunch = async (payload: object): Promise<{ res: Response; body: PunchResponsePayload }> => {
  let lastError: any = new Error("Failed to record attendance punch.");
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(attempt === 1 ? 1500 : 3500);
    try {
      const res = await fetchWithTimeout(
        `${API_BASE_URL}/punch`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        PUNCH_TIMEOUT_MS
      );
      let body: PunchResponsePayload = { status: "" };
      try {
        body = await res.json();
      } catch {
        /* the body was not JSON */
      }
      if (res.status === 500 || res.status === 503 || res.status === 429) {
        lastError = new Error(body.message || "The server is busy. Please try again.");
        continue;
      }
      return { res, body };
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;
      lastError = e; // network error: retry
    }
  }
  throw lastError;
};

// Display formatter for IST
const formatToIST = (dateInput?: number | string | Date | null) => {
  if (!dateInput) return "--:--";
  try {
    let date: Date;
    if (typeof dateInput === "string") {
      // Fix Android Hermes issue with SQL "YYYY-MM-DD HH:mm:ss" timestamps
      date = new Date(dateInput.replace(" ", "T"));
    } else if (typeof dateInput === "number") {
      date = new Date(dateInput);
    } else {
      date = dateInput;
    }
    if (!date || isNaN(date.getTime())) return "--:--";
    return date.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (e) {
    console.warn("Date formatting error:", e);
    return "--:--";
  }
};

// Same raw SQL timestamp shape, but as a Date for arithmetic
const parseRawTimestamp = (dateInput?: number | string | Date | null): Date | null => {
  if (!dateInput) return null;
  try {
    let date: Date;
    if (typeof dateInput === "string") date = new Date(dateInput.replace(" ", "T"));
    else if (typeof dateInput === "number") date = new Date(dateInput);
    else date = dateInput;
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

const fmtHMS = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const formatBreakDuration = (totalSeconds?: number, totalMinutes?: number) => {
  if (totalSeconds !== undefined) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m === 0) return `${s}s`;
    if (s === 0) return `${m}m`;
    return `${m}m ${s}s`;
  }
  return `${totalMinutes || 0}m`;
};

// Haversine distance (meters)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

// Pure geofence decision for ONE fix. Used for both the on-screen status and the punch gate,
// so a punch is always judged on the fresh fix, never on an older state value.
const computeGeofence = (
  lat: number,
  lng: number,
  branches: GeofenceConfig[],
  mode: AttendanceMode,
  exempt: boolean
): GeoResult => {
  let minDistance = Infinity;
  let matched: GeofenceConfig | null = null;
  let inside = false;

  for (const b of branches || []) {
    const dist = calculateDistance(lat, lng, b.latitude, b.longitude);
    const radius = b.radius_meters || 200;
    if (dist < minDistance) {
      minDistance = dist;
      matched = b;
    }
    if (dist <= radius) inside = true;
  }

  const distance = minDistance === Infinity ? null : minDistance;
  if (mode === "WFH" || exempt) return { eligible: true, distance, branch: matched }; // distance is only informational
  if (!branches || branches.length === 0) return { eligible: false, distance: null, branch: null };
  return { eligible: inside, distance, branch: matched };
};

// ---------------------------------------------------------------------------
// Timer that ticks by itself, so the whole screen no longer re-renders every second
// ---------------------------------------------------------------------------
const LiveTimer = React.memo(function LiveTimer({
  baseSeconds,
  anchorMs,
  running,
  offsetMs,
  className,
}: {
  baseSeconds: number;
  anchorMs: number;
  running: boolean;
  offsetMs: number;
  className?: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const elapsed = running ? Math.max(0, Math.floor((Date.now() + offsetMs - anchorMs) / 1000)) : 0;
  return <Text className={className}>{fmtHMS(baseSeconds + elapsed)}</Text>;
});

// ---------------------------------------------------------------------------
// Camera error boundary: a render error inside the camera block no longer blanks the screen
// ---------------------------------------------------------------------------
class CameraErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    console.warn("Camera section crashed:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View className="w-72 h-72 rounded-full border-2 border-dashed border-rose-400 bg-rose-50 items-center justify-center p-4">
          <AlertTriangle size={26} color="#E4453C" />
          <Text className="text-xs font-black text-[#1F1B3D] mt-2 text-center">Camera failed to load</Text>
          <TouchableOpacity
            onPress={() => {
              this.setState({ hasError: false });
              this.props.onReset();
            }}
            className="bg-[#5B4FD1] px-4 py-2 rounded-full mt-2.5 active:opacity-90 shadow-xs"
          >
            <Text className="text-white text-[10px] font-black uppercase">Retry Camera</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function PunchClockScreen({ navigation }: PunchClockScreenProps) {
  const isFocused = useIsFocused();
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const EMP_ID = UserSession.empId || "EMP1042";
  const role = UserSession.role || "IN_OFFICE";
  const [workMode, setWorkMode] = useState<string>("IN_OFFICE"); // default_work_mode from the employee config

  // ----- camera lifecycle -----
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraKey, setCameraKey] = useState(0); // bump to force a full native remount
  const [appActive, setAppActive] = useState(AppState.currentState === "active");

  // ----- screen state -----
  const [stateStatus, setStateStatus] = useState<"loading" | "ready" | "error">("loading");
  const [currentDateIST, setCurrentDateIST] = useState("");
  const [userDistance, setUserDistance] = useState<number | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false); // true only while a user action (punch / break) runs
  const [hasInitialFix, setHasInitialFix] = useState(false);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [, setRestartTick] = useState(0);

  const [activeBranchName, setActiveBranchName] = useState<string>("Assigned Office");
  const [geofenceRules, setGeofenceRules] = useState<GeofenceConfig[]>([]);
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState<number>(200);
  const [isGeofenceExempt, setIsGeofenceExempt] = useState(false);

  const [activeMode, setActiveMode] = useState<AttendanceMode>("OFFICE");
  const [attendanceState, setAttendanceState] = useState<PunchState>("NOT_CHECKED_IN");
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null);
  const [lastCheckoutRaw, setLastCheckoutRaw] = useState<Date | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);

  // worked time = base (from server) + time since anchor while WORKING
  const [workedBase, setWorkedBase] = useState(0);
  const [workedAnchorMs, setWorkedAnchorMs] = useState(Date.now());
  const [usedBreakMinutes, setUsedBreakMinutes] = useState(0);
  const [activeBreakType, setActiveBreakType] = useState<string | null>(null);
  const [activeBreakStartTime, setActiveBreakStartTime] = useState<string | null>(null);
  const [breakAnchorMs, setBreakAnchorMs] = useState<number | null>(null);
  const [isBreakModalVisible, setIsBreakModalVisible] = useState(false);
  const [breakHistory, setBreakHistory] = useState<BreakSessionItem[]>([]);

  // ----- refs (always hold the latest value, safe to read inside async code) -----
  const serverOffsetMs = useRef(0);
  const activeModeRef = useRef<AttendanceMode>(activeMode);
  const exemptRef = useRef(isGeofenceExempt);
  const geofenceRulesRef = useRef<GeofenceConfig[]>([]);
  const attendanceStateRef = useRef<PunchState>(attendanceState);
  const prevStateRef = useRef<PunchState | null>(null);
  const workedBaseRef = useRef(0);
  const workedAnchorRef = useRef(Date.now());
  const breakAnchorRef = useRef<number | null>(null);
  const stateReq = useRef(0); // newest state request wins; bumped by local changes too
  const lastFetchAtRef = useRef(0);
  const busyRef = useRef(false);
  const lastFixRef = useRef<Fix | null>(null);
  const inFlightLocation = useRef<Promise<Fix | null> | null>(null);
  const trackingResumeTried = useRef(false);
  const hasMountedOnce = useRef(false);

  activeModeRef.current = activeMode;
  exemptRef.current = isGeofenceExempt;
  attendanceStateRef.current = attendanceState;

  const getSyncedNowMs = () => Date.now() + serverOffsetMs.current;

  const updateDateLabel = () => {
    setCurrentDateIST(
      new Date(getSyncedNowMs()).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    );
  };

  const resetCamera = () => {
    setCameraReady(false);
    setCameraError(null);
    setCameraKey((k) => k + 1);
  };

  const setWork = (base: number, anchor: number) => {
    workedBaseRef.current = base;
    workedAnchorRef.current = anchor;
    setWorkedBase(base);
    setWorkedAnchorMs(anchor);
  };

  const setBreakAnchor = (ms: number | null) => {
    breakAnchorRef.current = ms;
    setBreakAnchorMs(ms);
  };

  // Single lock for every user action: no overlapping punches / breaks, one spinner, no double taps
  const runExclusive = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsSyncing(true);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setIsSyncing(false);
    }
  };

  // ----------------------------- server time -----------------------------
  const syncServerTimeOffset = async () => {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/server-time`, {}, 6000);
      if (!response.ok) return;
      const data = await response.json();
      const serverTimestamp =
        typeof data.serverTime === "number" ? data.serverTime : new Date(data.serverTime).getTime();
      serverOffsetMs.current = serverTimestamp - Date.now();
      updateDateLabel();
    } catch (error) {
      console.warn("Could not sync server time offset; using local clock", error);
    }
  };

  // ----------------------------- location -----------------------------
  const applyGeofenceToScreen = (
    lat: number,
    lng: number,
    rules: GeofenceConfig[],
    mode: AttendanceMode,
    exempt: boolean
  ) => {
    const r = computeGeofence(lat, lng, rules, mode, exempt);
    setIsWithinGeofence(r.eligible);
    setUserDistance(r.distance);
    if (!(mode === "WFH" || exempt) && r.branch) {
      setActiveBranchName(r.branch.branch_name || "Office HQ");
      setAllowedRadiusMeters(r.branch.radius_meters || 200);
    }
  };

  // interactive=false never shows a dialog or alert (safe from background/focus triggers)
  const ensureLocationPermission = async (interactive: boolean): Promise<boolean> => {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.status === "granted") return true;
      if (!interactive) return false;
      const asked = await Location.requestForegroundPermissionsAsync();
      if (asked.status === "granted") return true;
      if (Platform.OS === "web") {
        window.alert("GPS Location access is mandatory to punch attendance.");
      } else {
        Alert.alert(
          "Location Permission Needed",
          "GPS location is required to punch attendance. Please allow location access for this app in Settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
      return false;
    } catch {
      return false;
    }
  };

  const refreshLocation = (
    opts: { interactive?: boolean; maxAgeMs?: number; rules?: GeofenceConfig[]; exempt?: boolean } = {}
  ): Promise<Fix | null> => {
    const { interactive = false, maxAgeMs = 0, rules, exempt } = opts;

    const cached = lastFixRef.current;
    if (maxAgeMs > 0 && cached && Date.now() - cached.ts <= maxAgeMs) return Promise.resolve(cached);
    // A request is already running: share it instead of failing the caller
    if (inFlightLocation.current) return inFlightLocation.current;

    const run = (async (): Promise<Fix | null> => {
      setIsVerifying(true);
      try {
        if (!(await ensureLocationPermission(interactive))) return null;

        const location = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          LOCATION_TIMEOUT_MS,
          "Location request"
        );
        if (!location?.coords) return null;

        const fix: Fix = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          isMock: Boolean(location.mocked),
          accuracy: location.coords.accuracy ?? null,
          ts: Date.now(),
        };
        lastFixRef.current = fix;
        applyGeofenceToScreen(
          fix.latitude,
          fix.longitude,
          rules ?? geofenceRulesRef.current,
          activeModeRef.current,
          exempt ?? exemptRef.current
        );
        setHasInitialFix(true);
        setUserAccuracy(fix.accuracy);
        return fix;
      } catch (error) {
        console.warn("GPS error:", error);
        if (interactive) {
          notify("GPS Error", "Could not get your location. Please check that location is turned on and try again.");
        }
        return null;
      } finally {
        setIsVerifying(false);
        inFlightLocation.current = null;
      }
    })();

    inFlightLocation.current = run;
    return run;
  };

  // ----------------------------- tracking (never affects a punch result) -----------------------------
  const startTrackingIfNeeded = async (requires?: boolean) => {
    const track = requires ?? (exemptRef.current || activeModeRef.current === "SALES");
    if (!track) return;
    try {
      const r = await startShiftTracking(EMP_ID, "SALES");
      if (r?.warning) notify("Location Tracking", r.warning);
    } catch (e) {
      console.warn("Could not start tracking:", e);
    }
  };

  // Resume after an app restart / stop after check-out. Tried once per screen mount so a denied
  // permission can never open a prompt or the settings page on every resume.
  const syncTracking = (state: PunchState, requires: boolean | undefined) => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;
    const track = requires ?? exemptRef.current;
    if (!track) return;

    if ((state === "WORKING" || state === "ON_BREAK") && !trackingResumeTried.current) {
      trackingResumeTried.current = true;
      startShiftTracking(EMP_ID, "SALES").catch((e) => console.warn("Resume tracking failed:", e));
    } else if (state === "CHECKED_OUT" && prev !== "CHECKED_OUT") {
      stopShiftTracking().catch(() => {});
    }
  };

  // ----------------------------- attendance state -----------------------------
  // Applies the server state FIRST and starts GPS afterwards without waiting for it,
  // so the page never sits in "loading" because of a slow GPS fix.
  const fetchTodayAttendanceState = async (): Promise<FetchResult | null> => {
    lastFetchAtRef.current = Date.now();
    const my = ++stateReq.current;
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/today?empId=${EMP_ID}`, {}, NETWORK_TIMEOUT_MS);
      if (!response.ok) throw new Error(`Attendance fetch returned ${response.status}`);
      const data = await response.json();

      // ---- parse everything first ----
      let parsedBranches: GeofenceConfig[] = geofenceRulesRef.current;
      if (data.config?.geofence_config_json) {
        try {
          const raw =
            typeof data.config.geofence_config_json === "string"
              ? JSON.parse(data.config.geofence_config_json)
              : data.config.geofence_config_json;
          parsedBranches = Array.isArray(raw) ? raw : [raw];
        } catch (parseErr) {
          console.warn("Failed to parse geofence_config_json:", parseErr);
        }
      }
      const exemptFlag = Boolean(data.config?.is_geofence_exempt);

      let history: BreakSessionItem[] | null = null;
      if (data.break_history_json) {
        try {
          const parsed =
            typeof data.break_history_json === "string" ? JSON.parse(data.break_history_json) : data.break_history_json;
          if (Array.isArray(parsed)) history = parsed;
        } catch (parseErr) {
          console.warn("Failed to parse break_history_json:", parseErr);
        }
      }

      const onBreak = Boolean(data.first_punch_in) && !data.last_punch_out && Boolean(data.is_on_break);
      let breakAnchor: number | null = null;
      if (onBreak) {
        breakAnchor = breakAnchorRef.current;
        if (!breakAnchor) {
          try {
            const saved = await AsyncStorage.getItem("active_break_timestamp");
            breakAnchor = saved ? parseInt(saved, 10) : getSyncedNowMs();
          } catch {
            breakAnchor = getSyncedNowMs();
          }
        }
      }

      // A newer request, or a local change (punch / break), already won: drop this stale answer
      if (my !== stateReq.current) return null;

      // ---- apply in one go ----
      geofenceRulesRef.current = parsedBranches;
      exemptRef.current = exemptFlag;
      setGeofenceRules(parsedBranches);
      setIsGeofenceExempt(exemptFlag);
      setWorkMode(String(data.config?.default_work_mode || "IN_OFFICE").toUpperCase());
      if (parsedBranches.length > 0) {
        setActiveBranchName(parsedBranches[0].branch_name || "Office HQ");
        setAllowedRadiusMeters(parsedBranches[0].radius_meters || 200);
      }

      if (data.work_mode) {
        const mode: AttendanceMode =
          data.work_mode === "SALES" ? "SALES" : data.work_mode === "WFH" ? "WFH" : "OFFICE";
        activeModeRef.current = mode;
        setActiveMode(mode);
      }

      setUsedBreakMinutes(data.break_minutes || 0);
      if (history) setBreakHistory(history);

      let nextState: PunchState = "NOT_CHECKED_IN";
      if (data.first_punch_in) {
        setCheckInTime(formatToIST(data.first_punch_in));
        if (data.last_punch_out) {
          nextState = "CHECKED_OUT";
          setCheckOutTime(formatToIST(data.last_punch_out));
          setLastCheckoutRaw(parseRawTimestamp(data.last_punch_out));
          setBreakAnchor(null);
        } else if (onBreak) {
          nextState = "ON_BREAK";
          const startVal = data.active_break_start_time || data.current_break?.startTime;
          if (startVal) setActiveBreakStartTime(formatToIST(startVal));
          if (data.active_break_title || data.current_break?.title) {
            setActiveBreakType(data.active_break_title || data.current_break.title);
          }
          setBreakAnchor(breakAnchor);
        } else {
          nextState = "WORKING";
          setBreakAnchor(null);
          // the server says "not on break": drop any stale local break cache
          AsyncStorage.multiRemove(["active_break_timestamp", "active_break_type"]).catch(() => {});
        }
        setWork(data.worked_seconds || 0, getSyncedNowMs());
      } else {
        setCheckInTime(null);
        setLastCheckoutRaw(null);
        setWork(0, getSyncedNowMs());
      }

      attendanceStateRef.current = nextState;
      setAttendanceState(nextState);
      setStateStatus("ready");

      const requiresTracking: boolean | undefined =
        typeof data.requires_live_tracking === "boolean" ? data.requires_live_tracking : undefined;
      syncTracking(nextState, requiresTracking);

      // GPS runs in the background of the screen: never awaited here
      refreshLocation({ interactive: false, rules: parsedBranches, exempt: exemptFlag }).catch(() => {});

      return { state: nextState, requiresTracking };
    } catch (error: any) {
      console.warn(error?.name === "AbortError" ? "Attendance fetch timed out." : "Attendance fetch failed:", error);
      setStateStatus((s) => (s === "ready" ? "ready" : "error")); // keep showing known state on a refresh failure
      return null;
    }
  };

  // ----------------------------- lifecycle -----------------------------
  useEffect(() => {
    syncServerTimeOffset();
    fetchTodayAttendanceState();
    updateDateLabel();

    let backgroundedAt: number | null = null;

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      // "inactive" (iOS app switcher, system dialogs) is ignored on purpose
      if (next === "background") {
        backgroundedAt = Date.now();
        setAppActive(false);
        return;
      }
      if (next === "active") {
        setAppActive(true);
        const away = backgroundedAt ? Date.now() - backgroundedAt : 0;
        backgroundedAt = null;

        if (away > RESUME_REFRESH_MIN_AWAY_MS) {
          syncServerTimeOffset();
          fetchTodayAttendanceState(); // also reconciles a punch whose answer was lost while minimised
          if (away > CAMERA_REMOUNT_AFTER_BG_MS) resetCamera();
        }
      }
    });

    const dateTimer = setInterval(updateDateLabel, 60000);

    return () => {
      sub.remove();
      clearInterval(dateTimer);
    };
  }, []);

  // Back on this tab: refresh once (state + silent GPS), at most every 3 seconds
  useEffect(() => {
    if (isFocused && hasMountedOnce.current && Date.now() - lastFetchAtRef.current > 3000) {
      fetchTodayAttendanceState();
    }
    hasMountedOnce.current = true;
  }, [isFocused]);

  // Mode / exemption changed: re-judge the last fix (no new GPS request)
  useEffect(() => {
    const f = lastFixRef.current;
    if (f) applyGeofenceToScreen(f.latitude, f.longitude, geofenceRulesRef.current, activeMode, isGeofenceExempt);
  }, [activeMode, isGeofenceExempt]);

  // Keeps the "restart shift" countdown fresh after check-out (the only thing that needs a ticker there)
  useEffect(() => {
    if (attendanceState !== "CHECKED_OUT") return;
    const id = setInterval(() => setRestartTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, [attendanceState]);

  // Camera that never reports ready: offer a retry instead of an endless spinner
  useEffect(() => {
    if (
      !cameraReady &&
      !cameraError &&
      isFocused &&
      appActive &&
      permission?.granted &&
      !capturedPhotoUri &&
      attendanceState !== "CHECKED_OUT"
    ) {
      const timeout = setTimeout(() => {
        setCameraReady((ready) => {
          if (!ready) setCameraError("Camera is taking too long to start. Please retry.");
          return ready;
        });
      }, CAMERA_READY_TIMEOUT_MS);
      return () => clearTimeout(timeout);
    }
  }, [cameraKey, isFocused, appActive, cameraReady, cameraError, capturedPhotoUri, permission?.granted, attendanceState]);

  const handleManualRefresh = async () => {
    if (isPullRefreshing) return;
    setIsPullRefreshing(true);
    try {
      await Promise.all([syncServerTimeOffset(), fetchTodayAttendanceState()]);
      await refreshLocation({ interactive: true });
    } catch (error) {
      console.warn("Pull-to-refresh failed:", error);
    } finally {
      setIsPullRefreshing(false);
    }
  };

  // ----------------------------- punch -----------------------------
  // The selfie photo is not uploaded or stored. Only a placeholder key is sent with the punch.
  const executePunch = async (
    type: "CHECK_IN" | "CHECK_OUT",
    fix: Fix | null
  ): Promise<PunchResponsePayload | null> => {
    try {
      const lat = fix?.latitude ?? lastFixRef.current?.latitude ?? 0;
      const lng = fix?.longitude ?? lastFixRef.current?.longitude ?? 0;

      let cloudKey = SELFIE_NOT_STORED;
      if (USE_UPLOAD_TICKET) {
        const ticketRes = await fetchWithTimeout(
          `${API_BASE_URL}/upload-ticket?empId=${EMP_ID}&punchType=${type}`,
          {},
          NETWORK_TIMEOUT_MS
        );
        if (!ticketRes.ok) throw new Error("Could not prepare the selfie upload. Please try again.");
        const ticketData = await ticketRes.json();
        cloudKey = ticketData.cloudKey || `selfies/${Date.now()}-${type}.jpg`;
      }

      const effectiveMode =
        activeModeRef.current === "SALES" ? "SALES" : activeModeRef.current === "WFH" ? "WFH" : "IN_OFFICE";

      const { res: punchRes, body: result } = await postPunch({
        empId: EMP_ID,
        punchType: type,
        selectedMode: effectiveMode,
        latitude: lat,
        longitude: lng,
        selfieCloudKey: cloudKey,
        deviceId: `${Platform.OS}-${Platform.Version}`,
        mockLocation: fix?.isMock ?? false,
      });
      // the backend can answer HTTP 200 with status FAILED (e.g. a check-in rejected by the geofence)
      if (!punchRes.ok || result.status === "FAILED") {
        throw new Error(result.message || "Failed to record attendance punch.");
      }

      stateReq.current++; // any older in-flight state request is now out of date
      const modeTitle =
        effectiveMode === "WFH" ? "Work-From-Home" : effectiveMode === "SALES" ? "Sales Visit" : `${activeBranchName} Office`;
      notify(
        "Punch Recorded",
        `Successfully ${type === "CHECK_IN" ? "Checked In" : "Checked Out"} at ${formatToIST(getSyncedNowMs())} via ${modeTitle}.`
      );
      setCapturedPhotoUri(null);
      await fetchTodayAttendanceState();
      return result;
    } catch (error: any) {
      // The request may have reached the server even though the answer was lost
      // (app minimised, weak network, timeout). Let the server decide what really happened.
      const fetched = await fetchTodayAttendanceState();
      const recorded =
        !!fetched &&
        ((type === "CHECK_IN" && fetched.state !== "NOT_CHECKED_IN") ||
          (type === "CHECK_OUT" && fetched.state === "CHECKED_OUT"));

      if (recorded) {
        setCapturedPhotoUri(null);
        notify("Punch Recorded", `Your ${type === "CHECK_IN" ? "check-in" : "check-out"} was saved.`);
        return { status: "SUCCESS", recovered: true, requiresLiveTracking: fetched?.requiresTracking };
      }

      notify(
        "Attendance Error",
        error?.name === "AbortError"
          ? "The request took too long. Please check your connection and try again."
          : error?.message || "Attendance request failed. Verify connection."
      );
      return null;
    }
  };

  const handleTakeSelfie = () =>
    runExclusive(async () => {
      if (!cameraRef.current || !cameraReady) {
        notify("Camera Not Ready", "Please wait a moment and try again.");
        return;
      }

      const needsGps = !(activeModeRef.current === "WFH" || exemptRef.current);

      // 1. Ask for location permission BEFORE the shutter: a system dialog during capture kills the camera session
      if (!(await ensureLocationPermission(needsGps)) && needsGps) return;

      // 2. Take the photo first (fast), so the shutter never waits for GPS
      let photoUri: string;
      try {
        const photo = await withTimeout<{ uri: string } | undefined>(
          cameraRef.current.takePictureAsync({ quality: 0.6, skipProcessing: true }),
          CAMERA_CAPTURE_TIMEOUT_MS,
          "Camera capture"
        );
        if (!photo?.uri) throw new Error("The camera returned no photo");
        photoUri = await shrinkPhoto(photo.uri);
      } catch (err) {
        console.warn("Capture failed:", err);
        notify("Camera Error", "Could not capture the photo. Please try again.");
        resetCamera();
        return;
      }
      setCapturedPhotoUri(photoUri);

      // 3. Position: reuse a fix that is at most 20 s old, otherwise ask once
      const fix = await refreshLocation({ interactive: false, maxAgeMs: LOCATION_MAX_AGE_MS });

      if (fix?.isMock) {
        notify("Security Alert", "Mock GPS spoofing detected. Disable mock locations in settings.");
        setCapturedPhotoUri(null);
        return;
      }
      if (needsGps) {
        if (!fix) {
          notify("Location Error", "Could not get current GPS coordinates. Please retry.");
          setCapturedPhotoUri(null);
          return;
        }
        // A 2 km-off 'approximate' position would make the geofence result random: ask for a better one
        if (fix.accuracy != null && fix.accuracy > MAX_PUNCH_ACCURACY_M) {
          lastFixRef.current = null; // do not reuse this weak fix
          notify(
            "Weak GPS Signal",
            `Your location is only accurate to about ${Math.round(fix.accuracy)} m, too weak to verify the office perimeter. ` +
              `${PRECISE_LOCATION_HINT} Then move near a window or outdoors and try again.`
          );
          setCapturedPhotoUri(null);
          return;
        }
        // judged on THIS fix, not on an older state value
        const geo = computeGeofence(
          fix.latitude,
          fix.longitude,
          geofenceRulesRef.current,
          activeModeRef.current,
          exemptRef.current
        );
        if (!geo.eligible) {
          notify(
            "Location Error",
            `Geofence violation: You are ${geo.distance ?? "--"}m away from ${
              geo.branch?.branch_name || activeBranchName
            }. Must be within ${geo.branch?.radius_meters || allowedRadiusMeters}m to clock in.`
          );
          setCapturedPhotoUri(null);
          return;
        }
      }

      // 4. Check-in (a selfie taken while WORKING is only the check-out photo, kept for the checkout button)
      if (attendanceStateRef.current === "NOT_CHECKED_IN") {
        const result = await executePunch("CHECK_IN", fix);
        if (result?.status === "SUCCESS") {
          trackingResumeTried.current = true;
          await startTrackingIfNeeded(result.requiresLiveTracking);
        }
      }
    });

  const handleCheckOut = () =>
    runExclusive(async () => {
      if (!capturedPhotoUri) {
        notify("Selfie Required", "Please take a verification selfie before checking out.");
        return;
      }

      const needsGps = !(activeModeRef.current === "WFH" || exemptRef.current);
      const fix = await refreshLocation({ interactive: needsGps, maxAgeMs: LOCATION_MAX_AGE_MS });

      if (fix?.isMock) {
        notify("Security Alert", "Mock GPS detected. Check-out rejected.");
        return;
      }
      if (needsGps) {
        if (!fix) {
          notify("Location Error", "Could not verify your GPS location for checkout. Try again.");
          return;
        }
        if (fix.accuracy != null && fix.accuracy > MAX_PUNCH_ACCURACY_M) {
          lastFixRef.current = null;
          notify(
            "Weak GPS Signal",
            `Your location is only accurate to about ${Math.round(fix.accuracy)} m, too weak to verify the office perimeter. ` +
              `${PRECISE_LOCATION_HINT} Then move near a window or outdoors and try again.`
          );
          return;
        }
        const geo = computeGeofence(
          fix.latitude,
          fix.longitude,
          geofenceRulesRef.current,
          activeModeRef.current,
          exemptRef.current
        );
        if (!geo.eligible) {
          notify(
            "Location Error",
            `Geofence violation: You are ${geo.distance ?? "--"}m away from ${
              geo.branch?.branch_name || activeBranchName
            }. Must be within ${geo.branch?.radius_meters || allowedRadiusMeters}m.`
          );
          return;
        }
      }

      if (attendanceStateRef.current !== "WORKING") return;
      const result = await executePunch("CHECK_OUT", fix);
      if (result?.status === "SUCCESS") {
        try {
          await stopShiftTracking();
        } catch (e) {
          console.warn("Could not stop tracking:", e);
        }
      }
    });

  // Undo an accidental checkout (also enforced server-side)
  const handleRestartShift = () => {
    confirmAction(
      "Restart Shift?",
      "This will undo your check-out and resume your working hours. Use this only if you checked out by mistake.",
      "Restart Shift",
      () =>
            runExclusive(async () => {
              setIsRestarting(true);
              try {
                const res = await fetchWithTimeout(
                  `${API_BASE_URL}/restart-shift`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ empId: EMP_ID }),
                  },
                  NETWORK_TIMEOUT_MS
                );
                const data = await res.json();
                if (!res.ok || data.status !== "SUCCESS") throw new Error(data.message || "Could not restart your shift.");

                stateReq.current++;
                setCheckOutTime(null);
                setLastCheckoutRaw(null);
                setCapturedPhotoUri(null);
                const fetched = await fetchTodayAttendanceState();
                trackingResumeTried.current = true;
                await startTrackingIfNeeded(fetched?.requiresTracking);
                notify("Shift Restarted", "Your shift has been restarted. Working hours have resumed.");
              } catch (error: any) {
                const fetched = await fetchTodayAttendanceState();
                if (fetched && fetched.state !== "CHECKED_OUT") {
                  notify("Shift Restarted", "Your shift is running again.");
                } else {
                  notify(
                    "Restart Failed",
                    error?.name === "AbortError"
                      ? "The request took too long. Please check your connection and try again."
                      : error?.message || "Could not restart your shift. Please contact admin."
                  );
                }
              } finally {
                setIsRestarting(false);
              }
            })
    );
  };

  // ----------------------------- breaks -----------------------------
  const handleStartBreak = (breakName: string) => {
    setIsBreakModalVisible(false);
    return runExclusive(async () => {
      if (attendanceStateRef.current !== "WORKING") return;
      const startMs = getSyncedNowMs();
      const bType = breakName.toLowerCase().includes("lunch") ? "LUNCH" : "TEA";

      try {
        const res = await fetchWithTimeout(
          `${API_BASE_URL}/break/start`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ empId: EMP_ID, breakType: bType, breakTitle: breakName }),
          },
          NETWORK_TIMEOUT_MS
        );
        if (!res.ok) {
          let msg = "Could not start the break.";
          try {
            msg = (await res.json())?.message || msg;
          } catch {
            /* not JSON */
          }
          throw new Error(msg);
        }

        // The server confirmed: now (and only now) switch the screen
        stateReq.current++;
        // freeze worked time at this moment
        const frozen = workedBaseRef.current + Math.max(0, Math.floor((startMs - workedAnchorRef.current) / 1000));
        setWork(frozen, startMs);
        setActiveBreakType(breakName);
        setActiveBreakStartTime(formatToIST(startMs));
        setBreakAnchor(startMs);
        attendanceStateRef.current = "ON_BREAK";
        setAttendanceState("ON_BREAK");
        AsyncStorage.multiSet([
          ["active_break_timestamp", String(startMs)],
          ["active_break_type", breakName],
        ]).catch(() => {});
      } catch (error: any) {
        // the answer may have been lost although the server saved the break: ask the server
        const fetched = await fetchTodayAttendanceState();
        if (!fetched || fetched.state !== "ON_BREAK") {
          notify(
            "Break Not Started",
            error?.name === "AbortError"
              ? "The request took too long. Please check your connection and try again."
              : error?.message || "Could not start the break."
          );
        }
      }
    });
  };

  const handleEndBreak = () =>
    runExclusive(async () => {
      if (attendanceStateRef.current !== "ON_BREAK") return;

      try {
        const res = await fetchWithTimeout(
          `${API_BASE_URL}/break/end`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              empId: EMP_ID,
              breakType: activeBreakType?.toLowerCase().includes("lunch") ? "LUNCH" : "TEA",
              breakTitle: activeBreakType || "Personal Break",
            }),
          },
          NETWORK_TIMEOUT_MS
        );
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.message || "Could not sync the break session with the server.");

        // Server confirmed: switch immediately, no loading flash
        stateReq.current++;
        const endedTitle = activeBreakType || "Break";
        const endedStart = activeBreakStartTime;
        setWork(workedBaseRef.current, getSyncedNowMs()); // worked time resumes from here
        attendanceStateRef.current = "WORKING";
        setAttendanceState("WORKING");
        setActiveBreakType(null);
        setActiveBreakStartTime(null);
        setBreakAnchor(null);
        AsyncStorage.multiRemove(["active_break_timestamp", "active_break_type"]).catch(() => {});

        const durSec = resData.durationSeconds ?? (resData.durationMinutes ? resData.durationMinutes * 60 : 0);
        const durMin = resData.durationMinutes ?? Math.floor(durSec / 60);
        if (resData.totalBreakMinutes !== undefined) setUsedBreakMinutes(resData.totalBreakMinutes);
        setBreakHistory((prev) => [
          ...prev,
          {
            id: resData.breakId || Date.now().toString(),
            title: endedTitle,
            startTime: endedStart || formatToIST(resData.startTime),
            endTime: formatToIST(resData.endTime || getSyncedNowMs()),
            durationMinutes: durMin,
            durationSeconds: durSec,
            type: (endedTitle.toLowerCase().includes("lunch") ? "LUNCH" : "TEA") as "LUNCH" | "TEA",
          },
        ]);

        fetchTodayAttendanceState(); // refresh totals in the background (not awaited: no page reload)
      } catch (error: any) {
        // "already ended", a lost answer, a timeout: the server is the source of truth
        const fetched = await fetchTodayAttendanceState();
        if (fetched?.state === "ON_BREAK") {
          notify(
            "Break Sync Failed",
            error?.name === "AbortError"
              ? "The request took too long. Please check your connection and try again."
              : error?.message || "Network issue."
          );
        }
        // if the server says the break already ended, the screen simply follows it
      }
    });

  // ----------------------------- derived values -----------------------------
  const remainingBreakMinutes = Math.max(0, TOTAL_BREAK_LIMIT_MINS - usedBreakMinutes);
  // Field roles (sales / dispatch) see a fixed mode badge instead of the Office / WFH switch
  const isFieldRole = isGeofenceExempt && (role === "SALES" || workMode === "SALES" || workMode === "DISPATCH");

  const minutesSinceCheckout = lastCheckoutRaw ? (getSyncedNowMs() - lastCheckoutRaw.getTime()) / 60000 : null;
  const canRestartShift =
    attendanceState === "CHECKED_OUT" &&
    minutesSinceCheckout !== null &&
    minutesSinceCheckout >= 0 &&
    minutesSinceCheckout <= RESTART_WINDOW_MINUTES;
  const restartMinutesLeft = canRestartShift
    ? Math.max(0, Math.ceil(RESTART_WINDOW_MINUTES - (minutesSinceCheckout as number)))
    : 0;

  return (
    <ScreenContainer scrollable={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        overScrollMode="always"
        alwaysBounceVertical
        contentContainerStyle={{ paddingBottom: 24 }} // the container already keeps 100 free at the bottom for the tab bar
        refreshControl={
          <RefreshControl refreshing={isPullRefreshing} onRefresh={handleManualRefresh} colors={["#059669"]} tintColor="#059669" />
        }
      >
        {/* TOP PURPLE BANNER */}
        <View className="bg-[#5B4FD1] rounded-3xl pt-3 pb-4 px-4 mb-4 shadow-xs relative overflow-hidden">
          <View className="flex-row items-center justify-between mb-3">
            <TouchableOpacity
              onPress={() => (navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate("Home"))}
              className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center active:opacity-80"
            >
              <ChevronLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={handleManualRefresh}
                disabled={isPullRefreshing}
                className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center active:opacity-80"
              >
                {isPullRefreshing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <RefreshCw size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>

              <View className="bg-white/20 px-3 py-1 rounded-full border border-white/25 flex-row items-center">
                <ShieldCheck size={12} color="#FFFFFF" />
                <Text className="text-[10px] font-black text-white ml-1 uppercase tracking-wider">NTP Live Synced</Text>
              </View>
            </View>
          </View>

          <View className="items-center">
            <Text className="text-xl md:text-2xl font-black text-white tracking-tight">Biometric Punch Clock</Text>
            <Text className="text-xs font-semibold text-white/80 mt-0.5 text-center">
              {isGeofenceExempt
                ? `Field ${workMode} • GPS & Selfie Verification (Location Unrestricted)`
                : activeMode === "WFH"
                ? "Remote Presence • GPS & Selfie Verification"
                : "Geofenced GPS & Live Camera Attendance"}
            </Text>
          </View>
        </View>

        {/* WORK MODE SWITCH — fixed by admin config for geofence-exempt roles */}
        <View className="bg-white border border-[#E7E4F5] rounded-3xl p-2 mb-4 shadow-xs">
          {isFieldRole ? (
            <View className="flex-row items-center justify-center py-2.5 px-3 bg-[#F6F5FC] rounded-2xl border border-[#E7E4F5]">
              <Briefcase size={14} color="#5B4FD1" />
              <Text className="text-xs font-black text-[#5B4FD1] ml-2">Field / {workMode} Mode — Location Not Restricted</Text>
            </View>
          ) : (
            <View className="flex-row bg-[#F6F5FC] p-1 rounded-2xl border border-[#E7E4F5]">
              <TouchableOpacity
                onPress={() => setActiveMode("OFFICE")}
                disabled={attendanceState !== "NOT_CHECKED_IN"}
                className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center ${
                  activeMode === "OFFICE" ? "bg-white shadow-sm" : ""
                } ${attendanceState !== "NOT_CHECKED_IN" ? "opacity-75" : ""}`}
              >
                <Building2 size={14} color={activeMode === "OFFICE" ? "#5B4FD1" : "#7A76A6"} />
                <Text className={`text-xs font-black ml-1.5 ${activeMode === "OFFICE" ? "text-[#5B4FD1]" : "text-[#7A76A6]"}`}>
                  Office Check-In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveMode("WFH")}
                disabled={attendanceState !== "NOT_CHECKED_IN"}
                className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center ${
                  activeMode === "WFH" ? "bg-[#5B4FD1] shadow-sm" : ""
                } ${attendanceState !== "NOT_CHECKED_IN" ? "opacity-75" : ""}`}
              >
                <Home size={14} color={activeMode === "WFH" ? "#FFFFFF" : "#7A76A6"} />
                <Text className={`text-xs font-black ml-1.5 ${activeMode === "WFH" ? "text-white" : "text-[#7A76A6]"}`}>
                  Work From Home
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* GEOFENCE STATUS */}
        <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 mb-4 shadow-xs">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View
                className={`w-9 h-9 rounded-xl items-center justify-center mr-2.5 ${
                  activeMode === "WFH" || isGeofenceExempt
                    ? "bg-indigo-50 border border-indigo-200"
                    : isWithinGeofence
                    ? "bg-[#E7FAEE] border border-[#1FAE5C]/20"
                    : "bg-[#FDE9E8] border border-[#E4453C]/20"
                }`}
              >
                {activeMode === "WFH" ? (
                  <Home size={18} color="#5B4FD1" />
                ) : isGeofenceExempt ? (
                  <Briefcase size={18} color="#5B4FD1" />
                ) : (
                  <MapPin size={18} color={isWithinGeofence ? "#1FAE5C" : "#E4453C"} />
                )}
              </View>
              <View>
                <Text className="text-xs font-black text-[#1F1B3D]">
                  {activeMode === "WFH"
                    ? "Work-From-Home Status"
                    : isGeofenceExempt
                    ? `Field / ${workMode} Status`
                    : `${activeBranchName} (${allowedRadiusMeters}m)`}
                </Text>
                <Text className="text-[10px] font-semibold text-[#7A76A6]">
                  {activeMode === "WFH"
                    ? "Geofence Exempt • Remote GPS breadcrumb logged"
                    : isGeofenceExempt
                    ? `Geofence Exempt • Location logged for record${
                        userDistance !== null ? ` (${userDistance}m from nearest branch)` : ""
                      }`
                    : isVerifying && !hasInitialFix
                    ? "Verifying GPS fix..."
                    : `Current distance: ${userDistance !== null ? userDistance : "--"}m${
                        userAccuracy != null ? ` (GPS ±${Math.round(userAccuracy)}m)` : ""
                      }`}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => refreshLocation({ interactive: true })}
              className="w-8 h-8 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5] items-center justify-center active:bg-[#EEECFA]"
            >
              {isVerifying ? <ActivityIndicator size="small" color="#5B4FD1" /> : <RefreshCw size={14} color="#5B4FD1" />}
            </TouchableOpacity>
          </View>

          <View
            className={`p-2.5 rounded-2xl flex-row items-center ${
              activeMode === "WFH" || isGeofenceExempt
                ? "bg-indigo-50 border border-indigo-200/60"
                : isWithinGeofence
                ? "bg-[#E7FAEE] border border-[#1FAE5C]/30"
                : "bg-[#FDE9E8] border border-[#E4453C]/30"
            }`}
          >
            {activeMode === "WFH" ? (
              <>
                <CheckCircle2 size={15} color="#5B4FD1" />
                <Text className="text-xs font-bold text-[#5B4FD1] ml-2">WFH Active: Remote selfie will register presence.</Text>
              </>
            ) : isGeofenceExempt ? (
              <>
                <CheckCircle2 size={15} color="#5B4FD1" />
                <Text className="text-xs font-bold text-[#5B4FD1] ml-2">Field Role: Punch allowed from any location.</Text>
              </>
            ) : isWithinGeofence ? (
              <>
                <CheckCircle2 size={15} color="#1FAE5C" />
                <Text className="text-xs font-bold text-[#1FAE5C] ml-2">
                  Inside {activeBranchName} ({userDistance}m away)
                </Text>
              </>
            ) : (
              <>
                <AlertTriangle size={15} color="#E4453C" />
                <Text className="text-xs font-bold text-[#E4453C] ml-2">
                  Outside Perimeter. Please enter {allowedRadiusMeters}m zone to punch.
                </Text>
              </>
            )}
          </View>
        </View>

        {/* CAMERA PREVIEW */}
        <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 mb-4 shadow-xs items-center">
          <View className="w-full flex-row items-center justify-between mb-4">
            <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
              {attendanceState === "NOT_CHECKED_IN"
                ? "Capture Photo to Check-In"
                : attendanceState === "WORKING"
                ? "Capture Selfie for Check-Out"
                : "Biometric Verification"}
            </Text>
            <Text className="text-[10px] font-semibold uppercase text-[#5B4FD1]">Front Biometric Lens</Text>
          </View>

          {stateStatus === "loading" ? (
            <View className="w-64 h-64 rounded-full border-2 border-dashed border-[#E7E4F5] bg-[#F6F5FC] items-center justify-center p-4">
              <ActivityIndicator color="#5B4FD1" />
              <Text className="text-xs font-bold text-[#7A76A6] mt-3 text-center">Loading today's attendance...</Text>
            </View>
          ) : stateStatus === "error" ? (
            <View className="w-64 h-64 rounded-full border-2 border-dashed border-rose-300 bg-rose-50 items-center justify-center p-4">
              <AlertTriangle size={26} color="#E4453C" />
              <Text className="text-xs font-black text-[#1F1B3D] mt-2 text-center">Could not load attendance</Text>
              <TouchableOpacity
                onPress={() => {
                  setStateStatus("loading");
                  fetchTodayAttendanceState();
                }}
                className="bg-[#5B4FD1] px-4 py-2 rounded-full mt-2.5 active:opacity-90"
              >
                <Text className="text-white text-[10px] font-black uppercase">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : permission == null ? (
            <View className="w-64 h-64 items-center justify-center">
              <ActivityIndicator color="#5B4FD1" />
            </View>
          ) : !permission.granted ? (
            <View className="w-64 h-64 rounded-full border-2 border-dashed border-[#5B4FD1] bg-[#F6F5FC] items-center justify-center p-4">
              <CameraIcon size={26} color="#5B4FD1" />
              <Text className="text-xs font-black text-[#1F1B3D] mt-2 text-center">Camera Access Required</Text>
              <TouchableOpacity
                onPress={() =>
                  permission.canAskAgain === false
                    ? Platform.OS === "web"
                      ? notify("Camera Blocked", "Allow the camera for this site: tap the AA icon in Safari's address bar, then Website Settings, then Camera: Allow.")
                      : Linking.openSettings()
                    : requestPermission()
                }
                className="bg-[#5B4FD1] px-3 py-1.5 rounded-full mt-2.5 active:opacity-90 shadow-xs"
              >
                <Text className="text-white text-[10px] font-black uppercase">
                  {permission.canAskAgain === false ? "Open Settings" : "Grant Access"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : attendanceState === "CHECKED_OUT" ? (
            <View className="items-center">
              <View className="w-64 h-64 rounded-full bg-[#E7FAEE] border-4 border-[#1FAE5C] items-center justify-center p-4">
                <CheckCircle2 size={48} color="#1FAE5C" />
                <Text className="text-base font-black text-[#1F1B3D] mt-2">Shift Completed</Text>
                <Text className="text-xs text-[#7A76A6] font-semibold">See you tomorrow!</Text>
              </View>

              {canRestartShift && (
                <View className="items-center mt-4 px-2">
                  <TouchableOpacity
                    onPress={handleRestartShift}
                    disabled={isSyncing}
                    style={{ opacity: isSyncing ? 0.6 : 1 }}
                    className="bg-amber-500 px-4 py-2.5 rounded-2xl flex-row items-center active:opacity-90 shadow-xs"
                  >
                    {isRestarting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Undo2 size={14} color="#FFFFFF" />}
                    <Text className="text-white text-xs font-black ml-2 uppercase tracking-wider">
                      Checked Out By Mistake? Restart Shift
                    </Text>
                  </TouchableOpacity>
                  <Text className="text-[10px] text-slate-400 font-semibold mt-1.5">
                    Available for {restartMinutesLeft} more min{restartMinutesLeft === 1 ? "" : "s"}
                  </Text>
                </View>
              )}
            </View>
          ) : !capturedPhotoUri ? (
            <View className="relative items-center justify-center my-2">
              <View className="w-72 h-72 rounded-full border-4 border-[#1FAE5C] bg-black overflow-hidden relative items-center justify-center shadow-md">
                <CameraErrorBoundary onReset={resetCamera}>
                  {isFocused && appActive && !cameraError && (
                    <CameraView
                      key={cameraKey}
                      ref={cameraRef}
                      facing="front"
                      style={StyleSheet.absoluteFill}
                      enableTorch={false}
                      animateShutter={false}
                      onCameraReady={() => setCameraReady(true)}
                      onMountError={(error: any) => {
                        console.warn("Camera mount error:", error);
                        setCameraError("Camera failed to start. Please retry.");
                      }}
                    />
                  )}

                  {cameraError && (
                    <View className="absolute inset-0 items-center justify-center bg-black/80 px-6">
                      <AlertTriangle size={26} color="#FFFFFF" />
                      <Text className="text-white text-xs font-bold mt-2 text-center">{cameraError}</Text>
                      <TouchableOpacity onPress={resetCamera} className="mt-3 bg-white/20 px-4 py-2 rounded-full">
                        <Text className="text-white text-xs font-black">Retry Camera</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {!cameraReady && !cameraError && (
                    <View className="absolute inset-0 items-center justify-center bg-black/40">
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    </View>
                  )}
                </CameraErrorBoundary>

                <TouchableOpacity
                  onPress={handleTakeSelfie}
                  disabled={isSyncing || !cameraReady}
                  className="absolute bottom-4 w-12 h-12 rounded-full bg-white/90 border-2 border-[#1FAE5C] items-center justify-center active:scale-95 shadow-md z-10"
                  style={{ opacity: cameraReady ? 1 : 0.5 }}
                >
                  {isSyncing ? <ActivityIndicator color="#1FAE5C" size="small" /> : <CameraIcon size={18} color="#1FAE5C" />}
                </TouchableOpacity>
              </View>

              <View className="absolute bottom-2 right-3 w-9 h-9 rounded-full bg-[#1FAE5C] border-2 border-white items-center justify-center shadow-sm">
                <Sparkles size={14} color="#FFFFFF" />
              </View>
            </View>
          ) : (
            <View className="items-center justify-center my-2">
              <View className="relative">
                <View className="w-72 h-72 rounded-full border-4 border-[#1FAE5C] overflow-hidden shadow-md">
                  <Image source={{ uri: capturedPhotoUri }} className="w-full h-full" resizeMode="cover" />
                </View>
                <View className="absolute bottom-2 right-3 w-10 h-10 rounded-full bg-[#1FAE5C] border-4 border-white items-center justify-center shadow-md">
                  <Check size={18} color="#FFFFFF" strokeWidth={3.5} />
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setCapturedPhotoUri(null)}
                disabled={isSyncing}
                className="mt-4 px-4 py-1.5 bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl flex-row items-center active:bg-[#EEECFA]"
              >
                <RefreshCw size={12} color="#5B4FD1" />
                <Text className="text-[11px] font-bold text-[#5B4FD1] ml-1.5">Retake Photo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* BREAK CONTROLS */}
        {attendanceState !== "NOT_CHECKED_IN" && attendanceState !== "CHECKED_OUT" && (
          <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 mb-4 shadow-xs">
            <View className="flex-row items-center justify-between pb-2 mb-3 border-b border-[#E7E4F5]">
              <View className="flex-row items-center gap-1.5">
                <Coffee size={15} color="#5B4FD1" />
                <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">80-Min Break Allowance</Text>
              </View>
              <Text className={`text-[11px] font-bold ${usedBreakMinutes > 80 ? "text-rose-600" : "text-[#5B4FD1]"}`}>
                {usedBreakMinutes > 80 ? `Over limit by +${usedBreakMinutes - 80}m` : `${remainingBreakMinutes}m / 80m Left`}
              </Text>
            </View>

            <View className="w-full h-2.5 bg-[#F6F5FC] rounded-full overflow-hidden mb-3 border border-[#E7E4F5]">
              <View
                className={`h-full rounded-full ${usedBreakMinutes > 80 ? "bg-rose-500" : "bg-[#5B4FD1]"}`}
                style={{ width: `${Math.min(100, (usedBreakMinutes / TOTAL_BREAK_LIMIT_MINS) * 100)}%` }}
              />
            </View>

            {attendanceState === "WORKING" && (
              <TouchableOpacity
                onPress={() => setIsBreakModalVisible(true)}
                disabled={isSyncing}
                style={{ opacity: isSyncing ? 0.6 : 1 }}
                className="w-full py-3 bg-[#F6F5FC] border border-[#5B4FD1]/30 rounded-2xl flex-row items-center justify-center active:bg-[#EEECFA]"
              >
                <Pause size={14} color="#5B4FD1" />
                <Text className="text-xs font-black text-[#5B4FD1] ml-2 uppercase tracking-wider">
                  Take Break / Lunch (Pause Shift)
                </Text>
              </TouchableOpacity>
            )}

            {attendanceState === "ON_BREAK" && (
              <View>
                {/* Live break timer, shown only while a break is running */}
                <View className="items-center py-3 mb-3 bg-amber-50 rounded-2xl border border-amber-200">
                  <Text className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-0.5">
                    {activeBreakType || "Break"} started at {activeBreakStartTime || "--:--"}
                  </Text>
                  <LiveTimer
                    baseSeconds={0}
                    anchorMs={breakAnchorMs ?? getSyncedNowMs()}
                    running={attendanceState === "ON_BREAK"}
                    offsetMs={serverOffsetMs.current}
                    className="text-2xl font-black text-amber-700 tracking-widest font-mono"
                  />
                </View>

                <TouchableOpacity
                  onPress={handleEndBreak}
                  disabled={isSyncing}
                  style={{ opacity: isSyncing ? 0.6 : 1 }}
                  className="w-full py-3 bg-emerald-600 rounded-2xl flex-row items-center justify-center active:opacity-90 shadow-xs"
                >
                  {isSyncing ? (
                    <View className="flex-row items-center justify-center">
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text className="text-xs font-black text-white ml-2 uppercase tracking-wider">Ending Break...</Text>
                    </View>
                  ) : (
                    <>
                      <Play size={14} color="#FFFFFF" />
                      <Text className="text-xs font-black text-white ml-2 uppercase tracking-wider">
                        End {activeBreakType || "Break"} & Resume Working Hours
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* FINAL CHECK OUT */}
        {attendanceState === "WORKING" && (
          <View className="mb-4">
            <TouchableOpacity
              onPress={handleCheckOut}
              disabled={!capturedPhotoUri || isSyncing}
              className={`w-full py-4 rounded-2xl items-center shadow-md ${
                capturedPhotoUri && !isSyncing ? "bg-[#150F38] active:opacity-90 shadow-indigo-950/30" : "bg-slate-300 opacity-60"
              }`}
            >
              {isSyncing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-white font-black text-xs uppercase tracking-wider">
                  {activeMode === "WFH" ? "Punch Final WFH Check-Out" : "Punch Final Office Check-Out"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* TIMING SUMMARY CARD */}
        <View className="bg-[#5B4FD1] border border-[#2C2270] rounded-3xl p-5 mb-4 shadow-sm">
          <View className="flex-row items-center justify-between pb-3 mb-3 border-b border-white/10">
            <View className="flex-row items-center gap-1.5">
              <Clock size={14} color="#A6A2CE" />
              <Text className="text-[11px] font-bold text-[#A6A2CE] uppercase tracking-wider">
                {currentDateIST || "Today's Timings"}
              </Text>
            </View>
            <View className="bg-white/10 px-2.5 py-0.5 rounded-full flex-row items-center">
              <Text className="text-[10px] font-black text-emerald-300 uppercase tracking-wider">Target: 8h</Text>
            </View>
          </View>

          {attendanceState !== "NOT_CHECKED_IN" && (
            <View className="items-center py-2.5 mb-3 bg-white/10 rounded-2xl border border-white/10">
              <Text className="text-[10px] font-bold text-[#A6A2CE] uppercase tracking-widest mb-0.5">
                {attendanceState === "ON_BREAK" ? "Shift Paused (On Break)" : "Active Working Hours"}
              </Text>
              <LiveTimer
                baseSeconds={workedBase}
                anchorMs={workedAnchorMs}
                running={attendanceState === "WORKING"}
                offsetMs={serverOffsetMs.current}
                className="text-2xl font-black text-white tracking-widest font-mono"
              />
              <Text className="text-[9.5px] font-medium text-white/70 mt-1">Grace: 5 mins • Break Bank: 80 mins</Text>
            </View>
          )}

          <View className="flex-row justify-between items-center divide-x divide-white/10">
            <View className="flex-1 items-center px-2">
              <Text className="text-[10px] font-bold text-[#A6A2CE] uppercase tracking-widest mb-1">Checked In At</Text>
              <Text className="text-xl md:text-2xl font-black text-white tracking-tight">{checkInTime || "--:--"}</Text>
              <View className="bg-emerald-500/20 px-2 py-0.5 rounded-full mt-1.5">
                <Text className="text-[9.5px] font-black text-emerald-400 uppercase">
                  {checkInTime ? (attendanceState === "ON_BREAK" ? "Paused" : "Active Shift") : "Awaiting Photo"}
                </Text>
              </View>
            </View>

            <View className="flex-1 items-center px-2">
              <Text className="text-[10px] font-bold text-[#A6A2CE] uppercase tracking-widest mb-1">Checked Out At</Text>
              <Text className="text-xl md:text-2xl font-black text-white/80 tracking-tight">{checkOutTime || "--:--"}</Text>
              <View className={`px-2 py-0.5 rounded-full mt-1.5 ${checkOutTime ? "bg-emerald-500/20" : "bg-amber-500/20"}`}>
                <Text className={`text-[9.5px] font-black uppercase ${checkOutTime ? "text-emerald-400" : "text-amber-300"}`}>
                  {checkOutTime ? "Completed" : "In Progress"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* BREAK HISTORY LOG */}
        {breakHistory.length > 0 && (
          <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 mb-4 shadow-xs">
            <View className="flex-row items-center justify-between pb-2 mb-3 border-b border-[#E7E4F5]">
              <View className="flex-row items-center gap-1.5">
                <Clock size={14} color="#5B4FD1" />
                <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
                  Today's Break Sessions ({breakHistory.length})
                </Text>
              </View>
              <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Total: {usedBreakMinutes} mins</Text>
            </View>

            <View className="space-y-2 gap-2">
              {breakHistory.map((item, index) => (
                <View
                  key={`${item.id || "brk"}-${index}`}
                  className="flex-row items-center justify-between p-3 bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl"
                >
                  <View className="flex-row items-center gap-2.5">
                    <View
                      className={`w-8 h-8 rounded-xl items-center justify-center ${
                        item.type === "LUNCH" ? "bg-amber-100 border border-amber-200" : "bg-[#EEECFA] border border-[#5B4FD1]/20"
                      }`}
                    >
                      {item.type === "LUNCH" ? <Utensils size={14} color="#D97706" /> : <Coffee size={14} color="#5B4FD1" />}
                    </View>
                    <View>
                      <Text className="text-xs font-bold text-[#1F1B3D]">{item.title}</Text>
                      <Text className="text-[10px] font-semibold text-[#7A76A6]">
                        {item.startTime} - {item.endTime}
                      </Text>
                    </View>
                  </View>
                  <View className="bg-white px-2.5 py-1 rounded-lg border border-[#E7E4F5]">
                    <Text className="text-[11px] font-black text-[#1F1B3D]">
                      {formatBreakDuration(item.durationSeconds, item.durationMinutes)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* BREAK SELECTION MODAL */}
        <Modal
          visible={isBreakModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsBreakModalVisible(false)}
        >
          <View className="flex-1 bg-black/60 items-center justify-center px-5">
            <View className="w-full bg-white rounded-3xl p-5 shadow-xl border border-[#E7E4F5]">
              <Text className="text-base font-black text-[#1F1B3D] text-center mb-1">Select Break Category</Text>
              <Text className="text-xs font-semibold text-[#7A76A6] text-center mb-4">
                Remaining break bank: {remainingBreakMinutes} mins today
              </Text>

              <TouchableOpacity
                onPress={() => handleStartBreak("Morning Tea Break")}
                className="flex-row items-center p-3.5 bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl mb-2.5 active:bg-[#EEECFA]"
              >
                <Coffee size={18} color="#5B4FD1" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs font-black text-[#1F1B3D]">Morning Tea Break</Text>
                  <Text className="text-[10px] font-semibold text-[#7A76A6]">Flexible minutes from 80m pool</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleStartBreak("Lunch Break")}
                className="flex-row items-center p-3.5 bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl mb-2.5 active:bg-[#EEECFA]"
              >
                <Utensils size={18} color="#5B4FD1" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs font-black text-[#1F1B3D]">Lunch Break</Text>
                  <Text className="text-[10px] font-semibold text-[#7A76A6]">Flexible minutes from 80m pool</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleStartBreak("Evening Tea Break")}
                className="flex-row items-center p-3.5 bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl mb-4 active:bg-[#EEECFA]"
              >
                <Coffee size={18} color="#5B4FD1" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs font-black text-[#1F1B3D]">Evening Tea Break</Text>
                  <Text className="text-[10px] font-semibold text-[#7A76A6]">Flexible minutes from 80m pool</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsBreakModalVisible(false)}
                className="w-full py-3 bg-slate-200 rounded-xl items-center active:bg-slate-300"
              >
                <Text className="text-xs font-black text-[#1F1B3D] uppercase">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </ScreenContainer>
  );
}