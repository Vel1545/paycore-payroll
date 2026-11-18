import { Platform } from "react-native";
import * as Application from "expo-application";
import { DEVICE_VERIFICATION_ENABLED } from "../constants/config";

export type ClientInfo = { deviceId: string; platform: "MOBILE" | "WEB"; deviceModel: string };

// The id the server binds an employee to (device verification). Used by login and by the silent token renewal.
export const getClientInfo = async (empId?: string): Promise<ClientInfo> => {
  const base = await getBaseClientInfo();
  // TEST MODE: device verification OFF -> every Employee ID gets its own device record,
  // so one phone/browser can log in as many different IDs/roles as you want.
  if (!DEVICE_VERIFICATION_ENABLED && empId) {
    return { ...base, deviceId: `${base.deviceId}::${empId.trim().toUpperCase()}` };
  }
  return base;
};

const getBaseClientInfo = async (): Promise<ClientInfo> => {
  if (Platform.OS === "web") {
    let browserId = typeof window !== "undefined" ? window.localStorage.getItem("paycore_web_client_id") : null;
    if (!browserId) {
      browserId = "WEB-" + Math.random().toString(36).substring(2, 12) + "-" + Date.now();
      if (typeof window !== "undefined") {
        window.localStorage.setItem("paycore_web_client_id", browserId);
      }
    }
    return {
      deviceId: browserId,
      platform: "WEB",
      deviceModel: typeof navigator !== "undefined" ? navigator.userAgent.substring(0, 50) : "Browser",
    };
  }

  // Native Mobile (Android / iOS)
  const mobileId = Platform.OS === "android"
    ? Application.getAndroidId()
    : await Application.getIosIdForVendorAsync();

  return {
    deviceId: mobileId || "unknown-mobile",
    platform: "MOBILE",
    deviceModel: `${Platform.OS}-${Platform.Version}`,
  };
};
