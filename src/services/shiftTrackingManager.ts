import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SHIFT_LOCATION_TASK } from "./locationTrackingTask";

export async function startHourlyTracking(empId: string, workMode: string) {
  // Guard: Only track field staff (SALES) or approved remote (WFH)
  if (workMode !== "SALES" && workMode !== "WFH") return;

  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== "granted") {
    console.warn("Foreground location denied");
    return;
  }

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== "granted") {
    console.warn("Background location denied");
    return;
  }

  await AsyncStorage.setItem("active_tracking_emp_id", empId);
  await AsyncStorage.setItem("is_shift_tracking_active", "true");

  const isStarted = await Location.hasStartedLocationUpdatesAsync(SHIFT_LOCATION_TASK);
  if (isStarted) return; // Prevent double-registration

  // Configure OS Hardware Location Engine
  await Location.startLocationUpdatesAsync(SHIFT_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 3600000,           // 1 hour
    distanceInterval: 100,           // OR 100 meters traveled
    deferredUpdatesInterval: 3600000, 
    foregroundService: {
      notificationTitle: "Workforce Shift Active",
      notificationBody: "Live location verification is active during your shift.",
      notificationColor: "#5B4FD1",
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
}

export async function stopHourlyTracking() {
  await AsyncStorage.setItem("is_shift_tracking_active", "false");
  
  const isStarted = await Location.hasStartedLocationUpdatesAsync(SHIFT_LOCATION_TASK);
  if (isStarted) {
    await Location.stopLocationUpdatesAsync(SHIFT_LOCATION_TASK);
  }
}