import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Battery from "expo-battery";
import { BASE_HOST } from "../constants/config";

export const SHIFT_LOCATION_TASK = "BACKGROUND_HOURLY_LOCATION_TASK";

// Unified with your LiveTrackingScreen base URL
const API_URL = `${BASE_HOST}/api/attendance/location-ping`;

// 1. Task Definition (Must run at root bundle level)
TaskManager.defineTask(SHIFT_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error("Background task error:", error);
    return;
  }

  if (data && data.locations) {
    const loc = data.locations[data.locations.length - 1];
    if (!loc) return;

    try {
      const empId = await AsyncStorage.getItem("active_tracking_emp_id");
      const isShiftActive = await AsyncStorage.getItem("is_shift_tracking_active");

      // Guard: Only ping if shift is verified active
      if (!empId || isShiftActive !== "true") return;

      let batteryLvl: number | null = null;
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (level >= 0) batteryLvl = Math.round(level * 100);
      } catch {
        batteryLvl = null;
      }

      // Allow 45s for Render free-tier cold starts
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const payload = {
        empId,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracyMeters: loc.coords.accuracy ? Math.round(loc.coords.accuracy) : 10,
        batteryPercentage: batteryLvl,
        isMock: !!(loc.mocked || (loc as any).isFromMockProvider),
        time: new Date().toISOString(), // Required for LiveTrackingScreen audit trail
      };

      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (err: any) {
      console.warn("Could not dispatch background ping:", err.message);
    }
  }
});

// 2. Start Tracking (Call this on Punch In)
export async function startShiftTracking(empId: string) {
  await AsyncStorage.setItem("active_tracking_emp_id", empId);
  await AsyncStorage.setItem("is_shift_tracking_active", "true");

  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") {
    throw new Error("Foreground location permission denied");
  }

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== "granted") {
    throw new Error("Background location permission denied");
  }

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(SHIFT_LOCATION_TASK);
  if (!hasStarted) {
    await Location.startLocationUpdatesAsync(SHIFT_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 3600000,          // 1 hour (3,600,000 ms)
      distanceInterval: 50,          // Wake up if displaced by 50 meters
      deferredUpdatesInterval: 3600000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Shift Tracking Active",
        notificationBody: "Logging periodic location for your shift.",
        notificationColor: "#5B4FD1",
      },
    });
  }
}

// 3. Stop Tracking (Call this on Punch Out)
export async function stopShiftTracking() {
  await AsyncStorage.setItem("is_shift_tracking_active", "false");
  await AsyncStorage.removeItem("active_tracking_emp_id");

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(SHIFT_LOCATION_TASK);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(SHIFT_LOCATION_TASK);
  }
}