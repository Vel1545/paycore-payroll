import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { BASE_HOST } from "../constants/config";

const API = `${BASE_HOST}/api/payroll/view`;

// ---------- shared helpers (also used by SalaryViewScreen) ----------
export const pad = (n: number) => String(n).padStart(2, "0");
export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const monthsBetween = (from: Date, to: Date) => {
  const out: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end) {
    out.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
};
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[Number(m) - 1] || ym} ${y}`;
};
export const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};
// Indian grouping (12,34,567) without relying on Intl
export const inr = (v: any) => {
  const n = Number(v) || 0;
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return `${n < 0 ? "-" : ""}₹${grouped}${dec === "00" ? "" : "." + dec}`;
};
export const num = (v: any) => {
  const n = Number(v) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};
export const shortDate = (s: string) => {
  const p = String(s || "").slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}-${p[1]}` : s;
};
const timeOnly = (s?: string | null) => (s ? String(s).replace("T", " ").slice(11, 16) : "—");

export const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  NOT_CALCULATED: { bg: "#FDE9E8", fg: "#E4453C" },
  DRAFT: { bg: "#FFF6E5", fg: "#B7791F" },
  FINALIZED: { bg: "#E7FAEE", fg: "#1FAE5C" },
  PAID: { bg: "#EEECFA", fg: "#5B4FD1" },
};
export const StatusPill = ({ status }: { status: string }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE.DRAFT;
  return (
    <View className="px-2.5 py-1 rounded-full self-start" style={{ backgroundColor: s.bg }}>
      <Text className="text-[10px] font-black" style={{ color: s.fg }}>{status.replace("_", " ")}</Text>
    </View>
  );
};

// ---------- month stepper ----------
export function MonthStepper({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const current = monthKey(new Date());
  return (
    <View className="flex-row items-center justify-between bg-white border border-[#E7E4F5] rounded-2xl px-2 py-2 mb-4">
      <TouchableOpacity onPress={() => onChange(shiftMonth(month, -1))} className="w-10 h-10 rounded-xl bg-[#F6F5FC] items-center justify-center">
        <ChevronLeft size={18} color="#5B4FD1" />
      </TouchableOpacity>
      <Text className="text-sm font-black text-[#1F1B3D]">{monthLabel(month)}</Text>
      <TouchableOpacity
        onPress={() => month < current && onChange(shiftMonth(month, 1))}
        disabled={month >= current}
        className="w-10 h-10 rounded-xl bg-[#F6F5FC] items-center justify-center"
        style={{ opacity: month >= current ? 0.35 : 1 }}
      >
        <ChevronRight size={18} color="#5B4FD1" />
      </TouchableOpacity>
    </View>
  );
}

// ---------- small blocks ----------
export const Line = ({ label, value, bold, tone, hint }: { label: string; value: string; bold?: boolean; tone?: string; hint?: string }) => (
  <View className="flex-row items-start justify-between py-1.5">
    <View style={{ flex: 1, paddingRight: 8 }}>
      <Text className={`text-xs ${bold ? "font-black text-[#1F1B3D]" : "font-bold text-[#7A76A6]"}`}>{label}</Text>
      {hint ? <Text className="text-[10px] text-[#A6A2CE] mt-0.5">{hint}</Text> : null}
    </View>
    <Text className={`text-xs ${bold ? "font-black" : "font-bold"}`} style={{ color: tone || "#1F1B3D" }}>{value}</Text>
  </View>
);
export const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 mb-3">
    <Text className="text-[11px] font-black text-[#5B4FD1] uppercase tracking-wider mb-2">{title}</Text>
    {children}
  </View>
);

interface Props {
  empId: string;
  month: string; // YYYY-MM
  /** "my" = what an employee may see (published payslips only). "admin" = any state. */
  mode: "my" | "admin";
  reloadKey?: number;
  showEmployerShare?: boolean;
  /** Admin only: tap a day in the day-wise table to correct it. */
  onEditDay?: (day: any) => void;
}

/** One person, one month: summary, earnings, deductions, leave requests and day-wise attendance. */
export default function PayslipView({ empId, month, mode, reloadKey = 0, showEmployerShare = false, onEditDay }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const path = mode === "my" ? "my" : "detail";
      const res = await fetch(`${API}/${path}?empId=${encodeURIComponent(empId)}&month=${month}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      setData(json);
    } catch (e: any) {
      setData(null);
      setError(e?.message || "Could not load salary details");
    } finally {
      setLoading(false);
    }
  }, [empId, month, mode]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  if (loading && !data) return <ActivityIndicator color="#5B4FD1" style={{ marginTop: 40 }} />;
  if (error)
    return (
      <View className="items-center mt-10">
        <Text className="text-sm font-bold text-[#E4453C] mb-3 text-center">{error}</Text>
        <TouchableOpacity onPress={load} className="px-4 py-2 rounded-full bg-[#5B4FD1]">
          <Text className="text-xs font-black text-white">TRY AGAIN</Text>
        </TouchableOpacity>
      </View>
    );
  if (!data) return null;

  if (data.published === false) {
    return (
      <View className="bg-white border border-[#E7E4F5] rounded-3xl p-6 items-center">
        <Text className="text-sm font-black text-[#1F1B3D] text-center">Payslip not ready</Text>
        <Text className="text-xs font-bold text-[#7A76A6] text-center mt-1">
          Your salary for {monthLabel(month)} has not been finalized yet. It appears here once the admin completes payroll.
        </Text>
      </View>
    );
  }

  const s = data.summary;
  if (!s) return null;
  return (
    <>
      <View className="bg-[#1F1B3D] rounded-3xl p-5 mb-3">
        <Text className="text-[11px] font-black text-[#A6A2CE] uppercase tracking-wider">{s.salaryMonth} • {shortDate(s.periodStart)} to {shortDate(s.periodEnd)}</Text>
        <Text className="text-lg font-black text-white mt-1">{s.userName}</Text>
        <Text className="text-xs font-bold text-[#A6A2CE]">{s.empId}{s.department ? ` • ${s.department}` : ""}</Text>
        <View className="flex-row items-end justify-between mt-3">
          <View>
            <Text className="text-[10px] font-black text-[#A6A2CE] uppercase tracking-wider">Take-home net pay</Text>
            <Text className="text-2xl font-black text-emerald-300">{inr(s.netSalary)}</Text>
          </View>
          <StatusPill status={s.status} />
        </View>
        <View className="flex-row justify-between pt-3 mt-3 border-t border-white/15">
          <Text className="text-xs font-semibold text-[#A6A2CE]">Gross: <Text className="font-black text-white">{inr(s.grossEarnings)}</Text></Text>
          <Text className="text-xs font-semibold text-rose-200">Deductions: <Text className="font-black text-rose-200">{inr(s.totalDeductions)}</Text></Text>
        </View>
        {!s.calculated && (
          <Text className="text-[11px] font-bold text-[#F5C26B] mt-2">Not calculated yet. Amounts appear after payroll is run for this month.</Text>
        )}
      </View>

      <Section title="Attendance">
        <Line label="Days in month" value={num(s.monthDays)} />
        <Line label="Present days (incl. week off & holidays)" value={num(s.presentDaysTotal)} />
        <Line label="LOP days (total)" value={num(s.lopDaysTotal)} bold tone={Number(s.lopDaysTotal) > 0 ? "#E4453C" : undefined} />
        <Line label="  Absent (no punch, no leave)" value={num(s.lopAbsentDays)} />
        <Line label="  Leave beyond balance" value={num(s.lopLeaveDays)} />
        <Line label="  Permission over free hours" value={`${num(s.lopPermissionDays)}  (${num(s.permissionPenaltyHours)}h)`} />
        <Line label="On-Duty" value={`${num(s.odDays)} days, ${num(s.odHours)}h`} hint="For reference. OD time is already inside present hours." />
      </Section>

      <Section title="Earnings">
        <Line label="Monthly salary" value={inr(s.monthlySalary)} hint={s.calculated ? `Day rate ${inr(s.dayRate)}` : undefined} />
        <Line label={`Overtime (${num(s.overtimeHours)}h)`} value={inr(s.overtimePay)} />
        <Line label="Daily allowance" value={inr(s.dailyAllowance)} />
        <Line label="Bonus" value={inr(s.bonus)} />
        <Line label="Gift" value={inr(s.gift)} />
        <Line label="Approved claims" value={inr(s.claims)} />
        <Line label="Gross earnings" value={inr(s.grossEarnings)} bold />
      </Section>

      <Section title="Deductions">
        <Line label={`LOP cut (${num(s.lopDaysTotal)} days)`} value={inr(s.lopCut)} />
        <Line label="Attendance penalty (late / early / shortfall)" value={inr(s.attendancePenaltyInr)} />
        <Line label="Provident Fund (PF)" value={inr(s.pfDeduction)} hint={showEmployerShare ? `Employer PF ${inr(s.employerPf)}` : undefined} />
        <Line label="ESI" value={inr(s.esiDeduction)} hint={showEmployerShare ? `Employer ESI ${inr(s.employerEsi)}` : undefined} />
        <Line label="Salary advance" value={inr(s.advance)} />
        <Line label="Other deductions" value={inr(s.otherDeductions)} />
        <Line label="Total deductions" value={inr(s.totalDeductions)} bold tone="#E4453C" />
        <Line label="Net pay" value={inr(s.netSalary)} bold tone="#1FAE5C" />
      </Section>

      <Section title={`Leave and permission requests (${data.leaves?.length || 0})`}>
        <LeaveList leaves={data.leaves || []} />
      </Section>

      <Section title={`Day-wise attendance (${data.days?.length || 0})`}>
        {onEditDay && <Text className="text-[11px] font-bold text-[#7A76A6] mb-2">Tap a day to correct its worked minutes. Edited days are highlighted (✎).</Text>}
        <DayWiseTable days={data.days || []} onEdit={onEditDay} />
      </Section>
    </>
  );
}

export function LeaveList({ leaves }: { leaves: any[] }) {
  if (!leaves.length) return <Text className="text-xs font-bold text-[#A6A2CE]">None in this period.</Text>;
  return (
    <>
      {leaves.map((l: any, i: number) => (
        <View key={i} className="py-2 border-b border-[#F0EEFA]">
          <Text className="text-xs font-black text-[#1F1B3D]">{l.category || l.nature}</Text>
          <Text className="text-[11px] font-bold text-[#7A76A6]">
            {shortDate(l.startDate)}{l.endDate !== l.startDate ? ` → ${shortDate(l.endDate)}` : ""} •{" "}
            {Number(l.days) > 0 ? `${num(l.approvedDays ?? l.days)} day(s)` : `${num(l.hours)}h`} • {l.status}
          </Text>
        </View>
      ))}
    </>
  );
}

export function DayWiseTable({ days, onEdit }: { days: any[]; onEdit?: (day: any) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View>
        <View className="flex-row border-b border-[#E7E4F5] pb-1.5">
          {["Date", "Status", "In", "Out", "Net min", "Pay day", "Late", "Early", "Penalty", "OT h"].map((h, i) => (
            <Text key={h} className="text-[10px] font-black text-[#7A76A6] uppercase" style={{ width: i === 1 ? 84 : 58 }}>{h}</Text>
          ))}
        </View>
        {days.map((d: any) => (
          <TouchableOpacity
            key={d.date}
            activeOpacity={onEdit ? 0.6 : 1}
            disabled={!onEdit}
            onPress={() => onEdit && onEdit(d)}
            className="flex-row py-1.5 border-b border-[#F6F5FC]"
            style={d.edited ? { backgroundColor: "#FFF7E0" } : undefined}
          >
            <Text className="text-[11px] font-bold text-[#1F1B3D]" style={{ width: 58 }}>{shortDate(d.date)}</Text>
            <Text className="text-[11px] font-black" style={{ width: 84, color: d.status === "PRESENT" ? "#1FAE5C" : d.status === "HALF_DAY" ? "#B7791F" : "#E4453C" }}>
              {d.status}{d.isOd ? " (OD)" : ""}
            </Text>
            <Text className="text-[11px] text-[#1F1B3D]" style={{ width: 58 }}>{timeOnly(d.firstIn)}</Text>
            <Text className="text-[11px] text-[#1F1B3D]" style={{ width: 58 }}>{timeOnly(d.lastOut)}</Text>
            <Text className="text-[11px] text-[#1F1B3D]" style={{ width: 58 }}>{num(d.netMinutes)}{d.edited ? " ✎" : ""}</Text>
            <Text className="text-[11px] font-black text-[#1F1B3D]" style={{ width: 58 }}>{num(d.payableDays)}</Text>
            <Text className="text-[11px] text-[#1F1B3D]" style={{ width: 58 }}>{num(d.lateMinutes)}</Text>
            <Text className="text-[11px] text-[#1F1B3D]" style={{ width: 58 }}>{num(d.earlyExitMinutes)}</Text>
            <Text className="text-[11px] text-[#1F1B3D]" style={{ width: 58 }}>{num(d.penaltyInr)}</Text>
            <Text className="text-[11px] text-[#1F1B3D]" style={{ width: 58 }}>{num(d.approvedOtHours)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}