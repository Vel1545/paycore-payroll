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

/** Opens the chat room when the user taps a chat push notification. Call once in the logged-in app (for example in App.tsx). */
export function useOpenChatFromPush(navigation: { navigate: (screen: string, params?: any) => void } | null | undefined) {
  useEffect(() => {
    const N = getNotificationsModule();
    if (!N || !navigation) return;
    const sub = N.addNotificationResponseReceivedListener((resp) => {
      const data: any = resp.notification.request.content.data || {};
      if (data.type === "CHAT" && data.roomId) navigation.navigate("Chat", { roomId: String(data.roomId) });
    });
    return () => sub.remove();
  }, [navigation]);
}