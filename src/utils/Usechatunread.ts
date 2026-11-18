import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { BASE_HOST } from "../constants/config";
import { getNotificationsModule, PUSH_SUPPORTED } from "../constants/Notifications";
import { playChatSound } from "./chatSound";

const API = `${BASE_HOST}/api/workspace`;
const POLL_MS = 8000;

/**
 * Unread chat messages for one employee: { total, rooms }.
 *  - refreshes every 8 seconds while the app is open
 *  - sets the number on the phone's app icon
 *  - on web / Expo Go (where no push arrives) it also plays the chat sound when the number goes up
 * Use it on the Home screen (badge on the Chats icon) and in the chat room list.
 */
export function useChatUnread(empId?: string | null, enabled: boolean = true) {
  const [total, setTotal] = useState(0);
  const [rooms, setRooms] = useState<Record<string, number>>({});
  const last = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!empId) return;
    try {
      const res = await fetch(`${API}/unread?empId=${encodeURIComponent(empId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      const t = Number(d.total) || 0;
      setTotal(t);
      setRooms(d.rooms || {});
      // with push, the phone already rings for a new message; this covers web and Expo Go
      if (!PUSH_SUPPORTED && last.current !== null && t > last.current) playChatSound();
      last.current = t;
      const N = getNotificationsModule();
      if (N && Platform.OS !== "web") N.setBadgeCountAsync(t).catch(() => {});
    } catch {
      /* offline: keep the old number */
    }
  }, [empId]);

  useEffect(() => {
    if (!empId || !enabled) return;
    refresh();
    const id = setInterval(() => {
      if (AppState.currentState === "active") refresh();
    }, POLL_MS);
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [empId, enabled, refresh]);

  return { total, rooms, refresh };
}

// Each tapped notification is handled once, even if the logged-in screens mount again (logout -> login)
const handledResponses = new Set<string>();

type Nav = { navigate: (screen: string, params?: any) => void };

const CELEBRATION_KINDS = new Set(["BIRTHDAY", "CELEBRATION_WISH", "ACHIEVEMENT"]);

function openScreenFor(navigation: Nav, data: any) {
  const type = String(data?.type || "");
  // admin: a new onboarding form -> Completed User Forms tab with that candidate opened
  if (data?.kind === "CANDIDATE_ONBOARDING")
    navigation.navigate("AdminOnboardingSubmissions", { tab: "completed", ref: data.ref ? String(data.ref) : undefined });
  else if (type === "CHAT" && data.roomId) navigation.navigate("Chat", { roomId: String(data.roomId) });
  else if (type === "SHIFT_REMINDER") navigation.navigate("PunchClock");
  // admin: a staff member raised a request
  else if (type === "REQUEST") navigation.navigate("Approvals");
  // birthday of the day, a wish you received, a new achievement -> the Celebrations page
  else if (CELEBRATION_KINDS.has(String(data?.kind || ""))) navigation.navigate("Celebrations");
  // approval results, announcements, celebrations, "location shared" ...
  else if (type) navigation.navigate("Notifications");
}

/**
 * Opens the right screen when the user taps a push notification - while the app is open, in the background,
 * or when the tap itself started the app. Call once in the logged-in app (App.tsx MainTabs does).
 */
export function useOpenChatFromPush(navigation: Nav | null | undefined) {
  useEffect(() => {
    const N = getNotificationsModule();
    if (!N || !navigation) return;

    const handle = (resp: any) => {
      const id = resp?.notification?.request?.identifier || "";
      if (!resp || (id && handledResponses.has(id))) return;
      if (id) handledResponses.add(id);
      if (resp.actionIdentifier && resp.actionIdentifier !== N.DEFAULT_ACTION_IDENTIFIER) return;
      openScreenFor(navigation, resp.notification.request.content.data || {});
    };

    // The app was closed and the user tapped a notification: that tap started the app
    try {
      handle(N.getLastNotificationResponse());
    } catch {
      /* not available on this platform */
    }

    const sub = N.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [navigation]);
}