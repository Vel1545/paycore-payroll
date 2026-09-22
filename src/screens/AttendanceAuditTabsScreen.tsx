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
  Calendar,
  Filter,
  Clock,
  Coffee,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  User,
  Building,
} from "lucide-react-native";
import CrossPlatformDatePicker from "../components/CrossPlatformDatePicker";

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
      const url = `http://192.168.31.228:8080/api/attendance/audit-summary?fromDate=${fromStr}&toDate=${toStr}&empId=${empIdInput.trim() || "ALL"}&department=${selectedDept}`;
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
      {/* 1. Header */}
      <View className="bg-[#5B4FD1] pt-10 pb-4 px-4 shadow-sm">
        <View className="flex-row items-center justify-between mb-2">
          <TouchableOpacity
            onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation.navigate("Home"))}
            className="w-9 h-9 bg-white/20 rounded-xl items-center justify-center active:opacity-80"
          >
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-lg font-black text-white">Workforce Lifecycle Audit</Text>
          <View className="w-9" />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* 2. Global Filter Panel */}
        <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 mb-4 shadow-xs">
          <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider mb-3">Audit Parameters</Text>

          {/* Date Row */}
{/* REUSABLE CROSS-PLATFORM DATE PICKERS */}
<View className="flex-col md:flex-row gap-3 mb-3">
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

          {/* Single Person Search Input */}
          <View className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-2 mb-3 flex-row items-center">
            <User size={14} color="#7A76A6" />
            <TextInput
              value={empIdInput}
              onChangeText={setEmpIdInput}
              placeholder="Search Emp ID (e.g. EMP1042 or ALL)"
              placeholderTextColor="#9CA3AF"
              className="text-xs font-bold text-[#1F1B3D] ml-2 flex-1"
            />
            <TouchableOpacity
              onPress={fetchAuditData}
              className="bg-[#5B4FD1] px-3 py-1 rounded-lg"
            >
              <Text className="text-[10px] font-black text-white uppercase">Filter</Text>
            </TouchableOpacity>
          </View>

          {/* Department Filter Pills */}
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
                <Text className={`text-[11px] font-black ${selectedDept === dept ? "text-white" : "text-[#7A76A6]"}`}>
                  {dept}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 3. Horizontal Segmented Tabs */}
        <View className="flex-row bg-white border border-[#E7E4F5] p-1.5 rounded-2xl mb-4 shadow-xs">
          <TouchableOpacity
            onPress={() => setActiveTab("ATTENDANCE")}
            className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
              activeTab === "ATTENDANCE" ? "bg-[#5B4FD1] shadow-xs" : ""
            }`}
          >
            <Text className={`text-xs font-black ${activeTab === "ATTENDANCE" ? "text-white" : "text-[#7A76A6]"}`}>
              Attendance ({auditData.attendanceList?.length || 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("LEAVE")}
            className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
              activeTab === "LEAVE" ? "bg-[#5B4FD1] shadow-xs" : ""
            }`}
          >
            <Text className={`text-xs font-black ${activeTab === "LEAVE" ? "text-white" : "text-[#7A76A6]"}`}>
              Leaves ({auditData.leaveList?.length || 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("CLAIMS")}
            className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
              activeTab === "CLAIMS" ? "bg-[#5B4FD1] shadow-xs" : ""
            }`}
          >
            <Text className={`text-xs font-black ${activeTab === "CLAIMS" ? "text-white" : "text-[#7A76A6]"}`}>
              Claims ({auditData.claimList?.length || 0})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading Indicator */}
        {isLoading && (
          <View className="py-8 items-center">
            <ActivityIndicator color="#5B4FD1" size="small" />
            <Text className="text-xs font-bold text-[#7A76A6] mt-2">Loading lifecycle data...</Text>
          </View>
        )}

        {/* 4. Tab 1: ATTENDANCE */}
        {!isLoading && activeTab === "ATTENDANCE" && (
          <View className="space-y-3 gap-3">
            {auditData.attendanceList?.length === 0 ? (
              <Text className="text-center text-xs text-slate-400 py-6">No attendance records found.</Text>
            ) : (
              auditData.attendanceList.map((row: any, i: number) => (
                <View key={i} className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs">
                  {/* Emp & Status Header */}
                  <View className="flex-row justify-between items-center pb-2 mb-2 border-b border-slate-100">
                    <View>
                      <Text className="text-xs font-black text-[#1F1B3D]">{row.empName} ({row.empId})</Text>
                      <Text className="text-[10px] font-semibold text-slate-400">{row.department} • {row.date}</Text>
                    </View>
                    <View className={`px-2.5 py-0.5 rounded-full ${
                      row.status === "PRESENT" ? "bg-emerald-100" : row.status === "ON_DUTY" ? "bg-amber-100" : "bg-rose-100"
                    }`}>
                      <Text className={`text-[10px] font-black ${
                        row.status === "PRESENT" ? "text-emerald-700" : row.status === "ON_DUTY" ? "text-amber-700" : "text-rose-700"
                      }`}>{row.status}</Text>
                    </View>
                  </View>

                  {/* Punch Times & Total Hours */}
                  <View className="flex-row justify-between mb-2">
                    <View>
                      <Text className="text-[10px] font-bold text-slate-400 uppercase">Check In - Out</Text>
                      <Text className="text-xs font-black text-[#1F1B3D]">{row.checkIn} → {row.checkOut}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[10px] font-bold text-slate-400 uppercase">Total Worked</Text>
                      <Text className="text-xs font-black text-[#5B4FD1]">{row.totalWorkedHours}</Text>
                    </View>
                  </View>

                  {/* Breaks, Penalties & OT */}
                  <View className="flex-row justify-between items-center pt-2 border-t border-slate-50">
                    <Text className="text-[10px] font-bold text-slate-500">
                      Breaks: {row.totalBreakCount} ({row.totalBreakMinutes}m)
                    </Text>
                    <Text className="text-[10px] font-bold text-amber-600">
                      OT: {row.overtimeMinutes}m
                    </Text>
                    <Text className="text-[10px] font-bold text-rose-600">
                      Penalty: {row.penaltyHours}h (₹{row.penaltyInr || 0})
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* 5. Tab 2: LEAVES & PERMISSIONS */}
        {!isLoading && activeTab === "LEAVE" && (
          <View>
            {/* Subcategory Pills: All, Permission, Halfday, Fullday */}
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

            {filteredLeaves.length === 0 ? (
              <Text className="text-center text-xs text-slate-400 py-6">No leave or permission records match filter.</Text>
            ) : (
              filteredLeaves.map((row: any, i: number) => (
                <View key={i} className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-2.5 shadow-xs">
                  <View className="flex-row justify-between items-center mb-1.5">
                    <Text className="text-xs font-black text-[#1F1B3D]">{row.empName} ({row.empId})</Text>
                    <View className="bg-purple-100 px-2 py-0.5 rounded-md">
                      <Text className="text-[10px] font-black text-[#5B4FD1] uppercase">{row.category.replace("_", " ")}</Text>
                    </View>
                  </View>
                  <Text className="text-[11px] font-bold text-slate-600 mb-1">Reason: {row.reason || "N/A"}</Text>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-[10px] font-semibold text-slate-400">Date: {row.date}</Text>
                    {row.timeRange && (
                      <Text className="text-[10px] font-black text-teal-700">Time: {row.timeRange}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* 6. Tab 3: APPROVED CLAIMS ONLY */}
        {!isLoading && activeTab === "CLAIMS" && (
          <View className="space-y-2.5 gap-2.5">
            {auditData.claimList?.length === 0 ? (
              <Text className="text-center text-xs text-slate-400 py-6">No approved claims found for this period.</Text>
            ) : (
              auditData.claimList.map((row: any, i: number) => (
                <View key={i} className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs">
                  <View className="flex-row justify-between items-center mb-2">
                    <View>
                      <Text className="text-xs font-black text-[#1F1B3D]">{row.empName} ({row.empId})</Text>
                      <Text className="text-[10px] font-semibold text-slate-400">{row.department}</Text>
                    </View>
                    <Text className="text-base font-black text-emerald-600">₹{row.amount}</Text>
                  </View>

                  <View className="bg-[#F6F5FC] p-2.5 rounded-xl border border-slate-100 mb-2">
                    <Text className="text-[10px] font-bold text-slate-400 uppercase">Purpose of Claim</Text>
                    <Text className="text-xs font-bold text-[#1F1B3D] mt-0.5">{row.purpose}</Text>
                  </View>

                  <View className="flex-row justify-between items-center">
                    <Text className="text-[10px] font-semibold text-slate-500">Approved Date: {row.approvedDate}</Text>
                    <Text className="text-[10px] font-black text-[#5B4FD1]">Approved by: {row.approvedBy}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}