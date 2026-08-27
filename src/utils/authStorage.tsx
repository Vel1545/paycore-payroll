import AsyncStorage from "@react-native-async-storage/async-storage";

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

// Logout preserves the device verification flag so they only need Emp ID next time
export const clearActiveSessionOnly = async () => {
  await AsyncStorage.multiRemove(["jwt_token", SESSION_TOKEN_KEY]);
};

// Full wipe (e.g. app uninstall or unregister)
export const fullReset = async () => {
  await AsyncStorage.clear();
};