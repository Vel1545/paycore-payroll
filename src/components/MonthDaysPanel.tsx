import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { BASE_HOST } from "../constants/config";

/**
 * Day-by-day status of one employee's month: absent, week-offs, holidays, leave.
 * <MonthDaysPanel empId="F9003" month="2026-10" adminEmpId={String(UserSession.empId || "")} isDesktop={isDesktop} />
 */
const API = `${BASE_HOST}/api/payroll/month-days`;

interface Day {
  date: string; dayName: string; type: "WORKING" | "FIXED_OFF" | "HOLIDAY"; status: string; label: string;
  detail: string | null; in: string | null; out: string | null; netMinutes: number | null;
  lateMinutes: number | null; penaltyInr: number | null; edited: boolean; credit: number | null;
}
interface Week { from: string; to: string; requiredDays: number; workedDays: number; lopDays: number; approvedOffs: number; pendingOffs: number }
interface Data {
  empId: string; name: string; month: string; scheduleType: "FIXED" | "FLEXIBLE"; flexOffsPerWeek: number;
  fixedOffDays: string[]; judgedUpTo: string | null; counts: Record<string, number>; weeks: Week[];
  weekLopDays: number; ledger: Record<string, any> | null; days: Day[];
}

type Filter = "ALL" | "ABSENT" | "OFFS" | "HOLIDAY" | "LEAVE";
const FILTERS: { key: Filter; label: string; match: (s: string) => boolean }[] = [
  { key: "ALL", label: "All", match: () => true },
  { key: "ABSENT", label: "Absent", match: (s) => ["ABSENT", "NO_PUNCH", "OPEN_CHECKOUT", "HALF_DAY"].includes(s) },
  { key: "OFFS", label: "Week offs", match: (s) => ["FIXED_OFF", "FLEX_OFF", "FLEX_PENDING"].includes(s) },
  { key: "HOLIDAY", label: "Holidays", match: (s) => s === "HOLIDAY" },
  { key: "LEAVE", label: "Leave", match: (s) => s === "LEAVE" },
];

const COLOR: Record<string, { bg: string; fg: string }> = {
  PRESENT: { bg: "#dcfce7", fg: "#166534" },
  HALF_DAY: { bg: "#fef9c3", fg: "#854d0e" },
  ABSENT: { bg: "#fee2e2", fg: "#991b1b" },
  NO_PUNCH: { bg: "#ffedd5", fg: "#9a3412" },
  OPEN_CHECKOUT: { bg: "#ffedd5", fg: "#9a3412" },
  HOLIDAY: { bg: "#e0e7ff", fg: "#3730a3" },
  FIXED_OFF: { bg: "#f1f5f9", fg: "#475569" },
  FLEX_OFF: { bg: "#ccfbf1", fg: "#115e59" },
  FLEX_PENDING: { bg: "#fef3c7", fg: "#92400e" },
  LEAVE: { bg: "#f3e8ff", fg: "#6b21a8" },
  NOT_JOINED: { bg: "#f1f5f9", fg: "#94a3b8" },
  TODAY: { bg: "#dbeafe", fg: "#1e40af" },
  UPCOMING: { bg: "#f8fafc", fg: "#94a3b8" },
};
const colorOf = (s: string) => COLOR[s] || { bg: "#f1f5f9", fg: "#475569" };

const hm = (m: number | null) => (m == null ? "" : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`);
const short = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

export default function MonthDaysPanel({ empId, month, adminEmpId, isDesktop }: { empId: string; month: string; adminEmpId: string; isDesktop: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${API}?empId=${encodeURIComponent(empId)}&month=${encodeURIComponent(month)}&adminEmpId=${encodeURIComponent(adminEmpId)}`;
      const res = await fetch(url, { cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.message || j?.error || `Request failed (${res.status})`);
      setData(j as Data);
    } catch (e: any) {
      setData(null);
      setError(e.message || "Could not load the day-wise status");
    } finally {
      setLoading(false);
    }
  }, [empId, month, adminEmpId]);

  useEffect(() => { load(); }, [load]);

  const active = FILTERS.find((f) => f.key === filter)!;
  const shown = useMemo(() => (data ? data.days.filter((d) => active.match(d.status)) : []), [data, active]);
  const countFor = (f: (typeof FILTERS)[number]) =>
    data ? data.days.filter((d) => f.match(d.status)).length : 0;

  if (loading) return <View style={{ padding: 24, alignItems: "center" }}><ActivityIndicator /></View>;
  if (error || !data) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: "#b91c1c", marginBottom: 8 }}>{error || "No data"}</Text>
        <TouchableOpacity onPress={load}><Text style={{ color: "#2563eb", fontWeight: "600" }}>Try again</Text></TouchableOpacity>
      </View>
    );
  }

  const c = data.counts;
  const chips: { label: string; value: number; status: string }[] = [
    { label: "Present", value: (c.PRESENT || 0) + (c.HALF_DAY || 0), status: "PRESENT" },
    { label: "Absent", value: c.ABSENT || 0, status: "ABSENT" },
    { label: "No punch", value: c.NO_PUNCH || 0, status: "NO_PUNCH" },
    { label: "Week offs", value: (c.FIXED_OFF || 0) + (c.FLEX_OFF || 0), status: "FLEX_OFF" },
    { label: "Holidays", value: c.HOLIDAY || 0, status: "HOLIDAY" },
    { label: "Leave", value: c.LEAVE || 0, status: "LEAVE" },
  ];
  const flexible = data.scheduleType === "FLEXIBLE";

  return (
    <View style={{ padding: isDesktop ? 20 : 12 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a" }}>{data.name} · {data.empId}</Text>
      <Text style={{ color: "#64748b", marginTop: 2, marginBottom: 10 }}>
        {data.month} · {flexible ? `Flexible (${data.flexOffsPerWeek} off/week${data.fixedOffDays.length ? ", fixed " + data.fixedOffDays.join(", ") : ""})` : `Fixed off: ${data.fixedOffDays.join(", ") || "none"}`}
        {data.judgedUpTo ? ` · counted up to ${short(data.judgedUpTo)}` : ""}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 12 }}>
        {chips.map((x) => (
          <View key={x.label} style={{ backgroundColor: colorOf(x.status).bg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, marginBottom: 8, minWidth: 78 }}>
            <Text style={{ color: colorOf(x.status).fg, fontSize: 18, fontWeight: "800" }}>{x.value}</Text>
            <Text style={{ color: colorOf(x.status).fg, fontSize: 11 }}>{x.label}</Text>
          </View>
        ))}
      </View>

      {data.ledger ? (
        <Text style={{ color: "#475569", fontSize: 12, marginBottom: 10 }}>
          Ledger ({String(data.ledger.status)}): worked {String(data.ledger.worked_days)} · absent LOP {String(data.ledger.absent_lop_days)} · LOP {String(data.ledger.lop_days)} · adjusted LOP {String(data.ledger.adj_lop_days)}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)}
              style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, marginRight: 6, marginBottom: 6, backgroundColor: on ? "#0f172a" : "#f1f5f9" }}>
              <Text style={{ color: on ? "#fff" : "#334155", fontWeight: "600", fontSize: 13 }}>{f.label} ({countFor(f)})</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {shown.length === 0 ? <Text style={{ color: "#64748b", padding: 12 }}>Nothing in this list.</Text> : null}
      {shown.map((d) => {
        const col = colorOf(d.status);
        return (
          <View key={d.date} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }}>
            <View style={{ width: 62 }}>
              <Text style={{ fontWeight: "700", color: "#0f172a" }}>{short(d.date)}</Text>
              <Text style={{ fontSize: 11, color: "#64748b" }}>{d.dayName}</Text>
            </View>
            <View style={{ backgroundColor: col.bg, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 9, marginRight: 10, maxWidth: isDesktop ? 260 : 150 }}>
              <Text style={{ color: col.fg, fontWeight: "700", fontSize: 12 }}>{d.label}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {d.in ? <Text style={{ fontSize: 12, color: "#334155" }}>{d.in} – {d.out || "—"}{d.netMinutes ? ` · ${hm(d.netMinutes)}` : ""}</Text> : null}
              {d.lateMinutes ? <Text style={{ fontSize: 11, color: "#b45309" }}>Late {d.lateMinutes} min{d.penaltyInr ? ` · penalty ₹${d.penaltyInr}` : ""}</Text> : null}
              {d.detail ? <Text style={{ fontSize: 11, color: "#64748b" }}>{d.detail}</Text> : null}
              {d.edited ? <Text style={{ fontSize: 11, color: "#7c3aed" }}>Edited by admin</Text> : null}
            </View>
          </View>
        );
      })}

      {flexible && data.weeks.length > 0 ? (
        <View style={{ marginTop: 18 }}>
          <Text style={{ fontWeight: "700", color: "#0f172a", marginBottom: 6 }}>Week by week (same rule as payroll)</Text>
          <View style={{ flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#cbd5e1" }}>
            {["Week", "Needed", "Worked", "Offs", "LOP"].map((h, i) => (
              <Text key={h} style={{ flex: i === 0 ? 2 : 1, fontSize: 11, fontWeight: "700", color: "#64748b" }}>{h}</Text>
            ))}
          </View>
          {data.weeks.map((w) => (
            <View key={w.from} style={{ flexDirection: "row", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }}>
              <Text style={{ flex: 2, fontSize: 12, color: "#334155" }}>{short(w.from)} – {short(w.to)}</Text>
              <Text style={{ flex: 1, fontSize: 12, color: "#334155" }}>{w.requiredDays}</Text>
              <Text style={{ flex: 1, fontSize: 12, color: "#334155" }}>{w.workedDays}</Text>
              <Text style={{ flex: 1, fontSize: 12, color: "#334155" }}>{w.approvedOffs}{w.pendingOffs ? ` (+${w.pendingOffs} wait)` : ""}</Text>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: "700", color: w.lopDays > 0 ? "#b91c1c" : "#166534" }}>{w.lopDays}</Text>
            </View>
          ))}
          <Text style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>Total LOP from weeks: {data.weekLopDays}</Text>
        </View>
      ) : null}
    </View>
  );
}