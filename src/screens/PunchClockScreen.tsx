import React, { useState, useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { 
  View, 
  Text, RefreshControl,
  TouchableOpacity, 
  Alert, StyleSheet,
  Platform, 
  Image, 
  ActivityIndicator,
  ScrollView,
  Modal
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
  Undo2
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";
import { UserSession } from "../services/UserSession";
import { startShiftTracking, stopShiftTracking  } from "../services/shiftTrackingManager";
import { BASE_HOST } from "../constants/config";
import { useIsFocused } from "@react-navigation/native";

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
  [key: string]: any;
}

const API_BASE_URL = `${BASE_HOST}/api/attendance`;
const TOTAL_BREAK_LIMIT_MINS = 80;
const NETWORK_TIMEOUT_MS = 10000;
const CAMERA_REMOUNT_AFTER_BG_MS = 10000; // only remount camera after a REAL background period
const CAMERA_READY_TIMEOUT_MS = 8000;
const RESTART_WINDOW_MINUTES = 15; // matches the server-side window in restartShift()

// ---------------------------------------------------------------------------
// Generic fetch-with-timeout helper: prevents any single network call from
// hanging indefinitely and leaving the UI stuck in a "loading" state forever.
// ---------------------------------------------------------------------------
const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs: number = NETWORK_TIMEOUT_MS
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
};

// Pure display formatter for IST
const formatToIST = (dateInput?: number | string | Date | null) => {
  if (!dateInput) return "--:--";
  try {
    let date: Date;
    if (typeof dateInput === "string") {
      // Fix Android Hermes issue with SQL "YYYY-MM-DD HH:mm:ss" timestamps
      const sanitized = dateInput.replace(" ", "T");
      date = new Date(sanitized);
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

// Parses the same raw SQL timestamp shape formatToIST handles, but returns a
// real Date for arithmetic (e.g. "how many minutes since checkout").
const parseRawTimestamp = (dateInput?: number | string | Date | null): Date | null => {
  if (!dateInput) return null;
  try {
    let date: Date;
    if (typeof dateInput === "string") {
      date = new Date(dateInput.replace(" ", "T"));
    } else if (typeof dateInput === "number") {
      date = new Date(dateInput);
    } else {
      date = dateInput;
    }
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Lightweight error boundary — catches any uncaught render error inside the
// camera block instead of letting it crash to a blank white screen.
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
          <Text className="text-xs font-black text-[#1F1B3D] mt-2 text-center">
            Camera failed to load
          </Text>
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

  // Camera lifecycle & crash-recovery state
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraKey, setCameraKey] = useState(0); // bump this to force a full native remount

  // Server Time Sync Ref (Difference in ms between Server Time and Device Time)
  const serverOffsetMs = useRef<number>(0);
  const [currentTimeIST, setCurrentTimeIST] = useState("");
  const [currentDateIST, setCurrentDateIST] = useState("");

  const [userDistance, setUserDistance] = useState<number | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasInitialFix, setHasInitialFix] = useState(false);

  // Dynamic Geofence Configuration
  const [activeBranchName, setActiveBranchName] = useState<string>("Assigned Office");
  const [geofenceRules, setGeofenceRules] = useState<GeofenceConfig[]>([]);
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState<number>(200);

  // Role-based geofence exemption (e.g. SALES / field staff) — sourced from
  // the employee's own config row (is_geofence_exempt), NOT chosen by the user.
  const [isGeofenceExempt, setIsGeofenceExempt] = useState(false);

  // Live Location & Anti-Spoofing
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isMockLocation, setIsMockLocation] = useState(false);

  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    if (isPullRefreshing) return;
    setIsPullRefreshing(true);

    try {
      await syncServerTimeOffset();
      await fetchTodayAttendanceState();
      await checkLiveLocation();
    } catch (error) {
      console.warn("Pull-to-refresh failed:", error);
      Alert.alert("Refresh Failed", "Could not refresh your attendance status. Check your connection and try again.");
    } finally {
      setIsPullRefreshing(false);
    }
  };

  // Mode & Attendance State
  const [activeMode, setActiveMode] = useState<AttendanceMode>("OFFICE");
  const [attendanceState, setAttendanceState] = useState<PunchState>("NOT_CHECKED_IN");
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null);
  const [lastCheckoutRaw, setLastCheckoutRaw] = useState<Date | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);

  // Working Hours & Breaks
  const [workedSeconds, setWorkedSeconds] = useState(0);
  const [usedBreakMinutes, setUsedBreakMinutes] = useState(0);
  const [activeBreakType, setActiveBreakType] = useState<string | null>(null);
  const [activeBreakStartTime, setActiveBreakStartTime] = useState<string | null>(null);
  const [breakElapsedSeconds, setBreakElapsedSeconds] = useState(0);
  const breakStartEpochRef = useRef<number | null>(null);
  const [isBreakModalVisible, setIsBreakModalVisible] = useState(false);
  const [breakHistory, setBreakHistory] = useState<BreakSessionItem[]>([]);

  const EMP_ID = UserSession.empId || "EMP1042";

  // Returns current timestamp synced with backend
  const getSyncedServerDate = () => new Date(Date.now() + serverOffsetMs.current);

  // 1. Sync Offset from Backend (Called once on load or foreground)
  const syncServerTimeOffset = async () => {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/server-time`, {}, 6000);
      if (!response.ok) return;
      const data = await response.json();

      const serverTimestamp = typeof data.serverTime === "number"
        ? data.serverTime
        : new Date(data.serverTime).getTime();

      serverOffsetMs.current = serverTimestamp - Date.now();
    } catch (error) {
      console.warn("Could not sync server time offset; defaulting to local clock", error);
      // Non-fatal — local clock is used as fallback, no need to alert the user
    }
  };

  // Haversine Distance Calculation (Meters)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  // exemptOverride lets callers pass a just-fetched exemption flag directly,
  // avoiding a stale-closure read of `isGeofenceExempt` state right after it
  // was set (setState is async, so the very next line can't trust it yet).
  const evaluateGeofence = (
    lat: number,
    lng: number,
    branches: GeofenceConfig[],
    exemptOverride?: boolean
  ) => {
    const effectivelyExempt = exemptOverride ?? isGeofenceExempt;

    if (activeMode === "WFH" || effectivelyExempt) {
      setIsWithinGeofence(true);

      // Still compute distance for informational display even when exempt —
      // Sales/field staff's distance from the nearest branch is still useful
      // to log, it just never blocks the punch.
      if (branches && branches.length > 0) {
        let minDistance = Infinity;
        for (const b of branches) {
          const dist = calculateDistance(lat, lng, b.latitude, b.longitude);
          if (dist < minDistance) minDistance = dist;
        }
        setUserDistance(minDistance === Infinity ? null : minDistance);
      }
      return;
    }

    if (!branches || branches.length === 0) {
      setIsWithinGeofence(false);
      return;
    }

    let minDistance = Infinity;
    let matchedBranch: GeofenceConfig | null = null;
    let isInside = false;

    for (const b of branches) {
      const dist = calculateDistance(lat, lng, b.latitude, b.longitude);
      const radius = b.radius_meters || 200;

      if (dist < minDistance) {
        minDistance = dist;
        matchedBranch = b;
      }
      if (dist <= radius) {
        isInside = true;
      }
    }

    setUserDistance(minDistance === Infinity ? null : minDistance);
    setIsWithinGeofence(isInside);

    if (matchedBranch) {
      setActiveBranchName(matchedBranch.branch_name || "Office HQ");
      setAllowedRadiusMeters(matchedBranch.radius_meters || 200);
    }
  };

  const isCheckingLocation = useRef(false);

  const checkLiveLocation = async (
    rulesOverride?: GeofenceConfig[],
    exemptOverride?: boolean
  ): Promise<{ latitude: number; longitude: number; isMock: boolean } | null> => {
    if (isCheckingLocation.current) return null;
    isCheckingLocation.current = true;
    setIsVerifying(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "GPS Location access is mandatory to punch attendance.");
        return null;
      }

      const location = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High, // balance of speed vs accuracy across devices
        }),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("Location request timed out")), 8000)
        ),
      ]);

      if (location && location.coords) {
        const currentLat = location.coords.latitude;
        const currentLng = location.coords.longitude;
        const isMock = Boolean(location.mocked);

        setUserCoords({ latitude: currentLat, longitude: currentLng });
        setIsMockLocation(isMock);
        evaluateGeofence(currentLat, currentLng, rulesOverride || geofenceRules, exemptOverride);
        setHasInitialFix(true);

        return { latitude: currentLat, longitude: currentLng, isMock };
      }
    } catch (error) {
      console.warn("GPS lock error:", error);
      // Only surface an alert if we genuinely have no prior fix to fall back on —
      // avoids spamming the user with alerts on every transient background re-check.
      if (!hasInitialFix) {
        Alert.alert("GPS Error", "Could not get your location. Please check that location services are enabled and try again.");
      }
    } finally {
      setIsVerifying(false);
      isCheckingLocation.current = false;
    }

    return null;
  };

  const fetchTodayAttendanceState = async () => {
    try {
      setIsSyncing(true);
      const response = await fetchWithTimeout(`${API_BASE_URL}/today?empId=${EMP_ID}`, {}, NETWORK_TIMEOUT_MS);
      if (!response.ok) {
        console.warn(`Attendance fetch returned ${response.status}`);
        return;
      }
      const data = await response.json();

      let parsedBranches: GeofenceConfig[] = [];
      if (data.config?.geofence_config_json) {
        try {
          const rawConfig = typeof data.config.geofence_config_json === "string"
            ? JSON.parse(data.config.geofence_config_json)
            : data.config.geofence_config_json;

          parsedBranches = Array.isArray(rawConfig) ? rawConfig : [rawConfig];
          setGeofenceRules(parsedBranches);

          if (parsedBranches.length > 0) {
            setActiveBranchName(parsedBranches[0].branch_name || "Office HQ");
            setAllowedRadiusMeters(parsedBranches[0].radius_meters || 200);
          }
        } catch (parseErr) {
          console.warn("Failed to parse geofence_config_json:", parseErr);
        }
      }

      // Role-based exemption straight from the employee's own config row.
      const exemptFlag = Boolean(data.config?.is_geofence_exempt);
      setIsGeofenceExempt(exemptFlag);

      // Pass the freshly-read exemption flag directly so the very next
      // geofence evaluation doesn't read a stale (pre-update) state value.
      await checkLiveLocation(parsedBranches, exemptFlag);

      if (data.work_mode) {
        setActiveMode(data.work_mode === "SALES" ? "SALES" : data.work_mode === "WFH" ? "WFH" : "OFFICE");
      }

      setUsedBreakMinutes(data.break_minutes || 0);

      if (data.break_history_json) {
        try {
          const parsedHistory = typeof data.break_history_json === "string"
            ? JSON.parse(data.break_history_json)
            : data.break_history_json;
          if (Array.isArray(parsedHistory)) setBreakHistory(parsedHistory);
        } catch (parseErr) {
          console.warn("Failed to parse break_history_json:", parseErr);
        }
      }

      if (data.first_punch_in) {
        setCheckInTime(formatToIST(data.first_punch_in));

        if (data.last_punch_out) {
          setCheckOutTime(formatToIST(data.last_punch_out));
          setLastCheckoutRaw(parseRawTimestamp(data.last_punch_out));
          setAttendanceState("CHECKED_OUT");
          breakStartEpochRef.current = null;
        } else if (data.is_on_break) {
          setAttendanceState("ON_BREAK");
          const startVal = data.active_break_start_time || data.current_break?.startTime;
          if (startVal) setActiveBreakStartTime(formatToIST(startVal));
          if (data.active_break_title || data.current_break?.title) {
            setActiveBreakType(data.active_break_title || data.current_break.title);
          }

          // Resume the live break timer across app restarts/backgrounding —
          // prefer the precise epoch saved locally when the break was started
          // on THIS device; otherwise fall back to 0 (timer still ticks
          // forward correctly from this point on, just without prior elapsed time).
          if (!breakStartEpochRef.current) {
            try {
              const savedEpoch = await AsyncStorage.getItem("active_break_timestamp");
              breakStartEpochRef.current = savedEpoch ? parseInt(savedEpoch, 10) : Date.now();
            } catch {
              breakStartEpochRef.current = Date.now();
            }
          }
        } else {
          setAttendanceState("WORKING");
          breakStartEpochRef.current = null;
          // Backend confirms NOT on break — defensively clear any stale local
          // break cache left behind by a prior crash/force-close, so the UI
          // never shows a "ghost" break state that disagrees with the server.
          try {
            await AsyncStorage.multiRemove(["active_break_timestamp", "active_break_type"]);
          } catch (storageErr) {
            console.warn("Could not clear stale break cache:", storageErr);
          }
        }

        setWorkedSeconds(data.worked_seconds || 0);
      } else {
        setAttendanceState("NOT_CHECKED_IN");
        setWorkedSeconds(0);
        setLastCheckoutRaw(null);
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.warn("Attendance fetch timed out.");
      } else {
        console.warn("Initial attendance fetch failed:", error);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Lifecycle: Sync offset once & run the 1-second clock locally.
  // Also handles camera remount after a REAL background period (not brief
  // focus blips), and debounces the attendance/location refetch.
  useEffect(() => {
    syncServerTimeOffset();
    fetchTodayAttendanceState();

    let previousState = AppState.currentState;
    let lastRefetchAt = 0;
    const MIN_REFETCH_INTERVAL_MS = 5000;
    let backgroundedAt: number | null = null;

    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState.match(/inactive|background/)) {
        backgroundedAt = Date.now();
      }

      if (previousState.match(/inactive|background/) && nextState === "active") {
        const now = Date.now();

        if (now - lastRefetchAt > MIN_REFETCH_INTERVAL_MS) {
          lastRefetchAt = now;
          syncServerTimeOffset();
          fetchTodayAttendanceState();
        }

        // If the app was genuinely backgrounded for a while, the native camera
        // session is very likely dead even though the component never
        // unmounted — force a full remount so it isn't stuck "loading" forever.
        const backgroundDurationMs = backgroundedAt ? now - backgroundedAt : 0;
        if (backgroundDurationMs > CAMERA_REMOUNT_AFTER_BG_MS) {
          setCameraReady(false);
          setCameraError(null);
          setCameraKey((prev) => prev + 1);
        }
      }
      previousState = nextState;
    });

    const clockTimer = setInterval(() => {
      const nowSynced = getSyncedServerDate();
      setCurrentTimeIST(
        nowSynced.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: true,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setCurrentDateIST(
        nowSynced.toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "short",
          day: "numeric",
          month: "short",
        })
      );
    }, 1000);

    return () => {
      sub.remove();
      clearInterval(clockTimer);
    };
  }, []);

  // Increment worked seconds when working
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (attendanceState === "WORKING") {
      timer = setInterval(() => {
        setWorkedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [attendanceState]);

  // Live break duration timer — ticks every second while ON_BREAK, anchored
  // to the actual start epoch (not just an incrementing counter), so it stays
  // accurate even if the app was briefly backgrounded mid-break.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (attendanceState === "ON_BREAK") {
      timer = setInterval(() => {
        const startEpoch = breakStartEpochRef.current;
        if (startEpoch) {
          const nowMs = getSyncedServerDate().getTime();
          const elapsed = Math.max(0, Math.floor((nowMs - startEpoch) / 1000));
          setBreakElapsedSeconds(elapsed);
        }
      }, 1000);
    } else {
      setBreakElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [attendanceState]);

  useEffect(() => {
    if (userCoords) {
      evaluateGeofence(userCoords.latitude, userCoords.longitude, geofenceRules);
    }
  }, [activeMode, isGeofenceExempt]);

  // Prefetch GPS as soon as the screen is focused — skips the very first
  // mount (fetchTodayAttendanceState already triggers the initial fetch),
  // so this only fires on genuine returns to the screen.
  const hasMountedOnce = useRef(false);
  useEffect(() => {
    if (isFocused && hasMountedOnce.current) {
      checkLiveLocation();
    }
    hasMountedOnce.current = true;
  }, [isFocused]);

  // Safety-net: if the camera never reports ready within a bounded window,
  // surface a retry option instead of leaving the user staring at a stuck
  // "loading" circle indefinitely.
  useEffect(() => {
    if (!cameraReady && !cameraError && isFocused && permission?.granted && !capturedPhotoUri && attendanceState !== "CHECKED_OUT") {
      const timeout = setTimeout(() => {
        setCameraReady((ready) => {
          if (!ready) {
            setCameraError("Camera is taking too long to start. Please retry.");
          }
          return ready;
        });
      }, CAMERA_READY_TIMEOUT_MS);
      return () => clearTimeout(timeout);
    }
  }, [cameraKey, isFocused, cameraReady, cameraError, capturedPhotoUri, permission?.granted, attendanceState]);

  const formatWorkingHours = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

  // A punch is eligible when: WFH (always exempt), OR the employee's own
  // config marks them geofence-exempt (e.g. Sales/field staff), OR they are
  // physically confirmed inside the office radius.
  const isPunchEligible = activeMode === "WFH" || isGeofenceExempt ? true : isWithinGeofence;

  // Whether the "accidentally checked out" restart option should be shown —
  // only within a short window after checkout. Re-evaluated every render,
  // and since currentTimeIST already ticks every second, this naturally
  // re-checks live and the button disappears right when the window expires.
  const minutesSinceCheckout = lastCheckoutRaw
    ? (getSyncedServerDate().getTime() - lastCheckoutRaw.getTime()) / 60000
    : null;
  const canRestartShift =
    attendanceState === "CHECKED_OUT" &&
    minutesSinceCheckout !== null &&
    minutesSinceCheckout >= 0 &&
    minutesSinceCheckout <= RESTART_WINDOW_MINUTES;
  const restartMinutesLeft = canRestartShift
    ? Math.max(0, Math.ceil(RESTART_WINDOW_MINUTES - (minutesSinceCheckout as number)))
    : 0;

  const executePunchAPI = async (
    type: "CHECK_IN" | "CHECK_OUT",
    verifiedLocation?: { latitude: number; longitude: number; isMock: boolean }
  ): Promise<PunchResponsePayload | null> => {
    try {
      setIsSyncing(true);

      const lat = verifiedLocation?.latitude ?? userCoords?.latitude ?? 0;
      const lng = verifiedLocation?.longitude ?? userCoords?.longitude ?? 0;
      const isMock = verifiedLocation?.isMock ?? isMockLocation;

      if (isMock) {
        const spoofMsg = "Mock GPS spoofing detected. Disable fake location apps/Developer Options to punch.";
        Platform.OS === "web" ? window.alert(spoofMsg) : Alert.alert("Security Alert", spoofMsg);
        return null;
      }

      const ticketRes = await fetchWithTimeout(
        `${API_BASE_URL}/upload-ticket?empId=${EMP_ID}&punchType=${type}`,
        {},
        NETWORK_TIMEOUT_MS
      );
      if (!ticketRes.ok) throw new Error("Could not prepare selfie upload. Please try again.");
      const ticketData = await ticketRes.json();
      const cloudKey = ticketData.cloudKey || `selfies/${Date.now()}-${type}.jpg`;

      const effectiveMode = activeMode === "SALES" ? "SALES" : activeMode === "WFH" ? "WFH" : "IN_OFFICE";

      const payload = {
        empId: EMP_ID,
        punchType: type,
        selectedMode: effectiveMode,
        latitude: lat,
        longitude: lng,
        selfieCloudKey: cloudKey,
        deviceId: `${Platform.OS}-${Platform.Version}`,
        mockLocation: isMock,
      };

      const punchRes = await fetchWithTimeout(`${API_BASE_URL}/punch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, NETWORK_TIMEOUT_MS);

      const result: PunchResponsePayload = await punchRes.json();
      if (!punchRes.ok) throw new Error(result.message || "Failed to record attendance punch.");

      const modeTitle = effectiveMode === "WFH" ? "Work-From-Home" : effectiveMode === "SALES" ? "Sales Visit" : `${activeBranchName} Office`;
      const msg = `Successfully ${type === "CHECK_IN" ? "Checked In" : "Checked Out"} at ${currentTimeIST} via ${modeTitle}.`;
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Punch Recorded", msg);

      setCapturedPhotoUri(null);
      await fetchTodayAttendanceState();
      return result;
    } catch (error: any) {
      const errorMsg = error?.name === "AbortError"
        ? "The request took too long. Please check your connection and try again."
        : (error.message || "Attendance request failed. Verify connection.");
      Platform.OS === "web" ? window.alert(errorMsg) : Alert.alert("Attendance Error", errorMsg);
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTakeSelfie = async () => {
    if (!cameraRef.current || !cameraReady) {
      Alert.alert("Camera Not Ready", "Please wait a moment and try again.");
      return;
    }

    try {
      setIsCapturing(true);

      // Capture the photo immediately — don't block the shutter on GPS.
      const photoPromise = cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      });

      // Location resolves in parallel, not sequentially, so the camera feels
      // instantly responsive instead of freezing for several seconds first.
      const locationPromise = checkLiveLocation();

      const [photo, freshLoc] = await Promise.all([photoPromise, locationPromise]);

      setCapturedPhotoUri(photo.uri);

      // Exempt roles (WFH / geofence-exempt Sales) don't need a resolved fix
      // to proceed, but we still try to log whatever location we got.
      if (!freshLoc && activeMode !== "WFH" && !isGeofenceExempt) {
        Alert.alert("Location Error", "Could not get current GPS coordinates. Please retry.");
        setCapturedPhotoUri(null);
        return;
      }

      if (freshLoc?.isMock) {
        Alert.alert("Security Alert", "Mock GPS spoofing detected. Disable mock locations in settings.");
        setCapturedPhotoUri(null);
        return;
      }

      if (!isPunchEligible) {
        const msg = `Geofence violation: You are ${userDistance}m away from ${activeBranchName}. Must be within ${allowedRadiusMeters}m to clock in.`;
        Platform.OS === "web" ? window.alert(msg) : Alert.alert("Location Error", msg);
        setCapturedPhotoUri(null);
        return;
      }

      if (attendanceState === "NOT_CHECKED_IN") {
        const response = await executePunchAPI("CHECK_IN", freshLoc || undefined);
        if (response?.status === "SUCCESS") {
          await startShiftTracking(EMP_ID, response.workMode || activeMode);
        }
      }
    } catch (err) {
      const msg = "Could not capture front photo. Please try again.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Camera Error", msg);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!capturedPhotoUri) {
      const msg = "Please take a verification selfie before checking out.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Selfie Required", msg);
      return;
    }

    const freshLoc = await checkLiveLocation();
    if (!freshLoc && activeMode !== "WFH" && !isGeofenceExempt) {
      Alert.alert("Location Error", "Could not verify your GPS location for checkout. Try again.");
      return;
    }

    if (freshLoc?.isMock) {
      Alert.alert("Security Alert", "Mock GPS detected. Check-out rejected.");
      return;
    }

    if (!isPunchEligible) {
      const msg = `Geofence violation: You are ${userDistance}m away from ${activeBranchName}. Must be within ${allowedRadiusMeters}m.`;
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Location Error", msg);
      return;
    }

    try {
      if (attendanceState === "WORKING") {
        const response: any = await executePunchAPI("CHECK_OUT", freshLoc || undefined);
        if (response?.status === "SUCCESS") {
          await stopShiftTracking();
        }
      }
    } catch (err) {
      console.warn("Check-out failed:", err);
    }
  };

  // Undo an accidental checkout — only available within RESTART_WINDOW_MINUTES,
  // enforced both here (for immediate UI feedback) and server-side (authoritative).
  const handleRestartShift = () => {
    Alert.alert(
      "Restart Shift?",
      "This will undo your check-out and resume your working hours. Use this only if you checked out by mistake.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restart Shift",
          style: "destructive",
          onPress: async () => {
            try {
              setIsRestarting(true);
              const res = await fetchWithTimeout(`${API_BASE_URL}/restart-shift`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ empId: EMP_ID }),
              }, NETWORK_TIMEOUT_MS);

              const data = await res.json();
              if (!res.ok || data.status !== "SUCCESS") {
                throw new Error(data.message || "Could not restart your shift.");
              }

              setCheckOutTime(null);
              setLastCheckoutRaw(null);
              setCapturedPhotoUri(null);
              await fetchTodayAttendanceState();
              await startShiftTracking(EMP_ID, activeMode);

              const msg = "Your shift has been restarted. Working hours have resumed.";
              Platform.OS === "web" ? window.alert(msg) : Alert.alert("Shift Restarted", msg);
            } catch (error: any) {
              const errorMsg = error?.name === "AbortError"
                ? "The request took too long. Please check your connection and try again."
                : (error.message || "Could not restart your shift. Please contact admin.");
              Alert.alert("Restart Failed", errorMsg);
            } finally {
              setIsRestarting(false);
            }
          },
        },
      ]
    );
  };

  // Start Break using Synced Server Time
  const handleStartBreak = async (breakName: string) => {
    const syncedNow = getSyncedServerDate();
    const bType = breakName.toLowerCase().includes("lunch") ? "LUNCH" : "TEA";
    const formattedDisplay = formatToIST(syncedNow);

    setActiveBreakType(breakName);
    setActiveBreakStartTime(formattedDisplay);
    setAttendanceState("ON_BREAK");
    setIsBreakModalVisible(false);

    // Anchor the live break timer to this exact moment.
    breakStartEpochRef.current = syncedNow.getTime();
    setBreakElapsedSeconds(0);

    try {
      await AsyncStorage.setItem("active_break_timestamp", syncedNow.getTime().toString());
      await AsyncStorage.setItem("active_break_type", breakName);
    } catch (storageErr) {
      console.warn("Could not persist break state locally:", storageErr);
    }

    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/break/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: EMP_ID,
          breakType: bType,
          breakTitle: breakName,
        }),
      }, NETWORK_TIMEOUT_MS);

      if (!res.ok) {
        console.warn("Break start sync returned non-OK status:", res.status);
      }
    } catch (error) {
      console.warn("Could not sync break start with server:", error);
      // Non-fatal: local state already reflects "on break"; next successful
      // fetchTodayAttendanceState() will reconcile with the server's truth.
    }
  };

  // End Break (Authoritative Backend State)
  const isEndingBreak = useRef(false);

  const handleEndBreak = async () => {
    if (isEndingBreak.current || isSyncing) return;
    isEndingBreak.current = true;
    setIsSyncing(true);

    try {
      const payload = {
        empId: EMP_ID,
        breakType: activeBreakType?.toLowerCase().includes("lunch") ? "LUNCH" : "TEA",
        breakTitle: activeBreakType || "Personal Break",
      };

      const res = await fetchWithTimeout(`${API_BASE_URL}/break/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, NETWORK_TIMEOUT_MS);

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Could not sync break session with server.");

      setAttendanceState("WORKING");
      setActiveBreakType(null);
      setActiveBreakStartTime(null);
      breakStartEpochRef.current = null;
      setBreakElapsedSeconds(0);

      try {
        await AsyncStorage.multiRemove(["active_break_timestamp", "active_break_type"]);
      } catch (storageErr) {
        console.warn("Could not clear local break cache:", storageErr);
      }

      const serverDurationSec = resData.durationSeconds ?? (resData.durationMinutes ? resData.durationMinutes * 60 : 0);
      const serverDurationMin = resData.durationMinutes ?? Math.floor(serverDurationSec / 60);

      if (resData.totalBreakMinutes !== undefined) {
        setUsedBreakMinutes(resData.totalBreakMinutes);
      }

      const newSession: BreakSessionItem = {
        id: resData.breakId || Date.now().toString(),
        title: activeBreakType || "Break",
        startTime: activeBreakStartTime || formatToIST(resData.startTime),
        endTime: formatToIST(resData.endTime || getSyncedServerDate()),
        durationMinutes: serverDurationMin,
        durationSeconds: serverDurationSec,
        type: (activeBreakType?.toLowerCase().includes("lunch") ? "LUNCH" : "TEA") as "LUNCH" | "TEA",
      };
      setBreakHistory((prev) => [...prev, newSession]);

      await fetchTodayAttendanceState();
    } catch (error: any) {
      const msg = error?.name === "AbortError"
        ? "The request took too long. Please check your connection and try again."
        : (error.message || "Network issue.");
      Alert.alert("Break Sync Failed", msg);
    } finally {
      setIsSyncing(false);
      isEndingBreak.current = false;
    }
  };

  const remainingBreakMinutes = Math.max(0, TOTAL_BREAK_LIMIT_MINS - usedBreakMinutes);

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
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

            <View className="bg-white/20 px-3 py-1 rounded-full border border-white/25 flex-row items-center">
              <ShieldCheck size={12} color="#FFFFFF" />
              <Text className="text-[10px] font-black text-white ml-1 uppercase tracking-wider">
                NTP Live Synced
              </Text>
            </View>
          </View>

          <View className="items-center">
            <Text className="text-xl md:text-2xl font-black text-white tracking-tight">
              Biometric Punch Clock
            </Text>
            <Text className="text-xs font-semibold text-white/80 mt-0.5 text-center">
              {isGeofenceExempt
                ? "Field Role • GPS & Selfie Verification (Location Unrestricted)"
                : activeMode === "WFH"
                ? "Remote Presence • GPS & Selfie Verification"
                : "Geofenced GPS & Live Camera Attendance"}
            </Text>
          </View>
        </View>

        {/* WORK MODE SWITCH — disabled for geofence-exempt roles since their
            mode is fixed by admin config, not chosen in-app */}
        <View className="bg-white border border-[#E7E4F5] rounded-3xl p-2 mb-4 shadow-xs">
          {isGeofenceExempt ? (
            <View className="flex-row items-center justify-center py-2.5 px-3 bg-[#F6F5FC] rounded-2xl border border-[#E7E4F5]">
              <Briefcase size={14} color="#5B4FD1" />
              <Text className="text-xs font-black text-[#5B4FD1] ml-2">
                Field / Sales Mode — Location Not Restricted
              </Text>
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
              <View className={`w-9 h-9 rounded-xl items-center justify-center mr-2.5 ${
                activeMode === "WFH" || isGeofenceExempt
                  ? "bg-indigo-50 border border-indigo-200"
                  : isWithinGeofence ? "bg-[#E7FAEE] border border-[#1FAE5C]/20" : "bg-[#FDE9E8] border border-[#E4453C]/20"
              }`}>
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
                    ? "Field / Sales Status"
                    : `${activeBranchName} (${allowedRadiusMeters}m)`}
                </Text>
                <Text className="text-[10px] font-semibold text-[#7A76A6]">
                  {activeMode === "WFH"
                    ? "Geofence Exempt • Remote GPS breadcrumb logged"
                    : isGeofenceExempt
                    ? `Geofence Exempt • Location logged for record${userDistance !== null ? ` (${userDistance}m from nearest branch)` : ""}`
                    : isVerifying && !hasInitialFix
                    ? "Verifying GPS fix..."
                    : `Current distance: ${userDistance !== null ? userDistance : "--"}m`}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => checkLiveLocation()}
              className="w-8 h-8 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5] items-center justify-center active:bg-[#EEECFA]"
            >
              <RefreshCw size={14} color="#5B4FD1" />
            </TouchableOpacity>
          </View>

          <View className={`p-2.5 rounded-2xl flex-row items-center ${
            activeMode === "WFH" || isGeofenceExempt
              ? "bg-indigo-50 border border-indigo-200/60"
              : isWithinGeofence ? "bg-[#E7FAEE] border border-[#1FAE5C]/30" : "bg-[#FDE9E8] border border-[#E4453C]/30"
          }`}>
            {activeMode === "WFH" ? (
              <>
                <CheckCircle2 size={15} color="#5B4FD1" />
                <Text className="text-xs font-bold text-[#5B4FD1] ml-2">
                  WFH Active: Remote selfie will register presence.
                </Text>
              </>
            ) : isGeofenceExempt ? (
              <>
                <CheckCircle2 size={15} color="#5B4FD1" />
                <Text className="text-xs font-bold text-[#5B4FD1] ml-2">
                  Field Role: Punch allowed from any location.
                </Text>
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

          {!permission?.granted ? (
            <View className="w-64 h-64 rounded-full border-2 border-dashed border-[#5B4FD1] bg-[#F6F5FC] items-center justify-center p-4">
              <CameraIcon size={26} color="#5B4FD1" />
              <Text className="text-xs font-black text-[#1F1B3D] mt-2 text-center">Camera Access Required</Text>
              <TouchableOpacity
                onPress={requestPermission}
                className="bg-[#5B4FD1] px-3 py-1.5 rounded-full mt-2.5 active:opacity-90 shadow-xs"
              >
                <Text className="text-white text-[10px] font-black uppercase">Grant Access</Text>
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
                    disabled={isRestarting}
                    style={{ opacity: isRestarting ? 0.6 : 1 }}
                    className="bg-amber-500 px-4 py-2.5 rounded-2xl flex-row items-center active:opacity-90 shadow-xs"
                  >
                    {isRestarting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Undo2 size={14} color="#FFFFFF" />
                    )}
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
                <CameraErrorBoundary
                  onReset={() => {
                    setCameraReady(false);
                    setCameraError(null);
                    setCameraKey((prev) => prev + 1);
                  }}
                >
                  {isFocused && permission?.granted && !capturedPhotoUri && !cameraError && (
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
                      <TouchableOpacity
                        onPress={() => {
                          setCameraError(null);
                          setCameraReady(false);
                          setCameraKey((prev) => prev + 1);
                        }}
                        className="mt-3 bg-white/20 px-4 py-2 rounded-full"
                      >
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
                  disabled={isCapturing || isSyncing || !cameraReady}
                  className="absolute bottom-4 w-12 h-12 rounded-full bg-white/90 border-2 border-[#1FAE5C] items-center justify-center active:scale-95 shadow-md z-10"
                  style={{ opacity: cameraReady ? 1 : 0.5 }}
                >
                  {isCapturing || isSyncing ? (
                    <ActivityIndicator color="#1FAE5C" size="small" />
                  ) : (
                    <CameraIcon size={18} color="#1FAE5C" />
                  )}
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
                <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
                  80-Min Break Allowance
                </Text>
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
                {/* Live break timer — shown only once a break has actually
                    been started, directly above the End Break button. */}
                <View className="items-center py-3 mb-3 bg-amber-50 rounded-2xl border border-amber-200">
                  <Text className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-0.5">
                    {activeBreakType || "Break"} started at {activeBreakStartTime || "--:--"}
                  </Text>
                  <Text className="text-2xl font-black text-amber-700 tracking-widest font-mono">
                    {formatWorkingHours(breakElapsedSeconds)}
                  </Text>
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
                      <Text className="text-xs font-black text-white ml-2 uppercase tracking-wider">
                        Ending Break...
                      </Text>
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
              <Text className="text-[10px] font-black text-emerald-300 uppercase tracking-wider">
                Target: 8h
              </Text>
            </View>
          </View>

          {attendanceState !== "NOT_CHECKED_IN" && (
            <View className="items-center py-2.5 mb-3 bg-white/10 rounded-2xl border border-white/10">
              <Text className="text-[10px] font-bold text-[#A6A2CE] uppercase tracking-widest mb-0.5">
                {attendanceState === "ON_BREAK" ? "Shift Paused (On Break)" : "Active Working Hours"}
              </Text>
              <Text className="text-2xl font-black text-white tracking-widest font-mono">
                {formatWorkingHours(workedSeconds)}
              </Text>
              <Text className="text-[9.5px] font-medium text-white/70 mt-1">
                Grace: 5 mins • Break Bank: 80 mins
              </Text>
            </View>
          )}

          <View className="flex-row justify-between items-center divide-x divide-white/10">
            <View className="flex-1 items-center px-2">
              <Text className="text-[10px] font-bold text-[#A6A2CE] uppercase tracking-widest mb-1">
                Checked In At
              </Text>
              <Text className="text-xl md:text-2xl font-black text-white tracking-tight">
                {checkInTime || "--:--"}
              </Text>
              <View className="bg-emerald-500/20 px-2 py-0.5 rounded-full mt-1.5">
                <Text className="text-[9.5px] font-black text-emerald-400 uppercase">
                  {checkInTime ? (attendanceState === "ON_BREAK" ? "Paused" : "Active Shift") : "Awaiting Photo"}
                </Text>
              </View>
            </View>

            <View className="flex-1 items-center px-2">
              <Text className="text-[10px] font-bold text-[#A6A2CE] uppercase tracking-widest mb-1">
                Checked Out At
              </Text>
              <Text className="text-xl md:text-2xl font-black text-white/80 tracking-tight">
                {checkOutTime || "--:--"}
              </Text>
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
              <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">
                Total: {usedBreakMinutes} mins
              </Text>
            </View>

            <View className="space-y-2 gap-2">
              {breakHistory.map((item, index) => (
                <View
                  key={item.id || index}
                  className="flex-row items-center justify-between p-3 bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl"
                >
                  <View className="flex-row items-center gap-2.5">
                    <View className={`w-8 h-8 rounded-xl items-center justify-center ${
                      item.type === "LUNCH" ? "bg-amber-100 border border-amber-200" : "bg-[#EEECFA] border border-[#5B4FD1]/20"
                    }`}>
                      {item.type === "LUNCH" ? <Utensils size={14} color="#D97706" /> : <Coffee size={14} color="#5B4FD1" />}
                    </View>
                    <View>
                      <Text className="text-xs font-bold text-[#1F1B3D]">{item.title}</Text>
                      <Text className="text-[10px] font-semibold text-[#7A76A6]">{item.startTime} - {item.endTime}</Text>
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
              <Text className="text-base font-black text-[#1F1B3D] text-center mb-1">
                Select Break Category
              </Text>
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