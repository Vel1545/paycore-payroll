import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  ChevronLeft,
  User,
  RefreshCw,
} from "lucide-react-native";
import CrossPlatformDatePicker from "../components/CrossPlatformDatePicker";
import { BASE_HOST } from "../constants/config";

type TabType = "ATTENDANCE" | "LEAVE" | "CLAIMS";
type LeaveFilterType = "ALL" | "PERMISSION" | "HALF_DAY" | "FULL_DAY";

const DEPARTMENTS = ["ALL", "DEGITAL TEAM", "SALES", "HR", "MANAGER"];
const LEAVE_CATEGORIES: LeaveFilterType[] = ["ALL", "PERMISSION", "HALF_DAY", "FULL_DAY"];

export default function AttendanceAuditTabsScreen({ navigation }: any) {
  // Global Filters
  const [fromDate, setFromDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [toDate, setToDate] = useState<Date>(new Date());
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [empIdInput, setEmpIdInput] = useState("ALL");
  const [adminView, setAdminView] = useState<"menu" | "users" | "dashboard" | "onboarding" | "reports">("menu");

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>("ATTENDANCE");
  const [selectedLeaveCategory, setSelectedLeaveCategory] = useState<LeaveFilterType>("ALL");

  // Data & Loading
  const [isLoading, setIsLoading] = useState(false);
  const [auditData, setAuditData] = useState<any>({
    attendanceList: [],
    leaveList: [],
    claimList: [],
  });
  const formatDateToISO = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const fetchAuditData = async () => {
    setIsLoading(true);
    try {
      const fromStr = formatDateToISO(fromDate);
      const toStr = formatDateToISO(toDate);
      const url = `${BASE_HOST}/api/attendance/audit-summary?fromDate=${fromStr}&toDate=${toStr}&empId=${empIdInput.trim() || "ALL"}&department=${selectedDept}`;
      const res = await fetch(url);
      const json = await res.json();
      setAuditData(json);
    } catch (err) {
      console.warn("Failed to fetch audit data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [fromDate, toDate, selectedDept]);

  // Filter leaves locally based on subcategory pill
  const filteredLeaves = (auditData.leaveList || []).filter((item: any) => {
    if (selectedLeaveCategory === "ALL") return true;
    return item.category === selectedLeaveCategory;
  });

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
        {/* 2. Global Filter Panel */}
        <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-4 shadow-xs">
          <Text className="text-[11px] font-black text-[#1F1B3D] uppercase tracking-wider mb-3">Audit Parameters</Text>

          {/* Date Pickers */}
          <View className="flex-col md:flex-row gap-2 mb-3">
            <CrossPlatformDatePicker
              label="From Date"
              value={fromDate}
              onChange={(date: Date) => setFromDate(date)}
            />
            <CrossPlatformDatePicker
              label="To Date"
              value={toDate}
              onChange={(date: Date) => setToDate(date)}
            />
          </View>

          {/* Search by Emp ID */}
          <View className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-1.5 mb-3 flex-row items-center">
            <User size={14} color="#7A76A6" />
            <TextInput
              value={empIdInput}
              onChangeText={setEmpIdInput}
              placeholder="Search Emp ID (e.g. EMP1042 or ALL)"
              placeholderTextColor="#9CA3AF"
              className="text-xs font-bold text-[#1F1B3D] ml-2 flex-1 py-1"
            />
            <TouchableOpacity
              onPress={fetchAuditData}
              className="bg-[#5B4FD1] px-3 py-1.5 rounded-lg"
            >
              <Text className="text-[10px] font-black text-white uppercase">Filter</Text>
            </TouchableOpacity>
          </View>

          {/* Department Pills */}
          <Text className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Department Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {DEPARTMENTS.map((dept) => (
              <TouchableOpacity
                key={dept}
                onPress={() => setSelectedDept(dept)}
                className={`px-3 py-1 rounded-full mr-2 border ${
                  selectedDept === dept ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"
                }`}
              >
                <Text className={`text-[10px] font-black ${selectedDept === dept ? "text-white" : "text-[#7A76A6]"}`}>
                  {dept}
                </Text>
              </TouchableOpacity>
            ))}
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
              Attendance ({auditData.attendanceList?.length || 0})
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
              Claims ({auditData.claimList?.length || 0})
            </Text>
          </TouchableOpacity>
        </View>

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
                <Text className={`text-[10px] font-black uppercase ${
                  selectedLeaveCategory === cat ? "text-white" : "text-[#7A76A6]"
                }`}>
                  {cat.replace("_", " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Loading */}
        {isLoading && (
          <View className="py-12 items-center">
            <ActivityIndicator color="#5B4FD1" size="small" />
            <Text className="text-xs font-bold text-[#7A76A6] mt-2">Loading table records...</Text>
          </View>
        )}

        {/* 4. DATA GRID VIEW (Table) */}
{/* 4. DATA GRID VIEW (Table) */}
        {!isLoading && (
          <View className="bg-white border border-[#E7E4F5] rounded-2xl overflow-hidden shadow-xs">
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={Platform.OS === "web"}
              contentContainerStyle={{ minWidth: "100%" }}
            >
              <View className="w-full min-w-[900px]">
                {/* -------------------- TAB 1: ATTENDANCE GRID -------------------- */}
                {activeTab === "ATTENDANCE" && (
                  <View className="w-full">
                    {/* Header Row */}
                    <View className="flex-row items-center bg-[#F0EEFB] border-b border-[#E7E4F5] py-3.5 px-4">
                      <Text className="w-[70px] text-[11px] font-black text-[#5B4FD1] uppercase">Date</Text>
                      <Text className="flex-1 min-w-[150px] text-[11px] font-black text-[#5B4FD1] uppercase">Employee</Text>
                      <Text className="flex-1 min-w-[120px] text-[11px] font-black text-[#5B4FD1] uppercase">Department</Text>
                      <Text className="w-[100px] text-[11px] font-black text-[#5B4FD1] uppercase">Status</Text>
                      <Text className="flex-1 min-w-[140px] text-[11px] font-black text-[#5B4FD1] uppercase">In / Out</Text>
                      <Text className="w-[90px] text-[11px] font-black text-[#5B4FD1] uppercase text-right">Worked</Text>
                      <Text className="w-[110px] text-[11px] font-black text-[#5B4FD1] uppercase text-center">Breaks</Text>
                      <Text className="w-[70px] text-[11px] font-black text-[#5B4FD1] uppercase text-center">OT</Text>
                      <Text className="w-[110px] text-[11px] font-black text-[#5B4FD1] uppercase text-right pr-2">Penalty</Text>
                    </View>

                    {/* Data Rows */}
                    {auditData.attendanceList?.length === 0 ? (
                      <View className="py-12 items-center justify-center">
                        <Text className="text-xs text-slate-400 font-bold">No attendance records found.</Text>
                      </View>
                    ) : (
                      auditData.attendanceList.map((row: any, i: number) => {
                        const isEven = i % 2 === 0;
                        return (
                          <View
                            key={i}
                            className={`flex-row items-center border-b border-slate-100 py-3 px-4 ${
                              isEven ? "bg-white" : "bg-[#FAF9FE]"
                            }`}
                          >
                            <Text className="w-[70px] text-xs font-bold text-[#1F1B3D]">
                              {row.date ? row.date.slice(5) : "-"}
                            </Text>

                            <View className="flex-1 min-w-[150px]">
                              <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>{row.empName}</Text>
                              <Text className="text-[10px] font-bold text-slate-400">{row.empId}</Text>
                            </View>

                            <Text className="flex-1 min-w-[120px] text-xs font-semibold text-slate-600" numberOfLines={1}>
                              {row.department}
                            </Text>

                            <View className="w-[100px]">
                              <View className={`self-start px-2 py-0.5 rounded ${
                                row.status === "PRESENT"
                                  ? "bg-emerald-100"
                                  : row.status === "ON_DUTY"
                                  ? "bg-amber-100"
                                  : "bg-rose-100"
                              }`}>
                                <Text className={`text-[10px] font-black ${
                                  row.status === "PRESENT"
                                    ? "text-emerald-800"
                                    : row.status === "ON_DUTY"
                                    ? "text-amber-800"
                                    : "text-rose-800"
                                }`}>
                                  {row.status}
                                </Text>
                              </View>
                            </View>

                            <Text className="flex-1 min-w-[140px] text-xs font-semibold text-[#1F1B3D]">
                              {row.checkIn || "--:--"} → {row.checkOut || "--:--"}
                            </Text>

                            <Text className="w-[90px] text-xs font-black text-[#5B4FD1] text-right">
                              {row.totalWorkedHours || "0h 0m"}
                            </Text>

                            <Text className="w-[110px] text-[11px] font-semibold text-slate-500 text-center">
                              {row.totalBreakCount || 0} ({row.totalBreakMinutes || 0}m)
                            </Text>

                            <Text className="w-[70px] text-[11px] font-bold text-amber-600 text-center">
                              {row.overtimeMinutes ? `${row.overtimeMinutes}m` : "-"}
                            </Text>

                            <Text className="w-[110px] text-[11px] font-bold text-rose-600 text-right pr-2">
                              {row.penaltyHours ? `${row.penaltyHours}h (₹${row.penaltyInr || 0})` : "-"}
                            </Text>
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
                      filteredLeaves.map((row: any, i: number) => {
                        const isEven = i % 2 === 0;
                        return (
                          <View
                            key={i}
                            className={`flex-row items-center border-b border-slate-100 py-3 px-4 ${
                              isEven ? "bg-white" : "bg-[#FAF9FE]"
                            }`}
                          >
                            <Text className="w-[90px] text-xs font-bold text-[#1F1B3D]">{row.date}</Text>
                            <View className="flex-1 min-w-[160px]">
                              <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>{row.empName}</Text>
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

                    {auditData.claimList?.length === 0 ? (
                      <View className="py-12 items-center justify-center">
                        <Text className="text-xs text-slate-400 font-bold">No approved claims found.</Text>
                      </View>
                    ) : (
                      auditData.claimList.map((row: any, i: number) => {
                        const isEven = i % 2 === 0;
                        return (
                          <View
                            key={i}
                            className={`flex-row items-center border-b border-slate-100 py-3 px-4 ${
                              isEven ? "bg-white" : "bg-[#FAF9FE]"
                            }`}
                          >
                            <Text className="w-[90px] text-xs font-bold text-[#1F1B3D]">{row.approvedDate}</Text>
                            <View className="flex-1 min-w-[160px]">
                              <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>{row.empName}</Text>
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
          </View>
        )}
      </ScrollView>
    </View>
  );
}