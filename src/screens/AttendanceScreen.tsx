import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal
} from "react-native";
import {
  ChevronLeft,
  Camera,
  ShieldCheck,
  Fingerprint,
  Coffee,
  Utensils,
  Clock,
  AlertTriangle,
  X,
  ChevronRight
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";
import { UserSession } from "../services/UserSession";
import { BASE_HOST } from "../constants/config";

interface AttendanceScreenProps {
  navigation: {
    navigate: (screen: string) => void;
    goBack?: () => void;
    canGoBack?: () => boolean;
  };
}

interface BreakSessionItem {
  id?: string;
  type?: "TEA" | "LUNCH" | "PERSONAL";
  title?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  durationSeconds?: number;
}

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: "Present" | "Leave" | "Off Day" | "Half Day" | "Absent";
  recordType?: "PRESENT" | "LEAVE" | "PERMISSION" | "OD" | "OFF_DAY" | "ABSENT";
  statusBadge?: string;
  subtitle?: string;
  detailRight?: string;
  isApproved?: boolean;
  // Break and Penalty Fields from Backend
  breakMinutes?: number;
  excessBreakMinutes?: number;
  penaltyHours?: number;
  totalPenaltyInr?: number;
  breakHistory?: BreakSessionItem[];
  break_history_json?: string | BreakSessionItem[];
}

const API_BASE_URL = `${BASE_HOST}/api/attendance`;

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

  // Modal State for Break & Penalty Details
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

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

          if (json.records && Array.isArray(json.records)) {
            // Deduplicate incoming array by ID to ensure single occurrence per day
            const uniqueMap = new Map();
            json.records.forEach((rec: any) => {
              const key = rec.id || rec.date;
              if (!uniqueMap.has(key)) {
                uniqueMap.set(key, rec);
              }
            });
            setRecords(Array.from(uniqueMap.values()));
          }
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

  // Helper to parse break history from JSON string or object
  const getParsedBreaks = (record: AttendanceRecord | null): BreakSessionItem[] => {
    if (!record) return [];
    if (Array.isArray(record.breakHistory)) return record.breakHistory;
    if (Array.isArray(record.break_history_json)) return record.break_history_json;
    if (typeof record.break_history_json === "string") {
      try {
        return JSON.parse(record.break_history_json);
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const handleOpenDetails = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setIsDetailModalVisible(true);
  };

  // Read values directly from backend response with safety fallbacks
  const selectedBreaks = getParsedBreaks(selectedRecord);
  const totalBreakMins = selectedRecord?.breakMinutes ?? 0;
  const excessBreakMins = selectedRecord?.excessBreakMinutes ?? 0;

  // Read real penalties returned by backend
  const penaltyHours = Number(selectedRecord?.penaltyHours ?? 0);
  const penaltyInr = Number(selectedRecord?.totalPenaltyInr ?? 0);
  const hasPenalty = penaltyHours > 0 || penaltyInr > 0 || excessBreakMins > 0;

  return (
    <ScreenContainer scrollable={false}>
      <View className="flex-1 w-full flex-col justify-between">

        {/* ========================================================================= */}
        {/* 1. TOP PURPLE BANNER HEADER                                              */}
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
                {empId || "1042"}
              </Text>
            </View>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SCROLLABLE MAIN CONTENT                                                  */}
        {/* ========================================================================= */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: Platform.OS === "web" ? 80 : 110,
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

          {/* Monthly KPI Statistics Strip */}
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
          {/* DAILY ATTENDANCE RECORDS STREAM (SINGLE DEDUPLICATED RENDER)              */}
          {/* ========================================================================= */}
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
                  className={`px-2.5 py-1 rounded-lg ${filterType === t ? "bg-[#5B4FD1]" : "bg-transparent"
                    }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${filterType === t ? "text-white" : "text-[#7A76A6]"
                      }`}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Records Stream */}
          {isLoading ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="small" color="#5B4FD1" />
            </View>
          ) : (
            <View className="space-y-2.5">
              {filteredRecords.map((item: any, index: number) => {
                const isPresent = item.recordType === "PRESENT" || item.status === "Present";
                const isLeave = item.recordType === "LEAVE" || item.status === "Leave";
                const isPermission = item.recordType === "PERMISSION";
                const isOD = item.recordType === "OD";
                const isOffDay = item.recordType === "OFF_DAY" || item.status === "Off Day";

                const breakCount = Array.isArray(item.breakHistory) ? item.breakHistory.length : 0;
                const breakMins = item.breakMinutes ?? 0;
                const penaltyInr = item.totalPenaltyInr ?? 0;

                const recordKey = item.id || item.date || `rec-row-${index}`;

                return (
                  <View
                    key={recordKey}
                    className="bg-white border border-[#E7E4F5] rounded-2xl p-3.5 shadow-xs mb-3"
                  >
                    {/* 1. Header: Date + Status Badge */}
                    <View className="flex-row items-center justify-between pb-2 mb-2 border-b border-slate-100">
                      <Text className="text-xs font-black text-[#1F1B3D]">{item.date}</Text>

                      <View
                        className={`px-2.5 py-0.5 rounded-full border ${isPresent
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
                          className={`text-[9.5px] font-black uppercase ${isPresent
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

                    {/* 2. Body: Balanced 3-Column Center-Aligned Row */}
                    {isPresent ? (
                      <View className="flex-row items-center justify-between py-1">
                        {/* Left Column: Check In */}
                        <View className="flex-1 items-start">
                          <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">
                            Check In
                          </Text>
                          <Text className="text-xs font-black text-[#1F1B3D] mt-0.5">
                            {item.checkIn || "--:--"}
                          </Text>
                        </View>

                        {/* Center Column: Direct Break History Button */}
                        <View className="flex-1 items-center px-1">
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => handleOpenDetails(item)}
                            className="bg-[#EEECFA] border border-[#5B4FD1]/25 px-2.5 py-1.5 rounded-xl items-center flex-row gap-1 shadow-2xs active:bg-[#E3E0F8]"
                          >
                            <Coffee size={12} color="#5B4FD1" />
                            <View className="items-center">
                              <Text className="text-[10.5px] font-black text-[#5B4FD1]">
                                {breakMins}m Breaks
                              </Text>
                              {penaltyInr > 0 ? (
                                <Text className="text-[8.5px] font-bold text-rose-600">
                                  -₹{penaltyInr} penalty
                                </Text>
                              ) : (
                                <Text className="text-[8.5px] font-semibold text-[#7A76A6]">
                                  {breakCount} session{breakCount === 1 ? "" : "s"}
                                </Text>
                              )}
                            </View>
                            <ChevronRight size={11} color="#5B4FD1" />
                          </TouchableOpacity>
                        </View>

                        {/* Right Column: Check Out */}
                        <View className="flex-1 items-end">
                          <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">
                            Check Out
                          </Text>
                          <Text className="text-xs font-black text-[#1F1B3D] mt-0.5">
                            {item.checkOut || "--:--"}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View className="flex-row justify-between items-center py-1">
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
          )}
        </ScrollView>

        {/* ========================================================================= */}
        {/* BREAK & PENALTY DETAILS MODAL                                            */}
        {/* ========================================================================= */}
        <Modal
          visible={isDetailModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsDetailModalVisible(false)}
        >
          <View className="flex-1 bg-black/60 items-center justify-center px-4">
            <View className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#E7E4F5]">

              {/* Modal Header */}
              <View className="flex-row items-center justify-between pb-3 mb-3 border-b border-[#E7E4F5]">
                <View>
                  <Text className="text-sm font-black text-[#1F1B3D]">Shift & Break Breakdown</Text>
                  <Text className="text-[10px] font-semibold text-[#7A76A6]">{selectedRecord?.date}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsDetailModalVisible(false)}
                  className="w-7 h-7 rounded-full bg-[#F6F5FC] items-center justify-center active:bg-slate-200"
                >
                  <X size={16} color="#1F1B3D" />
                </TouchableOpacity>
              </View>

              {/* Penalty / Allowance Overview Card */}
              <View className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl p-3 mb-3">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-1.5">
                    <Clock size={13} color="#5B4FD1" />
                    <Text className="text-[11px] font-bold text-[#1F1B3D]">Total Break Used</Text>
                  </View>
                  <Text className={`text-xs font-black ${totalBreakMins > 80 ? "text-rose-600" : "text-[#5B4FD1]"}`}>
                    {totalBreakMins}m / 80m
                  </Text>
                </View>

                {/* Check hasPenalty instead of just excessBreakMins */}
                {hasPenalty ? (
                  <View className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 mt-1">
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <AlertTriangle size={13} color="#E11D48" />
                      <Text className="text-[10px] font-black text-rose-700 uppercase tracking-wider">
                        Shift & Break Penalty Applied
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-[10px] font-semibold text-rose-600">
                        {penaltyHours > 0 ? `Deduction: ${penaltyHours.toFixed(1)} hrs` : `Excess break: +${excessBreakMins}m`}
                      </Text>
                      {penaltyInr > 0 && (
                        <Text className="text-xs font-black text-rose-700">
                          - ₹{penaltyInr}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 mt-1">
                    <Text className="text-[10px] font-bold text-emerald-700 text-center">
                      Regular Shift • No penalties applied
                    </Text>
                  </View>
                )}
              </View>

              {/* Break Sessions Log */}
              <Text className="text-[11px] font-black text-[#1F1B3D] uppercase tracking-wider mb-2">
                Logged Break Sessions ({selectedBreaks.length})
              </Text>

              {selectedBreaks.length === 0 ? (
                <View className="py-5 items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 mb-4">
                  <Coffee size={20} color="#94A3B8" />
                  <Text className="text-xs font-semibold text-[#7A76A6] mt-1.5">No breaks logged for this date</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false} className="mb-4 space-y-2">
                  {selectedBreaks.map((b, idx) => (
                    <View
                      key={b.id || idx}
                      className="flex-row items-center justify-between p-2.5 bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl mb-1.5"
                    >
                      <View className="flex-row items-center gap-2">
                        <View className={`w-7 h-7 rounded-lg items-center justify-center ${b.type === "LUNCH" ? "bg-amber-100" : "bg-indigo-100"
                          }`}>
                          {b.type === "LUNCH" ? (
                            <Utensils size={13} color="#D97706" />
                          ) : (
                            <Coffee size={13} color="#5B4FD1" />
                          )}
                        </View>
                        <View>
                          <Text className="text-xs font-bold text-[#1F1B3D]">{b.title || "Break"}</Text>
                          <Text className="text-[9.5px] font-semibold text-[#7A76A6]">
                            {b.startTime || "--"} - {b.endTime || "--"}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-xs font-black text-[#1F1B3D]">
                        {b.durationMinutes ?? (b.durationSeconds ? Math.ceil(b.durationSeconds / 60) : 0)}m
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Close Button */}
              <TouchableOpacity
                onPress={() => setIsDetailModalVisible(false)}
                className="w-full py-2.5 bg-[#5B4FD1] rounded-xl items-center active:opacity-90"
              >
                <Text className="text-xs font-black text-white uppercase tracking-wider">Close Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    </ScreenContainer>
  );
}