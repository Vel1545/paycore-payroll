import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Wallet, ChevronDown, ChevronUp } from "lucide-react-native";
import { BASE_HOST } from "../constants/config";
import { MonthStepper, monthKey, monthLabel } from "./Payslipview";

type Day = { date: string; rate: number; pct: number; amount: number; reason: string; paid: boolean };
type Mine = {
  visible: boolean; sales: boolean; fullDays: number; halfDays: number; total: number; paid: number; unpaid: number;
  days: Day[]; lastCalculatedDay?: string;
};

const inr = (v: any) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const pad = (n: number) => String(n).padStart(2, "0");
const nice = (s: string) => {
  const d = new Date(s.slice(0, 10) + "T00:00:00");
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", weekday: "short" });
};

// Payslip page: the sales employee's own daily allowance (paid separately from the salary). Hidden for others.
export default function MyAllowancesCard({ empId }: { empId: string }) {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [data, setData] = useState<Mine | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!empId) return;
    const [y, m] = month.split("-").map(Number);
    const from = `${y}-${pad(m)}-01`;
    const to = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_HOST}/api/allowances/my?empId=${encodeURIComponent(empId)}&from=${from}&to=${to}`, { cache: "no-store" });
      setData(res.ok ? await res.json() : null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [empId, month]);

  useEffect(() => { load(); }, [load]);

  // not a sales employee (and no allowance on record): nothing to show
  if (!data || !data.visible) return null;

  return (
    <View className="bg-white border border-slate-100 rounded-3xl p-5 mt-4 shadow-xl shadow-slate-200/50">
      <View className="flex-row items-center mb-1">
        <Wallet size={16} color="#5B4FD1" />
        <Text className="text-sm font-black text-[#1F1B3D] ml-2">Daily allowance</Text>
      </View>
      <Text className="text-[10.5px] font-semibold text-[#7A76A6] mb-3">
        Paid separately from your salary. Present / OD = full day, half day = 50%. Sundays and holidays are not included.
      </Text>
      <MonthStepper month={month} onChange={setMonth} />

      {loading ? (
        <ActivityIndicator size="small" color="#5B4FD1" style={{ marginVertical: 12 }} />
      ) : (
        <>
          <View className="flex-row gap-2 mb-2">
            <View className="flex-1 bg-[#F6F5FC] rounded-2xl p-3">
              <Text className="text-[10px] font-black text-[#7A76A6] uppercase">{monthLabel(month)}</Text>
              <Text className="text-lg font-black text-[#1F1B3D]">{inr(data.total)}</Text>
              <Text className="text-[10.5px] font-semibold text-[#7A76A6]">{data.fullDays} full • {data.halfDays} half day(s)</Text>
            </View>
            <View className="flex-1 bg-[#F6F5FC] rounded-2xl p-3">
              <Text className="text-[10px] font-black text-[#7A76A6] uppercase">Paid / not yet</Text>
              <Text className="text-sm font-black text-emerald-700">{inr(data.paid)} paid</Text>
              <Text className="text-sm font-black text-amber-700">{inr(data.unpaid)} not paid yet</Text>
            </View>
          </View>
          {data.days.length > 0 ? (
            <TouchableOpacity onPress={() => setOpen(!open)} className="flex-row items-center justify-center py-2">
              <Text className="text-xs font-black text-[#5B4FD1] mr-1">{open ? "Hide days" : `Show ${data.days.length} day(s)`}</Text>
              {open ? <ChevronUp size={14} color="#5B4FD1" /> : <ChevronDown size={14} color="#5B4FD1" />}
            </TouchableOpacity>
          ) : (
            <Text className="text-[11px] font-semibold text-[#A6A2CE] text-center py-2">No allowance for this month yet.</Text>
          )}
          {open && data.days.map((d) => (
            <View key={d.date} className="flex-row justify-between py-1.5 border-b border-[#F6F5FC]">
              <Text className="text-[11px] font-bold text-[#1F1B3D] w-28">{nice(d.date)}</Text>
              <Text className="text-[11px] font-semibold text-[#7A76A6] flex-1">
                {d.reason?.startsWith("Edited: ") ? `Adjusted by admin: ${d.reason.slice(8)}` : d.reason}
              </Text>
              <Text className="text-[11px] font-black text-[#1F1B3D]">{inr(d.amount)}{d.paid ? " ✓" : ""}</Text>
            </View>
          ))}
          {!!data.lastCalculatedDay && (
            <Text className="text-[10px] font-semibold text-[#A6A2CE] mt-2">Updated every night • today is added tomorrow • ✓ = paid</Text>
          )}
        </>
      )}
    </View>
  );
}
