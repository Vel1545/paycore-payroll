import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from "react-native";
import { 
  ChevronLeft, 
  Camera, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  ChevronDown, 
  ShieldCheck, 
  Fingerprint,
  ArrowUpRight,
  Sparkles
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";
import { UserSession } from "../services/UserSession";

interface AttendanceScreenProps {
  navigation: {
    navigate: (screen: string) => void;
    goBack?: () => void;
    canGoBack?: () => boolean;
  };
}

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: "Present" | "Leave" | "Off Day" | "Half Day" | "Absent";
  subtitle?: string;
  isApproved?: boolean;
}

const API_BASE_URL = Platform.select({
  web: "http://localhost:8080/api/attendance",
  android: "http://10.0.2.2:8080/api/attendance",
  default: "http://192.168.31.228:8080/api/attendance"
});

export default function AttendanceScreen({ navigation }: AttendanceScreenProps) {
  type FilterTab = "All" | "Present" | "Leave" | "Permission" | "OD";
  const [filterType, setFilterType] = useState<FilterTab>("All");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const empId = UserSession.empId || "EMP1042";

  // Dynamic Data States
  const [todayData, setTodayData] = useState({
    checkIn: "--:--",
    checkOut: "--:--",
    hasCheckedIn: false,
    isCheckedOut: false,
  });

  const [monthlySummary, setMonthlySummary] = useState({
    present: 0,
    lateHalf: 0,
    absent: 0,
    ratio: 100,
  });

  const [leaveBalances, setLeaveBalances] = useState({
    earned: "00/00",
    casual: "00/00",
    sick: "00/00",
  });

  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  // Fetch Full Data from Overview Endpoint
  useEffect(() => {
    const fetchOverview = async () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;

      try {
        setIsLoading(true);
        const res = await fetch(`${API_BASE_URL}/overview?empId=${empId}&year=${year}&month=${month}`);
        if (res.ok) {
          const json = await res.json();
          if (json.today) setTodayData(json.today);
          if (json.monthlySummary) setMonthlySummary(json.monthlySummary);
          if (json.leaveBalances) setLeaveBalances(json.leaveBalances);
          if (json.records) setRecords(json.records);
        }
      } catch (err) {
        console.warn("Failed to load attendance records:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverview();
  }, [empId]);

  // Filter Stream Logic
 const filteredRecords = records.filter((rec: any) => {
  if (filterType === "All") return true;
  if (filterType === "Present") return rec.recordType === "PRESENT";
  if (filterType === "Leave") return rec.recordType === "LEAVE";
  if (filterType === "Permission") return rec.recordType === "PERMISSION";
  if (filterType === "OD") return rec.recordType === "OD";
  return true;
});

  return (
    <ScreenContainer scrollable={false}>
      <View className="flex-1 w-full flex-col justify-between">
        
        {/* ========================================================================= */}
        {/* 1. TOP PURPLE BANNER HEADER (Enterprise Theme)                            */}
        {/* ========================================================================= */}
        <View className="bg-[#5B4FD1] rounded-3xl p-4 mb-4 shadow-xs relative overflow-hidden shrink-0">
          <View 
            className="absolute -top-3 -right-4 w-20 h-20 rounded-3xl border-2 border-white/20 pointer-events-none"
            style={{ transform: [{ rotate: "20deg" }] }}
          />
          <View 
            className="absolute top-10 -left-6 w-16 h-16 rounded-2xl border-2 border-white/10 pointer-events-none"
            style={{ transform: [{ rotate: "-15deg" }] }}
          />

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <TouchableOpacity
                onPress={() => {
                  if (navigation?.goBack) {
                    navigation.goBack();
                  } else {
                    navigation.navigate("Home");
                  }
                }}
                className="w-9 h-9 bg-white/20 rounded-2xl items-center justify-center active:opacity-80"
              >
                <ChevronLeft size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <View>
                <Text className="text-lg md:text-xl font-black text-white tracking-tight">
                  Attendance & Time
                </Text>
                <Text className="text-[10px] font-bold text-white/80">
                  PAYCORE • Shift & Biometric Verification
                </Text>
              </View>
            </View>

            <View className="bg-white/20 px-3 py-1 rounded-full border border-white/25 flex-row items-center">
              <ShieldCheck size={12} color="#FFFFFF" />
              <Text className="text-[10px] font-black text-white ml-1 uppercase tracking-wider">
                EMP-{empId.replace(/[^0-9]/g, "") || "1042"}
              </Text>
            </View>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SCROLLABLE MAIN CONTENT                                                   */}
        {/* ========================================================================= */}
        <ScrollView 
          showsVerticalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: Platform.OS === "web" ? 30 : 110,
          }}
        >
          {/* Quick Biometric Punch Card */}
          <TouchableOpacity
            onPress={() => navigation.navigate("PunchClock")}
            activeOpacity={0.88}
            className="bg-white border border-[#E7E4F5] rounded-3xl p-4 mb-4 shadow-xs flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 rounded-2xl bg-[#EEECFA] items-center justify-center border border-[#5B4FD1]/20 shadow-xs">
                <Fingerprint size={24} color="#5B4FD1" />
              </View>
              <View>
                <Text className="text-xs font-black text-[#1F1B3D]">Geofence & Camera Clock-In</Text>
                <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5">
                  Office HQ • Live GPS Shift Check-in
                </Text>
              </View>
            </View>

            <View className="bg-[#5B4FD1] px-3 py-1.5 rounded-xl flex-row items-center shadow-xs">
              <Camera size={13} color="#FFFFFF" />
              <Text className="text-white text-[11px] font-black ml-1">Punch</Text>
            </View>
          </TouchableOpacity>

          {/* Today Check-In & Check-Out Dual Cards */}
          <View className="flex-row space-x-3 gap-3 mb-4">
            <View className="flex-1 bg-white rounded-2xl p-4 shadow-xs border border-[#E7E4F5]">
              <Text className="text-[10px] font-black text-[#7A76A6] uppercase tracking-wider mb-1">
                Today's Check-In
              </Text>
              <Text className="text-lg md:text-xl font-black text-[#1F1B3D]">
                {todayData.checkIn}
              </Text>
              <View className="bg-[#E7FAEE] self-start px-2.5 py-0.5 rounded-full flex-row items-center border border-[#1FAE5C]/20 mt-2">
                <View className="w-1.5 h-1.5 rounded-full bg-[#1FAE5C] mr-1.5" />
                <Text className="text-[9.5px] font-black text-[#1FAE5C]">
                  {todayData.hasCheckedIn ? "On Time" : "Pending"}
                </Text>
              </View>
            </View>

            <View className="flex-1 bg-white rounded-2xl p-4 shadow-xs border border-[#E7E4F5]">
              <Text className="text-[10px] font-black text-[#7A76A6] uppercase tracking-wider mb-1">
                Today's Check-Out
              </Text>
              <Text className="text-lg md:text-xl font-black text-[#A6A2CE]">
                {todayData.checkOut}
              </Text>
              <View className="bg-[#FEF2D9] self-start px-2.5 py-0.5 rounded-full flex-row items-center border border-[#D08A0C]/20 mt-2">
                <View className="w-1.5 h-1.5 rounded-full bg-[#D08A0C] mr-1.5" />
                <Text className="text-[9.5px] font-black text-[#D08A0C]">
                  {todayData.isCheckedOut ? "Completed" : "Pending"}
                </Text>
              </View>
            </View>
          </View>

          {/* Monthly KPI Statistics Strip (MNC Standard) */}
          <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 mb-4 shadow-xs">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
                Monthly Summary
              </Text>
              <Text className="text-[10px] font-bold text-[#5B4FD1]">
                {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </Text>
            </View>

            <View className="flex-row justify-between divide-x divide-slate-100">
              <View className="flex-1 items-center px-2">
                <Text className="text-base md:text-lg font-black text-[#1FAE5C]">
                  {monthlySummary.present}
                </Text>
                <Text className="text-[9.5px] font-bold text-[#7A76A6] uppercase mt-0.5">Present</Text>
              </View>
              <View className="flex-1 items-center px-2">
                <Text className="text-base md:text-lg font-black text-[#D08A0C]">
                  {String(monthlySummary.lateHalf).padStart(2, "0")}
                </Text>
                <Text className="text-[9.5px] font-bold text-[#7A76A6] uppercase mt-0.5">Late/Half</Text>
              </View>
              <View className="flex-1 items-center px-2">
                <Text className="text-base md:text-lg font-black text-[#E4453C]">
                  {String(monthlySummary.absent).padStart(2, "0")}
                </Text>
                <Text className="text-[9.5px] font-bold text-[#7A76A6] uppercase mt-0.5">Absent</Text>
              </View>
              <View className="flex-1 items-center px-2">
                <Text className="text-base md:text-lg font-black text-[#5B4FD1]">
                  {monthlySummary.ratio}%
                </Text>
                <Text className="text-[9.5px] font-bold text-[#7A76A6] uppercase mt-0.5">Ratio</Text>
              </View>
            </View>
          </View>

          {/* Leave Balances Header & Cards */}
          <View className="flex-row items-center justify-between mb-2.5 px-1">
            <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
              Available Leave Balances
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Apply")}>
              <Text className="text-xs font-bold text-[#5B4FD1]">+ Apply</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row space-x-2.5 gap-2 mb-5">
            <View className="flex-1 bg-[#E7FAEE] border border-[#1FAE5C]/20 rounded-2xl p-3 items-center">
              <Text className="text-base font-black text-[#1FAE5C]">{leaveBalances.earned}</Text>
              <Text className="text-[9.5px] font-bold text-[#1FAE5C] mt-0.5">Earned</Text>
            </View>
            <View className="flex-1 bg-[#FEF2D9] border border-[#D08A0C]/20 rounded-2xl p-3 items-center">
              <Text className="text-base font-black text-[#D08A0C]">{leaveBalances.casual}</Text>
              <Text className="text-[9.5px] font-bold text-[#D08A0C] mt-0.5">Casual</Text>
            </View>
            <View className="flex-1 bg-[#FDE9E8] border border-[#E4453C]/20 rounded-2xl p-3 items-center">
              <Text className="text-base font-black text-[#E4453C]">{leaveBalances.sick}</Text>
              <Text className="text-[9.5px] font-bold text-[#E4453C] mt-0.5">Sick</Text>
            </View>
          </View>

          {/* ========================================================================= */}
          {/* DAILY ATTENDANCE RECORDS STREAM                                           */}
          {/* ========================================================================= */}
{/* Header & 5 Filter Tabs */}
<View className="flex-row items-center justify-between mb-3 px-1">
  <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
    Attendance Records
  </Text>

  <ScrollView 
    horizontal 
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ gap: 4 }}
    className="flex-row bg-white border border-[#E7E4F5] rounded-xl p-0.5 shadow-xs"
  >
    {(["All", "Present", "Leave", "Permission", "OD"] as FilterTab[]).map((t) => (
      <TouchableOpacity
        key={t}
        onPress={() => setFilterType(t)}
        className={`px-2.5 py-1 rounded-lg ${
          filterType === t ? "bg-[#5B4FD1]" : "bg-transparent"
        }`}
      >
        <Text
          className={`text-[10px] font-bold ${
            filterType === t ? "text-white" : "text-[#7A76A6]"
          }`}
        >
          {t}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
</View>

{/* Records Stream */}
<View className="space-y-2.5">
  {filteredRecords.map((item: any, index: number) => {
    const isPresent = item.recordType === "PRESENT";
    const isLeave = item.recordType === "LEAVE";
    const isPermission = item.recordType === "PERMISSION";
    const isOD = item.recordType === "OD";
    const isOffDay = item.recordType === "OFF_DAY";
    const isAbsent = item.recordType === "ABSENT";

    const recordKey = item.id || item.date || `rec-row-${index}`;

    return (
      <View
        key={recordKey}
        className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs mb-2.5 space-y-2"
      >
        {/* Card Header: Date & Dynamic Status Badge */}
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-black text-[#1F1B3D]">{item.date}</Text>

          <View
            className={`px-3 py-1 rounded-full border ${
              isPresent
                ? "bg-[#E7FAEE] border-[#1FAE5C]/20"
                : isLeave
                ? "bg-[#FEF2D9] border-[#D08A0C]/20"
                : isPermission
                ? "bg-[#EEECFA] border-[#5B4FD1]/20"
                : isOD
                ? "bg-[#E0F2FE] border-[#0284C7]/20"
                : "bg-[#FDE9E8] border-[#E4453C]/20"
            }`}
          >
            <Text
              className={`text-[10px] font-black uppercase ${
                isPresent
                  ? "text-[#1FAE5C]"
                  : isLeave
                  ? "text-[#D08A0C]"
                  : isPermission
                  ? "text-[#5B4FD1]"
                  : isOD
                  ? "text-[#0284C7]"
                  : "text-[#E4453C]"
              }`}
            >
              {item.statusBadge || (isPresent ? "PRESENT" : isLeave ? "LEAVE" : "ABSENT")}
            </Text>
          </View>
        </View>

        {/* Card Body: Dynamic Content by Type */}
        {isPresent ? (
          // 1. PRESENT: Check-In and Check-Out Row
          <View className="space-y-1 pt-1">
            <View className="flex-row justify-between">
              <Text className="text-[11px] font-semibold text-[#7A76A6]">Check In</Text>
              <Text className="text-[11px] font-black text-[#1F1B3D]">{item.checkIn || "--:--"}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-[11px] font-semibold text-[#7A76A6]">Check Out</Text>
              <Text className="text-[11px] font-black text-[#1F1B3D]">{item.checkOut || "--:--"}</Text>
            </View>
          </View>
        ) : isPermission ? (
          // 2. PERMISSION: Hours Details & Approved Label
          <View className="flex-row justify-between items-center pt-1">
            <Text className="text-[11px] font-semibold text-[#5B4FD1]">
              {item.subtitle || "Permission slot approved"}
            </Text>
            <Text className="text-[11px] font-black text-[#1F1B3D]">
              {item.detailRight || "Approved"}
            </Text>
          </View>
        ) : isOD ? (
          // 3. OD: Nature (Full Day / Half Day) & Approved Label
          <View className="flex-row justify-between items-center pt-1">
            <Text className="text-[11px] font-semibold text-[#0284C7]">
              {item.subtitle || "On-Duty • Full Day"}
            </Text>
            <Text className="text-[11px] font-black text-[#1F1B3D]">
              {item.detailRight || "Approved"}
            </Text>
          </View>
        ) : isLeave ? (
          // 4. LEAVE: Leave Type (Casual/Sick/Earned) • Half Day/Full Day & Approved Label
          <View className="flex-row justify-between items-center pt-1">
            <Text className="text-[11px] font-semibold text-[#D08A0C]">
              {item.subtitle || "Leave • Full Day"}
            </Text>
            <Text className="text-[11px] font-black text-[#1F1B3D]">
              {item.detailRight || "Approved"}
            </Text>
          </View>
        ) : (
          // 5. ABSENT / OFF DAY
          <View className="flex-row justify-between items-center pt-1">
            <Text className="text-[11px] font-semibold text-[#7A76A6]">
              {item.subtitle || "No punch recorded"}
            </Text>
            <Text className="text-[11px] font-black text-[#1F1B3D]">
              {item.detailRight || (isOffDay ? "—" : "Absent")}
            </Text>
          </View>
        )}
      </View>
    );
  })}
</View>

          {/* Records Stream */}
          {isLoading ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="small" color="#5B4FD1" />
            </View>
          ) : (
            <View className="space-y-2.5">
             {filteredRecords.map((item, index) => {
  const isPresent = item?.status === "Present";
  const isLeave = item?.status === "Leave";
  const isOffDay = item?.status === "Off Day";
  const isHalfDay = item?.status === "Half Day";
  const isAbsent = item?.status === "Absent";

  // Provide guaranteed fallback key to prevent reconciliation crash
  const recordKey = item?.id || item?.date || `attendance-row-${index}`;

  return (
    <View
      key={recordKey}
      className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs mb-2.5 space-y-2"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-black text-[#1F1B3D]">{item?.date ?? "--"}</Text>
        
        {/* Status Badge */}
        <View
          className={`px-3 py-1 rounded-full border ${
            isPresent
              ? "bg-[#E7FAEE] border-[#1FAE5C]/20"
              : isLeave
              ? "bg-[#FEF2D9] border-[#D08A0C]/20"
              : isHalfDay
              ? "bg-[#EEECFA] border-[#5B4FD1]/20"
              : "bg-[#FDE9E8] border-[#E4453C]/20"
          }`}
        >
          <Text
            className={`text-[10px] font-black ${
              isPresent
                ? "text-[#1FAE5C]"
                : isLeave
                ? "text-[#D08A0C]"
                : isHalfDay
                ? "text-[#5B4FD1]"
                : "text-[#E4453C]"
            }`}
          >
            {item?.status ?? "Absent"}
          </Text>
        </View>
      </View>

      {/* Timing or Note Details */}
      {isPresent && !item?.subtitle ? (
        <View className="space-y-1 pt-1">
          <View className="flex-row justify-between">
            <Text className="text-[11px] font-semibold text-[#7A76A6]">Check In</Text>
            <Text className="text-[11px] font-black text-[#1F1B3D]">{item?.checkIn ?? "--:--"}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-[11px] font-semibold text-[#7A76A6]">Check Out</Text>
            <Text className="text-[11px] font-black text-[#1F1B3D]">{item?.checkOut ?? "--:--"}</Text>
          </View>
        </View>
      ) : (
        <View className="flex-row justify-between pt-1">
          <Text className="text-[11px] font-semibold text-[#7A76A6]">
            {item?.subtitle || "No punch recorded"}
          </Text>
          <Text className="text-[11px] font-black text-[#1F1B3D]">
            {item?.isApproved ? "Approved" : isOffDay ? "—" : "Absent"}
          </Text>
        </View>
      )}
    </View>
  );
})}
            </View>
          )}
        </ScrollView>

      </View>
    </ScreenContainer>
  );
}