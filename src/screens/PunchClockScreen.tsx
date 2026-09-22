import React, { useState, useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Alert, 
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
  Home 
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";
import { UserSession } from "../services/UserSession";
import { startHourlyTracking, stopHourlyTracking } from "../services/shiftTrackingManager";

interface PunchClockScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    canGoBack?: () => boolean;
  };
}

type PunchState = "NOT_CHECKED_IN" | "WORKING" | "ON_BREAK" | "CHECKED_OUT";

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

const API_BASE_URL = Platform.select({
  web: "http://localhost:8080/api/attendance",
  android: "http://10.0.2.2:8080/api/attendance",
  default: "http://192.168.31.228:8080/api/attendance"
});

export default function PunchClockScreen({ navigation }: PunchClockScreenProps) {
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [currentTimeIST, setCurrentTimeIST] = useState("");
  const [currentDateIST, setCurrentDateIST] = useState("");
  const [userDistance, setUserDistance] = useState<number | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Dynamic Geofence Configuration from user_configs
  const [activeBranchName, setActiveBranchName] = useState<string>("Assigned Office");
  const [geofenceRules, setGeofenceRules] = useState<GeofenceConfig[]>([]);
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState<number>(200);

  // Live Location & Anti-Spoofing
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isMockLocation, setIsMockLocation] = useState(false);

  // Mode & Attendance State
  const [activeMode, setActiveMode] = useState<AttendanceMode>("OFFICE");
  const [attendanceState, setAttendanceState] = useState<PunchState>("NOT_CHECKED_IN");
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null);

  // Live Working Hours Tracking
  const [workedSeconds, setWorkedSeconds] = useState(0);
  const effectiveStartRef = useRef<Date | null>(null);
  const breakSecondsRef = useRef<number>(0);
  type AttendanceMode = "OFFICE" | "WFH" | "SALES";

  // 80 Min Break Policy Pool
  const TOTAL_BREAK_LIMIT_MINS = 80;
  const [usedBreakMinutes, setUsedBreakMinutes] = useState(0);
  const [activeBreakType, setActiveBreakType] = useState<string | null>(null);
  const [activeBreakStartTime, setActiveBreakStartTime] = useState<string | null>(null);
  const [activeBreakRawStart, setActiveBreakRawStart] = useState<Date | null>(null);
  const [isBreakModalVisible, setIsBreakModalVisible] = useState(false);
  const [breakHistory, setBreakHistory] = useState<BreakSessionItem[]>([]);

  const EMP_ID = UserSession.empId || "EMP1042";
  

  // Haversine Distance Calculation (in Meters)
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



  const evaluateGeofence = (lat: number, lng: number, branches: GeofenceConfig[]) => {
    if (activeMode === "WFH") {
      setIsWithinGeofence(true);
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

  // ADD getFormattedIST HERE:
  const getFormattedIST = () =>
    new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const syncServerTimeIST = () => {
    const now = new Date();
    setCurrentTimeIST(
      now.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: true,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
    setCurrentDateIST(
      now.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    );
  };

  const checkLiveLocation = async (rulesOverride?: GeofenceConfig[]) => {
    setIsVerifying(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "GPS Location access is mandatory to punch attendance.");
        setIsVerifying(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const currentLat = location.coords.latitude;
      const currentLng = location.coords.longitude;

      setUserCoords({ latitude: currentLat, longitude: currentLng });
      setIsMockLocation(location.mocked || false);

      evaluateGeofence(currentLat, currentLng, rulesOverride || geofenceRules);
    } catch (error) {
      console.warn("GPS lock failed:", error);
    } finally {
      setIsVerifying(false);
    }
  };

  // Hydrate Initial Shift & Break State
  const fetchTodayAttendanceState = async () => {
    try {
      setIsSyncing(true);
      const response = await fetch(`${API_BASE_URL}/today?empId=${EMP_ID}`);
      if (!response.ok) return;
      const data = await response.json();

      let parsedBranches: GeofenceConfig[] = [];
      if (data.config?.geofence_config_json) {
        const rawConfig = typeof data.config.geofence_config_json === "string"
          ? JSON.parse(data.config.geofence_config_json)
          : data.config.geofence_config_json;

        parsedBranches = Array.isArray(rawConfig) ? rawConfig : [rawConfig];
        setGeofenceRules(parsedBranches);

        if (parsedBranches.length > 0) {
          setActiveBranchName(parsedBranches[0].branch_name || "Office HQ");
          setAllowedRadiusMeters(parsedBranches[0].radius_meters || 200);
        }
      }

      await checkLiveLocation(parsedBranches);

if (data.work_mode) {
  if (data.work_mode === "SALES") {
    setActiveMode("SALES");
  } else if (data.work_mode === "WFH") {
    setActiveMode("WFH");
  } else {
    setActiveMode("OFFICE");
  }
}

      const totalBreakMins = data.break_minutes || 0;
      setUsedBreakMinutes(totalBreakMins);
      breakSecondsRef.current = totalBreakMins * 60;

      if (data.break_history_json) {
        const parsedHistory = typeof data.break_history_json === "string" 
          ? JSON.parse(data.break_history_json) 
          : data.break_history_json;
        if (Array.isArray(parsedHistory)) {
          setBreakHistory(parsedHistory);
        }
      }

      // Check In State Restoration
      if (data.first_punch_in) {
        const inDate = new Date(data.first_punch_in);
        setCheckInTime(inDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }));

        // Shift clamping logic: calculation starts at shift_start if arrived earlier
        if (data.config?.shift_start) {
          const [sH, sM] = data.config.shift_start.split(":").map(Number);
          const shiftStartDate = new Date(inDate);
          shiftStartDate.setHours(sH, sM, 0, 0);
          effectiveStartRef.current = inDate < shiftStartDate ? shiftStartDate : inDate;
        } else {
          effectiveStartRef.current = inDate;
        }

        // Clean hierarchy: Checked Out > On Break > Working
        if (data.last_punch_out) {
          const outDate = new Date(data.last_punch_out);
          setCheckOutTime(outDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }));
          setAttendanceState("CHECKED_OUT");
        } else if (data.is_on_break) {
  setAttendanceState("ON_BREAK");

  // RESTORE THE ACTIVE BREAK START TIME FROM BACKEND
  if (data.active_break_start_time || data.current_break?.startTime) {
    const rawStartStr = data.active_break_start_time || data.current_break.startTime;
    setActiveBreakStartTime(rawStartStr);

    // If backend returns a full ISO date or timestamp, parse it:
    if (data.active_break_raw_start) {
      setActiveBreakRawStart(new Date(data.active_break_raw_start));
    } else {
      // Fallback: parse standard 12-hour/24-hour time for today's date
      const [timePart, modifier] = rawStartStr.split(" ");
      let [hours, minutes] = timePart.split(":").map(Number);
      if (modifier?.toLowerCase() === "pm" && hours < 12) hours += 12;
      if (modifier?.toLowerCase() === "am" && hours === 12) hours = 0;
      
      const parsedStart = new Date();
      parsedStart.setHours(hours, minutes, 0, 0);
      setActiveBreakRawStart(parsedStart);
    }
  }

  if (data.active_break_title || data.current_break?.title) {
    setActiveBreakType(data.active_break_title || data.current_break.title);
  }
} else {
  setAttendanceState("WORKING");
}

        // Calculate live worked time immediately upon reopening
        const now = new Date();
        const grossElapsedSec = Math.max(0, Math.floor((now.getTime() - effectiveStartRef.current.getTime()) / 1000));
        setWorkedSeconds(Math.max(0, grossElapsedSec - breakSecondsRef.current));
      } else {
        setAttendanceState("NOT_CHECKED_IN");
        setWorkedSeconds(0);
      }
    } catch (error) {
      console.warn("Initial attendance fetch skipped/failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Mount and AppState Foreground Watcher
  useEffect(() => {
    syncServerTimeIST();
    fetchTodayAttendanceState();

    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        fetchTodayAttendanceState();
      }
    });

    const clockTimer = setInterval(syncServerTimeIST, 1000);

    return () => {
      sub.remove();
      clearInterval(clockTimer);
    };
  }, []);

  useEffect(() => {
  const restoreLocalBreakState = async () => {
    const savedRawStart = await AsyncStorage.getItem("active_break_raw_start");
    const savedTime = await AsyncStorage.getItem("active_break_start_time");
    const savedType = await AsyncStorage.getItem("active_break_type");

    if (savedRawStart && savedTime) {
      setActiveBreakRawStart(new Date(savedRawStart));
      setActiveBreakStartTime(savedTime);
      if (savedType) setActiveBreakType(savedType);
    }
  };

  restoreLocalBreakState();
}, []);

  // Single Accurate Working Hours Timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    if (attendanceState === "WORKING" && effectiveStartRef.current) {
      timer = setInterval(() => {
        const now = new Date();
        const grossElapsedSec = Math.max(0, Math.floor((now.getTime() - effectiveStartRef.current!.getTime()) / 1000));
        const net = Math.max(0, grossElapsedSec - breakSecondsRef.current);
        setWorkedSeconds(net);
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [attendanceState]);

  useEffect(() => {
    if (userCoords) {
      evaluateGeofence(userCoords.latitude, userCoords.longitude, geofenceRules);
    }
  }, [activeMode]);

  // Formats worked seconds into HH:MM:SS
  const formatWorkingHours = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  // Formats break durations to exact minutes and seconds
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

  const isPunchEligible = activeMode === "WFH" ? true : isWithinGeofence;

// 1. Define the shape of your backend JSON response
interface PunchResponsePayload {
  status: string;
  statusCode?: number;
  workMode?: string;
  punchId?: string;
  message?: string;
  [key: string]: any;
}

// 2. Add the return type: Promise<PunchResponsePayload | null>
const executePunchAPI = async (
  type: "CHECK_IN" | "CHECK_OUT"
): Promise<PunchResponsePayload | null> => {
  try {
    setIsSyncing(true);

    const ticketRes = await fetch(
      `${API_BASE_URL}/upload-ticket?empId=${EMP_ID}&punchType=${type}`
    );
    const ticketData = await ticketRes.json();
    const cloudKey = ticketData.cloudKey || `selfies/${Date.now()}-${type}.jpg`;

    const effectiveMode =
      activeMode === "SALES" ? "SALES" : activeMode === "WFH" ? "WFH" : "IN_OFFICE";

    const payload = {
      empId: EMP_ID,
      punchType: type,
      selectedMode: effectiveMode,
      latitude: userCoords?.latitude || 0,
      longitude: userCoords?.longitude || 0,
      selfieCloudKey: cloudKey,
      deviceId: `${Platform.OS}-${Platform.Version}`,
      mockLocation: isMockLocation,
    };

    const punchRes = await fetch(`${API_BASE_URL}/punch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result: PunchResponsePayload = await punchRes.json();
    if (!punchRes.ok) {
      throw new Error(result.message || "Failed to record attendance punch.");
    }

    const modeTitle =
      effectiveMode === "WFH"
        ? "Work-From-Home"
        : effectiveMode === "SALES"
        ? "Sales Field Visit"
        : `${activeBranchName} In-Premises`;

    const msg = `Successfully ${type === "CHECK_IN" ? "Checked In" : "Checked Out"} at ${currentTimeIST} via ${modeTitle}.`;
    Platform.OS === "web" ? window.alert(msg) : Alert.alert("Punch Recorded", msg);

    setCapturedPhotoUri(null);
    await fetchTodayAttendanceState();

    // Make sure result is returned
    return result;
  } catch (error: any) {
    const errorMsg = error.message || "Attendance request failed. Verify network connection.";
    Platform.OS === "web" ? window.alert(errorMsg) : Alert.alert("Attendance Error", errorMsg);
    return null;
  } finally {
    setIsSyncing(false);
  }
};

  // Handle Selfie Camera Capture
  const handleTakeSelfie = async () => {
    if (!cameraRef.current) return;

    if (!isPunchEligible) {
      const msg = `Geofence violation: You are ${userDistance}m away from ${activeBranchName}. Must be within ${allowedRadiusMeters}m to clock in.`;
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Location Error", msg);
      return;
    }

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      });
      setCapturedPhotoUri(photo.uri);

if (attendanceState === "NOT_CHECKED_IN") {
  const response = await executePunchAPI("CHECK_IN");

  if (response?.status === "SUCCESS") {
    await startHourlyTracking(
      EMP_ID,
      response.workMode || activeMode
    );
  }
}
    } catch (err) {
      const msg = "Could not capture front photo. Please try again.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Camera Error", msg);
    } finally {
      setIsCapturing(false);
    }
  };

  // Final Departure Check-Out Handler
const handleCheckOut = async () => {
  if (!capturedPhotoUri) {
    const msg = "Please take a verification selfie before checking out.";
    Platform.OS === "web" ? window.alert(msg) : Alert.alert("Selfie Required", msg);
    return;
  }

  if (!isPunchEligible) {
    const msg = `Geofence violation: You are ${userDistance}m away from ${activeBranchName}. Must be within ${allowedRadiusMeters}m.`;
    Platform.OS === "web" ? window.alert(msg) : Alert.alert("Location Error", msg);
    return;
  }

  try {
    // Corrected from "CHECKED_IN" to "WORKING"
    if (attendanceState === "WORKING") {
      const response: any = await executePunchAPI("CHECK_OUT");
      if (response?.status === "SUCCESS") {
        await stopHourlyTracking();
      }
    }
  } catch (err) {
    console.warn("Check-out failed:", err);
  }
};

// Start Break
  const handleStartBreak = async (breakName: string) => {
    const startNow = new Date();
    const bType = breakName.toLowerCase().includes("lunch") ? "LUNCH" : "TEA";
    
    // Use fallback in case currentTimeIST has not populated yet
    const timeStr = currentTimeIST || getFormattedIST();

    setActiveBreakType(breakName);
    setActiveBreakStartTime(timeStr);
    setActiveBreakRawStart(startNow);
    setAttendanceState("ON_BREAK");
    setIsBreakModalVisible(false);

    // Persist break start state locally
    await AsyncStorage.setItem("active_break_raw_start", startNow.toISOString());
    await AsyncStorage.setItem("active_break_start_time", timeStr);
    await AsyncStorage.setItem("active_break_type", breakName);

    try {
      await fetch(`${API_BASE_URL}/break/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: EMP_ID,
          breakType: bType,
          breakTitle: breakName,
          startTime: timeStr,
          durationMinutes: 0,
        }),
      });
    } catch (error) {
      console.warn("Could not sync break start with server:", error);
    }
  };

  // End Break (Tracks exact seconds and avoids stale-state race conditions)
  const handleEndBreak = async () => {
    const endNow = new Date();
    const startObj = activeBreakRawStart || endNow;
    
    const totalElapsedSec = Math.max(1, Math.floor((endNow.getTime() - startObj.getTime()) / 1000));
    const exactMinutes = Math.floor(totalElapsedSec / 60);

    const breakType = activeBreakType?.toLowerCase().includes("lunch") ? "LUNCH" : "TEA";
    const breakTitle = activeBreakType || "Personal Break";
    const startTimeStr = activeBreakStartTime || currentTimeIST;

    try {
      setIsSyncing(true);
      const payload = {
        empId: EMP_ID,
        breakType,
        breakTitle,
        startTime: startTimeStr,
        endTime: currentTimeIST,
        durationMinutes: exactMinutes,
        durationSeconds: totalElapsedSec
      };

      const res = await fetch(`${API_BASE_URL}/break/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Could not sync break session with server.");
      }

     const resData = await res.json();

      // 1. Immediately switch UI state to WORKING so the button toggles back
      setAttendanceState("WORKING");
      setActiveBreakType(null);
      setActiveBreakStartTime(null);
      setActiveBreakRawStart(null);

      // Clear local storage so stale timestamps don't persist on next break
      await AsyncStorage.multiRemove([
        "active_break_raw_start",
        "active_break_start_time",
        "active_break_type",
      ]);

      // 2. Accumulate exact seconds and update minutes
      breakSecondsRef.current += totalElapsedSec;
      const totalBreaksFromBackend = resData.totalBreakMinutes !== undefined 
        ? resData.totalBreakMinutes 
        : Math.floor(breakSecondsRef.current / 60);
      setUsedBreakMinutes(totalBreaksFromBackend);

      // 3. Immediately recalculate net worked seconds
      if (effectiveStartRef.current) {
        const now = new Date();
        const grossElapsedSec = Math.max(0, Math.floor((now.getTime() - effectiveStartRef.current.getTime()) / 1000));
        setWorkedSeconds(Math.max(0, grossElapsedSec - breakSecondsRef.current));
      }

      // 4. Update local history log with exact seconds
      const newSession: BreakSessionItem = {
        id: resData.breakId || Date.now().toString(),
        title: breakTitle,
        startTime: startTimeStr,
        endTime: currentTimeIST || getFormattedIST(),
        durationMinutes: exactMinutes,
        durationSeconds: totalElapsedSec,
        type: breakType,
      };
      setBreakHistory((prev) => [...prev, newSession]);

    } catch (error: any) {
      Alert.alert("Break Sync Failed", error.message || "Network issue.");
    } finally {
      setIsSyncing(false);
    }
  };

  const remainingBreakMinutes = Math.max(0, TOTAL_BREAK_LIMIT_MINS - usedBreakMinutes);

  return (
    <ScreenContainer>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ========================================================================= */}
        {/* 1. TOP PURPLE BANNER HEADER                                               */}
        {/* ========================================================================= */}
        <View className="bg-[#5B4FD1] rounded-3xl pt-3 pb-4 px-4 mb-4 shadow-xs relative overflow-hidden">
          <View 
            className="absolute -top-3 -right-4 w-20 h-20 rounded-3xl border-2 border-white/20 pointer-events-none"
            style={{ transform: [{ rotate: "20deg" }] }}
          />
          <View 
            className="absolute top-12 -left-6 w-16 h-16 rounded-2xl border-2 border-white/10 pointer-events-none"
            style={{ transform: [{ rotate: "-15deg" }] }}
          />

          <View className="flex-row items-center justify-between mb-3">
            <TouchableOpacity 
              onPress={() => (navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate("Home"))}
              className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center active:opacity-80"
            >
              <ChevronLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View className="flex-row items-center gap-1.5">
              <View className="bg-white/20 px-3 py-1 rounded-full border border-white/25 flex-row items-center">
                <ShieldCheck size={12} color="#FFFFFF" />
                <Text className="text-[10px] font-black text-white ml-1 uppercase tracking-wider">
                  NTP Live Synced
                </Text>
              </View>
            </View>
          </View>

          <View className="items-center">
            <Text className="text-xl md:text-2xl font-black text-white tracking-tight">
              Biometric Punch Clock
            </Text>
            <Text className="text-xs font-semibold text-white/80 mt-0.5 text-center">
              {activeMode === "WFH" ? "Remote Presence • GPS & Selfie Verification" : "Geofenced GPS & Live Camera Attendance"}
            </Text>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 2. SLIDING SEGMENTED SWITCH: OFFICE MODE vs WORK-FROM-HOME (WFH)           */}
        {/* ========================================================================= */}
        <View className="bg-white border border-[#E7E4F5] rounded-3xl p-2 mb-4 shadow-xs">
          <View className="flex-row bg-[#F6F5FC] p-1 rounded-2xl border border-[#E7E4F5]">
            <TouchableOpacity
              onPress={() => setActiveMode("OFFICE")}
              disabled={attendanceState !== "NOT_CHECKED_IN"}
              className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center transition-all ${
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
              className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center transition-all ${
                activeMode === "WFH" ? "bg-[#5B4FD1] shadow-sm" : ""
              } ${attendanceState !== "NOT_CHECKED_IN" ? "opacity-75" : ""}`}
            >
              <Home size={14} color={activeMode === "WFH" ? "#FFFFFF" : "#7A76A6"} />
              <Text className={`text-xs font-black ml-1.5 ${activeMode === "WFH" ? "text-white" : "text-[#7A76A6]"}`}>
                Work From Home
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 3. GEOFENCE / WFH PERIMETER MONITOR                                       */}
        {/* ========================================================================= */}
        <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 mb-4 shadow-xs">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View className={`w-9 h-9 rounded-xl items-center justify-center mr-2.5 ${
                activeMode === "WFH"
                  ? "bg-indigo-50 border border-indigo-200"
                  : isWithinGeofence 
                    ? "bg-[#E7FAEE] border border-[#1FAE5C]/20" 
                    : "bg-[#FDE9E8] border border-[#E4453C]/20"
              }`}>
                {activeMode === "WFH" ? (
                  <Home size={18} color="#5B4FD1" />
                ) : (
                  <MapPin size={18} color={isWithinGeofence ? "#1FAE5C" : "#E4453C"} />
                )}
              </View>
              <View>
                <Text className="text-xs font-black text-[#1F1B3D]">
                  {activeMode === "WFH" ? "Work-From-Home Status" : `${activeBranchName} (${allowedRadiusMeters}m)`}
                </Text>
                <Text className="text-[10px] font-semibold text-[#7A76A6]">
                  {activeMode === "WFH"
                    ? "Geofence Exempt • Remote GPS breadcrumb logged"
                    : isVerifying 
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
            activeMode === "WFH"
              ? "bg-indigo-50 border border-indigo-200/60"
              : isWithinGeofence 
                ? "bg-[#E7FAEE] border border-[#1FAE5C]/30" 
                : "bg-[#FDE9E8] border border-[#E4453C]/30"
          }`}>
            {activeMode === "WFH" ? (
              <>
                <CheckCircle2 size={15} color="#5B4FD1" />
                <Text className="text-xs font-bold text-[#5B4FD1] ml-2">
                  WFH Active: Remote selfie will register presence.
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

        {/* ========================================================================= */}
        {/* 4. LIVE SELFIE CAMERA & RETAKE CONTAINER                                  */}
        {/* ========================================================================= */}
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
            <View className="w-64 h-64 rounded-full bg-[#E7FAEE] border-4 border-[#1FAE5C] items-center justify-center p-4">
              <CheckCircle2 size={48} color="#1FAE5C" />
              <Text className="text-base font-black text-[#1F1B3D] mt-2">Shift Completed</Text>
              <Text className="text-xs text-[#7A76A6] font-semibold">See you tomorrow!</Text>
            </View>
          ) : !capturedPhotoUri ? (
            <View className="relative items-center justify-center my-2">
              <View className="w-72 h-72 rounded-full border-4 border-[#1FAE5C] bg-black overflow-hidden relative items-center justify-center shadow-md">
                <CameraView ref={cameraRef} facing="front" style={{ width: "100%", height: "100%" }} />
                
                <TouchableOpacity
                  onPress={handleTakeSelfie}
                  disabled={isCapturing || isSyncing}
                  className="absolute bottom-4 w-12 h-12 rounded-full bg-white/90 border-2 border-[#1FAE5C] items-center justify-center active:scale-95 shadow-md"
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

        {/* ========================================================================= */}
        {/* 5. DYNAMIC BREAK MANAGEMENT (80 MIN POOL & TIMER PAUSE)                   */}
        {/* ========================================================================= */}
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

            {/* Progress Bar */}
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
              <TouchableOpacity
                onPress={handleEndBreak}
                disabled={isSyncing}
                className="w-full py-3 bg-emerald-600 rounded-2xl flex-row items-center justify-center active:opacity-90 shadow-xs"
              >
                {isSyncing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Play size={14} color="#FFFFFF" />
                    <Text className="text-xs font-black text-white ml-2 uppercase tracking-wider">
                      End {activeBreakType || "Break"} & Resume Working Hours
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* 6. FINAL SHIFT CHECK-OUT ACTION BUTTON                                    */}
        {/* ========================================================================= */}
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

        {/* ========================================================================= */}
        {/* 7. ATTENDANCE & WORKING HOURS TIMING SUMMARY (ALWAYS VISIBLE)             */}
        {/* ========================================================================= */}
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
                Target: 7h 40m
              </Text>
            </View>
          </View>

          {/* Active Working Hours Ticker */}
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

        {/* ========================================================================= */}
        {/* 8. BREAK SESSIONS HISTORY LOG                                             */}
        {/* ========================================================================= */}
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

        {/* ========================================================================= */}
        {/* 9. BREAK SELECTION POPUP MODAL                                            */}
        {/* ========================================================================= */}
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