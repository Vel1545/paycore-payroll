import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Switch, Platform } from "react-native";
import { ChevronLeft, Megaphone, MessageSquare, CheckCircle2, XCircle, Bell, BellOff, Volume2, CheckCheck } from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";
import { NOTIFY_API, playBeep } from "../constants/Usenotifications";
import { setAlertSoundPreference } from "../constants/Notifications";

const C = { primary: "#5B4FD1", ink: "#1F1B3D", muted: "#7A76A6", faint: "#A6A2CE", border: "#E7E4F5", soft: "#EEECFA", bg: "#F6F5FC" };

interface Item {
  id: number;
  type: "ANNOUNCEMENT" | "APPROVAL" | "CHAT" | string;
  title: string;
  body: string;
  data?: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Prefs {
  pushEnabled: boolean;
  soundEnabled: boolean;
  announcements: boolean;
  chat: boolean;
  approvals: boolean;
}

const DEFAULT_PREFS: Prefs = { pushEnabled: true, soundEnabled: true, announcements: true, chat: true, approvals: true };

const timeAgo = (iso: string) => {
  const t = new Date(iso.replace(" ", "T")).getTime();
  if (isNaN(t)) return "";
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
};

const parseData = (s?: string | null): Record<string, string> => {
  try {
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
};

export default function NotificationsScreen({ navigation, userSession }: { navigation: any; userSession?: { empId: string; isAdmin: boolean } }) {
  const empId = (userSession?.empId || "").trim();
  const q = encodeURIComponent(empId);

  const [items, setItems] = useState<Item[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    if (!empId) return;
    try {
      const [l, p] = await Promise.all([
        fetch(`${NOTIFY_API}?empId=${q}`, { cache: "no-store" }),
        fetch(`${NOTIFY_API}/prefs?empId=${q}`, { cache: "no-store" }),
      ]);
      if (l.ok) setItems(await l.json());
      if (p.ok) {
        const pr = await p.json();
        setPrefs(pr);
        setAlertSoundPreference(pr.soundEnabled !== false);
      }
    } catch {
      // offline: keep what is on screen
    } finally {
      setLoading(false);
    }
  }, [empId, q]);

  useEffect(() => {
    load();
  }, [load]);

  const savePref = async (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next); // switch moves at once
    if ("soundEnabled" in patch) {
      setAlertSoundPreference(!!patch.soundEnabled);
      if (patch.soundEnabled) playBeep();
    }
    try {
      await fetch(`${NOTIFY_API}/prefs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empId, ...next }),
      });
    } catch {
      // will be corrected on the next load
    }
  };

  const markRead = async (id?: number) => {
    setItems((prev) => prev.map((i) => (id === undefined || i.id === id ? { ...i, isRead: true } : i)));
    try {
      await fetch(`${NOTIFY_API}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empId, id }),
      });
    } catch {
      // ignore
    }
  };

  const unreadCount = items.filter((i) => !i.isRead).length;

  const iconFor = (it: Item) => {
    if (it.type === "ANNOUNCEMENT") return { Icon: Megaphone, bg: C.soft, fg: C.primary };
    if (it.type === "CHAT") return { Icon: MessageSquare, bg: "#E0F2FE", fg: "#0369A1" };
    if (it.type === "APPROVAL") {
      const rejected = parseData(it.data).status === "REJECTED";
      return rejected
        ? { Icon: XCircle, bg: "#FFE4E6", fg: "#BE123C" }
        : { Icon: CheckCircle2, bg: "#DCFCE7", fg: "#15803D" };
    }
    return { Icon: Bell, bg: C.soft, fg: C.primary };
  };

  const toggleRow = (label: string, hint: string, value: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <View className="flex-row items-center justify-between py-3" style={{ opacity: disabled ? 0.45 : 1 }}>
      <View className="flex-1 mr-3">
        <Text style={{ color: C.ink }} className="text-[13px] font-bold">{label}</Text>
        <Text style={{ color: C.muted }} className="text-[11px] font-medium mt-0.5">{hint}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: "#D9D6EE", true: C.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  return (
    <ScreenContainer scrollable={false} fullWidth={true}>
      <View className="flex-1 min-h-0 w-full" style={{ paddingBottom: Platform.OS === "web" ? 40 : 16 }}>
        {/* Header */}
        <View style={{ backgroundColor: C.primary }} className="rounded-3xl p-4 mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => (navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate("Home"))}
              className="w-9 h-9 bg-white/20 rounded-2xl items-center justify-center mr-3"
            >
              <ChevronLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text className="text-base font-black text-white">Notifications</Text>
              <Text className="text-[11px] font-semibold text-white/75">
                {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowSettings((v) => !v)}
            activeOpacity={0.85}
            className="flex-row items-center px-3 py-2 rounded-full"
            style={{ backgroundColor: showSettings ? "#FFFFFF" : "rgba(255,255,255,0.18)" }}
          >
            {prefs.pushEnabled ? <Bell size={14} color={showSettings ? C.primary : "#FFFFFF"} /> : <BellOff size={14} color={showSettings ? C.primary : "#FFFFFF"} />}
            <Text style={{ color: showSettings ? C.primary : "#FFFFFF" }} className="text-xs font-black ml-1.5">Settings</Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 min-h-0" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={{ width: "100%", maxWidth: 720, alignSelf: "center" }}>
            {/* Settings */}
            {showSettings && (
              <View style={{ borderColor: C.border }} className="bg-white border rounded-3xl px-4 py-2 mb-3">
                {toggleRow("Notifications", "Pop-ups on your phone for new announcements, chats and approvals", prefs.pushEnabled, (v) => savePref({ pushEnabled: v }))}
                <View style={{ height: 1, backgroundColor: C.border }} />
                {toggleRow("Sound", "Play a sound when a notification arrives", prefs.soundEnabled, (v) => savePref({ soundEnabled: v }))}
                <View style={{ height: 1, backgroundColor: C.border }} />
                {toggleRow("Announcements", "Notices posted by admins", prefs.announcements, (v) => savePref({ announcements: v }))}
                <View style={{ height: 1, backgroundColor: C.border }} />
                {toggleRow("Chat messages", "Groups and direct messages", prefs.chat, (v) => savePref({ chat: v }))}
                <View style={{ height: 1, backgroundColor: C.border }} />
                {toggleRow("Approvals", "When your request is approved or rejected", prefs.approvals, (v) => savePref({ approvals: v }))}
                {Platform.OS === "web" && (
                  <Text style={{ color: C.muted }} className="text-[11px] font-medium pb-2">
                    On the web version you get the bell and a chime while this page is open. Phone pop-ups need the Android app.
                  </Text>
                )}
              </View>
            )}

            {unreadCount > 0 && (
              <TouchableOpacity onPress={() => markRead()} className="flex-row items-center self-end mb-2 px-1">
                <CheckCheck size={14} color={C.primary} />
                <Text style={{ color: C.primary }} className="text-xs font-black ml-1">Mark all as read</Text>
              </TouchableOpacity>
            )}

            {/* List */}
            {!loading && items.length === 0 ? (
              <View style={{ borderColor: C.border }} className="bg-white border rounded-3xl py-16 items-center">
                <View style={{ backgroundColor: C.soft }} className="w-16 h-16 rounded-full items-center justify-center mb-3">
                  <Bell size={26} color={C.primary} />
                </View>
                <Text style={{ color: C.ink }} className="text-sm font-black">No notifications yet</Text>
                <Text style={{ color: C.muted }} className="text-xs font-medium mt-1">Announcements and approval updates will show here.</Text>
              </View>
            ) : (
              items.map((it) => {
                const { Icon, bg, fg } = iconFor(it);
                return (
                  <TouchableOpacity
                    key={it.id}
                    activeOpacity={0.8}
                    onPress={() => !it.isRead && markRead(it.id)}
                    style={{ borderColor: it.isRead ? C.border : C.primary + "55", backgroundColor: it.isRead ? "#FFFFFF" : "#FBFAFF" }}
                    className="border rounded-2xl p-3.5 mb-2 flex-row"
                  >
                    <View style={{ backgroundColor: bg }} className="w-10 h-10 rounded-xl items-center justify-center">
                      <Icon size={19} color={fg} />
                    </View>
                    <View className="flex-1 ml-3" style={{ minWidth: 0 }}>
                      <View className="flex-row items-start justify-between">
                        <Text style={{ color: C.ink }} className="text-[13px] font-black flex-1 mr-2" numberOfLines={2}>
                          {it.title}
                        </Text>
                        {!it.isRead && <View style={{ backgroundColor: C.primary }} className="w-2.5 h-2.5 rounded-full mt-1" />}
                      </View>
                      {!!it.body && (
                        <Text style={{ color: C.muted }} className="text-xs font-medium mt-0.5 leading-4" numberOfLines={3}>
                          {it.body}
                        </Text>
                      )}
                      <Text style={{ color: C.faint }} className="text-[10px] font-semibold mt-1.5">{timeAgo(it.createdAt)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}