import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Platform, Alert, ActivityIndicator } from "react-native";
import { Home } from "lucide-react-native";
import { BASE_HOST } from "../constants/config";

const C = { primary: "#5B4FD1", ink: "#1F1B3D", muted: "#7A76A6", border: "#E7E4F5", soft: "#EEECFA", bg: "#F6F5FC" };
const API = `${BASE_HOST}/api/wfh`;

interface Day {
  date: string;
  dayName: string;
  kind: "OFF" | "OFFICE" | "WFH_FIXED" | "WFH_PENDING" | "WFH_APPROVED" | string;
  isToday: boolean;
  isPast: boolean;
  worked: boolean;
  canRequest: boolean;
  canCancel: boolean;
}
interface Week {
  wfhDaysPerWeek: number;
  used: number;
  left: number;
  needsApproval: boolean;
  emergency?: boolean;
  emergencyPerMonth?: number;
  emergencyLeft?: number;
  fixedWfhDays: string[];
  days: Day[];
}

const notify = (title: string, msg: string) =>
  Platform.OS === "web" ? window.alert(`${title}\n${msg}`) : Alert.alert(title, msg);

const confirmAsk = (title: string, msg: string, onYes: () => void) => {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n${msg}`)) onYes();
    return;
  }
  Alert.alert(title, msg, [{ text: "Not now", style: "cancel" }, { text: "Yes", onPress: onYes }]);
};

/** This week's office and work-from-home days. Employees raise a WFH day by tapping it. Hidden if the person has no WFH policy. */
export default function WfhCard({
  empId,
  onChanged,
  emptyText,
}: {
  empId: string;
  onChanged?: () => void;
  emptyText?: string; // shown instead of hiding the card (use it when the card is a whole tab)
}) {
  const [week, setWeek] = useState<Week | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [emDay, setEmDay] = useState<Day | null>(null); // emergency: day chosen, waiting for the reason
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    if (!empId) return;
    try {
      const res = await fetch(`${API}?empId=${encodeURIComponent(empId)}`, { cache: "no-store" });
      if (res.ok) {
        setWeek(await res.json());
        setLoadError("");
      } else {
        setLoadError(`Could not load work from home (server error ${res.status}).`);
      }
    } catch {
      setLoadError("Could not reach the server. Check your connection.");
    } finally {
      setLoaded(true);
    }
  }, [empId]);

  useEffect(() => {
    load();
  }, [load]);

  const call = async (method: "POST" | "DELETE", d: Day, why?: string) => {
    setBusy(true);
    try {
      const res =
        method === "POST"
          ? await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ empId, date: d.date, reason: why }) })
          : await fetch(`${API}?empId=${encodeURIComponent(empId)}&date=${d.date}`, { method });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) notify("Work from home", j?.error || "Could not update. Please try again.");
      else {
        setWeek(j);
        setEmDay(null);
        setReason("");
        onChanged?.();
      }
    } catch {
      notify("Work from home", "No connection. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const onTap = (d: Day) => {
    if (busy) return;
    if (d.canRequest && week?.emergency) {
      setEmDay(d); // ask for the reason first
    } else if (d.canRequest) {
      confirmAsk(
        "Work from home?",
        week?.needsApproval
          ? `Send a WFH request for ${d.dayName} (${d.date}). Your manager has to approve it.`
          : `Take ${d.dayName} (${d.date}) as a work-from-home day. You will not need the office location that day.`,
        () => call("POST", d)
      );
    } else if (d.canCancel) {
      confirmAsk("Cancel WFH?", `${d.dayName} (${d.date}) becomes an office day again.`, () => call("DELETE", d));
    }
  };

  if (!week) {
    // Only show something when the card is a whole tab (emptyText given); on other screens stay hidden
    if (!emptyText) return null;
    return (
      <View style={{ borderColor: C.border }} className="bg-white border rounded-3xl p-5 mb-3">
        {!loaded ? (
          <ActivityIndicator size="small" color={C.primary} />
        ) : (
          <>
            <Text style={{ color: C.ink }} className="text-xs font-black">{loadError || emptyText}</Text>
            <TouchableOpacity onPress={load} className="mt-3 self-start">
              <Text style={{ color: C.primary }} className="text-xs font-black">TRY AGAIN</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }
  if (week.wfhDaysPerWeek <= 0 && week.fixedWfhDays.length === 0 && !week.emergency) {
    return emptyText ? (
      <View style={{ borderColor: C.border }} className="bg-white border rounded-3xl p-5 mb-3">
        <Text style={{ color: C.muted }} className="text-xs font-bold">{emptyText}</Text>
      </View>
    ) : null;
  }

  const label = (d: Day) =>
    d.kind === "OFF" ? "OFF" : d.kind === "WFH_FIXED" || d.kind === "WFH_APPROVED" ? "WFH" : d.kind === "WFH_PENDING" ? "WAIT" : d.canRequest ? "ASK" : "OFFICE";

  return (
    <View style={{ borderColor: C.border }} className="bg-white border rounded-3xl p-4 mb-3">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View style={{ backgroundColor: C.soft }} className="w-9 h-9 rounded-xl items-center justify-center mr-2.5">
            <Home size={17} color={C.primary} />
          </View>
          <View>
            <Text style={{ color: C.ink }} className="text-sm font-black">
              {week.emergency ? "Emergency work from home" : "Office & work from home"}
            </Text>
            <Text style={{ color: C.muted }} className="text-[11px] font-medium">
              {week.fixedWfhDays.length > 0 ? `Fixed WFH: ${week.fixedWfhDays.join(", ")}` : "Office days need your office location"}
            </Text>
          </View>
        </View>
        {week.emergency && (
          <View style={{ backgroundColor: (week.emergencyLeft ?? 0) > 0 ? C.soft : "#F1F0F7" }} className="px-3 py-1.5 rounded-full">
            <Text style={{ color: (week.emergencyLeft ?? 0) > 0 ? C.primary : C.muted }} className="text-[11px] font-black">
              {week.emergencyLeft ?? 0} of {week.emergencyPerMonth ?? 0} left this month
            </Text>
          </View>
        )}
        {week.wfhDaysPerWeek > 0 && (
          <View style={{ backgroundColor: week.left > 0 ? C.soft : "#F1F0F7" }} className="px-3 py-1.5 rounded-full">
            <Text style={{ color: week.left > 0 ? C.primary : C.muted }} className="text-[11px] font-black">
              {week.left} of {week.wfhDaysPerWeek} WFH left
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row" style={{ gap: 6 }}>
        {week.days.map((d) => {
          const wfh = d.kind === "WFH_FIXED" || d.kind === "WFH_APPROVED";
          const pending = d.kind === "WFH_PENDING";
          const off = d.kind === "OFF";
          const tappable = d.canRequest || d.canCancel;
          return (
            <TouchableOpacity
              key={d.date}
              disabled={!tappable || busy}
              activeOpacity={0.8}
              onPress={() => onTap(d)}
              style={{
                flex: 1,
                backgroundColor: wfh ? C.primary : pending ? "#FEF3C7" : off ? "#EDEBF7" : d.isToday ? C.soft : "#FFFFFF",
                borderColor: wfh ? C.primary : pending ? "#FCD34D" : d.isToday ? C.primary : C.border,
                borderWidth: 1,
                borderStyle: d.canRequest ? "dashed" : "solid",
                opacity: d.isPast && !wfh && !off ? 0.55 : 1,
              }}
              className="rounded-2xl py-2.5 items-center"
            >
              <Text style={{ color: wfh ? "#FFFFFF" : C.muted }} className="text-[10px] font-black uppercase">{d.dayName}</Text>
              <Text style={{ color: wfh ? "#FFFFFF" : C.ink }} className="text-sm font-black mt-0.5">{Number(d.date.slice(8, 10))}</Text>
              <Text
                style={{ color: wfh ? "#FFFFFF" : pending ? "#B45309" : d.canRequest ? C.primary : C.muted }}
                className="text-[9px] font-black mt-1"
              >
                {label(d)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {emDay && (
        <View style={{ borderColor: C.border, backgroundColor: C.bg }} className="border rounded-2xl p-3 mt-3">
          <Text style={{ color: C.ink }} className="text-xs font-black mb-2">
            Emergency WFH for {emDay.dayName} ({emDay.date}) - your manager has to approve it
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason (required)"
            placeholderTextColor={C.muted}
            multiline
            style={{ borderColor: C.border, color: C.ink, backgroundColor: "#FFFFFF", minHeight: 44 }}
            className="border rounded-xl px-3 py-2 text-sm font-semibold"
          />
          <View className="flex-row mt-2" style={{ gap: 8 }}>
            <TouchableOpacity
              disabled={busy || reason.trim().length < 3}
              onPress={() => call("POST", emDay, reason.trim())}
              style={{ backgroundColor: reason.trim().length < 3 ? "#C9C5E6" : C.primary }}
              className="flex-1 rounded-xl py-2.5 items-center"
            >
              <Text className="text-white text-xs font-black">SEND REQUEST</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setEmDay(null); setReason(""); }}
              style={{ borderColor: C.border }}
              className="rounded-xl py-2.5 px-4 items-center border bg-white"
            >
              <Text style={{ color: C.muted }} className="text-xs font-black">CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={{ color: C.muted }} className="text-[11px] font-medium mt-3">
        Tap a day marked ASK to work from home. Office days use the office location check.
      </Text>
      {busy && <ActivityIndicator size="small" color={C.primary} style={{ marginTop: 8 }} />}
    </View>
  );
}