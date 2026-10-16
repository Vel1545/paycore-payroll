import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { BASE_HOST } from "../constants/config";
import { setAlertSoundPreference, getNotificationsModule } from "../constants/Notifications";

export const NOTIFY_API = `${BASE_HOST}/api/notifications`;

let audioCtx: any = null;

// Web only: a short two-tone chime (phones get the real notification sound from the push itself)
export function playBeep() {
  if (Platform.OS !== "web") return;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const tone = (freq: number, start: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + start + 0.28);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + start);
      osc.stop(audioCtx.currentTime + start + 0.3);
    };
    tone(880, 0);
    tone(1175, 0.18);
  } catch {
    // browsers block sound until the page has been clicked once; nothing to do
  }
}

/** Unread count for the bell. Checks every 30 seconds and when a push arrives while the app is open. */
export function useNotifications(empId?: string, enabled = true) {
  const [unread, setUnread] = useState(0);
  const previous = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!empId || !enabled) return;
    try {
      const res = await fetch(`${NOTIFY_API}/unread-count?empId=${encodeURIComponent(empId)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const j = await res.json();
      const n = Number(j?.count) || 0;
      const soundOn = j?.sound !== false;
      setAlertSoundPreference(soundOn);
      if (previous.current !== null && n > previous.current && soundOn) playBeep();
      previous.current = n;
      setUnread(n);
    } catch {
      // offline: keep the last number
    }
  }, [empId, enabled]);

  useEffect(() => {
    if (!empId || !enabled) return;
    refresh();
    const id = setInterval(() => {
      if (AppState.currentState === "active") refresh();
    }, 30000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());

    let received: { remove: () => void } | null = null;
    const Notifications = getNotificationsModule(); // null on web and in Expo Go
    if (Notifications) {
      try {
        received = Notifications.addNotificationReceivedListener(() => refresh());
      } catch {
        // push library not available
      }
    }
    return () => {
      clearInterval(id);
      sub.remove();
      received?.remove();
    };
  }, [empId, enabled, refresh]);

  return { unread, refresh };
}