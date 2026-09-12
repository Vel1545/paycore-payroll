import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Platform } from "react-native";
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
  day: string;
  checkIn: string;
  checkOut: string;
  status: "Present" | "Leave" | "Off Day" | "Half Day";
  note?: string;
}

export default function AttendanceScreen({ navigation }: AttendanceScreenProps) {
  const [filterType, setFilterType] = useState<"All" | "Present" | "Leave">("All");

  // Daily records stream (Design direct from image_c3357a.png)
  const attendanceRecords: AttendanceRecord[] = [
    {
      id: "REC-101",
      date: "Tue, Feb 10",
      day: "Tuesday",
      checkIn: "09:00 AM",
      checkOut: "06:15 PM",
      status: "Present",
    },
    {
      id: "REC-102",
      date: "Mon, Feb 09",
      day: "Monday",
      checkIn: "--:-- --",
      checkOut: "--:-- --",
      status: "Leave",
      note: "Earned leave • Full day",
    },
    {
      id: "REC-103",
      date: "Sun, Feb 08",
      day: "Sunday",
      checkIn: "--:-- --",
      checkOut: "--:-- --",
      status: "Off Day",
      note: "Weekly scheduled off",
    },
    {
      id: "REC-104",
      date: "Sat, Feb 07",
      day: "Saturday",
      checkIn: "08:55 AM",
      checkOut: "05:30 PM",
      status: "Present",
    },
    {
      id: "REC-105",
      date: "Fri, Feb 06",
      day: "Friday",
      checkIn: "09:12 AM",
      checkOut: "01:30 PM",
      status: "Half Day",
      note: "Permission slot approved",
    },
  ];

  const filteredRecords = attendanceRecords.filter((rec) => {
    if (filterType === "All") return true;
    if (filterType === "Present") return rec.status === "Present";
    if (filterType === "Leave") return rec.status === "Leave" || rec.status === "Half Day";
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
                EMP-1042
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
            paddingBottom: Platform.OS === "web" ? 30 : 110, // Full clearance above floating dock
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
              <Text className="text-lg md:text-xl font-black text-[#1F1B3D]">09:05 AM</Text>
              <View className="bg-[#E7FAEE] self-start px-2.5 py-0.5 rounded-full flex-row items-center border border-[#1FAE5C]/20 mt-2">
                <View className="w-1.5 h-1.5 rounded-full bg-[#1FAE5C] mr-1.5" />
                <Text className="text-[9.5px] font-black text-[#1FAE5C]">On Time</Text>
              </View>
            </View>

            <View className="flex-1 bg-white rounded-2xl p-4 shadow-xs border border-[#E7E4F5]">
              <Text className="text-[10px] font-black text-[#7A76A6] uppercase tracking-wider mb-1">
                Today's Check-Out
              </Text>
              <Text className="text-lg md:text-xl font-black text-[#A6A2CE]">--:-- PM</Text>
              <View className="bg-[#FEF2D9] self-start px-2.5 py-0.5 rounded-full flex-row items-center border border-[#D08A0C]/20 mt-2">
                <View className="w-1.5 h-1.5 rounded-full bg-[#D08A0C] mr-1.5" />
                <Text className="text-[9.5px] font-black text-[#D08A0C]">Pending</Text>
              </View>
            </View>
          </View>

          {/* Monthly KPI Statistics Strip (MNC Standard) */}
          <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 mb-4 shadow-xs">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
                Monthly Summary
              </Text>
              <Text className="text-[10px] font-bold text-[#5B4FD1]">January 2026</Text>
            </View>

            <View className="flex-row justify-between divide-x divide-slate-100">
              <View className="flex-1 items-center px-2">
                <Text className="text-base md:text-lg font-black text-[#1FAE5C]">22</Text>
                <Text className="text-[9.5px] font-bold text-[#7A76A6] uppercase mt-0.5">Present</Text>
              </View>
              <View className="flex-1 items-center px-2">
                <Text className="text-base md:text-lg font-black text-[#D08A0C]">02</Text>
                <Text className="text-[9.5px] font-bold text-[#7A76A6] uppercase mt-0.5">Late/Half</Text>
              </View>
              <View className="flex-1 items-center px-2">
                <Text className="text-base md:text-lg font-black text-[#E4453C]">01</Text>
                <Text className="text-[9.5px] font-bold text-[#7A76A6] uppercase mt-0.5">Absent</Text>
              </View>
              <View className="flex-1 items-center px-2">
                <Text className="text-base md:text-lg font-black text-[#5B4FD1]">96%</Text>
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
              <Text className="text-base font-black text-[#1FAE5C]">14/18</Text>
              <Text className="text-[9.5px] font-bold text-[#1FAE5C] mt-0.5">Earned</Text>
            </View>
            <View className="flex-1 bg-[#FEF2D9] border border-[#D08A0C]/20 rounded-2xl p-3 items-center">
              <Text className="text-base font-black text-[#D08A0C]">04/08</Text>
              <Text className="text-[9.5px] font-bold text-[#D08A0C] mt-0.5">Casual</Text>
            </View>
            <View className="flex-1 bg-[#FDE9E8] border border-[#E4453C]/20 rounded-2xl p-3 items-center">
              <Text className="text-base font-black text-[#E4453C]">06/06</Text>
              <Text className="text-[9.5px] font-bold text-[#E4453C] mt-0.5">Sick</Text>
            </View>
          </View>

          {/* ========================================================================= */}
          {/* DAILY ATTENDANCE RECORDS (Exact Layout from image_c3357a.png)              */}
          {/* ========================================================================= */}
          <View className="flex-row items-center justify-between mb-3 px-1">
            <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
              Attendance Records
            </Text>

            {/* Filter Toggle Pills */}
            <View className="flex-row bg-white border border-[#E7E4F5] rounded-xl p-0.5 shadow-xs">
              {(["All", "Present", "Leave"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setFilterType(t)}
                  className={`px-2.5 py-1 rounded-lg ${
                    filterType === t ? "bg-[#5B4FD1]" : "bg-transparent"
                  }`}
                >
                  <Text className={`text-[10px] font-bold ${
                    filterType === t ? "text-white" : "text-[#7A76A6]"
                  }`}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Records Stream */}
          <View className="space-y-2.5">
            {filteredRecords.map((item) => {
              const isPresent = item.status === "Present";
              const isLeave = item.status === "Leave";
              const isOffDay = item.status === "Off Day";
              const isHalfDay = item.status === "Half Day";

              return (
                <View
                  key={item.id}
                  className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs mb-2.5 space-y-2"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-black text-[#1F1B3D]">{item.date}</Text>
                    
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
                        {item.status}
                      </Text>
                    </View>
                  </View>

                  {/* Timing or Note Details */}
                  {isPresent ? (
                    <View className="space-y-1 pt-1">
                      <View className="flex-row justify-between">
                        <Text className="text-[11px] font-semibold text-[#7A76A6]">Check In</Text>
                        <Text className="text-[11px] font-black text-[#1F1B3D]">{item.checkIn}</Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-[11px] font-semibold text-[#7A76A6]">Check Out</Text>
                        <Text className="text-[11px] font-black text-[#1F1B3D]">{item.checkOut}</Text>
                      </View>
                    </View>
                  ) : (
                    <View className="flex-row justify-between pt-1">
                      <Text className="text-[11px] font-semibold text-[#7A76A6]">
                        {item.note || "No punch recorded"}
                      </Text>
                      <Text className="text-[11px] font-black text-[#1F1B3D]">
                        {isOffDay ? "—" : "Approved"}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>

      </View>
    </ScreenContainer>
  );
}