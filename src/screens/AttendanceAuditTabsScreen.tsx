import React, { useState, useEffect, useMemo, useRef } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  View,
  Text,
  Keyboard,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  User,
  RefreshCw,
  X,
  AlertTriangle,
  Clock,
  Download,
  CheckSquare,
  Square,
  Coffee,
  MapPin,
} from "lucide-react-native";
import CrossPlatformDatePicker from "../components/CrossPlatformDatePicker";
import { BASE_HOST } from "../constants/config";

type TabType = "ATTENDANCE" | "LEAVE" | "CLAIMS";
type LeaveFilterType = "ALL" | "PERMISSION" | "HALF_DAY" | "FULL_DAY";
type AttendanceFilterType = "ALL" | "PRESENT" | "ABSENT" | "ON_DUTY";

const PAGE_SIZE = 100; // records shown per page

const LEAVE_CATEGORIES: LeaveFilterType[] = ["ALL", "PERMISSION", "HALF_DAY", "FULL_DAY"];
const ATTENDANCE_STATUS_FILTERS: AttendanceFilterType[] = ["ALL", "PRESENT", "ABSENT", "ON_DUTY"];

const ALL_COLUMNS = [
  { id: "date", label: "Date" },
  { id: "empId", label: "Emp ID" },
  { id: "empName", label: "Employee Name" },
  { id: "department", label: "Department" },
  { id: "status", label: "Status" },
  { id: "checkIn", label: "Check In" },
  { id: "checkOut", label: "Check Out" },
  { id: "workedHours", label: "Worked Hours" },
  { id: "breaks", label: "Breaks Summary" },
  { id: "otMinutes", label: "OT Minutes" },
  { id: "penaltyHours", label: "Penalty Hours" },
  { id: "penaltyInr", label: "Penalty Amount" },
];

// ---------------------------------------------------------------------------
// Date helpers + quick ranges
// ---------------------------------------------------------------------------
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const formatDateToISO = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const RANGE_PRESETS = [
  { id: "TODAY", label: "Today" },
  { id: "YESTERDAY", label: "Yesterday" },
  { id: "LAST7", label: "Last 7 days" },
  { id: "MONTH", label: "This month" },
] as const;

const presetRange = (id: string): [Date, Date] => {
  const today = startOfDay(new Date());
  switch (id) {
    case "YESTERDAY": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return [y, y];
    }
    case "LAST7": {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return [s, today];
    }
    case "MONTH":
      return [new Date(today.getFullYear(), today.getMonth(), 1), today];
    default:
      return [today, today];
  }
};

// ---------------------------------------------------------------------------
// Pagination bar (kept outside the horizontally scrolling table, so it never scrolls sideways)
// ---------------------------------------------------------------------------
function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const atStart = page <= 1;
  const atEnd = page >= totalPages;
  const btn = (disabled: boolean) =>
    `w-9 h-9 rounded-lg border items-center justify-center ${
      disabled ? "bg-slate-50 border-slate-100" : "bg-white border-[#E7E4F5] active:bg-[#F6F5FC]"
    }`;

  return (
    <View className="flex-row items-center justify-between px-3 py-3 border-t border-slate-100 bg-[#FAF9FE]">
      <View>
        <Text className="text-[11px] font-black text-[#1F1B3D]">
          {from}–{to} of {total}
        </Text>
        <Text className="text-[10px] font-bold text-[#7A76A6]">
          Page {page} / {totalPages}
        </Text>
      </View>

      {totalPages > 1 && (
        <View className="flex-row items-center gap-1.5">
          <TouchableOpacity disabled={atStart} onPress={() => onChange(1)} className={btn(atStart)}>
            <ChevronsLeft size={15} color={atStart ? "#CBD5E1" : "#5B4FD1"} />
          </TouchableOpacity>
          <TouchableOpacity disabled={atStart} onPress={() => onChange(page - 1)} className={btn(atStart)}>
            <ChevronLeft size={15} color={atStart ? "#CBD5E1" : "#5B4FD1"} />
          </TouchableOpacity>
          <TouchableOpacity disabled={atEnd} onPress={() => onChange(page + 1)} className={btn(atEnd)}>
            <ChevronRight size={15} color={atEnd ? "#CBD5E1" : "#5B4FD1"} />
          </TouchableOpacity>
          <TouchableOpacity disabled={atEnd} onPress={() => onChange(totalPages)} className={btn(atEnd)}>
            <ChevronsRight size={15} color={atEnd ? "#CBD5E1" : "#5B4FD1"} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function AttendanceAuditTabsScreen({ navigation }: any) {
  // Global Filters: the page opens on TODAY; the user widens the range when needed
  const [fromDate, setFromDate] = useState<Date>(() => startOfDay(new Date()));
  const [toDate, setToDate] = useState<Date>(() => startOfDay(new Date()));
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [empIdInput, setEmpIdInput] = useState("");
  const [appliedEmp, setAppliedEmp] = useState("");
  const [directory, setDirectory] = useState<{ empId: string; empName: string }[]>([]);
  const [adminView, setAdminView] = useState<"menu" | "users" | "dashboard" | "onboarding" | "reports">("menu");
  const [selectedAttendanceStatus, setSelectedAttendanceStatus] = useState<AttendanceFilterType>("ALL");

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>("ATTENDANCE");
  const [selectedLeaveCategory, setSelectedLeaveCategory] = useState<LeaveFilterType>("ALL");

  // Pagination
  const [page, setPage] = useState(1);
  const scrollRef = useRef<ScrollView>(null);
  const tableTop = useRef(0);

  // Modal State for Cell Inspection
  const [modalType, setModalType] = useState<"PUNCH" | "BREAK" | "PENALTY" | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  // Excel Export Modal State
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    "date",
    "empId",
    "empName",
    "department",
    "status",
    "checkIn",
    "checkOut",
    "workedHours",
  ]);
  const [isExporting, setIsExporting] = useState(false);
  const [allEmployees, setAllEmployees] = useState<{ empId: string; empName: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Data & Loading
  const [isLoading, setIsLoading] = useState(false);
  const [auditData, setAuditData] = useState<any>({
    attendanceList: [],
    leaveList: [],
    claimList: [],
  });

  // Persistent master list of departments
  const [availableDepartments, setAvailableDepartments] = useState<string[]>(["ALL"]);

  const reqId = useRef(0);

  const fetchAuditData = async () => {
    const my = ++reqId.current;
    setIsLoading(true);
    try {
      const fromStr = formatDateToISO(fromDate);
      const toStr = formatDateToISO(toDate);
      const url =
        `${BASE_HOST}/api/attendance/audit-summary?fromDate=${fromStr}&toDate=${toStr}` +
        `&empId=${encodeURIComponent(appliedEmp || "ALL")}&department=${encodeURIComponent(selectedDept)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (my !== reqId.current) return; // a newer search already started: ignore this old answer
      setAuditData(json);

      setAllEmployees((prev) => {
        const map = new Map<string, string>();
        prev.forEach((e) => map.set(e.empId, e.empName));
        [...(json.attendanceList || []), ...(json.leaveList || [])].forEach((row: any) => {
          if (row.empId && row.empId !== "ALL") map.set(row.empId, row.empName || row.empId);
        });
        return Array.from(map.entries()).map(([empId, empName]) => ({ empId, empName }));
      });

      setAvailableDepartments((prev) => {
        const set = new Set(prev);
        set.add("ALL");
        [...(json.attendanceList || []), ...(json.leaveList || []), ...(json.claimList || [])].forEach((row: any) => {
          if (row.department && row.department.trim()) set.add(row.department.trim());
        });
        return Array.from(set);
      });
    } catch (err) {
      if (my === reqId.current) console.warn("Failed to fetch audit data:", err);
    } finally {
      if (my === reqId.current) setIsLoading(false);
    }
  };

  // All employees (not only those in the current result) for the suggestions
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE_HOST}/api/admin/users`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setDirectory(
            data
              .filter((u: any) => u?.empId)
              .map((u: any) => ({ empId: u.empId, empName: u.fullName || u.userName || u.empId }))
          );
        }
      } catch {
        /* suggestions fall back to the employees seen in the results */
      }
    })();
  }, []);

  const suggestionPool = useMemo(() => {
    const map = new Map<string, string>();
    directory.forEach((e) => map.set(e.empId, e.empName));
    allEmployees.forEach((e) => {
      if (!map.has(e.empId)) map.set(e.empId, e.empName);
    });
    return Array.from(map.entries()).map(([empId, empName]) => ({ empId, empName }));
  }, [directory, allEmployees]);

  const filteredSuggestions = useMemo(() => {
    const q = empIdInput.trim().toLowerCase();
    if (!q) return [];
    return suggestionPool
      .filter((e) => e.empId.toLowerCase().includes(q) || e.empName.toLowerCase().includes(q))
      .slice(0, 6);
  }, [suggestionPool, empIdInput]);

  // "Showing: Name (ID)" label for the applied search
  const appliedLabel = useMemo(() => {
    if (!appliedEmp) return "";
    const hit = suggestionPool.find((e) => e.empId.toLowerCase() === appliedEmp.toLowerCase());
    return hit ? `${hit.empName} (${hit.empId})` : appliedEmp;
  }, [appliedEmp, suggestionPool]);

  // Apply a search: shows the records straight away (the effect below reloads them)
  const applySearch = (value: string) => {
    setEmpIdInput(value);
    setAppliedEmp(value.trim());
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const clearSearch = () => {
    setEmpIdInput("");
    setAppliedEmp("");
    setShowSuggestions(false);
  };

  // ----- quick date ranges and "is anything filtered" -----
  const fromIso = formatDateToISO(fromDate);
  const toIso = formatDateToISO(toDate);
  const activePreset = RANGE_PRESETS.find((p) => {
    const [f, t] = presetRange(p.id);
    return formatDateToISO(f) === fromIso && formatDateToISO(t) === toIso;
  })?.id;

  const applyPreset = (id: string) => {
    const [f, t] = presetRange(id);
    setFromDate(f);
    setToDate(t);
  };

  const isFiltered =
    appliedEmp !== "" ||
    selectedDept !== "ALL" ||
    selectedAttendanceStatus !== "ALL" ||
    selectedLeaveCategory !== "ALL" ||
    activePreset !== "TODAY";

  const resetAllFilters = () => {
    clearSearch();
    setSelectedDept("ALL");
    setSelectedAttendanceStatus("ALL");
    setSelectedLeaveCategory("ALL");
    applyPreset("TODAY");
  };

  // Reload whenever a date, the department or the applied search changes (one effect only)
  useEffect(() => {
    fetchAuditData();
  }, [fromDate, toDate, selectedDept, appliedEmp]);

  // Local filter for subcategories of attendance
  const filteredAttendanceList = useMemo(() => {
    return (auditData.attendanceList || []).filter((item: any) => {
      if (selectedAttendanceStatus === "ALL") return true;
      return item.status === selectedAttendanceStatus;
    });
  }, [auditData.attendanceList, selectedAttendanceStatus]);

  // Local filter for subcategories of leaves
  const filteredLeaves = useMemo(() => {
    return (auditData.leaveList || []).filter((item: any) => {
      if (selectedLeaveCategory === "ALL") return true;
      return item.category === selectedLeaveCategory;
    });
  }, [auditData.leaveList, selectedLeaveCategory]);

  const claimList: any[] = auditData.claimList || [];

  // ----- pagination: 100 rows per page for the tab that is open -----
  const activeTotal =
    activeTab === "ATTENDANCE" ? filteredAttendanceList.length : activeTab === "LEAVE" ? filteredLeaves.length : claimList.length;
  const totalPages = Math.max(1, Math.ceil(activeTotal / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;

  const pagedAttendance = useMemo(
    () => filteredAttendanceList.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredAttendanceList, pageStart]
  );
  const pagedLeaves = useMemo(() => filteredLeaves.slice(pageStart, pageStart + PAGE_SIZE), [filteredLeaves, pageStart]);
  const pagedClaims = useMemo(() => claimList.slice(pageStart, pageStart + PAGE_SIZE), [claimList, pageStart]);

  // Back to page 1 whenever the data set changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, fromDate, toDate, selectedDept, appliedEmp, selectedAttendanceStatus, selectedLeaveCategory]);

  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages));
    scrollRef.current?.scrollTo({ y: Math.max(0, tableTop.current - 8), animated: true });
  };

  // Modal handlers
  const handleOpenPunchModal = (row: any) => {
    setSelectedRecord(row);
    setModalType("PUNCH");
  };

  const handleOpenBreakModal = (row: any) => {
    setSelectedRecord(row);
    setModalType("BREAK");
  };

  const handleOpenPenaltyModal = (row: any) => {
    setSelectedRecord(row);
    setModalType("PENALTY");
  };

  const handleCloseModal = () => {
    setModalType(null);
    setSelectedRecord(null);
  };

  const toggleColumn = (colId: string) => {
    setSelectedColumns((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
    );
  };

  const handleExportExcel = async () => {
    if (selectedColumns.length === 0) {
      alert("Please select at least one column to export.");
      return;
    }

    setIsExporting(true);
    try {
      const fileName = `attendance_audit_${fromIso}_to_${toIso}.xlsx`;

      // Join column array as comma-separated query string
      const columnsParam = selectedColumns.join(",");

      // The export covers the WHOLE selected range, not only the page that is on screen
      const url =
        `${BASE_HOST}/api/admin/reports/attendance/export-excel?fromDate=${fromIso}&toDate=${toIso}` +
        `&empId=${encodeURIComponent(appliedEmp || "ALL")}&department=${encodeURIComponent(selectedDept)}` +
        `&status=${selectedAttendanceStatus}&columns=${columnsParam}`;

      if (Platform.OS === "web") {
        // Direct browser download
        const res = await fetch(url);
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        // Mobile download using Expo FileSystem Legacy & Sharing
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        const downloadResult = await FileSystem.downloadAsync(url, fileUri);

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            dialogTitle: "Save Attendance Excel Report",
          });
        }
      }

      setIsExportModalVisible(false);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export Excel file.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F8F7FD]">
      {/* 1. Top Header */}
      <View className="bg-[#5B4FD1] pt-10 pb-4 px-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => {
              if (adminView !== "menu") {
                setAdminView("menu");
              } else {
                navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate("Home");
              }
            }}
            className="w-9 h-9 bg-white/20 rounded-xl items-center justify-center active:opacity-80"
          >
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-base font-black text-white">Workforce Lifecycle Audit</Text>
          <TouchableOpacity
            onPress={fetchAuditData}
            className="w-9 h-9 bg-white/20 rounded-xl items-center justify-center active:opacity-80"
          >
            <RefreshCw size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
      >
        {/* 2. Global Filter Panel */}
        <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-4 shadow-xs">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-[11px] font-black text-[#1F1B3D] uppercase tracking-wider">Audit Parameters</Text>
            {isFiltered && (
              <TouchableOpacity
                onPress={resetAllFilters}
                className="flex-row items-center px-2 py-1 rounded-lg bg-rose-50 border border-rose-100"
              >
                <X size={11} color="#E11D48" />
                <Text className="text-[10px] font-black text-rose-600 uppercase ml-1">Clear all</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick ranges */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-3">
            {RANGE_PRESETS.map((p) => {
              const selected = activePreset === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => applyPreset(p.id)}
                  className={`px-3 py-1 rounded-full mr-2 border ${
                    selected ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"
                  }`}
                >
                  <Text className={`text-[10px] font-black ${selected ? "text-white" : "text-[#7A76A6]"}`}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Date Pickers */}
          <View className="flex-col md:flex-row gap-2 mb-3">
            <CrossPlatformDatePicker
              label="From Date"
              value={fromDate}
              onChange={(date: Date) => {
                setFromDate(date);
                if (formatDateToISO(date) > toIso) setToDate(date);
              }}
            />
            <CrossPlatformDatePicker
              label="To Date"
              value={toDate}
              onChange={(date: Date) => {
                setToDate(date);
                if (formatDateToISO(date) < fromIso) setFromDate(date);
              }}
            />
          </View>

          {/* Search by Emp ID / Emp Name */}
          <View className="mb-3">
            <View className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-1.5 flex-row items-center">
              <User size={14} color="#7A76A6" />
              <TextInput
                value={empIdInput}
                onChangeText={(text) => {
                  setEmpIdInput(text);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onSubmitEditing={() => applySearch(empIdInput)}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Search Emp ID or Name"
                placeholderTextColor="#9CA3AF"
                className="text-xs font-bold text-[#1F1B3D] ml-2 flex-1 py-1"
              />

              {empIdInput.length > 0 && (
                <TouchableOpacity onPress={clearSearch} className="p-1.5 mr-1">
                  <X size={14} color="#9CA3AF" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => applySearch(empIdInput)}
                className="bg-[#5B4FD1] px-3 py-1.5 rounded-lg active:opacity-80"
              >
                <Text className="text-[10px] font-black text-white uppercase">Search</Text>
              </TouchableOpacity>
            </View>

            {/* Suggestions: part of the layout (not floating), so every row can be tapped on Android */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <View className="mt-1 bg-white border border-[#E7E4F5] rounded-xl overflow-hidden">
                {filteredSuggestions.map((item) => (
                  <TouchableOpacity
                    key={item.empId}
                    onPress={() => applySearch(item.empId)}
                    className="flex-row items-center justify-between px-3 py-2.5 border-b border-slate-100 active:bg-[#F6F5FC]"
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>
                        {item.empName}
                      </Text>
                      <Text className="text-[10px] font-bold text-slate-400">{item.empId}</Text>
                    </View>
                    <View className="bg-purple-50 px-2 py-0.5 rounded">
                      <Text className="text-[9px] font-black text-[#5B4FD1] uppercase">Select</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* The search that is applied, with its own clear button */}
            {appliedEmp !== "" && (
              <View className="flex-row items-center self-start mt-2 bg-purple-50 border border-[#5B4FD1]/30 rounded-full pl-3 pr-1.5 py-1">
                <Text className="text-[11px] font-black text-[#5B4FD1]" numberOfLines={1}>
                  Showing: {appliedLabel}
                </Text>
                <TouchableOpacity onPress={clearSearch} className="ml-1.5 p-1">
                  <X size={12} color="#5B4FD1" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Dynamic Department Pills */}
          <Text className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Department Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {availableDepartments.map((dept) => {
              const isSelected = selectedDept === dept;
              return (
                <TouchableOpacity
                  key={dept}
                  onPress={() => setSelectedDept(dept)}
                  className={`px-3 py-1 rounded-full mr-2 border ${
                    isSelected ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"
                  }`}
                >
                  <Text className={`text-[10px] font-black ${isSelected ? "text-white" : "text-[#7A76A6]"}`}>
                    {dept}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 3. Segmented Tab Selector */}
        <View className="flex-row bg-white border border-[#E7E4F5] p-1 rounded-xl mb-4 shadow-xs">
          <TouchableOpacity
            onPress={() => setActiveTab("ATTENDANCE")}
            className={`flex-1 py-2 rounded-lg items-center justify-center ${
              activeTab === "ATTENDANCE" ? "bg-[#5B4FD1]" : ""
            }`}
          >
            <Text className={`text-xs font-black ${activeTab === "ATTENDANCE" ? "text-white" : "text-[#7A76A6]"}`}>
              Attendance ({filteredAttendanceList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("LEAVE")}
            className={`flex-1 py-2 rounded-lg items-center justify-center ${
              activeTab === "LEAVE" ? "bg-[#5B4FD1]" : ""
            }`}
          >
            <Text className={`text-xs font-black ${activeTab === "LEAVE" ? "text-white" : "text-[#7A76A6]"}`}>
              Leaves ({auditData.leaveList?.length || 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("CLAIMS")}
            className={`flex-1 py-2 rounded-lg items-center justify-center ${
              activeTab === "CLAIMS" ? "bg-[#5B4FD1]" : ""
            }`}
          >
            <Text className={`text-xs font-black ${activeTab === "CLAIMS" ? "text-white" : "text-[#7A76A6]"}`}>
              Claims ({claimList.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Subcategory Pills & Export Action for Attendance */}
        {activeTab === "ATTENDANCE" && (
          <View className="flex-row items-center justify-between mb-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row flex-1 mr-2">
              {ATTENDANCE_STATUS_FILTERS.map((status) => {
                const isSelected = selectedAttendanceStatus === status;
                return (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setSelectedAttendanceStatus(status)}
                    className={`px-3 py-1 rounded-full mr-2 border ${
                      isSelected ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-white border-[#E7E4F5]"
                    }`}
                  >
                    <Text className={`text-[10px] font-black uppercase ${isSelected ? "text-white" : "text-[#7A76A6]"}`}>
                      {status.replace("_", " ")}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setIsExportModalVisible(true)}
              className="bg-emerald-600 px-3 py-1.5 rounded-xl flex-row items-center active:opacity-80"
            >
              <Download size={13} color="#FFFFFF" />
              <Text className="text-[10px] font-black text-white uppercase ml-1.5">Export</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Subcategory Pills for Leave */}
        {activeTab === "LEAVE" && (
          <View className="flex-row mb-3">
            {LEAVE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedLeaveCategory(cat)}
                className={`px-3 py-1 rounded-full mr-2 border ${
                  selectedLeaveCategory === cat ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-white border-[#E7E4F5]"
                }`}
              >
                <Text
                  className={`text-[10px] font-black uppercase ${
                    selectedLeaveCategory === cat ? "text-white" : "text-[#7A76A6]"
                  }`}
                >
                  {cat.replace("_", " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <View className="py-12 items-center">
            <ActivityIndicator color="#5B4FD1" size="small" />
            <Text className="text-xs font-bold text-[#7A76A6] mt-2">Loading table records...</Text>
          </View>
        )}

        {/* 4. DATA GRID VIEW (Table), 100 rows per page */}
        {!isLoading && (
          <View
            className="bg-white border border-[#E7E4F5] rounded-2xl overflow-hidden shadow-xs"
            onLayout={(e) => {
              tableTop.current = e.nativeEvent.layout.y;
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={Platform.OS === "web"}
              contentContainerStyle={{ minWidth: "100%" }}
            >
              <View className="w-full min-w-[920px]">
                {/* -------------------- TAB 1: ATTENDANCE GRID -------------------- */}
                {activeTab === "ATTENDANCE" && (
                  <View className="w-full">
                    <View className="flex-row items-center bg-[#F0EEFB] border-b border-[#E7E4F5] py-3.5 px-4">
                      <Text className="w-[70px] text-[11px] font-black text-[#5B4FD1] uppercase">Date</Text>
                      <Text className="flex-1 min-w-[150px] text-[11px] font-black text-[#5B4FD1] uppercase">Employee</Text>
                      <Text className="flex-1 min-w-[120px] text-[11px] font-black text-[#5B4FD1] uppercase">Department</Text>
                      <Text className="w-[100px] text-[11px] font-black text-[#5B4FD1] uppercase">Status</Text>
                      <Text className="flex-1 min-w-[150px] text-[11px] font-black text-[#5B4FD1] uppercase">In / Out (Tap)</Text>
                      <Text className="w-[90px] text-[11px] font-black text-[#5B4FD1] uppercase text-right">Worked</Text>
                      <Text className="w-[110px] text-[11px] font-black text-[#5B4FD1] uppercase text-center">Breaks (Tap)</Text>
                      <Text className="w-[70px] text-[11px] font-black text-[#5B4FD1] uppercase text-center">OT</Text>
                      <Text className="w-[110px] text-[11px] font-black text-[#5B4FD1] uppercase text-right pr-2">Penalty</Text>
                    </View>

                    {filteredAttendanceList.length === 0 ? (
                      <View className="py-12 items-center justify-center">
                        <Text className="text-xs text-slate-400 font-bold">
                          {selectedAttendanceStatus === "ALL"
                            ? "No attendance records found."
                            : `No ${selectedAttendanceStatus.replace("_", " ")} records found for this selection.`}
                        </Text>
                      </View>
                    ) : (
                      pagedAttendance.map((row: any, i: number) => {
                        const rowIndex = pageStart + i;
                        const isEven = rowIndex % 2 === 0;
                        const isAbsent = row.status === "ABSENT";
                        return (
                          <View
                            key={rowIndex}
                            className={`flex-row items-center border-b border-slate-100 py-3 px-4 ${
                              isEven ? "bg-white" : "bg-[#FAF9FE]"
                            }`}
                          >
                            <Text className="w-[70px] text-xs font-bold text-[#1F1B3D]">
                              {row.date ? row.date.slice(5) : "-"}
                            </Text>

                            <View className="flex-1 min-w-[150px]">
                              <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>
                                {row.empName}
                              </Text>
                              <Text className="text-[10px] font-bold text-slate-400">{row.empId}</Text>
                            </View>

                            <Text className="flex-1 min-w-[120px] text-xs font-semibold text-slate-600" numberOfLines={1}>
                              {row.department}
                            </Text>

                            {/* Status Badge */}
                            <View className="w-[100px]">
                              <View
                                className={`self-start px-2 py-0.5 rounded ${
                                  row.status === "PRESENT"
                                    ? "bg-emerald-100"
                                    : row.status === "ON_DUTY"
                                    ? "bg-amber-100"
                                    : "bg-rose-100"
                                }`}
                              >
                                <Text
                                  className={`text-[10px] font-black ${
                                    row.status === "PRESENT"
                                      ? "text-emerald-800"
                                      : row.status === "ON_DUTY"
                                      ? "text-amber-800"
                                      : "text-rose-800"
                                  }`}
                                >
                                  {row.status}
                                </Text>
                              </View>
                            </View>

                            {/* In / Out Cell */}
                            <TouchableOpacity
                              disabled={isAbsent}
                              onPress={() => handleOpenPunchModal(row)}
                              className="flex-1 min-w-[150px] py-1 active:opacity-60"
                            >
                              <Text
                                className={`text-xs font-semibold ${
                                  isAbsent ? "text-slate-400" : "text-[#5B4FD1] underline"
                                }`}
                              >
                                {row.checkIn || "--:--"} → {row.checkOut || "--:--"}
                              </Text>
                            </TouchableOpacity>

                            <Text className="w-[90px] text-xs font-black text-[#5B4FD1] text-right">
                              {row.totalWorkedHours || "00h 00m"}
                            </Text>

                            {/* Break History Cell */}
                            <TouchableOpacity
                              disabled={!row.totalBreakCount || row.totalBreakCount === 0}
                              onPress={() => handleOpenBreakModal(row)}
                              className="w-[110px] items-center py-1 active:opacity-60"
                            >
                              <Text
                                className={`text-[11px] font-semibold ${
                                  row.totalBreakCount > 0 ? "text-[#5B4FD1] underline font-bold" : "text-slate-400"
                                }`}
                              >
                                {row.totalBreakCount || 0} ({row.totalBreakMinutes || 0}m)
                              </Text>
                            </TouchableOpacity>

                            <Text className="w-[70px] text-[11px] font-bold text-amber-600 text-center">
                              {row.overtimeMinutes ? `${row.overtimeMinutes}m` : "-"}
                            </Text>

                            {/* Penalty History Cell */}
                            <TouchableOpacity
                              disabled={!row.penaltyHours || row.penaltyHours === 0}
                              onPress={() => handleOpenPenaltyModal(row)}
                              className="w-[110px] items-end justify-center pr-2 py-1 active:opacity-60"
                            >
                              <Text
                                className={`text-[11px] font-bold ${
                                  row.penaltyHours > 0 ? "text-rose-600 underline" : "text-slate-400"
                                }`}
                              >
                                {row.penaltyHours ? `${row.penaltyHours}h` : "-"}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {/* -------------------- TAB 2: LEAVE & PERMISSION GRID -------------------- */}
                {activeTab === "LEAVE" && (
                  <View className="w-full">
                    <View className="flex-row items-center bg-[#F0EEFB] border-b border-[#E7E4F5] py-3.5 px-4">
                      <Text className="w-[90px] text-[11px] font-black text-[#5B4FD1] uppercase">Date</Text>
                      <Text className="flex-1 min-w-[160px] text-[11px] font-black text-[#5B4FD1] uppercase">Employee</Text>
                      <Text className="w-[130px] text-[11px] font-black text-[#5B4FD1] uppercase">Category</Text>
                      <Text className="w-[120px] text-[11px] font-black text-[#5B4FD1] uppercase">Time / Window</Text>
                      <Text className="flex-2 min-w-[260px] text-[11px] font-black text-[#5B4FD1] uppercase pr-2">Reason</Text>
                    </View>

                    {filteredLeaves.length === 0 ? (
                      <View className="py-12 items-center justify-center">
                        <Text className="text-xs text-slate-400 font-bold">No leave or permission records found.</Text>
                      </View>
                    ) : (
                      pagedLeaves.map((row: any, i: number) => {
                        const rowIndex = pageStart + i;
                        const isEven = rowIndex % 2 === 0;
                        return (
                          <View
                            key={rowIndex}
                            className={`flex-row items-center border-b border-slate-100 py-3 px-4 ${
                              isEven ? "bg-white" : "bg-[#FAF9FE]"
                            }`}
                          >
                            <Text className="w-[90px] text-xs font-bold text-[#1F1B3D]">{row.date}</Text>
                            <View className="flex-1 min-w-[160px]">
                              <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>
                                {row.empName}
                              </Text>
                              <Text className="text-[10px] font-bold text-slate-400">{row.empId}</Text>
                            </View>
                            <View className="w-[130px]">
                              <View className="self-start bg-purple-100 px-2.5 py-0.5 rounded">
                                <Text className="text-[10px] font-black text-[#5B4FD1] uppercase">
                                  {row.category?.replace("_", " ")}
                                </Text>
                              </View>
                            </View>
                            <Text className="w-[120px] text-[11px] font-bold text-teal-700">
                              {row.timeRange || "Full Day"}
                            </Text>
                            <Text className="flex-2 min-w-[260px] text-xs font-medium text-slate-600 pr-2" numberOfLines={2}>
                              {row.reason || "-"}
                            </Text>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {/* -------------------- TAB 3: CLAIMS GRID -------------------- */}
                {activeTab === "CLAIMS" && (
                  <View className="w-full">
                    <View className="flex-row items-center bg-[#F0EEFB] border-b border-[#E7E4F5] py-3.5 px-4">
                      <Text className="w-[90px] text-[11px] font-black text-[#5B4FD1] uppercase">Approved Date</Text>
                      <Text className="flex-1 min-w-[160px] text-[11px] font-black text-[#5B4FD1] uppercase">Employee</Text>
                      <Text className="flex-1 min-w-[120px] text-[11px] font-black text-[#5B4FD1] uppercase">Department</Text>
                      <Text className="w-[110px] text-[11px] font-black text-[#5B4FD1] uppercase text-right">Amount</Text>
                      <Text className="flex-2 min-w-[220px] text-[11px] font-black text-[#5B4FD1] uppercase pl-4">Purpose</Text>
                      <Text className="w-[130px] text-[11px] font-black text-[#5B4FD1] uppercase text-right pr-2">Approved By</Text>
                    </View>

                    {claimList.length === 0 ? (
                      <View className="py-12 items-center justify-center">
                        <Text className="text-xs text-slate-400 font-bold">No approved claims found.</Text>
                      </View>
                    ) : (
                      pagedClaims.map((row: any, i: number) => {
                        const rowIndex = pageStart + i;
                        const isEven = rowIndex % 2 === 0;
                        return (
                          <View
                            key={rowIndex}
                            className={`flex-row items-center border-b border-slate-100 py-3 px-4 ${
                              isEven ? "bg-white" : "bg-[#FAF9FE]"
                            }`}
                          >
                            <Text className="w-[90px] text-xs font-bold text-[#1F1B3D]">{row.approvedDate}</Text>
                            <View className="flex-1 min-w-[160px]">
                              <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>
                                {row.empName}
                              </Text>
                              <Text className="text-[10px] font-bold text-slate-400">{row.empId}</Text>
                            </View>
                            <Text className="flex-1 min-w-[120px] text-xs font-semibold text-slate-600" numberOfLines={1}>
                              {row.department}
                            </Text>
                            <Text className="w-[110px] text-xs font-black text-emerald-600 text-right">
                              ₹{row.amount}
                            </Text>
                            <Text className="flex-2 min-w-[220px] text-xs font-medium text-slate-700 pl-4" numberOfLines={2}>
                              {row.purpose || "-"}
                            </Text>
                            <Text className="w-[130px] text-[11px] font-bold text-[#5B4FD1] text-right pr-2">
                              {row.approvedBy || "Admin"}
                            </Text>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Pagination: outside the sideways-scrolling table, so it always stays on screen */}
            {activeTotal > 0 && (
              <PaginationBar
                page={safePage}
                totalPages={totalPages}
                total={activeTotal}
                pageSize={PAGE_SIZE}
                onChange={goToPage}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* 5. HISTORY POPUP / MODAL */}
      <Modal
        visible={modalType !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-white rounded-2xl w-full max-w-[420px] overflow-hidden shadow-2xl border border-slate-100">
            {/* Modal Header */}
            <View className="bg-[#5B4FD1] px-4 py-3.5 flex-row items-center justify-between">
              <View className="flex-row items-center space-x-2">
                {modalType === "PUNCH" && <Clock size={16} color="#FFFFFF" />}
                {modalType === "BREAK" && <Coffee size={16} color="#FFFFFF" />}
                {modalType === "PENALTY" && <AlertTriangle size={16} color="#FFFFFF" />}
                <Text className="text-white font-black text-sm ml-2">
                  {modalType === "PUNCH"
                    ? "Biometric Punch History"
                    : modalType === "BREAK"
                    ? "Break Event History"
                    : "Penalty & Deduction History"}
                </Text>
              </View>
              <TouchableOpacity onPress={handleCloseModal} className="p-1 rounded-lg bg-white/20">
                <X size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Modal Metadata */}
            <View className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex-row justify-between items-center">
              <Text className="text-xs font-black text-slate-800">
                {selectedRecord?.empName} ({selectedRecord?.empId})
              </Text>
              <Text className="text-xs font-semibold text-slate-500">{selectedRecord?.date}</Text>
            </View>

            {/* Modal Content Scroll Area */}
            <ScrollView className="max-h-[320px] p-4">
              {/* --- PUNCH EVENTS LIST --- */}
              {modalType === "PUNCH" && (
                <View>
                  {!selectedRecord?.punchEvents || selectedRecord.punchEvents.length === 0 ? (
                    <View className="py-6 items-center">
                      <Text className="text-xs text-slate-400 font-semibold">
                        Detailed punch breadcrumbs not logged for this date.
                      </Text>
                      <Text className="text-[11px] text-slate-500 mt-1">
                        First punch: {selectedRecord?.checkIn || "--:--"} | Last punch: {selectedRecord?.checkOut || "--:--"}
                      </Text>
                    </View>
                  ) : (
                    selectedRecord.punchEvents.map((event: any, idx: number) => (
                      <View key={idx} className="flex-row items-start py-2.5 border-b border-slate-100">
                        <View
                          className={`px-2 py-0.5 rounded mr-3 ${
                            event.type === "CHECK_IN" ? "bg-emerald-100" : "bg-purple-100"
                          }`}
                        >
                          <Text
                            className={`text-[10px] font-black ${
                              event.type === "CHECK_IN" ? "text-emerald-800" : "text-[#5B4FD1]"
                            }`}
                          >
                            {event.type}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-xs font-bold text-slate-800">{event.time}</Text>
                          {event.lat && event.lng && (
                            <View className="flex-row items-center mt-0.5">
                              <MapPin size={10} color="#7A76A6" />
                              <Text className="text-[10px] text-slate-500 ml-1">
                                {Number(event.lat).toFixed(4)}, {Number(event.lng).toFixed(4)} ({event.mode || "OFFICE"})
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* --- BREAK EVENTS LIST --- */}
              {modalType === "BREAK" && (
                <View>
                  {!selectedRecord?.breakHistory || selectedRecord.breakHistory.length === 0 ? (
                    <View className="py-6 items-center">
                      <Text className="text-xs text-slate-400 font-semibold">
                        No individual break timestamps logged for this date.
                      </Text>
                      <Text className="text-[11px] text-slate-500 mt-1">
                        Total duration: {selectedRecord?.totalBreakMinutes || 0} minutes ({selectedRecord?.totalBreakCount || 0} breaks)
                      </Text>
                    </View>
                  ) : (
                    selectedRecord.breakHistory.map((brk: any, idx: number) => {
                      const breakTitle = brk.title || (brk.type ? `${brk.type} Break` : `Break #${idx + 1}`);
                      const startTime = brk.startTime || brk.start_time || "--:--";
                      const endTime = brk.endTime || brk.end_time || "Ongoing";
                      const duration = brk.durationMinutes ?? brk.duration_minutes ?? brk.duration ?? 0;

                      return (
                        <View
                          key={brk.id || idx}
                          className="py-3 px-3 mb-2.5 bg-slate-50 border border-slate-100 rounded-xl"
                        >
                          <View className="flex-row items-center justify-between mb-1.5">
                            <Text className="text-xs font-black text-slate-800">{breakTitle}</Text>
                            <View className="bg-purple-100 px-2 py-0.5 rounded">
                              <Text className="text-[10px] font-black text-[#5B4FD1] uppercase">
                                {brk.type || "BREAK"}
                              </Text>
                            </View>
                          </View>

                          <View className="flex-row items-center justify-between pt-1 border-t border-slate-200/60">
                            <View className="flex-1">
                              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timing</Text>
                              <Text className="text-xs font-semibold text-slate-700 mt-0.5">
                                {startTime} → {endTime}
                              </Text>
                            </View>

                            <View className="items-end">
                              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duration</Text>
                              <Text className="text-xs font-black text-[#5B4FD1] mt-0.5">{duration} mins</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* --- PENALTY EVENTS LIST --- */}
              {modalType === "PENALTY" && (
                <View>
                  {!selectedRecord?.penaltyHistory || selectedRecord.penaltyHistory.length === 0 ? (
                    <View className="py-6 items-center">
                      <Text className="text-xs text-slate-400 font-semibold">
                        No itemized penalty logs found for this date.
                      </Text>
                      <Text className="text-[11px] text-slate-500 mt-1">
                        Total Penalty Hours: {selectedRecord?.penaltyHours || 0}h
                      </Text>
                    </View>
                  ) : (
                    selectedRecord.penaltyHistory.map((item: any, idx: number) => {
                      const timeFormatted = item.timestamp
                        ? new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "--:--";

                      return (
                        <View
                          key={idx}
                          className="py-3 px-3 mb-2.5 bg-rose-50/50 border border-rose-100 rounded-xl"
                        >
                          <View className="flex-row items-center justify-between mb-1.5">
                            <View className="bg-rose-100 px-2 py-0.5 rounded">
                              <Text className="text-[10px] font-black text-rose-800 uppercase tracking-wide">
                                {item.reason?.replace("_", " ") || "DEDUCTION"}
                              </Text>
                            </View>
                            {item.penalty_inr !== undefined && (
                              <Text className="text-xs font-black text-rose-700">- ₹{item.penalty_inr}</Text>
                            )}
                          </View>

                          <View className="flex-row items-center justify-between pt-1 border-t border-rose-200/50">
                            <View>
                              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Incident Time</Text>
                              <Text className="text-xs font-semibold text-slate-700 mt-0.5">{timeFormatted}</Text>
                            </View>

                            <View className="items-end">
                              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Penalty Time</Text>
                              <Text className="text-xs font-black text-rose-600 mt-0.5">
                                {item.minutes} mins ({Number(item.penalty_hours || 0).toFixed(1)}h)
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </ScrollView>

            {/* Modal Bottom Bar */}
            <View className="bg-slate-50 p-3 border-t border-slate-100 items-end">
              <TouchableOpacity
                onPress={handleCloseModal}
                className="bg-[#5B4FD1] px-4 py-1.5 rounded-lg active:opacity-80"
              >
                <Text className="text-xs font-black text-white uppercase">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. EXCEL EXPORT MODAL */}
      <Modal
        visible={isExportModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsExportModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-white rounded-2xl w-full max-w-[420px] overflow-hidden shadow-2xl border border-slate-100 p-5">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-sm font-black text-[#1F1B3D]">Select Columns for Export</Text>
              <TouchableOpacity onPress={() => setIsExportModalVisible(false)}>
                <X size={18} color="#7A76A6" />
              </TouchableOpacity>
            </View>

            <Text className="text-[11px] text-slate-500 mb-4">
              Range: <Text className="font-bold text-slate-700">{fromIso} to {toIso}</Text> | Department:{" "}
              <Text className="font-bold text-slate-700">{selectedDept}</Text> | Status:{" "}
              <Text className="font-bold text-slate-700">{selectedAttendanceStatus}</Text>
            </Text>

            {/* Checkbox Grid */}
            <View className="flex-row flex-wrap gap-2 mb-5">
              {ALL_COLUMNS.map((col) => {
                const isChecked = selectedColumns.includes(col.id);
                return (
                  <TouchableOpacity
                    key={col.id}
                    onPress={() => toggleColumn(col.id)}
                    className={`flex-row items-center px-3 py-2 rounded-xl border ${
                      isChecked ? "bg-purple-50 border-[#5B4FD1]" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    {isChecked ? <CheckSquare size={14} color="#5B4FD1" /> : <Square size={14} color="#9CA3AF" />}
                    <Text className={`text-xs ml-1.5 font-bold ${isChecked ? "text-[#5B4FD1]" : "text-slate-600"}`}>
                      {col.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action Buttons */}
            <View className="flex-row justify-end space-x-2">
              <TouchableOpacity
                onPress={() => setIsExportModalVisible(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 mr-2"
              >
                <Text className="text-xs font-black text-slate-600 uppercase">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={isExporting}
                onPress={handleExportExcel}
                className="px-5 py-2 rounded-xl bg-emerald-600 flex-row items-center"
              >
                {isExporting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Download size={14} color="#FFFFFF" />
                    <Text className="text-xs font-black text-white uppercase ml-1.5">Download</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}