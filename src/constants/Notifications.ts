import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { BASE_HOST } from "../constants/config";

// Expo Go (SDK 53+) cannot do push notifications, and even loading expo-notifications there shows a red error.
// So the library is only loaded in a real build (APK / development build), never on web or in Expo Go.
export const PUSH_SUPPORTED =
  Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Notifications: typeof import("expo-notifications") = PUSH_SUPPORTED
  ? require("expo-notifications")
  : (null as any);

export function getNotificationsModule(): typeof import("expo-notifications") | null {
  return PUSH_SUPPORTED ? Notifications : null;
}

// Must match PushNotificationService.SHIFT_CHANNEL_ID on the backend.
// Android fixes a channel's sound when it is first created, so if you ever change the bell,
// use a new id (for example "shift-reminders-v2") on both sides.
export const SHIFT_CHANNEL_ID = "shift-reminders-v1";

// Announcement / chat / approval alerts. Android fixes a channel's sound when it is created,
// so there are two channels and the server picks one from the user's "sound" choice.
export const ALERT_SOUND_CHANNEL_ID = "alerts-sound-v1";
export const ALERT_SILENT_CHANNEL_ID = "alerts-silent-v1";

// Kept in step with the user's choice (set from useNotifications after each check)
let alertSoundEnabled = true;
export function setAlertSoundPreference(on: boolean) {
  alertSoundEnabled = on;
}

// The chat room that is open on screen right now ("" = none). A message for that room does not pop a banner
// (the chat screen plays its own soft sound and shows the message directly).
let activeChatRoom = "";
export function setActiveChatRoom(roomId: string) {
  activeChatRoom = roomId || "";
}

// Show the banner while the app is open. Shift reminders always ring; alerts follow the user's sound choice.
if (PUSH_SUPPORTED) Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = (notification.request.content.data as any)?.type;
    if (type === "CHAT" && activeChatRoom && (notification.request.content.data as any)?.roomId === activeChatRoom) {
      return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
    }
    const isAlert = type === "ANNOUNCEMENT" || type === "CHAT" || type === "APPROVAL";
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: isAlert ? alertSoundEnabled : true,
      shouldSetBadge: false,
    };
  },
});

// Call once after the user logs in. Returns true when notifications are allowed.
export async function setupShiftReminderNotifications(): Promise<boolean> {
  if (!PUSH_SUPPORTED) return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(SHIFT_CHANNEL_ID, {
      name: "Shift reminders",
      importance: Notifications.AndroidImportance.HIGH, // pop-up banner with sound
      sound: "bell.wav", // file listed under "sounds" in the expo-notifications plugin
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    await Notifications.setNotificationChannelAsync(ALERT_SOUND_CHANNEL_ID, {
      name: "Announcements, chat and approvals",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 200, 150, 200],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    await Notifications.setNotificationChannelAsync(ALERT_SILENT_CHANNEL_ID, {
      name: "Announcements, chat and approvals (silent)",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      enableVibrate: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  // Android 13+ and iPhone ask the user here
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === "granted";
}

// Plays a local test in 5 seconds (no backend needed): proves the channel and the bell sound work on this phone
export async function sendBellTest(): Promise<void> {
  if (!PUSH_SUPPORTED) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🔔 Bell test",
      body: "If you heard the bell, shift reminders will sound the same.",
      sound: "bell.wav",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: SHIFT_CHANNEL_ID,
    },
  });
}

// Gets this phone's push token and gives it to the server, so the server can notify this employee.
// Call after login (NotificationBell does it when the Home screen opens). Safe to call again and again.
export async function registerPushTokenWithServer(empId: string): Promise<void> {
  if (!PUSH_SUPPORTED || !empId) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    const status = perm.status === "granted" ? "granted" : (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;

    await fetch(`${BASE_HOST}/api/notifications/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empId, token, platform: Platform.OS }),
    });
  } catch (e) {
    console.warn("Could not register push token:", e);
  }
}