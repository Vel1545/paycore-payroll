import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Platform, Alert,
  ActivityIndicator, Modal, RefreshControl,
} from "react-native";
import {
  ChevronLeft, Search, Download, SlidersHorizontal, ShieldCheck, CheckSquare,
  Square, X, Calendar, IndianRupee, Building, Pencil, Save,
} from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import ScreenContainer from "../components/ScreenContainer";
import { BASE_HOST } from "../constants/config";
import { UserSession } from "../services/UserSession";
import { useResponsive } from "../hooks/useResponsive";
import { Badge, Btn, WebPageHeader } from "../components/web/webUi";
// TODO: import your own session helper here and return the logged-in admin's emp id.
// import { UserSession } from "../utils/UserSession";

const getAdminEmpId = (): string => {
  // TODO: replace with your real source, e.g. UserSession.empId
  return UserSession.empId;
};

const API = `${BASE_HOST}/api/admin/reports/employees`;

interface Row {
  empId: string; name: string; email: string | null; mobile: string | null;
  dept: string | null; designation: string | null; joinDate: string | null;
  salary: number | null; basic: number | null; da: number | null; hra: number | null;
  pf: boolean; esi: boolean; status: "Active" | "Inactive";
}

type Detail = Record<string, any>;

const inr = (n: number | null | undefined) =>
  n === null || n === undefined ? "-" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

async function api(url: string, init?: RequestInit, ms = 20000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    if (!res.ok) throw new Error(body?.message || `Request failed (${res.status})`);
    return body;
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("The server took too long. Try again.");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// Fields shown in the detail screen. editable ones are saved with PUT.
type FieldDef = { key: string; label: string; kind?: "text" | "date" | "money" | "num" | "flag" | "json" | "time"; edit?: boolean };
const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  { title: "Job details", fields: [
    { key: "empId", label: "Employee ID" },
    { key: "name", label: "Full name", edit: true },
    { key: "department", label: "Department", edit: true },
    { key: "designation", label: "Designation", edit: true },
    { key: "doj", label: "Joining date (YYYY-MM-DD)", kind: "date", edit: true },
    { key: "role", label: "Login role" },
    { key: "isActive", label: "Active", kind: "flag", edit: true },
  ]},
  { title: "Contact", fields: [
    { key: "email", label: "Email", edit: true },
    { key: "mobile", label: "Mobile", edit: true },
    { key: "officialMobile", label: "Official mobile", edit: true },
  ]},
  { title: "Salary", fields: [
    { key: "joiningSalary", label: "Joining salary", kind: "money", edit: true },
    { key: "salary", label: "Monthly salary", kind: "money", edit: true },
    { key: "basicSalary", label: "Basic", kind: "money", edit: true },
    { key: "daAmount", label: "D.A.", kind: "money", edit: true },
    { key: "hraAmount", label: "HRA", kind: "money", edit: true },
    { key: "otherAllowances", label: 'Other allowances (JSON, e.g. {"Conveyance": 1000})', kind: "json", edit: true },
    { key: "dailyAllowance", label: "Daily allowance", kind: "money", edit: true },
    { key: "otherDeductions", label: "Other deductions (JSON)", kind: "json", edit: true },
  ]},
  { title: "PF / ESI", fields: [
    { key: "pfApplicable", label: "PF applicable", kind: "flag", edit: true },
    { key: "esiApplicable", label: "ESI applicable", kind: "flag", edit: true },
  ]},
  { title: "Personal", fields: [
    { key: "dob", label: "Date of birth (YYYY-MM-DD)", kind: "date", edit: true },
    { key: "gender", label: "Gender", edit: true },
    { key: "maritalStatus", label: "Marital status", edit: true },
    { key: "bloodGroup", label: "Blood group", edit: true },
    { key: "nationality", label: "Nationality", edit: true },
    { key: "religion", label: "Religion", edit: true },
    { key: "qualification", label: "Qualification", edit: true },
  ]},
  { title: "Leave balances", fields: [
    { key: "leaveBalances", label: 'Leave balances (JSON, e.g. {"cl": 12, "sl": 6, "ml": 0})', kind: "json", edit: true },
  ]},
  { title: "Identity (masked)", fields: [
    { key: "aadhaar", label: "Aadhaar" },
    { key: "pan", label: "PAN" },
  ]},
];
const READ_ONLY_JSON: { title: string; key: string; tab: "user" }[] = [
  { title: "Current address", key: "currentAddress", tab: "user" },
  { title: "Permanent address", key: "permanentAddress", tab: "user" },
  { title: "Bank details", key: "bank", tab: "user" },
];

const SAL_TIERS = [
  { label: "All Salaries", value: "All" },
  { label: "< ₹15,000", value: "low" },
  { label: "₹15k - ₹25k", value: "mid" },
  { label: "> ₹25,000", value: "high" },
];

const EXPORT_COLS = [
  { key: "id", label: "Employee ID", selected: true },
  { key: "name", label: "Employee Name", selected: true },
  { key: "dept", label: "Department", selected: true },
  { key: "designation", label: "Designation", selected: true },
  { key: "joinDate", label: "Joining Date", selected: true },
  { key: "salary", label: "Monthly Salary", selected: true },
  { key: "basic", label: "Basic", selected: false },
  { key: "da", label: "D.A.", selected: false },
  { key: "hra", label: "HRA", selected: false },
  { key: "pf", label: "PF Applicable", selected: false },
  { key: "esi", label: "ESI Applicable", selected: false },
  { key: "mobile", label: "Mobile", selected: false },
  { key: "email", label: "Email", selected: false },
  { key: "status", label: "Status", selected: false },
];

type AddField = { key: string; label: string; kind?: "flag" | "money" | "num" | "json"; hint?: string };
const ADD_FIELDS: AddField[] = [
  { key: "empId", label: "Employee ID *", hint: "e.g. F9101" },
  { key: "name", label: "Full name *" },
  { key: "role", label: "Login role", hint: "EMPLOYEE, MANAGER or ADMIN" },
  { key: "department", label: "Department" },
  { key: "designation", label: "Designation" },
  { key: "mobile", label: "Mobile" },
  { key: "email", label: "Email *" },
  { key: "doj", label: "Joining date (YYYY-MM-DD)" },
  { key: "salary", label: "Monthly salary *", kind: "money" },
  { key: "basicSalary", label: "Basic", kind: "money" },
  { key: "daAmount", label: "D.A.", kind: "money" },
  { key: "hraAmount", label: "HRA", kind: "money" },
  { key: "pfApplicable", label: "PF applicable", kind: "flag" },
  { key: "esiApplicable", label: "ESI applicable", kind: "flag" },
];
const ADD_DEFAULTS: Record<string, string> = { role: "EMPLOYEE", pfApplicable: "true", esiApplicable: "true" };

const valueOf = (d: Detail | null, key: string): any => (d ? d[key] : null);

const toText = (v: any, kind?: string): string => {
  if (v === null || v === undefined) return "";
  if (kind === "flag") return v ? "Yes" : "No";
  if (kind === "json") return typeof v === "string" ? v : JSON.stringify(v);
  return String(v);
};

export default function UserDirectoryScreen({ navigation }: any) {
  const { isWebDesktop } = useResponsive();
  const adminEmpId = getAdminEmpId();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedSalRange, setSelectedSalRange] = useState("All");
  const [selectedYear, setSelectedYear] = useState("All");
  const [sortBy, setSortBy] = useState<"name" | "salary" | "joinDate">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportColumns, setExportColumns] = useState(EXPORT_COLS);

  // detail popup
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // add-employee form
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState<Record<string, string>>(ADD_DEFAULTS);
  const [adding, setAdding] = useState(false);


  const loadList = useCallback(async (pull = false) => {
    pull ? setRefreshing(true) : setLoading(true);
    setLoadError(null);
    try {
      const data = await api(`${API}?adminEmpId=${encodeURIComponent(adminEmpId)}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setLoadError(e.message || "Could not load the employees");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [adminEmpId]);

  useEffect(() => { loadList(); }, [loadList]);

  const departments = useMemo(
    () => ["All", ...Array.from(new Set(rows.map(r => r.dept).filter(Boolean) as string[])).sort()], [rows]);
  const joinYears = useMemo(
    () => ["All", ...Array.from(new Set(rows.map(r => (r.joinDate || "").slice(0, 4)).filter(Boolean))).sort().reverse()], [rows]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(r => {
      const s = r.salary ?? 0;
      const okSearch = !q || (r.name || "").toLowerCase().includes(q) || r.empId.toLowerCase().includes(q)
        || (r.designation || "").toLowerCase().includes(q);
      const okDept = selectedDept === "All" || r.dept === selectedDept;
      const okYear = selectedYear === "All" || (r.joinDate || "").startsWith(selectedYear);
      const okSal = selectedSalRange === "All"
        || (selectedSalRange === "low" && s < 15000)
        || (selectedSalRange === "mid" && s >= 15000 && s <= 25000)
        || (selectedSalRange === "high" && s > 25000);
      return okSearch && okDept && okYear && okSal;
    }).sort((a, b) => {
      let c = 0;
      if (sortBy === "name") c = (a.name || "").localeCompare(b.name || "");
      else if (sortBy === "salary") c = (a.salary ?? 0) - (b.salary ?? 0);
      else c = (a.joinDate || "").localeCompare(b.joinDate || "");
      return sortOrder === "asc" ? c : -c;
    });
  }, [rows, searchQuery, selectedDept, selectedYear, selectedSalRange, sortBy, sortOrder]);

  const handleSortToggle = (f: "name" | "salary" | "joinDate") => {
    if (sortBy === f) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortBy(f); setSortOrder("asc"); }
  };

  // ---------------------------------------------------------------- detail popup
  const openDetail = async (empId: string) => {
    setOpenId(empId);
    setDetail(null);
    setDetailError(null);
    setEditing(false);
    setDetailLoading(true);
    try {
      setDetail(await api(`${API}/${encodeURIComponent(empId)}?adminEmpId=${encodeURIComponent(adminEmpId)}`));
    } catch (e: any) {
      setDetailError(e.message || "Could not load this employee");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    if (saving) return;
    if (editing && Object.keys(changedFields()).length > 0) {
      Alert.alert("Discard changes?", "You have unsaved changes.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => { setEditing(false); setOpenId(null); } },
      ]);
      return;
    }
    setEditing(false);
    setOpenId(null);
  };

  const startEdit = () => {
    if (!detail) return;
    const d: Record<string, string> = {};
    SECTIONS.forEach(s => s.fields.forEach(f => {
      if (!f.edit) return;
      d[f.key] = f.kind === "flag" ? String(!!valueOf(detail, f.key)) : toText(valueOf(detail, f.key), f.kind);
    }));
    setDraft(d);
    setEditing(true);
  };

  // only the fields the admin really changed
  const changedFields = (): Record<string, any> => {
    const out: Record<string, any> = {};
    if (!detail) return out;
    SECTIONS.forEach(s => s.fields.forEach(f => {
      if (!f.edit) return;
      const before = f.kind === "flag" ? String(!!valueOf(detail, f.key)) : toText(valueOf(detail, f.key), f.kind);
      const now = (draft[f.key] ?? "").trim();
      if (before !== now) out[f.key] = f.kind === "flag" ? (now === "true") : now;
    }));
    return out;
  };

  const save = async () => {
    if (!openId) return;
    const fields = changedFields();
    if (Object.keys(fields).length === 0) { setEditing(false); return; }
    setSaving(true);
    try {
      const updated = await api(`${API}/${encodeURIComponent(openId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmpId, fields }),
      });
      setDetail(updated);
      setEditing(false);
      loadList(true); // refresh the table behind the popup
      Alert.alert("Saved", "Employee details updated.");
    } catch (e: any) {
      Alert.alert("Could not save", e.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------- add employee
  const submitAdd = async () => {
    const empId = (addDraft.empId || "").trim();
    if (!empId || !(addDraft.name || "").trim() || !(addDraft.email || "").trim() || !(addDraft.salary || "").trim()) {
      Alert.alert("Missing details", "Employee ID, full name, email and monthly salary are required.");
      return;
    }
    const fields: Record<string, any> = {};
    ADD_FIELDS.forEach(f => {
      if (f.key === "empId" || f.key === "role") return;
      const v = (addDraft[f.key] ?? "").trim();
      if (f.kind === "flag") fields[f.key] = v === "true";
      else if (v !== "") fields[f.key] = v;
    });
    setAdding(true);
    try {
      const created = await api(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmpId, empId, role: (addDraft.role || "").trim(), fields, createConfig: false,
        }),
      });
      setShowAdd(false);
      setAddDraft(ADD_DEFAULTS);
      await loadList(true);
      Alert.alert("Employee added", `${created?.name || empId} was added. Set their login password separately.`);
      openDetail(created?.empId || empId);
    } catch (e: any) {
      Alert.alert("Could not add", e.message || "Please try again.");
    } finally {
      setAdding(false);
    }
  };

  // ---------------------------------------------------------------- export
  const toggleColumn = (key: string) =>
    setExportColumns(p => p.map(c => (c.key === key ? { ...c, selected: !c.selected } : c)));

  const handleExport = async () => {
    const keys = exportColumns.filter(c => c.selected).map(c => c.key);
    if (keys.length === 0) { Alert.alert("Selection Required", "Please select at least one column."); return; }
    setShowExportModal(false);
    try {
      setIsExporting(true);
      const qs = `?adminEmpId=${encodeURIComponent(adminEmpId)}&columns=${encodeURIComponent(keys.join(","))}`
        + `&dept=${encodeURIComponent(selectedDept)}&year=${encodeURIComponent(selectedYear)}&salary=${encodeURIComponent(selectedSalRange)}`;
      const url = `${API}/excel${qs}`;
      if (Platform.OS === "web") {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed");
        const blob = await res.blob();
        const href = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.setAttribute("download", `Employee_Directory_${Date.now()}.xlsx`);
        document.body.appendChild(a); a.click(); a.remove();
        window.URL.revokeObjectURL(href);
      } else {
        const fileUri = `${FileSystem.documentDirectory}Employee_Directory.xlsx`;
        const r = await FileSystem.downloadAsync(url, fileUri);
        if (r.status === 200) {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(r.uri, {
              mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              dialogTitle: "Employee Directory",
              UTI: "com.microsoft.excel.xlsx",
            });
          } else Alert.alert("Saved", `Report downloaded to: ${r.uri}`);
        } else Alert.alert("Error", "Could not generate the report.");
      }
    } catch {
      Alert.alert("Export Failed", "Unable to download the Excel report.");
    } finally {
      setIsExporting(false);
    }
  };

  // ---------------------------------------------------------------- pieces
  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress}
      className={`px-3.5 py-2 rounded-xl border ${on ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"}`}>
      <Text className={`text-xs font-bold ${on ? "text-white" : "text-[#1F1B3D]"}`}>{label}</Text>
    </TouchableOpacity>
  );

  const renderField = (f: FieldDef) => {
    const raw = valueOf(detail, f.key);
    if (editing && f.edit) {
      if (f.kind === "flag") {
        const on = draft[f.key] === "true";
        return (
          <TouchableOpacity key={f.key} onPress={() => setDraft(d => ({ ...d, [f.key]: on ? "false" : "true" }))}
            className="flex-row items-center justify-between py-2.5 border-b border-[#EEECFA]">
            <Text className="text-xs font-bold text-[#7A76A6]">{f.label}</Text>
            {on ? <CheckSquare size={18} color="#5B4FD1" /> : <Square size={18} color="#CBD5E1" />}
          </TouchableOpacity>
        );
      }
      return (
        <View key={f.key} className="py-2 border-b border-[#EEECFA]">
          <Text className="text-[10px] font-bold text-[#7A76A6] mb-1">{f.label}</Text>
          <TextInput
            value={draft[f.key] ?? ""}
            onChangeText={(v: string) => setDraft(d => ({ ...d, [f.key]: v }))}
            keyboardType={f.kind === "money" || f.kind === "num" ? "decimal-pad" : "default"}
            multiline={f.kind === "json"}
            autoCapitalize="none"
            className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-lg px-3 py-2 text-xs font-bold text-[#1F1B3D]"
          />
        </View>
      );
    }
    let shown = "-";
    if (f.kind === "flag") shown = raw ? "Yes" : "No";
    else if (f.kind === "money") shown = inr(raw);
    else if (f.kind === "num") shown = raw === null || raw === undefined ? "-" : String(raw);
    else if (f.kind === "json") shown = raw ? JSON.stringify(raw) : "-";
    else if (raw !== null && raw !== undefined && raw !== "") shown = String(raw);
    return (
      <View key={f.key} className="flex-row justify-between py-2.5 border-b border-[#EEECFA]">
        <Text className="text-xs font-bold text-[#7A76A6] w-5/12">{f.label.replace(/ \(.*\)$/, "")}</Text>
        <Text className="text-xs font-black text-[#1F1B3D] w-7/12 text-right">{shown}</Text>
      </View>
    );
  };

  const renderJsonBlock = (title: string, value: any) => {
    if (value === null || value === undefined || (typeof value === "object" && Object.keys(value).length === 0)) return null;
    const entries = typeof value === "object" ? Object.entries(value) : [["value", value]];
    return (
      <View key={title} className="mb-4">
        <Text className="text-[11px] font-black text-[#5B4FD1] uppercase tracking-wider mb-1">{title}</Text>
        <View className="bg-white border border-[#E7E4F5] rounded-2xl px-4">
          {entries.map(([k, v]) => (
            <View key={k} className="flex-row justify-between py-2.5 border-b border-[#EEECFA]">
              <Text className="text-xs font-bold text-[#7A76A6] w-5/12">{k}</Text>
              <Text className="text-xs font-black text-[#1F1B3D] w-7/12 text-right">
                {v !== null && typeof v === "object" ? JSON.stringify(v) : String(v ?? "-")}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ---------------------------------------------------------------- screen
  return (
    <ScreenContainer webHeader={<WebPageHeader title="Employee Directory" subtitle={`${filtered.length} of ${rows.length} employees`} onBack={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate("Home"))}><Badge label="Admin only" tone="primary" /><Btn label="Add" variant="secondary" onPress={() => { setAddDraft(ADD_DEFAULTS); setShowAdd(true); }} /><Btn label="Export" onPress={() => setShowExportModal(true)} disabled={rows.length === 0} busy={isExporting} icon={<Download size={15} color="#FFFFFF" />} /></WebPageHeader>}>
      {/* header */}
      {!isWebDesktop && (
      <View className="bg-[#5B4FD1] rounded-3xl pt-4 pb-6 px-5 mb-4 relative overflow-hidden">
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity
            onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate("Home"))}
            className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center active:opacity-80">
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View className="bg-white/20 px-3 py-1 rounded-full border border-white/25 flex-row items-center">
            <ShieldCheck size={12} color="#FFFFFF" />
            <Text className="text-[10px] font-black text-white ml-1 uppercase tracking-wider">Admin Only</Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xl font-black text-white tracking-tight">Employee Directory</Text>
            <Text className="text-xs font-semibold text-white/80 mt-0.5">
              {filtered.length} of {rows.length} employees
            </Text>
          </View>
          <View className="flex-row gap-2">
          <TouchableOpacity onPress={() => { setAddDraft(ADD_DEFAULTS); setShowAdd(true); }}
            className="bg-white/20 border border-white/30 px-4 py-2.5 rounded-xl flex-row items-center active:opacity-90">
            <Text className="text-white text-xs font-black uppercase">+ Add</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowExportModal(true)} disabled={isExporting || rows.length === 0}
            className="bg-white px-4 py-2.5 rounded-xl flex-row items-center active:opacity-90">
            {isExporting ? <ActivityIndicator size="small" color="#5B4FD1" /> : (
              <>
                <Download size={14} color="#5B4FD1" />
                <Text className="text-[#5B4FD1] text-xs font-black ml-1.5 uppercase">Export</Text>
              </>
            )}
          </TouchableOpacity>
          </View>
        </View>
      </View>
      )}

      {/* search */}
      <View className="bg-white border border-[#E7E4F5] rounded-2xl px-4 py-3 flex-row items-center mb-4">
        <Search size={18} color="#7A76A6" />
        <TextInput value={searchQuery} onChangeText={setSearchQuery}
          placeholder="Search by ID, name or designation..." placeholderTextColor="#A6A2CE"
          className="flex-1 ml-2.5 text-xs font-bold text-[#1F1B3D]" />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}><X size={16} color="#7A76A6" /></TouchableOpacity>
        )}
      </View>

      {/* filters */}
      <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 mb-4 gap-4">
        <View className="flex-row items-center justify-between pb-2 border-b border-slate-100">
          <View className="flex-row items-center gap-2">
            <SlidersHorizontal size={15} color="#5B4FD1" />
            <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">Filters</Text>
          </View>
          {(selectedDept !== "All" || selectedSalRange !== "All" || selectedYear !== "All") && (
            <TouchableOpacity onPress={() => { setSelectedDept("All"); setSelectedSalRange("All"); setSelectedYear("All"); }}>
              <Text className="text-[11px] font-black text-[#E4453C]">Reset</Text>
            </TouchableOpacity>
          )}
        </View>
        <View className="gap-1.5">
          <View className="flex-row items-center gap-1.5">
            <Building size={12} color="#7A76A6" />
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Department</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {departments.map(d => <Chip key={d} on={selectedDept === d} label={d} onPress={() => setSelectedDept(d)} />)}
          </ScrollView>
        </View>
        <View className="gap-1.5">
          <View className="flex-row items-center gap-1.5">
            <Calendar size={12} color="#7A76A6" />
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Joining year</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {joinYears.map(y => <Chip key={y} on={selectedYear === y} label={y} onPress={() => setSelectedYear(y)} />)}
          </ScrollView>
        </View>
        <View className="gap-1.5">
          <View className="flex-row items-center gap-1.5">
            <IndianRupee size={12} color="#7A76A6" />
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Monthly salary</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {SAL_TIERS.map(s => <Chip key={s.value} on={selectedSalRange === s.value} label={s.label} onPress={() => setSelectedSalRange(s.value)} />)}
          </ScrollView>
        </View>
      </View>

      {/* sort */}
      <View className="flex-row items-center justify-between mb-3 px-1">
        <Text className="text-[11px] font-black text-[#1F1B3D] uppercase tracking-wider">Sort ({sortOrder.toUpperCase()}):</Text>
        <View className="flex-row gap-2">
          {([["name", "Name"], ["salary", "Salary"], ["joinDate", "Joining"]] as const).map(([k, l]) => (
            <TouchableOpacity key={k} onPress={() => handleSortToggle(k)}
              className={`px-3 py-1 rounded-lg border ${sortBy === k ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-white border-[#E7E4F5]"}`}>
              <Text className={`text-[10px] font-black ${sortBy === k ? "text-white" : "text-[#1F1B3D]"}`}>
                {l} {sortBy === k ? (sortOrder === "asc" ? "↑" : "↓") : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* table */}
      <View className="bg-white border border-[#E7E4F5] rounded-3xl overflow-hidden mb-8">
        {loading ? (
          <View className="py-16 items-center"><ActivityIndicator color="#5B4FD1" /></View>
        ) : loadError ? (
          <View className="py-12 items-center px-6">
            <Text className="text-xs font-bold text-[#E4453C] text-center mb-3">{loadError}</Text>
            <TouchableOpacity onPress={() => loadList()} className="bg-[#5B4FD1] px-5 py-2.5 rounded-xl">
              <Text className="text-white text-xs font-black">Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={Platform.OS === "web" ? { minWidth: "100%" } : undefined}>
            <View className="web:lg:flex-1">
              <View className="flex-row bg-[#150F38] px-4 py-3.5 items-center">
                <Text className="text-white text-[11px] font-black uppercase tracking-wider w-24 web:lg:flex-1">Emp ID</Text>
                <Text className="text-white text-[11px] font-black uppercase tracking-wider w-44 web:lg:flex-[2]">Employee</Text>
                <Text className="text-white text-[11px] font-black uppercase tracking-wider w-28 web:lg:flex-1">Department</Text>
                <Text className="text-white text-[11px] font-black uppercase tracking-wider w-28 web:lg:flex-1">Joining</Text>
                <Text className="text-white text-[11px] font-black uppercase tracking-wider w-28 web:lg:flex-1 text-right">Salary</Text>
                <Text className="text-white text-[11px] font-black uppercase tracking-wider w-24 web:lg:flex-1 text-center ml-4">Status</Text>
              </View>
              {filtered.length > 0 ? filtered.map((r, idx) => (
                <TouchableOpacity key={r.empId} onPress={() => openDetail(r.empId)} activeOpacity={0.7}
                  className={`flex-row px-4 py-3.5 items-center border-b border-[#E7E4F5] ${idx % 2 === 1 ? "bg-[#F6F5FC]" : "bg-white"}`}>
                  <Text className="text-xs font-black text-[#5B4FD1] w-24 web:lg:flex-1">{r.empId}</Text>
                  <View className="w-44 web:lg:flex-[2] pr-2">
                    <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>{r.name}</Text>
                    <Text className="text-[10px] font-semibold text-[#7A76A6]" numberOfLines={1}>{r.designation || "-"}</Text>
                  </View>
                  <View className="w-28 web:lg:flex-1">
                    <View className="bg-[#EEECFA] border border-[#5B4FD1]/20 self-start px-2.5 py-0.5 rounded-md">
                      <Text className="text-[10px] font-bold text-[#5B4FD1]">{r.dept || "-"}</Text>
                    </View>
                  </View>
                  <Text className="text-xs font-semibold text-[#7A76A6] w-28 web:lg:flex-1">{r.joinDate || "-"}</Text>
                  <Text className="text-xs font-black text-[#1F1B3D] w-28 web:lg:flex-1 text-right">{inr(r.salary)}</Text>
                  <View className="w-24 web:lg:flex-1 items-center ml-4">
                    <View className={`px-2.5 py-0.5 rounded-full border ${r.status === "Active" ? "bg-[#E7FAEE] border-[#1FAE5C]/20" : "bg-[#FDECEA] border-[#E4453C]/20"}`}>
                      <Text className={`text-[9.5px] font-black ${r.status === "Active" ? "text-[#1FAE5C]" : "text-[#E4453C]"}`}>{r.status}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )) : (
                <View className="py-12 items-center justify-center w-[700px] web:lg:w-full">
                  <Text className="text-xs font-bold text-[#7A76A6]">No employees match your filters.</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>
      {!loading && !loadError && (
        <TouchableOpacity onPress={() => loadList(true)} disabled={refreshing} className="items-center mb-8 -mt-4">
          <Text className="text-[11px] font-black text-[#5B4FD1]">{refreshing ? "Refreshing..." : "Refresh list"}</Text>
        </TouchableOpacity>
      )}

      {/* ============ employee detail popup ============ */}
      <Modal visible={openId !== null} animationType="slide" onRequestClose={closeDetail}>
        <View className="flex-1 bg-[#F6F5FC]">
          <View className="bg-[#5B4FD1] pt-12 pb-4 px-5 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-white text-base font-black" numberOfLines={1}>{detail?.name || openId}</Text>
              <Text className="text-white/80 text-[11px] font-semibold">{openId} · {detail?.designation || "Employee"}</Text>
            </View>
            <TouchableOpacity onPress={closeDetail} className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center">
              <X size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {detailLoading ? (
            <View className="flex-1 items-center justify-center"><ActivityIndicator color="#5B4FD1" /></View>
          ) : detailError ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-xs font-bold text-[#E4453C] text-center mb-3">{detailError}</Text>
              <TouchableOpacity onPress={() => openId && openDetail(openId)} className="bg-[#5B4FD1] px-5 py-2.5 rounded-xl">
                <Text className="text-white text-xs font-black">Try again</Text>
              </TouchableOpacity>
            </View>
          ) : detail ? (
            <>
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
                {SECTIONS.map(sec => (
                  <View key={sec.title} className="mb-4">
                    <Text className="text-[11px] font-black text-[#5B4FD1] uppercase tracking-wider mb-1">{sec.title}</Text>
                    <View className="bg-white border border-[#E7E4F5] rounded-2xl px-4">
                      {sec.fields.map(renderField)}
                    </View>
                  </View>
                ))}
                {READ_ONLY_JSON.map(b => renderJsonBlock(b.title, detail[b.key]))}
                <Text className="text-[10px] font-semibold text-[#7A76A6] text-center">
                  Address, bank, role and password are view-only here. Work settings (shift, leave quota) are on the Add / Edit User page.
                </Text>
              </ScrollView>

              <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E7E4F5] p-4 flex-row gap-3">
                {editing ? (
                  <>
                    <TouchableOpacity onPress={() => setEditing(false)} disabled={saving}
                      className="flex-1 py-3.5 rounded-xl items-center border border-[#E7E4F5]">
                      <Text className="text-xs font-black text-[#1F1B3D]">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={save} disabled={saving}
                      className="flex-1 py-3.5 rounded-xl items-center bg-[#5B4FD1] flex-row justify-center">
                      {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                        <>
                          <Save size={14} color="#FFFFFF" />
                          <Text className="text-xs font-black text-white ml-1.5">Save changes</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity onPress={startEdit}
                    className="flex-1 py-3.5 rounded-xl items-center bg-[#5B4FD1] flex-row justify-center">
                    <Pencil size={14} color="#FFFFFF" />
                    <Text className="text-xs font-black text-white ml-1.5">Edit details</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : null}
        </View>
      </Modal>

      {/* ============ add employee ============ */}
      <Modal visible={showAdd} animationType="slide" onRequestClose={() => !adding && setShowAdd(false)}>
        <View className="flex-1 bg-[#F6F5FC]">
          <View className="bg-[#5B4FD1] pt-12 pb-4 px-5 flex-row items-center justify-between">
            <Text className="text-white text-base font-black">Add new employee</Text>
            <TouchableOpacity onPress={() => !adding && setShowAdd(false)} className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center">
              <X size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
            <View className="bg-white border border-[#E7E4F5] rounded-2xl px-4 mb-4">
              {ADD_FIELDS.map(f => f.kind === "flag" ? (
                <TouchableOpacity key={f.key}
                  onPress={() => setAddDraft(d => ({ ...d, [f.key]: d[f.key] === "true" ? "false" : "true" }))}
                  className="flex-row items-center justify-between py-2.5 border-b border-[#EEECFA]">
                  <Text className="text-xs font-bold text-[#7A76A6]">{f.label}</Text>
                  {addDraft[f.key] === "true" ? <CheckSquare size={18} color="#5B4FD1" /> : <Square size={18} color="#CBD5E1" />}
                </TouchableOpacity>
              ) : (
                <View key={f.key} className="py-2 border-b border-[#EEECFA]">
                  <Text className="text-[10px] font-bold text-[#7A76A6] mb-1">{f.label}</Text>
                  <TextInput value={addDraft[f.key] ?? ""} placeholder={f.hint} placeholderTextColor="#A6A2CE"
                    onChangeText={(v: string) => setAddDraft(d => ({ ...d, [f.key]: v }))}
                    keyboardType={f.kind === "money" ? "decimal-pad" : "default"} autoCapitalize="none"
                    className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-lg px-3 py-2 text-xs font-bold text-[#1F1B3D]" />
                </View>
              ))}
            </View>

            <Text className="text-[10px] font-semibold text-[#7A76A6] text-center">
              Work settings are added on the Add / Edit User page. Address, bank details and the login password are not set here.
            </Text>
          </ScrollView>
          <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E7E4F5] p-4">
            <TouchableOpacity onPress={submitAdd} disabled={adding}
              className="py-3.5 rounded-xl items-center bg-[#5B4FD1] flex-row justify-center">
              {adding ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                <Text className="text-xs font-black text-white">Add employee</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============ export modal ============ */}
      <Modal visible={showExportModal} transparent animationType="fade">
        <TouchableOpacity activeOpacity={1} onPress={() => setShowExportModal(false)}
          className="flex-1 bg-black/40 justify-center items-center p-4">
          <View className="w-full max-w-md bg-white border border-[#E7E4F5] rounded-3xl p-6 gap-4 max-h-[85%]">
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
              <View>
                <Text className="text-base font-black text-[#1F1B3D]">Select Columns</Text>
                <Text className="text-[11px] font-semibold text-[#7A76A6]">Uses the filters you set above</Text>
              </View>
              <TouchableOpacity onPress={() => setShowExportModal(false)}><X size={18} color="#7A76A6" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {exportColumns.map(col => (
                <TouchableOpacity key={col.key} onPress={() => toggleColumn(col.key)}
                  className="flex-row items-center justify-between bg-[#F6F5FC] border border-[#E7E4F5] p-3.5 rounded-xl">
                  <Text className="text-xs font-black text-[#1F1B3D]">{col.label}</Text>
                  {col.selected ? <CheckSquare size={18} color="#5B4FD1" /> : <Square size={18} color="#CBD5E1" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={handleExport} className="bg-[#5B4FD1] py-4 rounded-xl items-center">
              <Text className="text-white text-xs font-black uppercase tracking-wider">Download Excel File</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScreenContainer>
  );
}