import React, { useState, useMemo } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  useWindowDimensions 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bell, LogOut, ChevronRight, ArrowUpRight,
  Clock, Calendar as CalendarIcon, Fingerprint,
  User, Users, Cake, Scale, MessageSquare, Receipt,
  ShieldUser , ChevronLeft, AlertCircle, Sparkles,
  ShieldCheck, Mail, FileText, DollarSign
} from "lucide-react-native";
import { clearActiveSessionOnly } from "../utils/authStorage";
import { LinearGradient } from "expo-linear-gradient";

interface HomeScreenProps {
  navigation: any;
  userSession?: { empId: string; isAdmin: boolean };
  onLogout?: () => void;
}

export default function HomeScreen({ navigation, userSession, onLogout }: HomeScreenProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const isAdmin = userSession?.isAdmin ?? false;
  const empId = userSession?.empId || "EMP-1042";

  // Dynamic Real-Time Date Initialization
  const today = new Date();
  const [currentDate, setCurrentDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(today.getDate());

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Attendance Map for the month
  const attendanceStatusMap: Record<number, "present" | "absent" | "leave"> = {
    1: "present",
    2: "present", 
    8: "present",
    15: "absent", 
    18: "leave",
    22: "absent", 
    24: "present",
  };

  // Navigate Months
  const handlePrevMonth = () => {
    const prev = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(prev);
    setSelectedDayNumber(1);
  };

  const handleNextMonth = () => {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(next);
    setSelectedDayNumber(1);
  };

  // Generate 7-column calendar matrix
  const calendarCells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: { day: number; isCurrentMonth: boolean; dayOfWeek: number }[] = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        dayOfWeek: cells.length % 7,
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({
        day: i,
        isCurrentMonth: true,
        dayOfWeek: cells.length % 7,
      });
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        day: i,
        isCurrentMonth: false,
        dayOfWeek: cells.length % 7,
      });
    }

    return cells;
  }, [currentDate]);

  const handleLogoutPress = async () => {
    await clearActiveSessionOnly();
    if (onLogout) {
      onLogout();
    } else if (navigation?.replace) {
      navigation.replace("Login");
    } else if (navigation?.reset) {
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F4F6F9]" edges={["top"]}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
        className="flex-1"
      >
       {/* ========================================================================= */}
        {/* 1. PREMIUM HEADER / HERO SECTION                                          */}
        {/* ========================================================================= */}
          <LinearGradient
          colors={["#4F46E5", "#6366F1", "#818CF8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="px-6 md:px-10 relative overflow-hidden shadow-xl shadow-indigo-950/20"
          style={{ 
            paddingTop: 16, 
            paddingBottom: 90, 
            paddingLeft: 20, 
            paddingRight: 20,
            borderBottomLeftRadius: 22,
            borderBottomRightRadius: 22
          }}
        >
          {/* Background Decorative Shapes */}
          <View className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <View className="absolute bottom-0 left-10 w-44 h-44 rounded-full bg-indigo-900/20 blur-2xl pointer-events-none" />

          <View className="max-w-6xl mx-auto w-full">
            {/* Top Action Icons Row */}
            <View className="flex-row items-center justify-between" style={{ marginBottom: 8 }}>
              <TouchableOpacity 
                onPress={() => (isAdmin ? navigation.navigate("Approvals") : null)}
                className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 items-center justify-center relative active:opacity-80 shadow-sm"
              >
                <Bell size={20} color="#FFFFFF" />
                {isAdmin && (
                  <View className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-rose-400 border border-[#5B4FD1]" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogoutPress}
                className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 items-center justify-center active:opacity-80 shadow-sm"
              >
                <LogOut size={18} color="#FFD1D1" />
              </TouchableOpacity>
            </View>

            {/* Centered Profile Layout */}
            <View className="items-center justify-center" style={{ marginTop: 0, marginBottom: 16 }}>
              <View className="relative" style={{ marginBottom: 12 }}>
                <View className="w-24 h-24 rounded-full bg-indigo-900/40 border-2 border-white/60 items-center justify-center shadow-xl">
                  <Text className="text-3xl font-black text-white">
                    {isAdmin ? "A" : "MS"}
                  </Text>
                </View>
                <View className="absolute -inset-1 rounded-full border border-white/30 pointer-events-none" />
              </View>

              <Text className="text-xl md:text-2xl font-black text-white tracking-tight text-center">
                {isAdmin ? "Command Center" : "Marcus Sterling"}
              </Text>
              <Text className="text-xs font-bold text-purple-200 uppercase tracking-widest text-center" style={{ marginTop: 5 }}>
                {isAdmin ? "Admin Portal" : "Software Engineer"}
              </Text>
            </View>
          </View>
        </LinearGradient>
        {/* ========================================================================= */}
        {/* 2. MAIN CONTAINER BODY                                                    */}
        {/* ========================================================================= */}
        <View className="max-w-6xl mx-auto w-full px-5 md:px-10">
          
          {/* Today Attendance Floating Card (Recalibrated Overlap) */}
           <View 
            className="bg-white rounded-[18px] p-5 md:p-6 shadow-2xl shadow-slate-300/80 border border-slate-100/80 z-10"
            style={{ marginTop: -60, marginBottom: 40 }}
          >
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center gap-2.5">
                <View className="w-9 h-9 rounded-xl bg-[#EEECFA] items-center justify-center">
                  <Clock size={18} color="#5B4FD1" />
                </View>
                <Text className="text-sm md:text-base font-black text-[#1F1B3D]">Today Attendance Status</Text>
              </View>
              <View className="bg-[#EEECFA] px-3.5 py-1 rounded-full border border-[#5B4FD1]/10">
                <Text className="text-[10px] font-black text-[#5B4FD1] uppercase tracking-wider">
                  ID #{empId.replace(/[^0-9]/g, "") || "21474632"}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between items-stretch gap-2 pt-2">
              <View className="flex-1 bg-white border border-slate-200 rounded-2xl py-3 px-0.5 items-center justify-center shadow-sm">
                <Text className="text-sm md:text-xl font-black text-[#1F1B3D]" numberOfLines={1} adjustsFontSizeToFit>09:12 AM</Text>
                <Text className="text-[9px] font-bold text-[#7A76A6] mt-1 tracking-wide uppercase">
                  CHECK-IN
                </Text>
              </View>

              <View className="flex-1 bg-white border border-slate-200 rounded-2xl py-3 px-0.5 items-center justify-center shadow-sm">
                <Text className="text-sm md:text-xl font-black text-[#1F1B3D]" numberOfLines={1} adjustsFontSizeToFit>06:15 PM</Text>
                <Text className="text-[9px] font-bold text-[#7A76A6] mt-1 tracking-wide uppercase">
                  CHECK-OUT
                </Text>
              </View>

              <View className="flex-1 bg-emerald-50 border border-emerald-200/90 rounded-2xl py-3 px-0.5 items-center justify-center shadow-sm">
                <Text className="text-sm md:text-xl font-black text-emerald-700" numberOfLines={1} adjustsFontSizeToFit>09h 03m</Text>
                <Text className="text-[9px] font-bold text-emerald-800 mt-1 tracking-wide uppercase">
                  TOTAL HOURS
                </Text>
              </View>
            </View>
          </View>

          {/* ========================================================================= */}
          {/* 3. UNIFORMED PREMIUM 4-CARD SERVICE GRID                                  */}
          {/* ========================================================================= */}
          <View className="mb-10">
            <View className="flex-row justify-between items-center mb-3 px-1">
              <Text className="text-xs md:text-sm font-black text-[#1F1B3D] uppercase tracking-wider">
                Please Choose Services
              </Text>
            <Text className="text-xs font-black text-[#5B4FD1] uppercase tracking-widest font-sans">
  Quick Actions
</Text>
            </View>

            <View className="flex-row flex-wrap justify-between gap-3">
              
                           {/* Card 1: Requests */}
              <TouchableOpacity 
                onPress={() => navigation.navigate( "Approvals")}
                activeOpacity={0.85}
                className="overflow-hidden rounded-[22px] border border-emerald-100"
                style={{ 
                  minHeight: 150, 
                  width: isDesktop ? "23.5%" : "48%",
                  shadowColor: "#059669",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  elevation: 3
                }}
              >
                <LinearGradient
                  colors={["#FFFFFF", "#ECFDF5", "#D1FAE5"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="items-start justify-between relative rounded-[22px] overflow-hidden"
                  style={{ minHeight: 150, paddingTop: 16, paddingBottom: 16, paddingLeft: 16, paddingRight: 14 }}
                >
                  <View className="absolute -bottom-4 -right-3 items-center justify-center opacity-[0.14] pointer-events-none">
                    <Mail size={100} color="#059669" />
                  </View>
                  <View 
                    className="items-center justify-center pointer-events-none"
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#059669" }}
                  >
                    <Mail size={20} color="#FFFFFF" />
                  </View>
                  <View 
                    className="absolute bg-emerald-500/15 rounded-full border border-emerald-500/25" 
                    style={{ top: 14, right: 14, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 84 }}
                  >
                    <Text className="text-[9px] font-black text-emerald-700 uppercase tracking-wider text-center" numberOfLines={1}>
                      {isAdmin ? "04 Active" : "100"}
                    </Text>
                  </View>
                  <View className="z-10" style={{ marginTop: 20 }}>
                    <Text className="text-base font-black text-[#1F1B3D] tracking-wide">Requests</Text>
                    <Text className="text-[11px] font-semibold text-emerald-700/80" style={{ marginTop: 3 }}>
                      Manage requests
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Card 2: Leaves */}
              <TouchableOpacity 
                onPress={() => navigation.navigate("Apply", { tab: "leave" })}
                activeOpacity={0.85}
                className="overflow-hidden rounded-[22px] border border-rose-100"
                style={{ 
                  minHeight: 150, 
                  width: isDesktop ? "23.5%" : "48%",
                  shadowColor: "#E11D48",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  elevation: 3
                }}
              >
                <LinearGradient
                  colors={["#FFFFFF", "#FFF1F2", "#FFE4E6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="items-start justify-between relative rounded-[22px] overflow-hidden"
                  style={{ minHeight: 150, paddingTop: 16, paddingBottom: 16, paddingLeft: 16, paddingRight: 14 }}
                >
                  <View className="absolute -bottom-4 -right-3 items-center justify-center opacity-[0.14] pointer-events-none">
                    <CalendarIcon size={100} color="#E11D48" />
                  </View>
                  <View 
                    className="items-center justify-center pointer-events-none"
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#E11D48" }}
                  >
                    <CalendarIcon size={20} color="#FFFFFF" />
                  </View>
                  <View 
                    className="absolute bg-rose-500/15 rounded-full border border-rose-500/25" 
                    style={{ top: 14, right: 14, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 84 }}
                  >
                    <Text className="text-[9px] font-black text-rose-700 uppercase tracking-wider text-center" numberOfLines={1}>
                      12 Left
                    </Text>
                  </View>
                  <View className="z-10" style={{ marginTop: 20 }}>
                    <Text className="text-base font-black text-[#1F1B3D] tracking-wide">Leaves</Text>
                    <Text className="text-[11px] font-semibold text-rose-700/80" style={{ marginTop: 3 }}>
                      Apply & track
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Card 3: Pay Slip */}
              <TouchableOpacity 
                onPress={() => navigation.navigate("MyHub", { initialTab: "payslip" })}
                activeOpacity={0.85}
                className="overflow-hidden rounded-[22px] border border-amber-100"
                style={{ 
                  minHeight: 150, 
                  width: isDesktop ? "23.5%" : "48%",
                  shadowColor: "#D97706",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  elevation: 3
                }}
              >
                <LinearGradient
                  colors={["#FFFFFF", "#FFF7E6", "#FEF0CC"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="items-start justify-between relative rounded-[22px] overflow-hidden"
                  style={{ minHeight: 150, paddingTop: 16, paddingBottom: 16, paddingLeft: 16, paddingRight: 14 }}
                >
                  <View className="absolute -bottom-4 -right-3 items-center justify-center opacity-[0.14] pointer-events-none">
                    <DollarSign size={100} color="#D97706" />
                  </View>
                  <View 
                    className="items-center justify-center pointer-events-none"
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#D97706" }}
                  >
                    <DollarSign size={20} color="#FFFFFF" />
                  </View>
                  <View 
                    className="absolute bg-amber-500/15 rounded-full border border-amber-500/25" 
                    style={{ top: 14, right: 14, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 84 }}
                  >
                    <Text className="text-[9px] font-black text-amber-700 uppercase tracking-wider text-center" numberOfLines={1}>
                      Available
                    </Text>
                  </View>
                  <View className="z-10" style={{ marginTop: 20 }}>
                    <Text className="text-base font-black text-[#1F1B3D] tracking-wide">Pay Slip</Text>
                    <Text className="text-[11px] font-semibold text-amber-700/80" style={{ marginTop: 3 }}>
                      View & download
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Card 4: Punch Entry */}
              <TouchableOpacity 
                onPress={() => navigation.navigate("PunchClock")}
                activeOpacity={0.85}
                className="overflow-hidden rounded-[22px] border border-indigo-100"
                style={{ 
                  minHeight: 150, 
                  width: isDesktop ? "23.5%" : "48%",
                  shadowColor: "#5B4FD1",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  elevation: 3
                }}
              >
                <LinearGradient
                  colors={["#FFFFFF", "#F5F3FF", "#EDE9FE"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="items-start justify-between relative rounded-[22px] overflow-hidden"
                  style={{ minHeight: 150, paddingTop: 16, paddingBottom: 16, paddingLeft: 16, paddingRight: 14 }}
                >
                  <View className="absolute -bottom-4 -right-3 items-center justify-center opacity-[0.14] pointer-events-none">
                    <Fingerprint size={100} color="#5B4FD1" />
                  </View>
                  <View 
                    className="items-center justify-center pointer-events-none"
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#5B4FD1" }}
                  >
                    <Fingerprint size={20} color="#FFFFFF" />
                  </View>
                  <View 
                    className="absolute bg-indigo-500/15 rounded-full border border-indigo-500/25" 
                    style={{ top: 14, right: 14, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 84 }}
                  >
                    <Text className="text-[9px] font-black text-[#5B4FD1] uppercase tracking-wider text-center" numberOfLines={1}>
                      In-Office
                    </Text>
                  </View>
                  <View className="z-10" style={{ marginTop: 20 }}>
                    <Text className="text-base font-black text-[#1F1B3D] tracking-wide">Punch Entry</Text>
                    <Text className="text-[11px] font-semibold text-indigo-700/80" style={{ marginTop: 3 }}>
                      Time & attendance
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
{/* 🔒 ADMIN HUB CARD: Visible ONLY if the user is an Admin */}
{isAdmin && (
  <TouchableOpacity 
    onPress={() => navigation.navigate("AdminHub")}
    activeOpacity={0.85}
    className="overflow-hidden rounded-[22px] border border-indigo-200"
    style={{ 
      minHeight: 150, 
      width: isDesktop ? "23.5%" : "48%",
      shadowColor: "#5B4FD1",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 3
    }}
  >
    <LinearGradient
      colors={["#FFFFFF", "#F5F3FF", "#EDE9FE"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="items-start justify-between relative rounded-[22px] overflow-hidden"
      style={{ minHeight: 150, paddingTop: 16, paddingBottom: 16, paddingLeft: 16, paddingRight: 14 }}
    >
      {/* Background Watermark Icon (Identical positioning and opacity pattern) */}
      <View className="absolute -bottom-4 -right-3 items-center justify-center opacity-[0.14] pointer-events-none">
        <ShieldUser size={100} color="#5B4FD1" />
      </View>

      {/* Main Icon Badge */}
      <View 
        className="items-center justify-center pointer-events-none"
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#5B4FD1" }}
      >
        <ShieldUser size={20} color="#FFFFFF" />
      </View>

      {/* Top Right Status Badge ("RESTRICTED" or "SECURE") */}
      <View 
        className="absolute bg-indigo-500/15 rounded-full border border-indigo-500/25" 
        style={{ top: 14, right: 14, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 84 }}
      >
        <Text className="text-[9px] font-black text-[#5B4FD1] uppercase tracking-wider text-center" numberOfLines={1}>
          Secure
        </Text>
      </View>

      {/* Card Titles */}
      <View className="z-10" style={{ marginTop: 20 }}>
        <Text className="text-base font-black text-[#1F1B3D] tracking-wide">Admin Hub</Text>
        <Text className="text-[11px] font-semibold text-indigo-700/80" style={{ marginTop: 3 }}>
          Command Center
        </Text>
      </View>
    </LinearGradient>
  </TouchableOpacity>
)}
              

            </View>
          </View>

          {/* ========================================================================= */}
          {/* 4. MODERN SAAS ATTENDANCE CALENDAR MATRIX                                */}
          {/* ========================================================================= */}
          <View className="flex-row items-center justify-between px-1 mb-3">
            <View className="flex-row items-center gap-2">
              <CalendarIcon size={16} color="#5B4FD1" />
              <Text className="text-xs md:text-sm font-black text-[#1F1B3D] uppercase tracking-wider">
                Attendance Calendar View
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => navigation.navigate("Attendance")}
              className="flex-row items-center active:opacity-75"
            >
               <Text className="text-xs font-black text-[#5B4FD1] uppercase tracking-widest font-sans">Full Logs</Text>
              <ChevronRight size={14} color="#5B4FD1" />
            </TouchableOpacity>
          </View>

          <View className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden mb-10">
            
            {/* Header: Month Selector */}
            <View className="flex-row items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <View className="flex-row items-center gap-3">
                <Text className="text-base md:text-lg font-black text-[#1F1B3D]">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </Text>
                {currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear() && (
                  <View className="bg-emerald-100 px-3 py-0.5 rounded-full">
                    <Text className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">Live</Text>
                  </View>
                )}
              </View>

              <View className="flex-row items-center gap-1.5 bg-white border border-slate-200 rounded-2xl p-1 shadow-xs">
                <TouchableOpacity 
                  onPress={handlePrevMonth}
                  className="w-8 h-8 rounded-xl items-center justify-center active:bg-slate-100"
                >
                  <ChevronLeft size={16} color="#1F1B3D" />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleNextMonth}
                  className="w-8 h-8 rounded-xl items-center justify-center active:bg-slate-100"
                >
                  <ChevronRight size={16} color="#1F1B3D" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Day of the Week Header */}
            <View className="flex-row border-b border-slate-100 bg-slate-50/30 py-3">
              {dayLabels.map((label, idx) => {
                const isSun = idx === 0;
                return (
                  <View key={label} className="flex-1 items-center justify-center">
                    <Text className={`text-[11px] font-black tracking-wider ${isSun ? "text-rose-500" : "text-[#7A76A6]"}`}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Calendar Days Matrix */}
            <View className="flex-row flex-wrap p-3">
              {calendarCells.map((cell, index) => {
                const isSunday = cell.dayOfWeek === 0;

                const isRealToday = 
                  cell.isCurrentMonth &&
                  cell.day === today.getDate() &&
                  currentDate.getMonth() === today.getMonth() &&
                  currentDate.getFullYear() === today.getFullYear();

                const isSelected = cell.isCurrentMonth && selectedDayNumber === cell.day;
                const attendance = cell.isCurrentMonth ? attendanceStatusMap[cell.day] : undefined;
                const isAbsent = attendance === "absent";
                const isPresent = attendance === "present";
                const isLeave = attendance === "leave";

                return (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (cell.isCurrentMonth) {
                        setSelectedDayNumber(cell.day);
                      }
                    }}
                    style={{ width: "14.285%", height: 54 }}
                    className="p-1 items-center justify-center relative"
                  >
                    <View 
                      className={`w-10 h-10 rounded-2xl items-center justify-center transition-all ${
                        isSelected
                          ? "bg-[#5B4FD1] shadow-md shadow-purple-600/30"
                          : isAbsent
                          ? "bg-[#FDE9E8] border border-[#E4453C]/40"
                          : isRealToday
                          ? "bg-[#EEECFA] border border-[#5B4FD1]/40"
                          : "bg-transparent"
                      }`}
                    >
                      <Text
                        className={`text-xs md:text-sm font-black ${
                          isSelected
                            ? "text-white"
                            : isAbsent
                            ? "text-[#E4453C]"
                            : !cell.isCurrentMonth
                            ? "text-slate-300"
                            : isSunday
                            ? "text-rose-500"
                            : "text-[#1F1B3D]"
                        }`}
                      >
                        {cell.day}
                      </Text>

                      {/* Status Indicator Dots */}
                      {cell.isCurrentMonth && !isSelected && (
                        <View className="absolute bottom-1.5 flex-row gap-0.5 items-center">
                          {isPresent && <View className="w-1.5 h-1.5 rounded-full bg-[#1FAE5C]" />}
                          {isAbsent && <View className="w-1.5 h-1.5 rounded-full bg-[#E4453C]" />}
                          {isLeave && <View className="w-1.5 h-1.5 rounded-full bg-[#D08A0C]" />}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Attendance Legend Strip */}
            <View className="flex-row items-center justify-around px-4 py-3 border-t border-slate-100 bg-slate-50/40">
              <View className="flex-row items-center gap-2">
                <View className="w-2.5 h-2.5 rounded-full bg-[#1FAE5C]" />
                <Text className="text-[11px] font-bold text-[#7A76A6]">Present</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="w-2.5 h-2.5 rounded-full bg-[#E4453C]" />
                <Text className="text-[11px] font-bold text-[#E4453C]">Absent</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="w-2.5 h-2.5 rounded-full bg-[#D08A0C]" />
                <Text className="text-[11px] font-bold text-[#7A76A6]">Leave</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <Text className="text-[11px] font-bold text-[#7A76A6]">Weekend</Text>
              </View>
            </View>

            {/* Selected Day Status Footer */}
            <View className="p-4 bg-white border-t border-slate-100 flex-row justify-between items-center">
              <View className="flex-row items-center gap-2.5">
                <CalendarIcon size={16} color="#5B4FD1" />
                <Text className="text-xs md:text-sm font-bold text-[#1F1B3D]">
                  {monthNames[currentDate.getMonth()]} {selectedDayNumber}, {currentDate.getFullYear()}
                </Text>
                {selectedDayNumber === today.getDate() && (
                  <View className="bg-purple-100 px-2 py-0.5 rounded-md">
                    <Text className="text-[9px] font-black text-[#5B4FD1]">TODAY</Text>
                  </View>
                )}
              </View>

              {attendanceStatusMap[selectedDayNumber] === "absent" ? (
                <View className="bg-[#FDE9E8] border border-[#E4453C]/30 px-3 py-1 rounded-full flex-row items-center gap-1.5">
                  <AlertCircle size={12} color="#E4453C" />
                  <Text className="text-[10px] font-black text-[#E4453C] uppercase">
                    Absent • Unpaid
                  </Text>
                </View>
              ) : attendanceStatusMap[selectedDayNumber] === "leave" ? (
                <View className="bg-[#FEF2D9] border border-[#D08A0C]/30 px-3 py-1 rounded-full">
                  <Text className="text-[10px] font-black text-[#D08A0C] uppercase">
                    Approved Leave
                  </Text>
                </View>
              ) : (
                <View className="bg-[#E7FAEE] border border-[#1FAE5C]/30 px-3 py-1 rounded-full">
                  <Text className="text-[10px] font-black text-[#1FAE5C] uppercase">
                    Shift • 09:00 - 18:00
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ========================================================================= */}
          {/* 5. OTHER DETAILS & QUICK MODULES                                          */}
          {/* ========================================================================= */}
          <Text className="text-xs md:text-sm font-black text-[#1F1B3D] uppercase tracking-wider mb-3 px-1">
            Other Details & Quick Modules
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate("MyHub", { initialTab: "payslip" })}
            activeOpacity={0.85}
            className="bg-white rounded-3xl p-4 md:p-5 shadow-sm border border-slate-100 flex-row items-center justify-between mb-4"
          >
            <View className="flex-row items-center gap-4">
              <View className="w-12 h-12 rounded-2xl bg-[#EEECFA] items-center justify-center">
                <Receipt size={22} color="#5B4FD1" />
              </View>
              <View>
                <Text className="text-sm md:text-base font-black text-[#1F1B3D]">Salary & Pay Slip</Text>
                <Text className="text-xs font-semibold text-[#7A76A6] mt-0.5">Check-in · Pay Slip · Form 16</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#7A76A6" />
          </TouchableOpacity>

          {/* Quick Module Strip */}
          <View className="bg-white rounded-3xl p-4 md:p-5 shadow-sm border border-slate-100 flex-row justify-between items-center mb-8">
            <TouchableOpacity onPress={() => navigation.navigate("Profile")} className="items-center flex-1 py-1.5 active:opacity-75">
              <View className="w-11 h-11 rounded-2xl bg-[#EEECFA] items-center justify-center mb-1.5 mx-auto">
                <User size={20} color="#5B4FD1" />
              </View>
              <Text className="text-xs font-bold text-[#1F1B3D] text-center">{isAdmin ? "Admin Profile" : "Profile"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate( "Celebrations")} className="items-center flex-1 py-1.5 active:opacity-75">
              <View className="w-11 h-11 rounded-2xl bg-[#EEECFA] items-center justify-center mb-1.5 mx-auto">
                 <Cake size={20} color="#5B4FD1" />
              </View>
              <Text className="text-xs font-bold text-[#1F1B3D] text-center">
                { "Celebrations"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate( "HrPolicy" )} className="items-center flex-1 py-1.5 active:opacity-75">
              <View className="w-11 h-11 rounded-2xl bg-[#EEECFA] items-center justify-center mb-1.5 mx-auto">
                <Scale size={20} color="#5B4FD1" />
              </View>
              <Text className="text-xs font-bold text-[#1F1B3D] text-center">
                {isAdmin ? "Directory" : "Policy"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Chat")} className="items-center flex-1 py-1.5 active:opacity-75">
              <View className="w-11 h-11 rounded-2xl bg-[#EEECFA] items-center justify-center mb-1.5 mx-auto">
                <MessageSquare size={20} color="#5B4FD1" />
              </View>
              <Text className="text-xs font-bold text-[#1F1B3D] text-center">Chats</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}