// Which server the app talks to.
//  - APK builds (EAS profiles): EXPO_PUBLIC_API_URL from eas.json.
//  - OTA updates (`eas update`) do not read eas.json, so without EXPO_PUBLIC_API_URL:
//      test app (package ...payroll.test) -> TEST_HOST, every other release build / website -> PROD_HOST
//  - `npx expo start` on your laptop: DEV_HOST below (change it to your PC's Wi-Fi IP).
// Android release builds block plain http://, so these URLs must be https://.
import { Platform } from "react-native";
import * as Application from "expo-application";

const PROD_HOST = "https://frontend.brainmarq.com";
const TEST_HOST = "https://test.brainmarq.com";
const DEV_HOST = "http://192.168.31.229:8080";

const fromEnv = (process.env.EXPO_PUBLIC_API_URL || "").trim();
const isTestApp = Platform.OS !== "web" && (Application.applicationId || "").endsWith(".test");

export const BASE_HOST = (fromEnv || (__DEV__ ? DEV_HOST : isTestApp ? TEST_HOST : PROD_HOST)).replace(/\/+$/, "");

// Device lock (one employee = one phone, new phone needs OTP).
// ON in every release build, OFF while developing so one phone can log in as many IDs.
// Override with EXPO_PUBLIC_DEVICE_VERIFICATION="true" / "false" in eas.json if needed.
const deviceFlag = (process.env.EXPO_PUBLIC_DEVICE_VERIFICATION || "").trim().toLowerCase();
export const DEVICE_VERIFICATION_ENABLED = deviceFlag ? deviceFlag === "true" : !__DEV__;
