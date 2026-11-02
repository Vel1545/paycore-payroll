import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { RotateCw } from "lucide-react-native";
import { BASE_HOST } from "../constants/config";

interface Punch {
  id: string;
  date: string;
  kind: "PERMISSION" | "OD";
  purpose?: string;
  status: string; // OPEN, PENDING, APPROVED, VOID
  startTime: string;
  endTime?: string | null;
  chargedMinutes?: number;
  approvedMinutes?: number | null;
  penaltyInr?: number | null;
  lopDays?: number | null;
  missingEnd?: boolean;
  decidedBy?: string | null;
  adminNote?: string | null;
}

const clock = (t?: string | null) => {
  if (!t) return "-";
  const m = /(\d{2}):(\d{2})/.exec(t.replace("T", " ").split(" ")[1] || "");
  if (!m) return t;
  const h = Number(m[1]);
  return `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, "0")}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
};

/**
 * Employee view of their own punched permissions / ODs (read only), next to the normal request list.
 * Shows nothing when the person has no punches of this kind.
 */
export default function Permissionpunchmypanel({ empId, kind }: { empId: string; kind: "PERMISSION" | "OD" }) {
  const [all, setAll] = useState<Punch[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!empId) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_HOST}/api/attendance/permission-punch/mine?empId=${encodeURIComponent(empId)}`, { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setAll(Array.isArray(d) ? d : []);
      }
    } catch {
      // keep the last list
    } finally {
      setLoading(false);
    }
  }, [empId]);

  useEffect(() => {
    load();
  }, [load]);

  const items = all.filter((p: Punch) => p.kind === kind && p.status !== "VOID");
  if (items.length === 0) return null;

  const label = (p: Punch) =>
    p.status === "OPEN" ? { t: "RUNNING", c: "text-sky-700", b: "bg-sky-50 border-sky-200" }
    : p.status === "PENDING" ? { t: "WAITING FOR VERIFICATION", c: "text-amber-700", b: "bg-amber-50 border-amber-200" }
    : { t: "VERIFIED", c: "text-emerald-700", b: "bg-emerald-50 border-emerald-200" };

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-[11px] font-black text-[#1F1B3D] uppercase tracking-wider">
          My punched {kind === "OD" ? "OD" : "permission"} (Start / End)
        </Text>
        <TouchableOpacity onPress={load}>
          {loading ? <ActivityIndicator size="small" color="#5B4FD1" /> : <RotateCw size={14} color="#5B4FD1" />}
        </TouchableOpacity>
      </View>
      {items.map((p: Punch) => {
        const l = label(p);
        return (
          <View key={p.id} className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-2.5">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs font-black text-[#1F1B3D]">
                {p.date} • {clock(p.startTime)} to {p.endTime ? clock(p.endTime) : "running"}
              </Text>
              <View className={`px-2.5 py-1 rounded-full border ${l.b}`}>
                <Text className={`text-[9px] font-black ${l.c}`}>{l.t}</Text>
              </View>
            </View>
            {!!p.purpose && <Text className="text-[11px] font-semibold text-[#7A76A6]">Purpose: {p.purpose}</Text>}
            {p.status !== "OPEN" && (
              <Text className="text-[11px] font-bold text-[#7A76A6] mt-0.5">
                Counted: <Text className="text-[#1F1B3D]">{p.chargedMinutes ?? 0} min</Text>
                {p.status === "APPROVED" && (
                  <Text>
                    {" "}• Approved: <Text className="text-emerald-700">{p.approvedMinutes ?? 0} min</Text>
                    {p.penaltyInr ? <Text className="text-[#E4453C]"> • Penalty Rs {p.penaltyInr}</Text> : null}
                    {p.lopDays && Number(p.lopDays) > 0 ? <Text className="text-[#E4453C]"> • Unpaid {Number(p.lopDays)} day</Text> : null}
                  </Text>
                )}
              </Text>
            )}
            {p.missingEnd && <Text className="text-[10px] font-bold text-amber-700 mt-0.5">The end punch was missing, so it was closed automatically.</Text>}
            {!!p.adminNote && <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5">Note: {p.adminNote}</Text>}
          </View>
        );
      })}
    </View>
  );
}