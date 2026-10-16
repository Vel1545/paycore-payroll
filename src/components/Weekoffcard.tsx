import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Platform, Alert, ActivityIndicator } from "react-native";
import { CalendarOff, Check } from "lucide-react-native";
import { BASE_HOST } from "../constants/config";

const C = { primary: "#5B4FD1", ink: "#1F1B3D", muted: "#7A76A6", faint: "#A6A2CE", border: "#E7E4F5", soft: "#EEECFA", bg: "#F6F5FC" };
const API = `${BASE_HOST}/api/weekoff`;

interface Day {
  date: string;
  dayName: string;
  kind: "FIXED_OFF" | "FLEX_OFF" | "WORK";
  isToday: boolean;
  isPast: boolean;
  worked: boolean;
  canTake: boolean;
  canCancel: boolean;
}
interface Week {
  flexOffsPerWeek: number;
  used: number;
  left: number;
  workingDaysPerWeek: number;
  days: Day[];
}

const notify = (title: string, msg: string) =>
  Platform.OS === "web" ? window.alert(`${title}\n${msg}`) : Alert.alert(title, msg);

const confirmAsk = (title: string, msg: string, onYes: () => void) => {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n${msg}`)) onYes();
    return;
  }
  Alert.alert(title, msg, [
    { text: "Not now", style: "cancel" },
    { text: "Yes", onPress: onYes },
  ]);
};

/** Shows this week and lets the employee take their flexible week-offs. Renders nothing if the schedule has none. */
export default function WeekOffCard({ empId, onChanged }: { empId: string; onChanged?: () => void }) {
  const [week, setWeek] = useState<Week | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!empId) return;
    try {
      const res = await fetch(`${API}?empId=${encodeURIComponent(empId)}`, { cache: "no-store" });
      if (res.ok) setWeek(await res.json());
    } catch {
      // offline: keep what is shown
    }
  }, [empId]);

  useEffect(() => {
    load();
  }, [load]);

  const call = async (method: "POST" | "DELETE", d: Day) => {
    setBusy(true);
    try {
      const res =
        method === "POST"
          ? await fetch(API, {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ empId, date: d.date }),
            })
          : await fetch(`${API}?empId=${encodeURIComponent(empId)}&date=${d.date}`, { method });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify("Week off", j?.error || "Could not update. Please try again.");
      } else {
        setWeek(j);
        onChanged?.();
      }
    } catch {
      notify("Week off", "No connection. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const onTap = (d: Day) => {
    if (busy) return;
    if (d.canTake) {
      confirmAsk("Take a week off?", `Mark ${d.dayName} (${d.date}) as your week off. You cannot punch in that day.`, () => call("POST", d));
    } else if (d.canCancel) {
      confirmAsk("Cancel this week off?", `${d.dayName} (${d.date}) will become a working day again.`, () => call("DELETE", d));
    }
  };

  if (!week || week.flexOffsPerWeek <= 0) return null;

  return (
    <View style={{ borderColor: C.border }} className="bg-white border rounded-3xl p-4 mb-3">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View style={{ backgroundColor: C.soft }} className="w-9 h-9 rounded-xl items-center justify-center mr-2.5">
            <CalendarOff size={17} color={C.primary} />
          </View>
          <View>
            <Text style={{ color: C.ink }} className="text-sm font-black">My week off</Text>
            <Text style={{ color: C.muted }} className="text-[11px] font-medium">
              You work {week.workingDaysPerWeek} days a week
            </Text>
          </View>
        </View>
        <View style={{ backgroundColor: week.left > 0 ? C.soft : "#F1F0F7" }} className="px-3 py-1.5 rounded-full">
          <Text style={{ color: week.left > 0 ? C.primary : C.muted }} className="text-[11px] font-black">
            {week.left} of {week.flexOffsPerWeek} left
          </Text>
        </View>
      </View>

      <View className="flex-row" style={{ gap: 6 }}>
        {week.days.map((d) => {
          const fixed = d.kind === "FIXED_OFF";
          const flex = d.kind === "FLEX_OFF";
          const tappable = d.canTake || d.canCancel;
          const bg = flex ? C.primary : fixed ? "#EDEBF7" : d.isToday ? C.soft : "#FFFFFF";
          const border = flex ? C.primary : d.isToday ? C.primary : C.border;
          return (
            <TouchableOpacity
              key={d.date}
              disabled={!tappable || busy}
              activeOpacity={0.8}
              onPress={() => onTap(d)}
              style={{
                flex: 1,
                backgroundColor: bg,
                borderColor: border,
                borderWidth: 1,
                borderStyle: tappable && !flex ? "dashed" : "solid",
                opacity: d.isPast && !flex && !fixed ? 0.55 : 1,
              }}
              className="rounded-2xl py-2.5 items-center"
            >
              <Text style={{ color: flex ? "#FFFFFF" : C.muted }} className="text-[10px] font-black uppercase">
                {d.dayName}
              </Text>
              <Text style={{ color: flex ? "#FFFFFF" : C.ink }} className="text-sm font-black mt-0.5">
                {Number(d.date.slice(8, 10))}
              </Text>
              <View style={{ height: 16 }} className="items-center justify-center mt-1">
                {flex ? (
                  <Check size={12} color="#FFFFFF" />
                ) : fixed ? (
                  <Text style={{ color: C.muted }} className="text-[9px] font-black">OFF</Text>
                ) : d.worked ? (
                  <Check size={12} color="#15803D" />
                ) : d.canTake ? (
                  <Text style={{ color: C.primary }} className="text-[9px] font-black">TAKE</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ color: C.muted }} className="text-[11px] font-medium mt-3">
        Tap a day marked TAKE to use a week off. Tap a purple day to give it back.
      </Text>
      {busy && <ActivityIndicator size="small" color={C.primary} style={{ marginTop: 8 }} />}
    </View>
  );
}