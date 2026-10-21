import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform } from "react-native";
import { ChevronLeft, ChevronRight, CalendarOff, Trash2, Plus } from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";
import CrossPlatformDatePicker from "../components/CrossPlatformDatePicker";
import { BASE_HOST } from "../constants/config";
import { useAuth } from "../context/AuthContext";
import { UserSession } from "../services/UserSession";

const API = `${BASE_HOST}/api/holidays`;
const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nice = (ymd: string) => {
  const d = new Date(ymd + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
};

interface Holiday { date: string; title: string }

export default function AdminHolidaysScreen({ navigation }: { navigation?: any }) {
  const { user } = useAuth();
  const myEmpId = String(user?.empId || user?.userId || UserSession.empId || "");
  const [year, setYear] = useState(new Date().getFullYear());
  const [items, setItems] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const notify = (t: string, m: string) => (Platform.OS === "web" ? window.alert(`${t}\n${m}`) : Alert.alert(t, m));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}?from=${year}-01-01&to=${year}-12-31`);
      const json = await res.json().catch(() => []);
      if (!res.ok) throw new Error((json as any).message || `HTTP ${res.status}`);
      setItems(json);
    } catch (e: any) {
      notify("Could not load", e?.message || "Try again");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const doAdd = async () => {
    setSaving(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: toYmd(date), title: title.trim(), by: myEmpId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      setTitle("");
      if (date.getFullYear() !== year) setYear(date.getFullYear()); else await load();
      notify("Holiday announced", json.recalculating
        ? "All staff are notified. Salary for that month is being recalculated."
        : "All staff are notified.");
    } catch (e: any) {
      notify("Could not save", e?.message || "Try again");
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    if (!title.trim()) { notify("Title needed", "Write why it is a holiday, e.g. Heavy rain holiday."); return; }
    const msg = `Announce ${nice(toYmd(date))} as a holiday for ALL staff? Everyone is notified${
      date <= new Date() ? " and salary for that month is recalculated" : ""}.`;
    if (Platform.OS === "web") { if (window.confirm(msg)) doAdd(); }
    else Alert.alert("Announce holiday", msg, [{ text: "Cancel", style: "cancel" }, { text: "Announce", onPress: doAdd }]);
  };

  const doRemove = async (h: Holiday) => {
    try {
      const res = await fetch(`${API}?date=${h.date}&by=${encodeURIComponent(myEmpId)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      await load();
    } catch (e: any) {
      notify("Could not remove", e?.message || "Try again");
    }
  };

  const remove = (h: Holiday) => {
    const msg = `Cancel the holiday on ${nice(h.date)}? Staff are told it is a working day.`;
    if (Platform.OS === "web") { if (window.confirm(msg)) doRemove(h); }
    else Alert.alert("Cancel holiday", msg, [{ text: "Keep", style: "cancel" }, { text: "Cancel holiday", style: "destructive", onPress: () => doRemove(h) }]);
  };

  return (
    <ScreenContainer>
      <View className="px-4 pt-2 pb-8">
        <View className="flex-row items-center mb-3">
          {navigation && (
            <TouchableOpacity
              onPress={() => (navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate("AdminHub"))}
              className="w-10 h-10 rounded-2xl bg-white border border-[#E7E4F5] items-center justify-center mr-3"
            >
              <ChevronLeft size={18} color="#1F1B3D" />
            </TouchableOpacity>
          )}
          <View>
            <Text className="text-xl font-black text-[#1F1B3D]">Company holidays</Text>
            <Text className="text-xs font-bold text-[#7A76A6]">Applies to all staff • paid, no LOP</Text>
          </View>
        </View>

        {/* Announce */}
        <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 mb-4">
          <Text className="text-sm font-black text-[#1F1B3D] mb-2">Announce a holiday</Text>
          <CrossPlatformDatePicker label="Holiday date" value={date} onChange={(d: Date) => setDate(d)} />
          <Text className="text-[11px] font-black text-[#7A76A6] mb-1 mt-3">Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            placeholder="e.g. Heavy rain holiday"
            placeholderTextColor="#A6A2CE"
            className="h-11 rounded-2xl border border-[#E7E4F5] bg-[#F6F5FC] px-3 text-sm font-bold text-[#1F1B3D]"
          />
          <TouchableOpacity
            onPress={add}
            disabled={saving}
            className="h-11 rounded-2xl bg-[#5B4FD1] flex-row items-center justify-center mt-3"
            style={{ opacity: saving ? 0.6 : 1 }}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Plus size={16} color="#fff" />}
            <Text className="text-sm font-black text-white ml-1.5">Announce to all staff</Text>
          </TouchableOpacity>
          <Text className="text-[10px] font-bold text-[#7A76A6] mt-2">
            A past or today's date also recalculates salary for that month (paid months are not touched).
          </Text>
        </View>

        {/* Year + list */}
        <View className="flex-row items-center justify-between mb-2">
          <TouchableOpacity onPress={() => setYear((y) => y - 1)} className="w-9 h-9 rounded-xl bg-white border border-[#E7E4F5] items-center justify-center">
            <ChevronLeft size={16} color="#5B4FD1" />
          </TouchableOpacity>
          <Text className="text-sm font-black text-[#1F1B3D]">{year} • {items.length} holiday{items.length === 1 ? "" : "s"}</Text>
          <TouchableOpacity onPress={() => setYear((y) => y + 1)} className="w-9 h-9 rounded-xl bg-white border border-[#E7E4F5] items-center justify-center">
            <ChevronRight size={16} color="#5B4FD1" />
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="small" color="#5B4FD1" style={{ marginVertical: 12 }} />}
        {!loading && items.length === 0 && (
          <View className="bg-white border border-[#E7E4F5] rounded-3xl py-10 items-center">
            <CalendarOff size={26} color="#A6A2CE" />
            <Text className="text-xs font-bold text-[#7A76A6] mt-2">No holidays announced for {year}.</Text>
          </View>
        )}
        {items.map((h) => (
          <View key={h.date} className="bg-white border border-[#E7E4F5] rounded-2xl px-3.5 py-3 mb-2 flex-row items-center">
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text className="text-[13px] font-black text-[#1F1B3D]">{h.title || "Holiday"}</Text>
              <Text className="text-[11px] font-bold text-[#7A76A6]">{nice(h.date)}</Text>
            </View>
            <TouchableOpacity onPress={() => remove(h)} className="w-9 h-9 rounded-xl bg-[#FDE9E8] items-center justify-center">
              <Trash2 size={15} color="#E4453C" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}