import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Modal, Platform } from "react-native";
import { Search, RotateCw, X, Calculator, Download, Pencil } from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import ScreenContainer from "../components/ScreenContainer";
import CrossPlatformDatePicker from "../components/CrossPlatformDatePicker";
import { BASE_HOST } from "../constants/config";
import { useAuth } from "../context/AuthContext";
import { UserSession } from "../services/UserSession";
import { downloadPayslipPdf } from "../services/Payslipdownload";
import PayslipView, { MonthStepper, StatusPill, inr, num, shortDate, toIso, monthKey, monthsBetween } from "../components/Payslipview";

const API = `${BASE_HOST}/api/payroll`;

// Fields an admin can correct. The first five are +/- on top of what the system recorded.
const ADJ_INPUTS = [
  { key: "presentDays", label: "Present days (incl. week off & holidays) - edit to correct" },
  { key: "adjWorkingDays", label: "Working days of the month (leave empty = system value)" },
  { key: "adjLopDays", label: "LOP days  (+ add / - remove)" },
  { key: "adjPenaltyInr", label: "Penalty ₹  (+ add / - remove)" },
  { key: "adjOtHours", label: "Overtime hours  (+ / -)" },
  { key: "adjAllowance", label: "Allowance ₹  (+ / -)" },
  { key: "bonus", label: "Bonus ₹ (total for the month)" },
  { key: "gift", label: "Gift ₹ (total for the month)" },
  { key: "otherDeductions", label: "Other deductions ₹ (total for the month)" },
  { key: "advance", label: "Advance ₹ deducted this month (total, replaces the value)" },
];

// table columns: label, width, cell renderer
type Row = any;
const COLS: { key: string; label: string; w: number; align?: "right"; render: (r: Row) => string }[] = [
  { key: "month", label: "Month", w: 78, render: (r) => r.salaryMonth },
  { key: "period", label: "Period", w: 108, render: (r) => `${shortDate(r.periodStart)} → ${shortDate(r.periodEnd)}` },
  { key: "wd", label: "Month days", w: 74, align: "right", render: (r) => (r.calculated ? num(r.monthDays) : "—") },
  { key: "pd", label: "Present", w: 66, align: "right", render: (r) => (r.calculated ? num(r.presentDaysTotal) : "—") },
  { key: "lop", label: "LOP", w: 56, align: "right", render: (r) => (r.hasLedger ? num(r.lopDaysTotal) : "—") },
  { key: "sal", label: "Monthly salary", w: 104, align: "right", render: (r) => inr(r.monthlySalary) },
  { key: "ot", label: "OT (h / ₹)", w: 100, align: "right", render: (r) => (r.calculated ? `${num(r.overtimeHours)}h / ${inr(r.overtimePay)}` : "—") },
  { key: "allow", label: "Daily allow.", w: 92, align: "right", render: (r) => inr(r.dailyAllowance) },
  { key: "pen", label: "Penalty", w: 84, align: "right", render: (r) => inr(r.attendancePenaltyInr) },
  { key: "lopcut", label: "LOP cut", w: 90, align: "right", render: (r) => inr(r.lopCut) },
  { key: "pf", label: "PF", w: 74, align: "right", render: (r) => inr(r.pfDeduction) },
  { key: "esi", label: "ESI", w: 70, align: "right", render: (r) => inr(r.esiDeduction) },
  { key: "oth", label: "Advance + other", w: 110, align: "right", render: (r) => inr(Number(r.advance) + Number(r.otherDeductions)) },
  { key: "gross", label: "Gross", w: 96, align: "right", render: (r) => inr(r.grossEarnings) },
  { key: "ded", label: "Deductions", w: 96, align: "right", render: (r) => inr(r.totalDeductions) },
  { key: "net", label: "Net pay", w: 100, align: "right", render: (r) => inr(r.netSalary) },
];
const NAME_W = 170;
const STATUS_W = 112;

export default function SalaryViewScreen() {
  const today = new Date();
  const [fromDate, setFromDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [toDate, setToDate] = useState(today);
  const [dept, setDept] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [people, setPeople] = useState<Record<string, { empId: string; userName: string; department?: string }>>({});
  const [departments, setDepartments] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [dayEdit, setDayEdit] = useState<any>(null);
  const [dayMinutes, setDayMinutes] = useState("");
  const [dayPenalty, setDayPenalty] = useState("");
  const [dayOtHrs, setDayOtHrs] = useState(""); // text of the hours box (so "1." can be typed)
  const [dayOtMin, setDayOtMin] = useState(""); // overtime of the day, kept in minutes; the hours box shows the same value
  const [dayReason, setDayReason] = useState("");
  const [daySaving, setDaySaving] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjForm, setAdjForm] = useState<Record<string, string>>({});
  const [adjReason, setAdjReason] = useState("");
  const [adjPresent0, setAdjPresent0] = useState("");
  const [adjLog, setAdjLog] = useState<any[]>([]);

  const [detailKey, setDetailKey] = useState<{ empId: string; month: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { user } = useAuth();
  const isAdmin = !!(user?.isAdmin || String(user?.role || "").toUpperCase() === "ADMIN");
  const myEmpId = String(user?.empId || user?.userId || UserSession.empId || "");
  const [view, setView] = useState<"ALL" | "ME">(isAdmin ? "ALL" : "ME");
  const [myMonth, setMyMonth] = useState(() => monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)));
  const reqId = useRef(0);

  const fromIso = toIso(fromDate);
  const toIsoStr = toIso(toDate);

  const load = useCallback(async () => {
    const my = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const url =
        `${API}/view?fromDate=${fromIso}&toDate=${toIsoStr}` +
        `&department=${encodeURIComponent(dept)}&q=${encodeURIComponent(appliedSearch)}`;
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      if (my !== reqId.current) return;
      setRows(json.rows || []);
      // remember every employee seen so far, for the search suggestions
      setPeople((prev) => {
        const next = { ...prev };
        (json.rows || []).forEach((r: any) => { next[r.empId] = { empId: r.empId, userName: String(r.userName || r.empId), department: r.department }; });
        return next;
      });
      setTotals(json.totals || null);
      setDepartments((prev) => Array.from(new Set([...prev, ...(json.departments || [])])));
    } catch (e: any) {
      if (my !== reqId.current) return;
      setError(e?.message || "Could not load salary data");
    } finally {
      if (my === reqId.current) setLoading(false);
    }
  }, [fromIso, toIsoStr, dept, appliedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const notify = (title: string, msg: string) => (Platform.OS === "web" ? window.alert(`${title}\n${msg}`) : Alert.alert(title, msg));

  // Own payslip PDF ("My payslip" tab)
  const downloadMine = async () => {
    setPdfBusy(true);
    try {
      await downloadPayslipPdf(myEmpId, myMonth);
    } catch (e: any) {
      notify("Payslip not available", e?.message || "Try again");
    } finally {
      setPdfBusy(false);
    }
  };

  // Payslip PDF of the open employee. highlight=true is the admin check: yellow = no data for that field.
  const downloadSlip = async (highlight: boolean) => {
    if (!detailKey) return;
    setPdfBusy(true);
    try {
      await downloadPayslipPdf(detailKey.empId, detailKey.month, { highlight });
    } catch (e: any) {
      notify("Payslip not available", e?.message || "Try again");
    } finally {
      setPdfBusy(false);
    }
  };

  // Excel of the same filters that are on screen (dates, department, search)
  const exportExcel = async () => {
    setExporting(true);
    try {
      const fileName = `salary_${fromIso}_to_${toIsoStr}.xlsx`;
      const url =
        `${API}/view/export?fromDate=${fromIso}&toDate=${toIsoStr}` +
        `&department=${encodeURIComponent(dept)}&q=${encodeURIComponent(appliedSearch)}`;
      if (Platform.OS === "web") {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const href = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.setAttribute("download", fileName);
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const out = await FileSystem.downloadAsync(url, `${FileSystem.documentDirectory}${fileName}`);
        if (out.status !== 200) throw new Error(`HTTP ${out.status}`);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(out.uri, {
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            dialogTitle: "Save salary report",
          });
        }
      }
    } catch (e: any) {
      notify("Could not export", e?.message || "Try again");
    } finally {
      setExporting(false);
    }
  };

  // ---- Admin correction of a month ----
  const openAdjust = async () => {
    if (!detailKey) return;
    try {
      const res = await fetch(`${API}/view/detail?empId=${encodeURIComponent(detailKey.empId)}&month=${detailKey.month}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      const s = json.summary || {};
      const a = s.adjustments || {};
      const show = (v: any) => (v === undefined || v === null || Number(v) === 0 ? "" : String(Number(v)));
      setAdjForm({
        presentDays: String(Number(s.presentDaysTotal ?? 0)),
        adjWorkingDays: show(a.adjWorkingDays),
        adjLopDays: show(a.adjLopDays),
        adjPenaltyInr: show(a.adjPenaltyInr),
        adjOtHours: show(a.adjOtHours),
        adjAllowance: show(a.adjAllowance),
        bonus: show(s.bonus),
        gift: show(s.gift),
        otherDeductions: show(s.otherDeductions),
        advance: show(s.advance),
      });
      setAdjReason("");
      setAdjPresent0(String(Number(s.presentDaysTotal ?? 0)));
      const lg = await fetch(`${API}/adjust/log?empId=${encodeURIComponent(detailKey.empId)}&month=${detailKey.month}`);
      setAdjLog(lg.ok ? await lg.json().catch(() => []) : []);
      setAdjOpen(true);
    } catch (e: any) {
      notify("Could not open", e?.message || "Try again");
    }
  };

  const saveAdjust = async () => {
    if (!detailKey) return;
    if (!adjReason.trim()) {
      notify("Reason needed", "Please write why this month is being changed.");
      return;
    }
    setAdjSaving(true);
    try {
      const changes: Record<string, string> = {};
      ADJ_INPUTS.forEach((f) => { changes[f.key] = (adjForm[f.key] ?? "").trim(); });
      // present days is sent only when it was edited; then it replaces the LOP correction box
      if ((changes.presentDays ?? "") === adjPresent0 || changes.presentDays === "") delete changes.presentDays;
      const res = await fetch(`${API}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empId: detailKey.empId, month: detailKey.month, by: myEmpId, reason: adjReason.trim(), changes }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      setAdjOpen(false);
      setReloadKey((k) => k + 1);
      await load();
      notify("Saved", `Recalculated. Net salary: ${inr(json.netSalary)}${json.status === "DRAFT" ? " (Draft)" : ""}`);
    } catch (e: any) {
      notify("Could not save", e?.message || "Try again");
    } finally {
      setAdjSaving(false);
    }
  };

  // ---- Admin correction of one daily attendance record ----
  // Same rule as the check-out: 460+ = Present 1.0, any minutes below that = Half day paid for the minutes (minutes / 460, max 0.99), 0 = Absent
  // minutes of a full day for this person (460 normally, e.g. 400 for a 09:00-17:00 shift)
  const reqMin = Number(dayEdit?.requiredMinutes) || 460;
  const dayPreview = (m: number) => {
    if (m >= reqMin) return { status: "PRESENT", payable: "1" };
    if (m > 0) return { status: "HALF_DAY", payable: String(Math.min(0.99, Math.round((m * 100) / reqMin) / 100)) };
    return { status: "ABSENT", payable: "0" };
  };

  // hours <-> minutes helpers for the day edit form
  const fmtHM = (m: number) => `${Math.floor(m / 60)} h ${m % 60} min`;
  const hoursFromMin = (m: string) => (m === "" ? "" : String(Math.round((Number(m) / 60) * 100) / 100));

  const openDayEdit = (d: any) => {
    setDayEdit(d);
    // net minutes = paid part (max 460) + overtime
    const net = d.netMinutes === null || d.netMinutes === undefined ? null : Number(d.netMinutes);
    const req = Number(d.requiredMinutes) || 460;
    const approvedOt = Math.round(Number(d.approvedOtHours || 0) * 60);
    setDayMinutes(net === null ? "" : String(Math.min(net, req)));
    const otStart = net === null ? "" : String(Math.max(approvedOt, net > req ? net - req : 0));
    setDayOtMin(otStart);
    setDayOtHrs(hoursFromMin(otStart));
    setDayPenalty(d.penaltyInr === null || d.penaltyInr === undefined ? "" : String(Number(d.penaltyInr)));
    setDayReason("");
  };

  const saveDayEdit = async () => {
    if (!detailKey || !dayEdit) return;
    if (dayMinutes === "") {
      notify("Minutes needed", "Please enter the worked minutes.");
      return;
    }
    if (Number(dayMinutes) < reqMin && Number(dayOtMin || 0) > 0) {
      notify("Overtime not allowed", "Overtime can only be added to a full day (" + reqMin + " paid minutes).");
      return;
    }
    if (!dayReason.trim()) {
      notify("Reason needed", "Please write why this day is being changed.");
      return;
    }
    setDaySaving(true);
    try {
      const res = await fetch(`${API}/day-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: detailKey.empId,
          date: dayEdit.date,
          netMinutes: Number(dayMinutes),
          otMinutes: dayOtMin === "" ? 0 : Number(dayOtMin),
          penaltyInr: dayPenalty === "" ? null : Number(dayPenalty),
          by: myEmpId,
          reason: dayReason.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      setDayEdit(null);
      setReloadKey((k) => k + 1);
      await load();
      notify("Saved", `Day updated and month recalculated. Net salary: ${inr(json.netSalary)}${json.status === "DRAFT" ? " (Draft)" : ""}`);
    } catch (e: any) {
      notify("Could not save", e?.message || "Try again");
    } finally {
      setDaySaving(false);
    }
  };

  const recalcOne = async () => {
    if (!detailKey) return;
    setCalculating(true);
    try {
      const res = await fetch(`${API}/calculate?empId=${encodeURIComponent(detailKey.empId)}&month=${detailKey.month}`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      setReloadKey((k) => k + 1);
      await load();
      if (json.warnings?.length) notify("Calculated with notes", json.warnings.join("\n"));
    } catch (e: any) {
      notify("Could not calculate", e?.message || "Try again");
    } finally {
      setCalculating(false);
    }
  };

  const runAll = () => {
    const months = monthsBetween(fromDate, toDate);
    const go = async () => {
      setCalculating(true);
      try {
        for (const m of months) {
          const res = await fetch(`${API}/run?month=${m}`, { method: "POST" });
          if (!res.ok) throw new Error(`${m}: HTTP ${res.status}`);
        }
        await load();
        notify("Done", `Salary calculated for ${months.join(", ")} (saved as DRAFT).`);
      } catch (e: any) {
        notify("Could not calculate", e?.message || "Try again");
      } finally {
        setCalculating(false);
      }
    };
    const msg = `Calculate salary for all employees for ${months.join(", ")}? Drafts are overwritten; finalized months are kept.`;
    if (Platform.OS === "web") {
      if (window.confirm(msg)) go();
    } else {
      Alert.alert("Calculate all", msg, [{ text: "Cancel", style: "cancel" }, { text: "Calculate", onPress: go }]);
    }
  };

  // suggestions while typing: name or employee id contains the text (max 6)
  const suggestions = (() => {
    const t = searchText.trim().toLowerCase();
    if (!searchFocus || t.length < 1) return [];
    return (Object.values(people) as { empId: string; userName: string; department?: string }[])
      .filter((p) => p.userName.toLowerCase().includes(t) || p.empId.toLowerCase().includes(t))
      .sort((a, b) => Number(b.userName.toLowerCase().startsWith(t)) - Number(a.userName.toLowerCase().startsWith(t)) || a.userName.localeCompare(b.userName))
      .slice(0, 6);
  })();

  const tableWidth = NAME_W + COLS.reduce((s, c) => s + c.w, 0) + STATUS_W;

  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3.5 py-2 rounded-full mr-2 border ${active ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-white border-[#E7E4F5]"}`}
    >
      <Text className={`text-xs font-black ${active ? "text-white" : "text-[#7A76A6]"}`}>{label}</Text>
    </TouchableOpacity>
  );

  const StatCard = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
    <View className="bg-white border border-[#E7E4F5] rounded-2xl px-4 py-3 mr-3" style={{ minWidth: 130 }}>
      <Text className="text-[10px] font-black text-[#7A76A6] uppercase tracking-wider">{label}</Text>
      <Text className="text-base font-black mt-1" style={{ color: tone || "#1F1B3D" }}>{value}</Text>
    </View>
  );

  // ---------- screen ----------
  const Toggle = () =>
    isAdmin ? (
      <View className="flex-row bg-white p-1 rounded-2xl border border-[#E7E4F5] mb-3">
        {([["ALL", "All employees"], ["ME", "My payslip"]] as const).map(([k, label]) => (
          <TouchableOpacity
            key={k}
            onPress={() => setView(k)}
            className={`flex-1 h-10 rounded-xl items-center justify-center ${view === k ? "bg-[#5B4FD1]" : ""}`}
          >
            <Text className={`text-xs font-black uppercase tracking-wider ${view === k ? "text-white" : "text-[#7A76A6]"}`}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ) : null;

  if (view === "ME" || !isAdmin) {
    return (
      <ScreenContainer>
        <View className="px-4 pt-2 pb-8">
          <Text className="text-xl font-black text-[#1F1B3D]">{isAdmin ? "Salary" : "My Payslip"}</Text>
          <Text className="text-xs font-bold text-[#7A76A6] mb-3">Your own salary details</Text>
          <Toggle />
          <MonthStepper month={myMonth} onChange={setMyMonth} />
          <View className="flex-row items-center justify-between bg-white border border-[#E7E4F5] rounded-2xl px-4 py-3 mb-3">
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text className="text-sm font-black text-[#1F1B3D]">Salary statement</Text>
              <Text className="text-[11px] font-bold text-[#7A76A6] mt-0.5">{myMonth}</Text>
            </View>
            <TouchableOpacity
              onPress={downloadMine}
              disabled={pdfBusy}
              className="flex-row items-center bg-[#5B4FD1] px-4 h-10 rounded-2xl"
              style={{ opacity: pdfBusy ? 0.6 : 1 }}
            >
              {pdfBusy ? <ActivityIndicator size="small" color="#fff" /> : <Download size={14} color="#fff" />}
              <Text className="text-xs font-black text-white ml-1.5 uppercase tracking-wider">PDF</Text>
            </TouchableOpacity>
          </View>
          <PayslipView empId={myEmpId} month={myMonth} mode="my" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="px-4 pt-2 pb-8">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-xl font-black text-[#1F1B3D]">Salary View</Text>
            <Text className="text-xs font-bold text-[#7A76A6]">All employees • by salary month</Text>
          </View>
          <View className="flex-row">
            <TouchableOpacity onPress={load} className="w-10 h-10 rounded-2xl bg-white border border-[#E7E4F5] items-center justify-center mr-2">
              {loading ? <ActivityIndicator size="small" color="#5B4FD1" /> : <RotateCw size={16} color="#5B4FD1" />}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={exportExcel}
              disabled={exporting}
              className="px-3.5 h-10 rounded-2xl bg-white border border-[#E7E4F5] flex-row items-center justify-center mr-2"
              style={{ opacity: exporting ? 0.6 : 1 }}
            >
              {exporting ? <ActivityIndicator size="small" color="#5B4FD1" /> : <Download size={15} color="#5B4FD1" />}
              <Text className="text-xs font-black text-[#5B4FD1] ml-1.5">Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={runAll}
              disabled={calculating}
              className="px-3.5 h-10 rounded-2xl bg-[#5B4FD1] flex-row items-center justify-center"
              style={{ opacity: calculating ? 0.6 : 1 }}
            >
              {calculating ? <ActivityIndicator size="small" color="#fff" /> : <Calculator size={15} color="#fff" />}
              <Text className="text-xs font-black text-white ml-1.5">Calculate all</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Toggle />

        {/* Date range */}
        <View className="flex-col md:flex-row gap-2 mb-3">
          <CrossPlatformDatePicker
            label="From Date"
            value={fromDate}
            onChange={(d: Date) => {
              setFromDate(d);
              if (toIso(d) > toIsoStr) setToDate(d);
            }}
          />
          <CrossPlatformDatePicker
            label="To Date"
            value={toDate}
            onChange={(d: Date) => {
              setToDate(d);
              if (toIso(d) < fromIso) setFromDate(d);
            }}
          />
        </View>
        <Text className="text-[11px] font-bold text-[#7A76A6] mb-3">
          Showing salary months: {monthsBetween(fromDate, toDate).join(", ")}. Each month is shown in full.
        </Text>

        {/* Department */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          {["ALL", ...departments].map((d) => (
            <Chip key={d} label={d === "ALL" ? "All departments" : d} active={dept === d} onPress={() => setDept(d)} />
          ))}
        </ScrollView>

        {/* Search */}
        <View className="flex-row items-center bg-white border border-[#E7E4F5] rounded-2xl px-3 mb-3">
          <Search size={16} color="#7A76A6" />
          <TextInput
            value={searchText}
            onChangeText={(t) => { setSearchText(t); setSearchFocus(true); }}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
            onSubmitEditing={() => { setAppliedSearch(searchText.trim()); setSearchFocus(false); }}
            returnKeyType="search"
            placeholder="Search by name or employee ID"
            placeholderTextColor="#A6A2CE"
            className="flex-1 py-3 px-2 text-sm font-bold text-[#1F1B3D]"
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchText("");
                setAppliedSearch("");
              }}
            >
              <X size={16} color="#7A76A6" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setAppliedSearch(searchText.trim())} className="ml-2 px-3 py-1.5 rounded-xl bg-[#EEECFA]">
            <Text className="text-xs font-black text-[#5B4FD1]">Search</Text>
          </TouchableOpacity>
        </View>
        {suggestions.length > 0 && (
          <View className="bg-white border border-[#E7E4F5] rounded-2xl mb-3 -mt-1 overflow-hidden">
            {suggestions.map((p, i) => (
              <TouchableOpacity
                key={p.empId}
                onPress={() => {
                  setSearchText(p.userName);
                  setAppliedSearch(p.empId); // exact person (two people can share a name)
                  setSearchFocus(false);
                }}
                className={`px-3 py-2.5 ${i > 0 ? "border-t border-[#F0EEFA]" : ""}`}
              >
                <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>{p.userName}</Text>
                <Text className="text-[10px] font-bold text-[#7A76A6]" numberOfLines={1}>{p.empId}{p.department ? ` • ${p.department}` : ""}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Totals */}
        {totals && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            <StatCard label="Records" value={String(totals.rows)} />
            <StatCard label="Gross" value={inr(totals.grossEarnings)} />
            <StatCard label="Deductions" value={inr(totals.totalDeductions)} tone="#E4453C" />
            <StatCard label="Net payable" value={inr(totals.netSalary)} tone="#1FAE5C" />
            <StatCard label="PF" value={inr(totals.pfDeduction)} />
            <StatCard label="ESI" value={inr(totals.esiDeduction)} />
            <StatCard label="Penalties" value={inr(totals.attendancePenaltyInr)} />
            {totals.notCalculated > 0 && <StatCard label="Not calculated" value={String(totals.notCalculated)} tone="#E4453C" />}
          </ScrollView>
        )}

        {error && (
          <View className="bg-[#FDE9E8] border border-[#E4453C]/30 rounded-2xl p-3 mb-3">
            <Text className="text-xs font-bold text-[#E4453C]">{error}</Text>
          </View>
        )}

        {/* Table */}
        <View className="bg-white border border-[#E7E4F5] rounded-3xl overflow-hidden">
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ width: tableWidth }}>
              <View className="flex-row bg-[#EEECFA] py-2.5">
                <Text className="text-[10px] font-black text-[#5B4FD1] uppercase px-3" style={{ width: NAME_W }}>Employee</Text>
                {COLS.map((c) => (
                  <Text key={c.key} className="text-[10px] font-black text-[#5B4FD1] uppercase px-2" style={{ width: c.w, textAlign: c.align || "left" }}>
                    {c.label}
                  </Text>
                ))}
                <Text className="text-[10px] font-black text-[#5B4FD1] uppercase px-2" style={{ width: STATUS_W }}>Status</Text>
              </View>

              {rows.length === 0 && !loading && (
                <Text className="text-xs font-bold text-[#7A76A6] text-center py-8">No employees found for these filters.</Text>
              )}

              {rows.map((r) => (
                <TouchableOpacity
                  key={`${r.empId}-${r.salaryMonth}`}
                  onPress={() => setDetailKey({ empId: r.empId, month: r.salaryMonth })}
                  className="flex-row items-center py-3 border-t border-[#F0EEFA] active:bg-[#F6F5FC]"
                >
                  <View className="px-3" style={{ width: NAME_W }}>
                    <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>{r.userName}</Text>
                    <Text className="text-[10px] font-bold text-[#7A76A6]" numberOfLines={1}>{r.empId}{r.department ? ` • ${r.department}` : ""}</Text>
                  </View>
                  {COLS.map((c) => (
                    <Text
                      key={c.key}
                      className={`text-[11px] px-2 ${c.key === "net" ? "font-black text-[#1FAE5C]" : "font-bold text-[#1F1B3D]"}`}
                      style={{ width: c.w, textAlign: c.align || "left" }}
                      numberOfLines={1}
                    >
                      {c.render(r)}
                    </Text>
                  ))}
                  <View className="px-2" style={{ width: STATUS_W }}>
                    <StatusPill status={r.status} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
        <Text className="text-[11px] font-bold text-[#A6A2CE] mt-2">Tap a row for the full salary breakdown.</Text>
      </View>

      {/* Single person detail */}
      <Modal visible={!!detailKey} animationType="slide" onRequestClose={() => setDetailKey(null)}>
        <View className="flex-1 bg-[#F6F5FC]">
          <View className="flex-row items-center justify-between px-4 pt-12 pb-3 bg-[#F6F5FC]">
            <TouchableOpacity onPress={() => setDetailKey(null)} className="w-10 h-10 rounded-2xl bg-white border border-[#E7E4F5] items-center justify-center">
              <X size={18} color="#1F1B3D" />
            </TouchableOpacity>
            <Text className="text-base font-black text-[#1F1B3D]">Salary details</Text>
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => downloadSlip(false)}
                disabled={pdfBusy}
                className="px-3.5 h-10 rounded-2xl bg-white border border-[#E7E4F5] flex-row items-center justify-center mr-2"
                style={{ opacity: pdfBusy ? 0.6 : 1 }}
              >
                {pdfBusy ? <ActivityIndicator size="small" color="#5B4FD1" /> : <Download size={14} color="#5B4FD1" />}
                <Text className="text-xs font-black text-[#5B4FD1] ml-1.5">PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => downloadSlip(true)}
                disabled={pdfBusy}
                className="px-3 h-10 rounded-2xl bg-white border border-[#E7E4F5] items-center justify-center mr-2"
                style={{ opacity: pdfBusy ? 0.6 : 1 }}
              >
                <Text className="text-xs font-black text-[#5B4FD1]">Check</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openAdjust}
                className="px-3.5 h-10 rounded-2xl bg-white border border-[#E7E4F5] flex-row items-center justify-center mr-2"
              >
                <Pencil size={14} color="#5B4FD1" />
                <Text className="text-xs font-black text-[#5B4FD1] ml-1.5">Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={recalcOne}
                disabled={calculating}
                className="px-3.5 h-10 rounded-2xl bg-[#5B4FD1] flex-row items-center justify-center"
                style={{ opacity: calculating ? 0.6 : 1 }}
              >
                {calculating ? <ActivityIndicator size="small" color="#fff" /> : <Calculator size={15} color="#fff" />}
                <Text className="text-xs font-black text-white ml-1.5">Recalculate</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>{detailKey && (
              <PayslipView empId={detailKey.empId} month={detailKey.month} mode="admin" reloadKey={reloadKey} showEmployerShare onEditDay={openDayEdit} />
            )}</ScrollView>

          {/* Admin correction of one day */}
          {dayEdit && (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(31,27,61,0.45)" }}>
              <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 80, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                <View className="bg-white rounded-3xl p-4 border border-[#E7E4F5]">
                  <Text className="text-base font-black text-[#1F1B3D]">Edit day • {dayEdit.date}</Text>
                  <Text className="text-[11px] font-bold text-[#7A76A6] mt-1 mb-3">
                    Recorded: {dayEdit.status} • in {dayEdit.firstIn ? String(dayEdit.firstIn).slice(11, 16) : "-"} • out {dayEdit.lastOut ? String(dayEdit.lastOut).slice(11, 16) : "-"} •{" "}
                    {num(dayEdit.netMinutes)} min • pay day {num(dayEdit.payableDays)}
                  </Text>

                  <Text className="text-[11px] font-black text-[#7A76A6] mb-1">Paid minutes for the day ({reqMin} = full day, max {reqMin})</Text>
                  <TextInput
                    value={dayMinutes}
                    onChangeText={(t) => setDayMinutes(t.replace(/[^0-9]/g, "").slice(0, 3))}
                    keyboardType="number-pad"
                    placeholder={`e.g. ${reqMin}`}
                    placeholderTextColor="#A6A2CE"
                    className="h-11 rounded-2xl border border-[#E7E4F5] bg-[#F6F5FC] px-3 text-sm font-bold text-[#1F1B3D]"
                  />
                  <Text className="text-[11px] font-black mt-1.5" style={{ color: "#5B4FD1" }}>
                    {dayMinutes === "" ? "" : (() => { const p = dayPreview(Number(dayMinutes)); return `Becomes ${p.status} • pay day ${p.payable}`; })()}
                  </Text>

                  {dayMinutes !== "" && (
                    <Text className="text-[10px] font-bold text-[#7A76A6]">= {fmtHM(Number(dayMinutes))}</Text>
                  )}

                  <Text className="text-[11px] font-black text-[#7A76A6] mb-1 mt-3">Overtime (after {reqMin} minutes) - type hours or minutes</Text>
                  <View className="flex-row">
                    <View className="flex-1 mr-2">
                      <TextInput
                        value={dayOtHrs}
                        onChangeText={(t) => {
                          const c = t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
                          setDayOtHrs(c);
                          setDayOtMin(c === "" || c === "." ? "" : String(Math.round(parseFloat(c) * 60)));
                        }}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="#A6A2CE"
                        className="h-11 rounded-2xl border border-[#E7E4F5] bg-[#F6F5FC] px-3 text-sm font-bold text-[#1F1B3D]"
                      />
                      <Text className="text-[10px] font-bold text-[#7A76A6] mt-1">hours (e.g. 1.5)</Text>
                    </View>
                    <View className="flex-1">
                      <TextInput
                        value={dayOtMin}
                        onChangeText={(t) => {
                          const c = t.replace(/[^0-9]/g, "");
                          setDayOtMin(c);
                          setDayOtHrs(hoursFromMin(c));
                        }}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor="#A6A2CE"
                        className="h-11 rounded-2xl border border-[#E7E4F5] bg-[#F6F5FC] px-3 text-sm font-bold text-[#1F1B3D]"
                      />
                      <Text className="text-[10px] font-bold text-[#7A76A6] mt-1">minutes (e.g. 90)</Text>
                    </View>
                  </View>
                  <Text className="text-[11px] font-black mt-1" style={{ color: "#5B4FD1" }}>
                    Overtime {fmtHM(Number(dayOtMin || 0))} • day total {fmtHM(Math.min(Number(dayMinutes || 0), reqMin) + Number(dayOtMin || 0))}
                  </Text>

                  <Text className="text-[11px] font-black text-[#7A76A6] mb-1 mt-3">Penalty ₹ for the day (leave as it is to keep)</Text>
                  <TextInput
                    value={dayPenalty}
                    onChangeText={(t) => setDayPenalty(t.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#A6A2CE"
                    className="h-11 rounded-2xl border border-[#E7E4F5] bg-[#F6F5FC] px-3 text-sm font-bold text-[#1F1B3D]"
                  />

                  <Text className="text-[11px] font-black text-[#7A76A6] mb-1 mt-3">Reason (required)</Text>
                  <TextInput
                    value={dayReason}
                    onChangeText={setDayReason}
                    placeholder="e.g. App was down, worked the full day"
                    placeholderTextColor="#A6A2CE"
                    multiline
                    className="min-h-[64px] rounded-2xl border border-[#E7E4F5] bg-[#F6F5FC] px-3 py-2 text-sm font-bold text-[#1F1B3D]"
                  />

                  <View className="flex-row mt-4">
                    <TouchableOpacity onPress={() => setDayEdit(null)} className="flex-1 h-11 rounded-2xl bg-[#EEECFA] items-center justify-center mr-2">
                      <Text className="text-sm font-black text-[#5B4FD1]">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={saveDayEdit}
                      disabled={daySaving}
                      className="flex-1 h-11 rounded-2xl bg-[#5B4FD1] items-center justify-center"
                      style={{ opacity: daySaving ? 0.6 : 1 }}
                    >
                      {daySaving ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-sm font-black text-white">Save & recalculate</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          )}

          {/* Admin correction form */}
          {adjOpen && (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(31,27,61,0.45)" }}>
              <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                <View className="bg-white rounded-3xl p-4 border border-[#E7E4F5]">
                  <Text className="text-base font-black text-[#1F1B3D]">Edit {detailKey?.empId} • {detailKey?.month}</Text>
                  <Text className="text-[11px] font-bold text-[#7A76A6] mt-1 mb-3">
                    Use + or - to correct what the system recorded. Your edits stay after Recalculate. A finalized month goes back to Draft.
                  </Text>
                  {ADJ_INPUTS.map((f) => (
                    <View key={f.key} className="mb-2.5">
                      <Text className="text-[11px] font-black text-[#7A76A6] mb-1">{f.label}</Text>
                      <TextInput
                        value={adjForm[f.key] ?? ""}
                        onChangeText={(t) => setAdjForm((p) => ({ ...p, [f.key]: t.replace(/[^0-9.\-]/g, "") }))}
                        keyboardType="numbers-and-punctuation"
                        placeholder="0"
                        placeholderTextColor="#A6A2CE"
                        className="h-11 rounded-2xl border border-[#E7E4F5] bg-[#F6F5FC] px-3 text-sm font-bold text-[#1F1B3D]"
                      />
                    </View>
                  ))}
                  <Text className="text-[11px] font-black text-[#7A76A6] mb-1 mt-1">Reason (required)</Text>
                  <TextInput
                    value={adjReason}
                    onChangeText={setAdjReason}
                    placeholder="e.g. Permission request missed, emergency leave approved by HR"
                    placeholderTextColor="#A6A2CE"
                    multiline
                    className="min-h-[64px] rounded-2xl border border-[#E7E4F5] bg-[#F6F5FC] px-3 py-2 text-sm font-bold text-[#1F1B3D]"
                  />
                  {adjLog.length > 0 && (
                    <View className="mt-3">
                      <Text className="text-[11px] font-black text-[#7A76A6] mb-1">Previous edits</Text>
                      {adjLog.slice(0, 5).map((g, i) => (
                        <Text key={i} className="text-[11px] font-bold text-[#7A76A6]">
                          {String(g.edited_at).slice(0, 16).replace("T", " ")} • {g.edited_by} • {g.field_name}: {g.old_value} → {g.new_value} ({g.reason})
                        </Text>
                      ))}
                    </View>
                  )}
                  <View className="flex-row mt-4">
                    <TouchableOpacity onPress={() => setAdjOpen(false)} className="flex-1 h-11 rounded-2xl bg-[#EEECFA] items-center justify-center mr-2">
                      <Text className="text-sm font-black text-[#5B4FD1]">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={saveAdjust}
                      disabled={adjSaving}
                      className="flex-1 h-11 rounded-2xl bg-[#5B4FD1] items-center justify-center"
                      style={{ opacity: adjSaving ? 0.6 : 1 }}
                    >
                      {adjSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-sm font-black text-white">Save & recalculate</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
}