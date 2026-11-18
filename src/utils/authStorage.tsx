import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserSession } from "../services/UserSession";
import { Platform } from "react-native";
import { stopShiftTracking } from "../services/shiftTrackingManager";
import { unregisterPushTokenFromServer } from "../constants/Notifications";
import { setAuthToken } from "../services/apiAuth";

const SESSION_TOKEN_KEY = "paycore_session_token";
const DEVICE_ID_KEY = "paycore_device_id";
const VERIFIED_EMP_ID_KEY = "paycore_verified_emp_id";

export const getOrCreateDeviceId = async (): Promise<string> => {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = "DEV-" + Math.random().toString(36).substring(2, 11).toUpperCase() + "-" + Date.now();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

export const saveUserSession = async (token: string, sessionToken: string, user: any) => {
  await AsyncStorage.setItem("jwt_token", token);
  await AsyncStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
  await AsyncStorage.setItem(VERIFIED_EMP_ID_KEY, user.empId);
  await AsyncStorage.setItem("user_profile", JSON.stringify(user));
};

export const getSavedSession = async () => {
  const sessionToken = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
  const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  const verifiedEmpId = await AsyncStorage.getItem(VERIFIED_EMP_ID_KEY);
  return { sessionToken, deviceId, verifiedEmpId };
};

// ---- Offline start: the last successful login, so the app opens straight to Home (even with no network).
// Saved only after the server accepted the login (OTP / direct login). The server still checks the device,
// the account and the token in the background (App.tsx) and logs the user out if any of them is refused.
const OFFLINE_SESSION_KEY = "paycore_offline_session";

export type OfflineSession = { empId: string; isAdmin: boolean; savedAt: number };

export const saveOfflineSession = async (empId: string, isAdmin: boolean): Promise<void> => {
  try {
    const data: OfflineSession = { empId: empId.trim().toUpperCase(), isAdmin: !!isAdmin, savedAt: Date.now() };
    await AsyncStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable: the next start just goes through the login screen */
  }
};

export const getOfflineSession = async (): Promise<OfflineSession | null> => {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_SESSION_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && typeof d.empId === "string" && d.empId ? { empId: d.empId, isAdmin: !!d.isAdmin, savedAt: Number(d.savedAt) || 0 } : null;
  } catch {
    return null;
  }
};

// Logout preserves the device verification flag so they only need Emp ID next time
export const clearActiveSessionOnly = async () => {
  // 0. Phone only: stop shift location tracking and stop this phone receiving the old user's notifications.
  //    Best effort - a slow or offline network never blocks the logout.
  if (Platform.OS !== "web") {
    await Promise.race([
      Promise.allSettled([stopShiftTracking(), unregisterPushTokenFromServer()]),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
  }

  try {
    // 1. Clear in-memory singleton and the login token sent with API calls
    if (UserSession?.clear) {
      UserSession.clear();
    }
    await setAuthToken(null);

    // 2. Clear Mobile storage
    await AsyncStorage.multiRemove([
      "jwt_token",
      SESSION_TOKEN_KEY,
      "paycore_remembered_emp_id", // Stops silent auto-login from triggering after logout
      OFFLINE_SESSION_KEY, // and the offline start
    ]);

    // 3. Clear Web storage (if user is on PC / Browser)
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.localStorage.removeItem("jwt_token");
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
      window.localStorage.removeItem("paycore_remembered_emp_id");
      window.localStorage.removeItem(OFFLINE_SESSION_KEY);
    }
  } catch (error) {
    console.warn("Error clearing session:", error);
  }
};

// Full wipe (e.g. app uninstall or unregister)
export const fullReset = async () => {
  await AsyncStorage.clear();
};