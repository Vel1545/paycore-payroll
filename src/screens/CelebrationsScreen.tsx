import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, useWindowDimensions, TouchableOpacity, TextInput, Platform, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Cake, Sparkles, Award, ChevronLeft, Calendar, Trophy, Plus, Trash2, X } from "lucide-react-native";
import { BASE_HOST } from "../constants/config";
import { useAuth } from "../context/AuthContext";
import { UserSession } from "../services/UserSession";
import CrossPlatformDatePicker from "../components/CrossPlatformDatePicker";
import Confetti from "../components/Confetti";
import FullPageCelebration from "../components/FullPageCelebration";
import LottieCelebration from "../components/LottieCelebration";

const API = `${BASE_HOST}/api/celebrations`;
const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (ymd: string) => {
  const [, m, d] = String(ymd).slice(0, 10).split("-");
  return `${MONTHS[Number(m) - 1] ?? ""} ${d}`;
};
const monthName = (ymd: string) => {
  const d = new Date(String(ymd).slice(0, 10) + "T00:00:00");
  return `${d.toLocaleString("en-IN", { month: "long" })} ${d.getFullYear()}`;
};
const CATEGORIES = ["Sales", "Clients", "Personal", "Other"];
const notify = (t: string, m: string) => (Platform.OS === "web" ? window.alert(`${t}\n${m}`) : Alert.alert(t, m));

interface Person { empId: string; name: string; department?: string }

const QUICK_EMOJI = ["🎉", "🎂", "🎈", "👏", "🌟", "💐"];

const ago = (iso: string) => {
  const t = new Date(String(iso).replace(" ", "T")).getTime();
  if (isNaN(t)) return "";
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} d ago`;
};

/** Wishes on one card: everyone sees the list; the box to write one is on only when the server says wishOpen. */
function WishBox({ item, today, myEmpId, isAdmin, onChanged }: { item: any; today: string; myEmpId: string; isAdmin: boolean; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const wishes: any[] = item.wishes ?? [];
  const isMe = item.empId === myEmpId;
  const iWished = wishes.some((w) => w.from === myEmpId);
  const MAX = 140;

  const send = async () => {
    if (!text.trim()) { notify("Write a wish", "Add a short message, or tap an emoji."); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/wishes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: myEmpId, targetEmpId: item.empId, eventType: item.eventType, eventRef: item.eventRef, message: text.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      setText("");
      onChanged();
    } catch (e: any) {
      notify("Not sent", e?.message || "Try again");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (w: any) => {
    try {
      const url = w.from === myEmpId ? `${API}/wishes/${w.id}?by=${encodeURIComponent(myEmpId)}` : `${API}/wishes/${w.id}/admin`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onChanged();
    } catch (e: any) {
      notify("Could not remove", e?.message || "Try again");
    }
  };

  const closedNote = () => {
    if (item.wishOpen) return null;
    if (item.eventType === "ACHIEVEMENT") return "Wishes for this achievement are closed.";
    return String(item.date) > today ? `Wishes open on ${shortDate(item.date)}` : "Wishes are closed.";
  };

  return (
    <View className="mt-3 pt-3 border-t border-[#F0EEFA]">
      {wishes.length > 0 && (
        <View className="mb-2">
          <Text className="text-[10px] font-black text-[#7A76A6] uppercase tracking-wider mb-1.5">Wishes ({wishes.length})</Text>
          {wishes.map((w) => (
            <View key={w.id} className="flex-row items-start mb-1.5">
              <View style={{ flex: 1 }} className="bg-[#F6F5FC] rounded-xl px-3 py-2">
                <Text className="text-[11px] font-black text-[#1F1B3D]">
                  {w.fromName} <Text className="text-[10px] font-bold text-[#A6A2CE]">• {ago(w.createdAt)}</Text>
                </Text>
                <Text className="text-xs font-medium text-[#1F1B3D] mt-0.5">{w.message}</Text>
              </View>
              {(w.from === myEmpId || isAdmin) && (
                <TouchableOpacity onPress={() => remove(w)} className="w-7 h-7 items-center justify-center ml-1">
                  <Trash2 size={13} color="#E4453C" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {item.wishOpen && !isMe && !iWished && (
        <View>
          <View className="flex-row flex-wrap mb-1.5">
            {QUICK_EMOJI.map((e) => (
              <TouchableOpacity key={e} onPress={() => setText((t) => (t + e).slice(0, 300))} className="w-9 h-9 rounded-xl bg-[#EEECFA] items-center justify-center mr-1.5 mb-1">
                <Text style={{ fontSize: 17 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row items-center">
            <TextInput
              value={text}
              onChangeText={setText}
              maxLength={MAX}
              placeholder="Write a short wish..."
              placeholderTextColor="#A6A2CE"
              className="flex-1 h-10 rounded-xl border border-[#E7E4F5] bg-[#F6F5FC] px-3 text-xs font-bold text-[#1F1B3D]"
              onSubmitEditing={send}
            />
            <TouchableOpacity onPress={send} disabled={busy} className="ml-2 h-10 px-4 rounded-xl bg-[#5B4FD1] items-center justify-center" style={{ opacity: busy ? 0.6 : 1 }}>
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-xs font-black text-white">Send</Text>}
            </TouchableOpacity>
          </View>
          <Text className="text-[10px] font-bold text-[#A6A2CE] mt-1">{text.length}/{MAX} • wishes disappear after 3 days</Text>
        </View>
      )}
      {item.wishOpen && !isMe && iWished && <Text className="text-[11px] font-bold text-[#1FAE5C]">Your wish is posted ✔</Text>}
      {item.wishOpen && isMe && wishes.length === 0 && <Text className="text-[11px] font-bold text-[#7A76A6]">Your colleagues' wishes will appear here.</Text>}
      {!item.wishOpen && closedNote() && <Text className="text-[11px] font-bold text-[#A6A2CE]">{closedNote()}</Text>}
    </View>
  );
}

export default function CelebrationsScreen({ navigation }: any) {
  const { height: winH } = useWindowDimensions();
  const { user } = useAuth();
  const isAdmin = !!(user?.isAdmin || String(user?.role || "").toUpperCase() === "ADMIN");
  const myEmpId = String(user?.empId || user?.userId || UserSession.empId || "");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // admin: tag an achievement
  const [formOpen, setFormOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [pick, setPick] = useState<Person | null>(null);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("Sales");
  const [achDate, setAchDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API, { cache: "no-store" as any });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Could not load celebrations");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = async () => {
    setFormOpen(true);
    if (people.length === 0) {
      try {
        const res = await fetch(`${API}/people`);
        if (res.ok) setPeople(await res.json());
      } catch { /* the form still opens; the list stays empty */ }
    }
  };

  const suggestions = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t || pick) return [];
    return people.filter((p) => p.name.toLowerCase().includes(t) || p.empId.toLowerCase().includes(t)).slice(0, 5);
  }, [search, people, pick]);

  const saveAchievement = async () => {
    if (!pick) { notify("Choose a person", "Search and tap the employee."); return; }
    if (!title.trim()) { notify("Title needed", "e.g. Highest sales this month"); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/achievements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empId: pick.empId, title: title.trim(), description: desc.trim(), category, date: toYmd(achDate), by: myEmpId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      setFormOpen(false);
      setPick(null); setSearch(""); setTitle(""); setDesc("");
      await load();
      notify("Achievement added", `${pick.name} is on the board and the team is notified.`);
    } catch (e: any) {
      notify("Could not save", e?.message || "Try again");
    } finally {
      setSaving(false);
    }
  };

  const removeAchievement = (id: number) => {
    const go = async () => {
      try {
        const res = await fetch(`${API}/achievements/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await load();
      } catch (e: any) {
        notify("Could not remove", e?.message || "Try again");
      }
    };
    if (Platform.OS === "web") { if (window.confirm("Remove this achievement?")) go(); }
    else Alert.alert("Remove achievement", "Remove this achievement from the board?", [{ text: "Keep", style: "cancel" }, { text: "Remove", style: "destructive", onPress: go }]);
  };

  const birthdaysToday: any[] = data?.birthdaysToday ?? [];
  const upcoming: any[] = data?.upcomingBirthdays ?? [];
  const recent: any[] = data?.recentBirthdays ?? [];
  const anniversaries: any[] = data?.anniversaries ?? [];
  const today: string = data?.today ?? toYmd(new Date());
  const achievements: any[] = data?.achievements ?? [];

  // The person whose birthday / work anniversary is TODAY gets the full-page show (only on the day)
  const myBirthdayToday = birthdaysToday.some((p) => p.empId === myEmpId);
  const myAnniversaryToday = anniversaries.some((p) => p.today && p.empId === myEmpId);
  const celebrateMe = !loading && (myBirthdayToday || myAnniversaryToday);

  const yearTone = (y: number) => (y >= 5 ? { bg: "#FEF2D9", fg: "#D08A0C", bd: "#D08A0C" } : { bg: "#EEECFA", fg: "#5B4FD1", bd: "#5B4FD1" });

  return (
    <SafeAreaView className="flex-1 bg-[#F6F5FC]" edges={["top"]} style={Platform.OS === "web" ? ({ height: winH, maxHeight: winH, overflow: "hidden" } as any) : undefined}>
      {/* Header */}
      <View className="bg-[#5B4FD1] rounded-3xl pt-4 pb-6 px-5 mx-4 mt-2 mb-4 relative overflow-hidden">
        <View className="absolute -top-3 -right-4 w-20 h-20 rounded-3xl border-2 border-white/20" style={{ transform: [{ rotate: "20deg" }] }} pointerEvents="none" />
        <View className="absolute top-12 -left-6 w-16 h-16 rounded-2xl border-2 border-white/10" style={{ transform: [{ rotate: "-15deg" }] }} pointerEvents="none" />

        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity
            onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate("Home"))}
            className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center active:opacity-80"
          >
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View className="flex-row items-center">
            {isAdmin && (
              <TouchableOpacity onPress={openForm} className="bg-white px-3 py-1 rounded-full flex-row items-center mr-2 active:opacity-90">
                <Trophy size={12} color="#5B4FD1" />
                <Text className="text-[10px] font-black text-[#5B4FD1] ml-1 uppercase tracking-wider">Tag achievement</Text>
              </TouchableOpacity>
            )}
            <View className="bg-white/20 px-3 py-1 rounded-full border border-white/25 flex-row items-center">
              <Sparkles size={12} color="#FFFFFF" />
              <Text className="text-[10px] font-black text-white ml-1 uppercase tracking-wider">Workplace Culture</Text>
            </View>
          </View>
        </View>

        <View className="items-center">
          <Text className="text-xl md:text-2xl font-black text-white tracking-tight">Team Celebrations 🎉</Text>
          <Text className="text-xs font-semibold text-white/80 mt-0.5 text-center">Birthdays, achievements & work anniversaries</Text>
        </View>
      </View>

      <View className="flex-1 min-h-0 w-full max-w-4xl mx-auto px-4" style={{ minHeight: 0 }}>
        <ScrollView
          className="flex-1 min-h-0"
          style={{ flex: 1, minHeight: 0 }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={Platform.OS === "web"}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#5B4FD1" />}
          contentContainerStyle={{ paddingBottom: 170 }}   // clears the floating bottom bar, so the last card can scroll fully into view
        >
          {loading && <ActivityIndicator size="small" color="#5B4FD1" style={{ marginVertical: 24 }} />}
          {error && (
            <View className="bg-[#FDE9E8] border border-[#E4453C]/30 rounded-2xl p-3 mb-3">
              <Text className="text-xs font-bold text-[#E4453C]">{error}</Text>
            </View>
          )}

          {/* Today's birthdays */}
          {!loading &&
            birthdaysToday.map((p) => {
              const mine = p.empId === myEmpId;
              return (
                <View
                  key={p.empId}
                  className="rounded-3xl p-5 mb-3 overflow-hidden relative border"
                  style={{ backgroundColor: mine ? "#FFF1F5" : "#FFFFFF", borderColor: mine ? "#F9A8C4" : "#E7E4F5" }}
                >
                  <Confetti kind="BIRTHDAY" height={mine ? 230 : 150} count={mine ? 34 : 18} />
                  {mine ? (
                    <View className="items-center py-2">
                      <Text style={{ fontSize: 44 }}>🎂</Text>
                      <Text className="text-xl font-black text-[#BE185D] mt-1 text-center">Happy Birthday, {p.name}!</Text>
                      <Text className="text-xs font-bold text-[#9D4B6B] mt-1 text-center">Wishing you a wonderful year ahead 🎉</Text>
                    </View>
                  ) : (
                    <View className="flex-row items-center">
                      <View className="w-14 h-14 bg-[#EEECFA] rounded-2xl items-center justify-center mr-4 border border-[#5B4FD1]/20">
                        <Cake size={28} color="#5B4FD1" />
                      </View>
                      <View className="flex-1">
                        <View className="bg-rose-100 px-2.5 py-0.5 rounded-full self-start mb-1">
                          <Text className="text-[9px] font-black text-rose-700 uppercase tracking-wider">Today's Birthday 🎂</Text>
                        </View>
                        <Text className="text-[#1F1B3D] font-black text-base">{p.name}</Text>
                        {!!p.department && <Text className="text-[#7A76A6] text-xs font-medium mt-0.5">{p.department}</Text>}
                      </View>
                    </View>
                  )}
                  <WishBox item={p} today={today} myEmpId={myEmpId} isAdmin={isAdmin} onChanged={load} />
                </View>
              );
            })}

          {/* Birthdays of the last 2 days (wishes still visible, writing is closed) */}
          {!loading && recent.length > 0 && (
            <>
              <View className="flex-row items-center mb-2 mt-1 px-1">
                <Cake size={14} color="#5B4FD1" />
                <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider ml-1.5">Recent birthdays</Text>
              </View>
              {recent.map((p) => (
                <View key={p.empId} className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-2.5">
                  <Text className="text-xs font-black text-[#1F1B3D]">{p.name} <Text className="text-[10px] font-bold text-[#A6A2CE]">• {shortDate(p.date)}</Text></Text>
                  <WishBox item={p} today={today} myEmpId={myEmpId} isAdmin={isAdmin} onChanged={load} />
                </View>
              ))}
            </>
          )}

          {/* Achievements */}
          <View className="flex-row items-center justify-between mb-3 mt-2 px-1">
            <View className="flex-row items-center gap-1.5">
              <Trophy size={15} color="#5B4FD1" />
              <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">Achievements</Text>
            </View>
          </View>
          {!loading && achievements.length === 0 ? (
            <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-5">
              <Text className="text-xs font-bold text-[#7A76A6]">No achievements yet. Admins can tag one with the button above.</Text>
            </View>
          ) : (
            <View className="mb-5">
              {achievements.map((a) => (
                <View key={a.id} className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-2.5 overflow-hidden relative">
                  {a.wishOpen && <Confetti kind="ACHIEVEMENT" height={120} count={14} rounds={2} />}
                  <View className="flex-row items-start">
                    <View className="w-11 h-11 bg-[#FEF2D9] rounded-2xl items-center justify-center mr-3 border border-[#D08A0C]/20">
                      <Trophy size={20} color="#D08A0C" />
                    </View>
                    <View className="flex-1" style={{ minWidth: 0 }}>
                      <Text className="text-xs font-black text-[#1F1B3D]">{a.name}</Text>
                      <Text className="text-[13px] font-black text-[#5B4FD1] mt-0.5">{a.title}</Text>
                      {!!a.description && <Text className="text-[11px] font-medium text-[#7A76A6] mt-0.5">{a.description}</Text>}
                      <Text className="text-[10px] font-bold text-[#A6A2CE] mt-1">
                        {shortDate(a.date)}{a.category ? ` • ${a.category}` : ""}{a.department ? ` • ${a.department}` : ""}
                      </Text>
                    </View>
                    {isAdmin && (
                      <TouchableOpacity onPress={() => removeAchievement(a.id)} className="w-8 h-8 rounded-xl bg-[#FDE9E8] items-center justify-center ml-2">
                        <Trash2 size={14} color="#E4453C" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <WishBox item={a} today={today} myEmpId={myEmpId} isAdmin={isAdmin} onChanged={load} />
                </View>
              ))}
            </View>
          )}

          {/* Work anniversaries */}
          <View className="flex-row items-center justify-between mb-3 px-1">
            <View className="flex-row items-center gap-1.5">
              <Award size={15} color="#5B4FD1" />
              <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">Work Anniversaries (This Month)</Text>
            </View>
            {!!data?.today && <Text className="text-[11px] font-bold text-[#7A76A6]">{monthName(data.today)}</Text>}
          </View>
          {!loading && anniversaries.length === 0 ? (
            <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-6">
              <Text className="text-xs font-bold text-[#7A76A6]">No work anniversaries this month.</Text>
            </View>
          ) : (
            <View className="mb-6">
              {anniversaries.map((p) => {
                const tone = yearTone(p.years);
                return (
                  <View key={p.empId} className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-2.5 overflow-hidden relative">
                    {p.today && <Confetti kind="ANNIVERSARY" height={p.empId === myEmpId ? 200 : 130} count={p.empId === myEmpId ? 30 : 16} />}
                    {p.today && p.empId === myEmpId && (
                      <View className="items-center pb-3">
                        <Text style={{ fontSize: 36 }}>🎉</Text>
                        <Text className="text-base font-black text-[#B45309] text-center">Happy {p.years}-year work anniversary, {p.name}!</Text>
                      </View>
                    )}
                    <View className="flex-row items-center">
                      <View style={{ backgroundColor: tone.bg, borderColor: tone.bd + "33" }} className="w-11 h-11 rounded-2xl items-center justify-center mr-3 border">
                        <Text style={{ color: tone.fg }} className="font-black text-sm">{p.years}Y</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>{p.name}</Text>
                        <Text className="text-[11px] font-semibold text-[#7A76A6]" numberOfLines={1}>
                          {p.department ? `${p.department} • ` : ""}{shortDate(p.date)}{p.today ? " • Today 🎉" : ""}
                        </Text>
                      </View>
                    </View>
                    <WishBox item={p} today={today} myEmpId={myEmpId} isAdmin={isAdmin} onChanged={load} />
                  </View>
                );
              })}
            </View>
          )}

          {/* Upcoming birthdays: display only, wishes open on the day */}
          <View className="flex-row items-center justify-between mb-3 px-1">
            <View className="flex-row items-center gap-1.5">
              <Calendar size={15} color="#5B4FD1" />
              <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">Upcoming Birthdays (Next 14 Days)</Text>
            </View>
          </View>
          {!loading && upcoming.length === 0 ? (
            <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-6">
              <Text className="text-xs font-bold text-[#7A76A6]">No birthdays in the next 14 days.</Text>
            </View>
          ) : (
            <View className="bg-white border border-[#E7E4F5] rounded-3xl mb-6 overflow-hidden">
              {upcoming.map((p, i) => (
                <View key={p.empId} className={`p-4 flex-row justify-between items-center ${i > 0 ? "border-t border-[#F0EEFA]" : ""}`}>
                  <View className="w-16 bg-[#EEECFA] py-1 rounded-lg items-center">
                    <Text className="text-xs font-black text-[#5B4FD1]">{shortDate(p.date)}</Text>
                  </View>
                  <View className="flex-1 px-3">
                    <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>{p.name}</Text>
                    {!!p.department && <Text className="text-[10px] font-medium text-[#7A76A6]" numberOfLines={1}>{p.department}</Text>}
                  </View>
                  <View className="bg-slate-100 px-2.5 py-1 rounded-full">
                    <Text className="text-[10px] font-bold text-[#7A76A6]">{p.inDays === 1 ? "Tomorrow" : `In ${p.inDays} Days`}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          <View style={{ height: 120 }} />{/* extra end space so the last card clears the floating bottom bar */}
        </ScrollView>
      </View>

      {celebrateMe && <LottieCelebration kind={myBirthdayToday ? "BIRTHDAY" : "ANNIVERSARY"} />}

      {/* Admin: tag an achievement */}
      {formOpen && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(31,27,61,0.45)" }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 70, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View className="bg-white rounded-3xl p-4 border border-[#E7E4F5] max-w-xl w-full self-center">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-black text-[#1F1B3D]">Tag an achievement</Text>
                <TouchableOpacity onPress={() => setFormOpen(false)}><X size={18} color="#7A76A6" /></TouchableOpacity>
              </View>

              <Text className="text-[11px] font-black text-[#7A76A6] mb-1">Employee</Text>
              {pick ? (
                <View className="h-11 rounded-2xl border border-[#5B4FD1]/40 bg-[#EEECFA] px-3 flex-row items-center justify-between">
                  <Text className="text-sm font-black text-[#1F1B3D]" numberOfLines={1}>{pick.name} • {pick.empId}</Text>
                  <TouchableOpacity onPress={() => { setPick(null); setSearch(""); }}><X size={15} color="#5B4FD1" /></TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search name or employee ID"
                    placeholderTextColor="#A6A2CE"
                    className="h-11 rounded-2xl border border-[#E7E4F5] bg-[#F6F5FC] px-3 text-sm font-bold text-[#1F1B3D]"
                  />
                  {suggestions.map((p) => (
                    <TouchableOpacity key={p.empId} onPress={() => { setPick(p); setSearch(p.name); }} className="px-3 py-2 border-b border-[#F0EEFA]">
                      <Text className="text-xs font-black text-[#1F1B3D]">{p.name}</Text>
                      <Text className="text-[10px] font-bold text-[#7A76A6]">{p.empId}{p.department ? ` • ${p.department}` : ""}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              <Text className="text-[11px] font-black text-[#7A76A6] mb-1 mt-3">Achievement</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={120}
                placeholder="e.g. Highest sales this month"
                placeholderTextColor="#A6A2CE"
                className="h-11 rounded-2xl border border-[#E7E4F5] bg-[#F6F5FC] px-3 text-sm font-bold text-[#1F1B3D]"
              />
              <Text className="text-[11px] font-black text-[#7A76A6] mb-1 mt-3">Details (optional)</Text>
              <TextInput
                value={desc}
                onChangeText={setDesc}
                maxLength={500}
                multiline
                placeholder="e.g. Closed 12 new clients in October"
                placeholderTextColor="#A6A2CE"
                className="min-h-[56px] rounded-2xl border border-[#E7E4F5] bg-[#F6F5FC] px-3 py-2 text-sm font-bold text-[#1F1B3D]"
              />

              <Text className="text-[11px] font-black text-[#7A76A6] mb-1 mt-3">Type</Text>
              <View className="flex-row flex-wrap">
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    className={`px-3.5 py-2 rounded-full mr-2 mb-2 border ${category === c ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-white border-[#E7E4F5]"}`}
                  >
                    <Text className={`text-xs font-black ${category === c ? "text-white" : "text-[#7A76A6]"}`}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <CrossPlatformDatePicker label="Achieved on" value={achDate} onChange={(d: Date) => setAchDate(d)} />

              <View className="flex-row mt-4">
                <TouchableOpacity onPress={() => setFormOpen(false)} className="flex-1 h-11 rounded-2xl bg-[#EEECFA] items-center justify-center mr-2">
                  <Text className="text-sm font-black text-[#5B4FD1]">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveAchievement}
                  disabled={saving}
                  className="flex-1 h-11 rounded-2xl bg-[#5B4FD1] flex-row items-center justify-center"
                  style={{ opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Plus size={15} color="#fff" />}
                  <Text className="text-sm font-black text-white ml-1">Add & notify team</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}