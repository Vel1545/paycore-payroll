import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Battery from "expo-battery";

export const SHIFT_LOCATION_TASK = "BACKGROUND_HOURLY_LOCATION_TASK";
const API_URL = "http://192.168.31.228:8080/api/attendance/location-ping";

TaskManager.defineTask(SHIFT_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error("Background task error:", error);
    return;
  }

  if (data && data.locations) {
    // Always grab the latest location in the array
    const loc = data.locations[data.locations.length - 1];
    if (!loc) return;

    try {
      const empId = await AsyncStorage.getItem("active_tracking_emp_id");
      const isShiftActive = await AsyncStorage.getItem("is_shift_tracking_active");

      // Guard: Only ping if shift is verified active
      if (!empId || isShiftActive !== "true") return;

      const batteryLvl = Math.round((await Battery.getBatteryLevelAsync()) * 100);

      // Timeout wrapper to prevent hanging background tasks
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracyMeters: loc.coords.accuracy || 10,
          batteryPercentage: batteryLvl > 0 ? batteryLvl : 85,
          isMock: loc.mocked || false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (err: any) {
      // It's normal for fetches to fail in the background (e.g., passing through a tunnel)
      // The task will retry on the next interval.
      console.warn("Could not dispatch background ping:", err.message);
    }
  }
});