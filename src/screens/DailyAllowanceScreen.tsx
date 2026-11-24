import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform, Modal, ScrollView } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { ChevronLeft, Plus, RotateCw, Download, CheckCircle2, Trash2, Pencil, X, Search, History } from "lucide-react-native";

/** One row of /edit-log (who changed which day, from what to what). */
type HistRow = {
  id: number; empId: string; name?: string; date: string; action: "EDITED" | "REMOVED" | "RESET" | string;
  oldAmount?: number | string | null; newAmount?: number | string | null; reason?: string; by?: string; byName?: string; at: string;
};
const ACTION_LABEL: Record<string, string> = { EDITED: "Edited", REMOVED: "Removed", RESET: "Reset to automatic" };
const rupees = (v: any) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
import ScreenContainer from "../components/ScreenContainer";
import CrossPlatformDatePicker from "../components/CrossPlatformDatePicker";
import { BASE_HOST } from "../constants/config";
import { authHeaders } from "../services/apiAuth";
import { UserSession } from "../services/UserSession";
import { useResponsive } from "../hooks/useResponsive";
import { WebPageHeader } from "../components/web/webUi";

const API = `${BASE_HOST}/api/admin/allowances`;
const CUTOVER = "2026-11-01"; // the server checks the real date (allowance.cutover-date)

type Tab = "rules" | "report" | "statements";
type Staff = { empId: string; name: string; designation: string };
type Desig = { designation: string; count: number };
type Rule = {
  id: number; scope: "GROUP" | "INDIVIDUAL"; designation?: string; empId?: string; name?: string;
  fromDate: string; toDate: string; amountPerDay: number; note?: string; paidDays: number;
};
type ReportRow = {
  empId: string; name: string; designation: string; fullDays: number; halfDays: number; odDays: number;
  rate: string; total: number; unpaid: number; paid: number;
};
type Entry = {
  date: string; rate: number; pct: number; amount: number; reason: string; paid: boolean;
  edited?: boolean; editReason?: string | null; editedBy?: string | null; editedAt?: string | null;
  dayType?: string | null; noRule?: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthStart = () => { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth(), 1)); };
const monthEnd = () => { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
const atLeastCutover = (s: string) => (s < CUTOVER ? CUTOVER : s);
type Period = "THIS" | "LAST" | "LAST2" | "CUSTOM";
const PERIODS: [Period, string][] = [["THIS", "This month"], ["LAST", "Last month"], ["LAST2", "Last 2 months"], ["CUSTOM", "Custom"]];
/** From / To of a quick period (From never before the cutover). */
const periodRange = (p: Period): [string, string] => {
  const d = new Date();
  const y = d.getFullYear(), m = d.getMonth();
  if (p === "LAST") return [atLeastCutover(ymd(new Date(y, m - 1, 1))), ymd(new Date(y, m, 0))];
  if (p === "LAST2") return [atLeastCutover(ymd(new Date(y, m - 1, 1))), ymd(new Date(y, m + 1, 0))];
  return [atLeastCutover(ymd(new Date(y, m, 1))), ymd(new Date(y, m + 1, 0))];
};
const inr = (v: any) => `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const nice = (s?: string) => {
  if (!s) return "-";
  const d = new Date(s.slice(0, 10) + "T00:00:00");
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const niceDay = (s: string) => {
  const d = new Date(s.slice(0, 10) + "T00:00:00");
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
};
// the day's status text (the server prefixes an admin edit with "Edited: ")
const dayLabel = (d: Entry) => (d.edited ? "Edited by admin" : d.reason || "-");
const notify = (t: string, m: string) => (Platform.OS === "web" ? window.alert(`${t}\n\n${m}`) : Alert.alert(t, m));
const ask = (t: string, m: string, yes: string, onYes: () => void) => {
  if (Platform.OS === "web") { if (window.confirm(`${t}\n\n${m}`)) onYes(); }
  else Alert.alert(t, m, [{ text: "Cancel", style: "cancel" }, { text: yes, onPress: onYes }]);
};

// small pieces (outside the screen, so text boxes keep their focus while typing)
const Chip = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress}
    className={`px-3 py-1.5 rounded-full border mr-2 mb-2 ${on ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-white border-[#E7E4F5]"}`}>
    <Text className={`text-[11px] font-black ${on ? "text-white" : "text-[#7A76A6]"}`}>{label}</Text>
  </TouchableOpacity>
);
const Card = ({ children }: { children: React.ReactNode }) => (
  <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-3">{children}</View>
);
const Label = ({ t }: { t: string }) => <Text className="text-[10px] font-black text-[#7A76A6] uppercase mb-1.5">{t}</Text>;

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.success === false) throw new Error(j?.message || `Request failed (${res.status})`);
  return j;
}

// Admin: daily allowance for sales staff (rules by designation / person and date range, report, mark as paid).
// Separate from salary and payslip. Present / OD = 100 %, half day = 50 %, permission <= 1 hr = present.
export default function DailyAllowanceScreen({ navigation }: { navigation?: any }) {
  const { isWebDesktop } = useResponsive();
  const adminEmpId = String(UserSession.empId || "");
  const q = `adminEmpId=${encodeURIComponent(adminEmpId)}`;
  const goBack = () => (navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate("SalaryView"));
  const [tab, setTab] = useState<Tab>("rules");

  const [staff, setStaff] = useState<Staff[]>([]);
  const [desigs, setDesigs] = useState<Desig[]>([]);

  // ---- rule form
  const [scope, setScope] = useState<"GROUP" | "INDIVIDUAL">("GROUP");
  const [rFrom, setRFrom] = useState(atLeastCutover(monthStart()));
  const [rTo, setRTo] = useState(monthEnd());
  const [pickedDesigs, setPickedDesigs] = useState<string[]>([]);
  const [pickedEmp, setPickedEmp] = useState<Staff | null>(null);
  const [empSearch, setEmpSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [edit, setEdit] = useState<Rule | null>(null);
  const [editFrom, setEditFrom] = useState("");
  const [editTo, setEditTo] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");

  // ---- report
  const [from, setFrom] = useState(atLeastCutover(monthStart()));
  const [to, setTo] = useState(monthEnd());
  const [fDesig, setFDesig] = useState("ALL");
  const [paidFilter, setPaidFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");
  const [period, setPeriod] = useState<Period>("THIS");
  const [search, setSearch] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [editedOnly, setEditedOnly] = useState(false);
  // search is sent to the server after typing stops
  useEffect(() => {
    const t = setTimeout(() => setAppliedQ(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);
  const pickPeriod = (p: Period) => {
    setPeriod(p);
    if (p !== "CUSTOM") { const [a, b] = periodRange(p); setFrom(a); setTo(b); }
  };
  const filtersActive = period !== "THIS" || fDesig !== "ALL" || paidFilter !== "ALL" || !!search.trim() || editedOnly;
  const clearFilters = () => {
    const [a, b] = periodRange("THIS");
    setPeriod("THIS"); setFrom(a); setTo(b);
    setFDesig("ALL"); setPaidFilter("ALL"); setSearch(""); setAppliedQ(""); setEditedOnly(false);
  };
  const filterQs = () =>
    `from=${from}&to=${to}&paid=${paidFilter}` +
    (fDesig !== "ALL" ? `&designation=${encodeURIComponent(fDesig)}` : "") +
    (appliedQ ? `&q=${encodeURIComponent(appliedQ)}` : "") +
    (editedOnly ? "&edited=true" : "");
  const [report, setReport] = useState<{ total: number; unpaid: number; rows: ReportRow[]; lastCalculatedDay?: string } | null>(null);
  const [repLoading, setRepLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [openEmp, setOpenEmp] = useState<string | null>(null);
  const [days, setDays] = useState<Entry[]>([]);
  const [daysLoading, setDaysLoading] = useState(false);
  const [statements, setStatements] = useState<any[]>([]);

  // ---- day edit
  const [dayEdit, setDayEdit] = useState<{ empId: string; name: string; day: Entry; ruleRate: number } | null>(null);
  const [dayAmount, setDayAmount] = useState("");
  const [dayReason, setDayReason] = useState("");

  // ---- edit history (like the salary page History)
  const [hist, setHist] = useState<{ title: string; rows: HistRow[] } | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const openHistory = async (empId?: string, name?: string) => {
    setHist({ title: empId ? `${name || empId} (${empId})` : "All sales staff", rows: [] });
    setHistLoading(true);
    try {
      const qs = `from=${from}&to=${to}` + (empId ? `&empId=${encodeURIComponent(empId)}` : appliedQ ? `&q=${encodeURIComponent(appliedQ)}` : "");
      const r = await call(`${API}/edit-log?${qs}`);
      setHist((h) => (h ? { ...h, rows: Array.isArray(r?.rows) ? r.rows : [] } : h));
    } catch (e: any) {
      notify("Could not load the edit history", e.message);
      setHist(null);
    } finally {
      setHistLoading(false);
    }
  };

  const loadBase = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([call(`${API}/sales-staff`), call(`${API}/designations`)]);
      setStaff(Array.isArray(s) ? s : []);
      setDesigs(Array.isArray(d) ? d : []);
    } catch (e: any) {
      notify("Could not load the sales staff", e.message);
    }
  }, []);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const r = await call(`${API}/rules`);
      setRules(Array.isArray(r) ? r : []);
    } catch (e: any) {
      notify("Could not load the rules", e.message);
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const loadReport = useCallback(async (keepOpen?: boolean) => {
    setRepLoading(true);
    if (keepOpen !== true) setOpenEmp(null);
    try {
      setReport(await call(`${API}/report?${filterQs()}`));
    } catch (e: any) {
      notify("Could not load the report", e.message);
    } finally {
      setRepLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, paidFilter, fDesig, appliedQ, editedOnly]);

  const loadStatements = useCallback(async () => {
    try {
      const s = await call(`${API}/statements`);
      setStatements(Array.isArray(s) ? s : []);
    } catch (e: any) {
      notify("Could not load the statements", e.message);
    }
  }, []);

  useEffect(() => { loadBase(); loadRules(); }, [loadBase, loadRules]);
  useEffect(() => { if (tab === "report") loadReport(); if (tab === "statements") loadStatements(); }, [tab, loadReport, loadStatements]);

  // ---------------------------------------------------------------- rules
  const toggleDesig = (d: string) =>
    setPickedDesigs((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));

  const saveRule = async () => {
    if (!amount.trim()) return notify("Amount needed", "Enter the allowance per day.");
    if (scope === "GROUP" && pickedDesigs.length === 0) return notify("Designation needed", "Choose at least one designation.");
    if (scope === "INDIVIDUAL" && !pickedEmp) return notify("Employee needed", "Choose the sales employee.");
    setSaving(true);
    try {
      const j = await call(`${API}/rules?${q}`, {
        method: "POST",
        body: JSON.stringify({
          scope, fromDate: rFrom, toDate: rTo, amountPerDay: amount.trim(), note: note.trim() || null,
          designations: scope === "GROUP" ? pickedDesigs : undefined,
          empId: scope === "INDIVIDUAL" ? pickedEmp?.empId : undefined,
        }),
      });
      notify("Saved", j.message || "Rule saved.");
      setAmount(""); setNote(""); setPickedDesigs([]); setPickedEmp(null); setEmpSearch("");
      loadRules();
    } catch (e: any) {
      notify("Could not save", e.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (r: Rule) => {
    setEdit(r);
    setEditFrom(r.fromDate); setEditTo(r.toDate); setEditAmount(String(r.amountPerDay)); setEditNote(r.note || "");
  };

  const saveEdit = async () => {
    if (!edit) return;
    setBusy("edit");
    try {
      const j = await call(`${API}/rules/${edit.id}?${q}`, {
        method: "PUT",
        body: JSON.stringify({ fromDate: editFrom, toDate: editTo, amountPerDay: editAmount, note: editNote }),
      });
      notify("Updated", j.message || "Rule updated.");
      setEdit(null);
      loadRules();
    } catch (e: any) {
      notify("Could not update", e.message);
    } finally {
      setBusy(null);
    }
  };

  const deleteRule = (r: Rule) =>
    ask("Delete rule", `Delete the ${r.scope === "GROUP" ? r.designation : r.name || r.empId} rule (${nice(r.fromDate)} - ${nice(r.toDate)})?`,
      "Delete", async () => {
        try {
          const j = await call(`${API}/rules/${r.id}?${q}`, { method: "DELETE" });
          notify("Deleted", j.message || "Rule deleted.");
          loadRules();
        } catch (e: any) {
          notify("Could not delete", e.message);
        }
      });

  // Individual picker: designation chips (ASM, DM ...) + people grouped under their designation
  const [empGroup, setEmpGroup] = useState("ALL");
  const desigOf = (s: Staff) => (s.designation || "").trim() || "(no designation)";
  const staffGroups = useMemo(() => {
    const counts = new Map<string, number>();
    staff.forEach((s) => counts.set(desigOf(s), (counts.get(desigOf(s)) || 0) + 1));
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [staff]);
  const staffShown = useMemo(() => {
    const t = empSearch.trim().toLowerCase();
    const list = staff
      .filter((s) => empGroup === "ALL" || desigOf(s) === empGroup)
      .filter((s) => !t || `${s.name} ${s.empId} ${s.designation}`.toLowerCase().includes(t));
    const byGroup = new Map<string, Staff[]>();
    list.forEach((s) => {
      const g = desigOf(s);
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(s);
    });
    return [...byGroup.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([g, people]) => ({ group: g, people: people.sort((a, b) => (a.name || "").localeCompare(b.name || "")) }));
  }, [staff, empSearch, empGroup]);

  // ---------------------------------------------------------------- report actions
  const loadDays = async (empId: string) => {
    setDaysLoading(true);
    try {
      const d = await call(`${API}/entries?empId=${encodeURIComponent(empId)}&from=${from}&to=${to}&allDays=true`);
      setDays(Array.isArray(d) ? d : []);
    } catch (e: any) {
      notify("Could not load the days", e.message);
    } finally {
      setDaysLoading(false);
    }
  };

  const openDays = async (empId: string) => {
    if (openEmp === empId) { setOpenEmp(null); return; }
    setOpenEmp(empId);
    setDays([]);
    loadDays(empId);
  };

  // the person's usual rate for the quick Full / Half buttons (a day with no rule: the highest rate in the list)
  const openDayEdit = (r: ReportRow, d: Entry) => {
    const rate = Number(d.rate) > 0 ? Number(d.rate)
      : Math.max(0, ...days.filter((x) => !x.edited && Number(x.rate) > 0).map((x) => Number(x.rate)));
    setDayEdit({ empId: r.empId, name: r.name, day: d, ruleRate: rate });
    setDayAmount(String(Number(d.amount) || 0));
    setDayReason(d.editReason || "");
  };

  const saveDay = async () => {
    if (!dayEdit) return;
    const amt = dayAmount.replace(/[,\s₹]/g, "");
    if (amt === "" || isNaN(Number(amt)) || Number(amt) < 0) return notify("Amount needed", "Enter the amount for the day (0 removes it).");
    if (dayReason.trim().length < 3) return notify("Reason needed", "Enter why you are changing this day (e.g. Worked Sunday - client visit).");
    setBusy("day");
    try {
      const j = await call(`${API}/day-edit?${q}`, {
        method: "POST",
        body: JSON.stringify({ empId: dayEdit.empId, date: dayEdit.day.date, amount: amt, reason: dayReason.trim() }),
      });
      const emp = dayEdit.empId;
      setDayEdit(null);
      notify("Saved", j.message || "Day updated.");
      loadDays(emp);
      loadReport(true);
    } catch (e: any) {
      notify("Could not save", e.message);
    } finally {
      setBusy(null);
    }
  };

  const resetDay = () => {
    if (!dayEdit) return;
    const { empId, day } = dayEdit;
    ask("Reset to automatic", `Remove your edit for ${nice(day.date)}? The system calculation is used again.`, "Reset", async () => {
      setBusy("day");
      try {
        const j = await call(`${API}/day-reset?${q}`, { method: "POST", body: JSON.stringify({ empId, date: day.date }) });
        setDayEdit(null);
        notify("Reset", j.message || "Back to automatic.");
        loadDays(empId);
        loadReport(true);
      } catch (e: any) {
        notify("Could not reset", e.message);
      } finally {
        setBusy(null);
      }
    });
  };

  const recalc = async () => {
    setBusy("recalc");
    try {
      const j = await call(`${API}/recalculate`, { method: "POST", body: JSON.stringify({ fromDate: from, toDate: to }) });
      notify("Recalculated", j.message || "Done.");
      loadReport();
    } catch (e: any) {
      notify("Could not recalculate", e.message);
    } finally {
      setBusy(null);
    }
  };

  const markPaid = () => {
    if (appliedQ || editedOnly) {
      return notify("Clear the search first", "Mark as paid works on the date range and designation only. Clear the search / Edited days filter, then try again.");
    }
    const unpaid = report?.unpaid || 0;
    if (!(Number(unpaid) > 0)) return notify("Nothing to pay", "There is no unpaid allowance in this range / filter.");
    ask("Mark as paid",
      `Lock ${inr(unpaid)} of unpaid allowance from ${nice(from)} to ${nice(to)}${fDesig !== "ALL" ? ` (${fDesig})` : ""} as PAID? Paid days are never recalculated or paid again.`,
      "Mark paid", async () => {
        setBusy("paid");
        try {
          const j = await call(`${API}/mark-paid?${q}`, {
            method: "POST",
            body: JSON.stringify({ fromDate: from, toDate: to, designation: fDesig !== "ALL" ? fDesig : null }),
          });
          notify("Marked as paid", j.message || "Done.");
          loadReport();
        } catch (e: any) {
          notify("Could not mark as paid", e.message);
        } finally {
          setBusy(null);
        }
      });
  };

  const exportExcel = async () => {
    setBusy("export");
    const url = `${API}/export?${filterQs()}`;
    const fileName = `Allowance_${from}_${to}.xlsx`;
    try {
      if (Platform.OS === "web") {
        const res = await fetch(url);
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || `HTTP ${res.status}`);
        const blob = await res.blob();
        const href = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href; a.setAttribute("download", fileName);
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => window.URL.revokeObjectURL(href), 10000);
        return;
      }
      const out = await FileSystem.downloadAsync(url, `${FileSystem.documentDirectory}${fileName}`, { headers: authHeaders() });
      if (out.status !== 200) throw new Error(`HTTP ${out.status}`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(out.uri, { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", dialogTitle: "Allowance report" });
      }
    } catch (e: any) {
      notify("Could not export", e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScreenContainer webMaxWidth={1100}
      webHeader={<WebPageHeader title="Daily Allowance" subtitle="Sales staff • separate from salary" onBack={navigation ? goBack : undefined} />}>
      <View className="px-4 pt-2 pb-10">
        {!isWebDesktop && (
          <View className="flex-row items-center mb-3">
            {navigation && (
              <TouchableOpacity onPress={goBack} className="w-10 h-10 rounded-2xl bg-white border border-[#E7E4F5] items-center justify-center mr-3">
                <ChevronLeft size={18} color="#1F1B3D" />
              </TouchableOpacity>
            )}
            <View>
              <Text className="text-xl font-black text-[#1F1B3D]">Daily Allowance</Text>
              <Text className="text-xs font-bold text-[#7A76A6]">Sales staff • separate from salary</Text>
            </View>
          </View>
        )}

        <View className="flex-row bg-[#EEECFA]/70 p-1.5 rounded-2xl border border-[#E7E4F5] mb-4">
          {([["rules", "Rules"], ["report", "Report & pay"], ["statements", "Paid statements"]] as [Tab, string][]).map(([k, l]) => (
            <TouchableOpacity key={k} onPress={() => setTab(k)} className={`flex-1 py-2.5 rounded-xl items-center ${tab === k ? "bg-[#5B4FD1]" : ""}`}>
              <Text className={`text-xs font-black ${tab === k ? "text-white" : "text-[#7A76A6]"}`}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ================================================================ RULES */}
        {tab === "rules" && (
          <>
            <Card>
              <Text className="text-sm font-black text-[#1F1B3D] mb-3">Add allowance</Text>
              <View className="flex-row mb-3">
                <Chip label="Group (designation)" on={scope === "GROUP"} onPress={() => setScope("GROUP")} />
                <Chip label="Individual" on={scope === "INDIVIDUAL"} onPress={() => setScope("INDIVIDUAL")} />
              </View>
              <View className="flex-col md:flex-row gap-2 mb-3">
                <CrossPlatformDatePicker label="From date" value={rFrom} onChange={(v: string) => { setRFrom(v); if (v > rTo) setRTo(v); }} />
                <CrossPlatformDatePicker label="To date" value={rTo} onChange={(v: string) => { setRTo(v); if (v < rFrom) setRFrom(v); }} />
              </View>

              {scope === "GROUP" ? (
                <>
                  <Label t="Designations (sales staff)" />
                  <View className="flex-row flex-wrap mb-2">
                    {desigs.length === 0 && <Text className="text-xs font-semibold text-[#A6A2CE]">No sales staff found (work mode SALES).</Text>}
                    {desigs.map((d) => (
                      <Chip key={d.designation} label={`${d.designation} (${d.count})`} on={pickedDesigs.includes(d.designation)} onPress={() => toggleDesig(d.designation)} />
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Label t="Sales employee" />
                  {pickedEmp ? (
                    <View className="flex-row items-center justify-between bg-[#F6F5FC] rounded-xl p-3 mb-3">
                      <Text className="text-xs font-black text-[#1F1B3D]">{pickedEmp.name} • {pickedEmp.empId} • {pickedEmp.designation}</Text>
                      <TouchableOpacity onPress={() => setPickedEmp(null)}><X size={16} color="#7A76A6" /></TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <View className="flex-row flex-wrap">
                        <Chip label={`All (${staff.length})`} on={empGroup === "ALL"} onPress={() => setEmpGroup("ALL")} />
                        {staffGroups.map(([g, n]) => (
                          <Chip key={g} label={`${g} (${n})`} on={empGroup === g} onPress={() => setEmpGroup(g)} />
                        ))}
                      </View>
                      <View className="flex-row items-center bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 mb-2">
                        <Search size={14} color="#A6A2CE" />
                        <TextInput value={empSearch} onChangeText={setEmpSearch}
                          placeholder={empGroup === "ALL" ? "Search name or ID" : `Search in ${empGroup}`} placeholderTextColor="#A6A2CE"
                          className="flex-1 py-2.5 px-2 text-xs font-semibold text-[#1F1B3D]" />
                        {!!empSearch && (
                          <TouchableOpacity onPress={() => setEmpSearch("")}><X size={14} color="#7A76A6" /></TouchableOpacity>
                        )}
                      </View>
                      <View className="border border-[#F1EFFB] rounded-xl mb-3" style={{ maxHeight: 320 }}>
                        <ScrollView nestedScrollEnabled>
                          {staffShown.length === 0 && (
                            <Text className="text-[11px] font-semibold text-[#A6A2CE] p-3">No sales employee matches.</Text>
                          )}
                          {staffShown.map(({ group, people }) => (
                            <View key={group}>
                              <View className="px-3 py-1.5 bg-[#F6F5FC] border-b border-[#EEECFA]">
                                <Text className="text-[10px] font-black text-[#5B4FD1] uppercase tracking-wider">{group} ({people.length})</Text>
                              </View>
                              {people.map((s) => (
                                <TouchableOpacity key={s.empId} onPress={() => setPickedEmp(s)} className="px-3 py-2.5 border-b border-[#F6F5FC]">
                                  <Text className="text-xs font-bold text-[#1F1B3D]">{s.name} <Text className="text-[#7A76A6]">• {s.empId}</Text></Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          ))}
                        </ScrollView>
                      </View>
                    </>
                  )}
                </>
              )}

              <View className="flex-row gap-2 mb-3">
                <View className="flex-1">
                  <Label t="Amount per day (₹)" />
                  <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="250" placeholderTextColor="#A6A2CE"
                    className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-sm font-black text-[#1F1B3D]" />
                </View>
                <View className="flex-[2]">
                  <Label t="Note (optional)" />
                  <TextInput value={note} onChangeText={setNote} placeholder="e.g. Erode - Salem route" placeholderTextColor="#A6A2CE"
                    className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-semibold text-[#1F1B3D]" />
                </View>
              </View>
              <Text className="text-[10.5px] font-semibold text-[#7A76A6] mb-3">
                Present / OD = 100% • half day = 50% • half day with a permission of 1 hour or less = 100%. An individual rule beats the
                group rule. Two rules for the same designation (or person) cannot overlap.
              </Text>
              <TouchableOpacity onPress={saveRule} disabled={saving} className="bg-[#5B4FD1] rounded-xl py-3 flex-row items-center justify-center">
                {saving ? <ActivityIndicator size="small" color="#fff" /> : (<><Plus size={14} color="#fff" /><Text className="text-white text-xs font-black uppercase ml-1.5">Save allowance</Text></>)}
              </TouchableOpacity>
            </Card>

            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-black text-[#1F1B3D]">Rules ({rules.length})</Text>
              <TouchableOpacity onPress={loadRules} className="w-9 h-9 rounded-xl bg-white border border-[#E7E4F5] items-center justify-center">
                {rulesLoading ? <ActivityIndicator size="small" color="#5B4FD1" /> : <RotateCw size={15} color="#5B4FD1" />}
              </TouchableOpacity>
            </View>
            {rules.length === 0 && !rulesLoading && <Text className="text-xs font-semibold text-[#A6A2CE] mb-3">No rules yet.</Text>}
            {rules.map((r) => (
              <View key={r.id} className="bg-white border border-[#E7E4F5] rounded-2xl p-3.5 mb-2 flex-row items-center">
                <View className="flex-1 pr-2">
                  <Text className="text-[10px] font-black text-[#5B4FD1] uppercase">{r.scope === "GROUP" ? "Group" : "Individual"}</Text>
                  <Text className="text-sm font-black text-[#1F1B3D]">{r.scope === "GROUP" ? r.designation : `${r.name || ""} • ${r.empId}`}</Text>
                  <Text className="text-[11px] font-semibold text-[#7A76A6]">
                    {nice(r.fromDate)} - {nice(r.toDate)} • {inr(r.amountPerDay)}/day{r.paidDays > 0 ? ` • ${r.paidDays} day(s) paid` : ""}
                  </Text>
                  {!!r.note && <Text className="text-[10.5px] font-semibold text-[#A6A2CE]">{r.note}</Text>}
                </View>
                <TouchableOpacity onPress={() => openEdit(r)} className="w-9 h-9 rounded-xl border border-[#E7E4F5] items-center justify-center mr-2">
                  <Pencil size={14} color="#5B4FD1" />
                </TouchableOpacity>
                {r.paidDays === 0 && (
                  <TouchableOpacity onPress={() => deleteRule(r)} className="w-9 h-9 rounded-xl border border-rose-200 bg-rose-50 items-center justify-center">
                    <Trash2 size={14} color="#BE123C" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}

        {/* ================================================================ REPORT */}
        {tab === "report" && (
          <>
            <Card>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-black text-[#1F1B3D]">Filters</Text>
                {filtersActive && (
                  <TouchableOpacity onPress={clearFilters} className="flex-row items-center px-2.5 py-1.5 rounded-lg bg-[#FFF1F2] border border-[#FECDD3]">
                    <X size={12} color="#BE123C" />
                    <Text className="text-[11px] font-black text-[#BE123C] ml-1">Clear filters</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Label t="Period" />
              <View className="flex-row flex-wrap">
                {PERIODS.map(([k, l]) => <Chip key={k} label={l} on={period === k} onPress={() => pickPeriod(k)} />)}
              </View>
              {period === "CUSTOM" && (
                <View className="flex-col md:flex-row gap-2 mb-3">
                  <CrossPlatformDatePicker label="From date" value={from} onChange={(v: string) => { setFrom(v); if (v > to) setTo(v); }} />
                  <CrossPlatformDatePicker label="To date" value={to} onChange={(v: string) => { setTo(v); if (v < from) setFrom(v); }} />
                </View>
              )}

              <Label t="Search employee" />
              <View className="flex-row items-center bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 mb-3">
                <Search size={14} color="#7A76A6" />
                <TextInput value={search} onChangeText={setSearch} placeholder="Name or employee ID"
                  placeholderTextColor="#A6A2CE" autoCapitalize="none"
                  className="flex-1 py-2.5 px-2 text-xs font-semibold text-[#1F1B3D]" />
                {!!search && (
                  <TouchableOpacity onPress={() => setSearch("")}><X size={14} color="#7A76A6" /></TouchableOpacity>
                )}
              </View>

              <Label t="Designation" />
              <View className="flex-row flex-wrap">
                <Chip label="All" on={fDesig === "ALL"} onPress={() => setFDesig("ALL")} />
                {desigs.map((d) => <Chip key={d.designation} label={d.designation} on={fDesig === d.designation} onPress={() => setFDesig(d.designation)} />)}
              </View>
              <Label t="Show" />
              <View className="flex-row flex-wrap">
                {(["ALL", "UNPAID", "PAID"] as const).map((p) => <Chip key={p} label={p === "ALL" ? "All" : p === "UNPAID" ? "Unpaid" : "Paid"} on={paidFilter === p} onPress={() => setPaidFilter(p)} />)}
                <Chip label="Edited days only" on={editedOnly} onPress={() => setEditedOnly(!editedOnly)} />
              </View>

              <View className="bg-[#F6F5FC] rounded-xl px-3 py-2 mb-2">
                <Text className="text-[11px] font-bold text-[#1F1B3D]">
                  Showing: {nice(from)} – {nice(to)}
                  {fDesig !== "ALL" ? ` • ${fDesig}` : ""}
                  {paidFilter !== "ALL" ? ` • ${paidFilter === "UNPAID" ? "Unpaid" : "Paid"}` : ""}
                  {appliedQ ? ` • "${appliedQ}"` : ""}
                  {editedOnly ? " • Edited days" : ""}
                  {report ? ` • ${report.rows.length} people • ${inr(report.total)}` : ""}
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2 mt-1">
                <TouchableOpacity onPress={() => loadReport()} className="px-3 h-10 rounded-xl bg-white border border-[#E7E4F5] flex-row items-center">
                  {repLoading ? <ActivityIndicator size="small" color="#5B4FD1" /> : <RotateCw size={14} color="#5B4FD1" />}
                  <Text className="text-xs font-black text-[#5B4FD1] ml-1.5">Refresh</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={recalc} disabled={!!busy} className="px-3 h-10 rounded-xl bg-white border border-[#E7E4F5] flex-row items-center">
                  {busy === "recalc" ? <ActivityIndicator size="small" color="#5B4FD1" /> : <RotateCw size={14} color="#5B4FD1" />}
                  <Text className="text-xs font-black text-[#5B4FD1] ml-1.5">Recalculate</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={exportExcel} disabled={!!busy} className="px-3 h-10 rounded-xl bg-white border border-[#E7E4F5] flex-row items-center">
                  {busy === "export" ? <ActivityIndicator size="small" color="#5B4FD1" /> : <Download size={14} color="#5B4FD1" />}
                  <Text className="text-xs font-black text-[#5B4FD1] ml-1.5">Excel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openHistory()} className="px-3 h-10 rounded-xl bg-white border border-[#E7E4F5] flex-row items-center">
                  <History size={14} color="#5B4FD1" />
                  <Text className="text-xs font-black text-[#5B4FD1] ml-1.5">Edit history</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={markPaid} disabled={!!busy} className="px-3 h-10 rounded-xl bg-emerald-600 flex-row items-center">
                  {busy === "paid" ? <ActivityIndicator size="small" color="#fff" /> : <CheckCircle2 size={14} color="#fff" />}
                  <Text className="text-xs font-black text-white ml-1.5">Mark as paid</Text>
                </TouchableOpacity>
              </View>
            </Card>

            {report && (
              <View className="flex-row gap-2 mb-3">
                <View className="flex-1 bg-white border border-[#E7E4F5] rounded-2xl p-3">
                  <Text className="text-[10px] font-black text-[#7A76A6] uppercase">Total</Text>
                  <Text className="text-lg font-black text-[#1F1B3D]">{inr(report.total)}</Text>
                </View>
                <View className="flex-1 bg-white border border-[#E7E4F5] rounded-2xl p-3">
                  <Text className="text-[10px] font-black text-[#7A76A6] uppercase">Unpaid</Text>
                  <Text className="text-lg font-black text-amber-700">{inr(report.unpaid)}</Text>
                </View>
              </View>
            )}
            {report?.lastCalculatedDay && (
              <Text className="text-[10.5px] font-semibold text-[#7A76A6] mb-2">Calculated up to {nice(report.lastCalculatedDay)} (today is counted tomorrow).</Text>
            )}
            {report && report.rows.length === 0 && !repLoading && (
              <Text className="text-xs font-semibold text-[#A6A2CE]">No allowance in this range. Add a rule on the Rules tab, then Recalculate.</Text>
            )}
            {report?.rows.map((r) => (
              <View key={r.empId} className="bg-white border border-[#E7E4F5] rounded-2xl mb-2">
                <TouchableOpacity onPress={() => openDays(r.empId)} className="p-3.5 flex-row items-center">
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-black text-[#1F1B3D]">{r.name} <Text className="text-[#5B4FD1]">• {r.empId}</Text></Text>
                    <Text className="text-[11px] font-semibold text-[#7A76A6]">
                      {r.designation} • {r.fullDays} full • {r.halfDays} half{r.odDays ? ` • ${r.odDays} OD` : ""} • {inr(r.rate)}/day
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-black text-[#1F1B3D]">{inr(r.total)}</Text>
                    <Text className={`text-[10.5px] font-bold ${Number(r.unpaid) > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                      {Number(r.unpaid) > 0 ? `${inr(r.unpaid)} unpaid` : "Paid"}
                    </Text>
                  </View>
                </TouchableOpacity>
                {openEmp === r.empId && (
                  <View className="px-3.5 pb-3 border-t border-[#F1EFFB]">
                    <TouchableOpacity onPress={() => openHistory(r.empId, (r as any).name)} className="self-end flex-row items-center mt-2 px-2.5 py-1.5 rounded-lg bg-[#F6F5FC] border border-[#E7E4F5]">
                      <History size={12} color="#5B4FD1" />
                      <Text className="text-[11px] font-black text-[#5B4FD1] ml-1">History</Text>
                    </TouchableOpacity>
                    {daysLoading && days.length === 0 && <ActivityIndicator size="small" color="#5B4FD1" style={{ marginTop: 8 }} />}
                    {!daysLoading && days.length === 0 && (
                      <Text className="text-[11px] font-semibold text-[#A6A2CE] mt-2">No finished day in this range yet.</Text>
                    )}
                    {days.length > 0 && (
                      <Text className="text-[10px] font-semibold text-[#A6A2CE] mt-2 mb-1">
                        Tap Edit to change or remove a day • Sundays / holidays are ₹0 unless you add them • paid days are locked
                      </Text>
                    )}
                    {days.map((d) => {
                      const off = !!d.dayType;
                      return (
                        <View key={d.date}
                          className={`flex-row items-center py-2 px-2 rounded-lg mb-1 ${d.edited ? "bg-[#EEF2FF]" : off ? "bg-[#FFF7ED]" : ""}`}>
                          <View className="w-24">
                            <Text className={`text-[11px] font-bold ${off ? "text-orange-700" : "text-[#1F1B3D]"}`}>{niceDay(d.date)}</Text>
                            {off && <Text className="text-[9.5px] font-black text-orange-600 uppercase">{d.dayType}</Text>}
                          </View>
                          <View className="flex-1 pr-2">
                            <Text className={`text-[11px] font-semibold ${d.noRule && !d.edited ? "text-[#A6A2CE]" : "text-[#7A76A6]"}`}>
                              {dayLabel(d)}{!d.edited && !d.noRule ? ` (${d.pct}%)` : ""}
                            </Text>
                            {d.edited && (
                              <Text className="text-[10px] font-semibold text-[#5B4FD1]" numberOfLines={2}>
                                {d.editReason}{d.editedBy ? ` • ${d.editedBy}` : ""}
                              </Text>
                            )}
                          </View>
                          <Text className="text-[11.5px] font-black text-[#1F1B3D] mr-2">{inr(d.amount)}</Text>
                          {d.paid ? (
                            <View className="px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200">
                              <Text className="text-[10px] font-black text-emerald-700">Paid ✓</Text>
                            </View>
                          ) : (
                            <TouchableOpacity onPress={() => openDayEdit(r, d)}
                              className="px-2 py-1 rounded-md bg-white border border-[#D9D5F2] flex-row items-center">
                              <Pencil size={11} color="#5B4FD1" />
                              <Text className="text-[10px] font-black text-[#5B4FD1] ml-1">Edit</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {/* ================================================================ STATEMENTS */}
        {tab === "statements" && (
          <>
            {statements.length === 0 && <Text className="text-xs font-semibold text-[#A6A2CE]">Nothing marked as paid yet.</Text>}
            {statements.map((s) => (
              <View key={s.id} className="bg-white border border-[#E7E4F5] rounded-2xl p-3.5 mb-2">
                <View className="flex-row justify-between">
                  <Text className="text-sm font-black text-[#1F1B3D]">{nice(s.fromDate)} - {nice(s.toDate)}</Text>
                  <Text className="text-sm font-black text-emerald-700">{inr(s.total)}</Text>
                </View>
                <Text className="text-[11px] font-semibold text-[#7A76A6]">
                  {s.filter} • {s.employees} employee(s) • {s.days} day(s) • paid by {s.paidBy || "-"} on {nice(s.paidAt)}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>

      {/* edit rule */}
      <Modal visible={!!edit} transparent animationType="fade" onRequestClose={() => setEdit(null)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="w-full max-w-md bg-white rounded-3xl p-5">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-base font-black text-[#1F1B3D]">Change rule</Text>
              <TouchableOpacity onPress={() => setEdit(null)}><X size={18} color="#7A76A6" /></TouchableOpacity>
            </View>
            <Text className="text-xs font-bold text-[#7A76A6] mb-3">
              {edit?.scope === "GROUP" ? edit?.designation : `${edit?.name || ""} • ${edit?.empId}`}
              {edit && edit.paidDays > 0 ? " • already paid: only the end date and note can change" : ""}
            </Text>
            <View className="gap-2 mb-3">
              <CrossPlatformDatePicker label="From date" value={editFrom} onChange={(v: string) => setEditFrom(v)} />
              <CrossPlatformDatePicker label="To date" value={editTo} onChange={(v: string) => setEditTo(v)} />
            </View>
            <Label t="Amount per day (₹)" />
            <TextInput value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad"
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-sm font-black text-[#1F1B3D] mb-3" />
            <Label t="Note" />
            <TextInput value={editNote} onChangeText={setEditNote}
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-semibold text-[#1F1B3D] mb-4" />
            <TouchableOpacity onPress={saveEdit} disabled={busy === "edit"} className="bg-[#5B4FD1] rounded-xl py-3 items-center">
              {busy === "edit" ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white text-xs font-black uppercase">Save changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* edit one day */}
      <Modal visible={!!dayEdit} transparent animationType="fade" onRequestClose={() => setDayEdit(null)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="w-full max-w-md bg-white rounded-3xl p-5">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-base font-black text-[#1F1B3D]">Edit day allowance</Text>
              <TouchableOpacity onPress={() => setDayEdit(null)}><X size={18} color="#7A76A6" /></TouchableOpacity>
            </View>
            {dayEdit && (
              <>
                <Text className="text-xs font-bold text-[#7A76A6]">{dayEdit.name} • {dayEdit.empId}</Text>
                <Text className="text-sm font-black text-[#1F1B3D] mt-1">
                  {nice(dayEdit.day.date)}{dayEdit.day.dayType ? ` • ${dayEdit.day.dayType}` : ""}
                </Text>
                <Text className="text-[11px] font-semibold text-[#7A76A6] mb-3">
                  Now: {dayLabel(dayEdit.day)} • {inr(dayEdit.day.amount)}
                </Text>

                <Label t="Quick choose" />
                <View className="flex-row flex-wrap mb-2">
                  {dayEdit.ruleRate > 0 && (
                    <Chip label={`Full day ${inr(dayEdit.ruleRate)}`} on={Number(dayAmount) === dayEdit.ruleRate}
                      onPress={() => setDayAmount(String(dayEdit.ruleRate))} />
                  )}
                  {dayEdit.ruleRate > 0 && (
                    <Chip label={`Half day ${inr(dayEdit.ruleRate / 2)}`} on={Number(dayAmount) === dayEdit.ruleRate / 2}
                      onPress={() => setDayAmount(String(dayEdit.ruleRate / 2))} />
                  )}
                  <Chip label="Remove (₹0)" on={dayAmount.trim() !== "" && Number(dayAmount) === 0} onPress={() => setDayAmount("0")} />
                </View>

                <Label t="Amount for this day (₹)" />
                <TextInput value={dayAmount} onChangeText={setDayAmount} keyboardType="decimal-pad" placeholder="e.g. 300"
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-sm font-black text-[#1F1B3D] mb-3" />
                <Label t="Reason (required)" />
                <TextInput value={dayReason} onChangeText={setDayReason} placeholder="e.g. Worked Sunday - client visit"
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-semibold text-[#1F1B3D] mb-4" />

                <TouchableOpacity onPress={saveDay} disabled={busy === "day"} className="bg-[#5B4FD1] rounded-xl py-3 items-center">
                  {busy === "day" ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white text-xs font-black uppercase">Save day</Text>}
                </TouchableOpacity>
                {dayEdit.day.edited && (
                  <TouchableOpacity onPress={resetDay} disabled={busy === "day"} className="mt-2 border border-[#E7E4F5] rounded-xl py-3 flex-row items-center justify-center">
                    <RotateCw size={13} color="#7A76A6" />
                    <Text className="text-[#7A76A6] text-xs font-black uppercase ml-1.5">Reset to automatic</Text>
                  </TouchableOpacity>
                )}
                {dayEdit.day.edited && !!dayEdit.day.editedAt && (
                  <Text className="text-[10px] font-semibold text-[#A6A2CE] mt-2 text-center">
                    Last edited by {dayEdit.day.editedBy || "-"} on {nice(dayEdit.day.editedAt)}
                  </Text>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* edit history */}
      <Modal visible={!!hist} transparent animationType="fade" onRequestClose={() => setHist(null)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="w-full max-w-lg bg-white rounded-3xl p-5" style={{ maxHeight: "85%" }}>
            <View className="flex-row justify-between items-start mb-1">
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text className="text-base font-black text-[#1F1B3D]">Edit history</Text>
                <Text className="text-[11px] font-bold text-[#7A76A6]">{hist?.title} • {nice(from)} – {nice(to)}</Text>
              </View>
              <TouchableOpacity onPress={() => setHist(null)}><X size={18} color="#7A76A6" /></TouchableOpacity>
            </View>
            {histLoading && <ActivityIndicator size="small" color="#5B4FD1" style={{ marginVertical: 16 }} />}
            {!histLoading && hist && hist.rows.length === 0 && (
              <Text className="text-xs font-semibold text-[#A6A2CE] text-center my-6">No changes in this period.</Text>
            )}
            <ScrollView style={{ marginTop: 8 }}>
              {(hist?.rows || []).map((h) => (
                <View key={h.id} className="border border-[#E7E4F5] rounded-2xl p-3 mb-2">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-xs font-black text-[#1F1B3D]">
                      {nice(h.date)}{hist?.title === "All sales staff" ? ` • ${h.name || h.empId}` : ""}
                    </Text>
                    <Text className={`text-[10px] font-black uppercase ${h.action === "REMOVED" ? "text-rose-600" : h.action === "RESET" ? "text-[#7A76A6]" : "text-[#5B4FD1]"}`}>
                      {ACTION_LABEL[h.action] || h.action}
                    </Text>
                  </View>
                  <Text className="text-xs font-bold text-[#1F1B3D] mt-1">
                    {rupees(h.oldAmount)} → {rupees(h.newAmount)}
                  </Text>
                  {!!h.reason && <Text className="text-[11px] font-semibold text-[#7A76A6] mt-0.5">Reason: {h.reason}</Text>}
                  <Text className="text-[10px] font-semibold text-[#A6A2CE] mt-1">
                    By {h.byName || h.by || "-"}{h.by && h.byName ? ` (${h.by})` : ""} • {nice(h.at)} {String(h.at).slice(11, 16)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
