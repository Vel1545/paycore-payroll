
import { Platform } from "react-native";

const LOCAL_IP = process.env.EXPO_PUBLIC_LOCAL_IP || "scholarships-exterior-transcript-tractor.trycloudflare.com";
const PORT = process.env.EXPO_PUBLIC_API_PORT || "8080";
const PROD_URL = process.env.EXPO_PUBLIC_PROD_URL || "https://attendance.yourcompany.com";

const resolveBaseUrl = (): string => {
  // 1. Release APK build for all employees -> Always points to the common URL
  if (!__DEV__) {
    return PROD_URL;
  }

  // 2. Running on Laptop / Web Browser during development
  if (Platform.OS === "web") {
    return `http://localhost:${PORT}`;
  }

  // 3. Running locally on physical Android / iOS mobile
  return `http://${LOCAL_IP}:${PORT}`;
};

export const API_BASE_URL = resolveBaseUrl();
export const API_ATTENDANCE_URL = `${API_BASE_URL}/api/attendance`;

export default {
  API_BASE_URL,
  API_ATTENDANCE_URL,
};