import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Camera } from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";

interface AttendanceScreenProps {
  navigation: {
    navigate: (screen: string) => void;
  };
}

export default function AttendanceScreen({ navigation }: AttendanceScreenProps) {
  return (
    <ScreenContainer>
      {/* Title */}
      <View className="mb-4">
        <Text className="text-2xl font-black text-brand-dark tracking-tight">Attendance & Leave</Text>
        <Text className="text-xs font-semibold text-brand-muted mt-0.5">Live tracking & annual leave balances</Text>
      </View>

      {/* Geofence & Selfie Punch Launcher Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate("PunchClock")}
        className="bg-brand-hero px-4 py-3.5 rounded-2xl flex-row items-center justify-center mb-6 shadow-xs active:opacity-90 border border-brand-border"
      >
        <Camera size={18} color="#FFFFFF" />
        <Text className="text-white text-xs font-black uppercase tracking-wider ml-2">
          Open Geofence & Selfie Punch
        </Text>
      </TouchableOpacity>

      {/* Check-In / Check-Out Row */}
      <View className="flex-row space-x-4 mb-6">
        <View className="flex-1 bg-brand-card rounded-3xl p-5 shadow-xs border border-brand-border">
          <Text className="text-[10px] font-black text-brand-muted uppercase tracking-wider mb-2">Today's Check-In</Text>
          <Text className="text-xl font-black text-brand-dark mb-3">09:05 AM</Text>
          <View className="bg-emerald-50 self-start px-3 py-1 rounded-full flex-row items-center border border-emerald-100">
            <View className="w-2 h-2 rounded-full bg-brand-primary mr-1.5" />
            <Text className="text-[10px] font-black text-brand-primary">On Time</Text>
          </View>
        </View>

        <View className="flex-1 bg-brand-card rounded-3xl p-5 shadow-xs border border-brand-border">
          <Text className="text-[10px] font-black text-brand-muted uppercase tracking-wider mb-2">Today's Check-Out</Text>
          <Text className="text-xl font-black text-slate-300 mb-3">--:-- PM</Text>
          <View className="bg-slate-100 self-start px-3 py-1 rounded-full flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-slate-400 mr-1.5" />
            <Text className="text-[10px] font-black text-brand-muted">Pending</Text>
          </View>
        </View>
      </View>

      {/* Attendance Circular Breakdown */}
      <View className="flex-row items-center bg-brand-card/40 rounded-3xl p-5 mb-6 border border-brand-border">
        <View className="w-20 h-20 rounded-full border-8 border-brand-primary border-t-amber-500 border-r-rose-500 items-center justify-center mr-6 bg-brand-card shadow-xs">
          <Text className="text-base font-black text-brand-dark leading-none">88%</Text>
          <Text className="text-[9px] font-bold text-brand-muted mt-0.5">Present</Text>
        </View>
        <View className="space-y-2">
          <View className="flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-sm bg-brand-primary mr-2" />
            <Text className="text-xs font-bold text-brand-dark">Present (22 Days)</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-sm bg-amber-500 mr-2" />
            <Text className="text-xs font-bold text-brand-dark">Late/Half-day (2 Days)</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-sm bg-rose-500 mr-2" />
            <Text className="text-xs font-bold text-brand-dark">Absent/Unpaid (1 Day)</Text>
          </View>
        </View>
      </View>

      {/* Leave Balances */}
      <Text className="text-xs font-black text-brand-dark uppercase tracking-widest mb-3">Leave Balances</Text>
      <View className="flex-row space-x-3 mb-6">
        <View className="flex-1 bg-teal-50 border border-teal-200 rounded-2xl p-4">
          <Text className="text-xl font-black text-brand-dark">14/18</Text>
          <Text className="text-[10px] font-bold text-teal-800 mt-1">Earned Days</Text>
        </View>
        <View className="flex-1 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <Text className="text-xl font-black text-brand-dark">4/8</Text>
          <Text className="text-[10px] font-bold text-amber-800 mt-1">Casual Days</Text>
        </View>
        <View className="flex-1 bg-rose-50 border border-rose-200 rounded-2xl p-4">
          <Text className="text-xl font-black text-brand-dark">6/6</Text>
          <Text className="text-[10px] font-bold text-rose-800 mt-1">Sick Days</Text>
        </View>
      </View>

      {/* Attendance Heatmap Strip */}
      <Text className="text-xs font-black text-brand-dark uppercase tracking-widest mb-3">Attendance Heatmap (Jan)</Text>
      <View className="space-y-2 mb-8">
        <View className="flex-row justify-between">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
            <View key={i} className="w-10 h-10 bg-brand-hero rounded-xl items-center justify-center shadow-xs">
              <Text className="text-white text-xs font-black">{day}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row justify-between">
          <View className="w-10 h-10 bg-brand-primary rounded-xl" />
          <View className="w-10 h-10 bg-brand-primary rounded-xl" />
          <View className="w-10 h-10 bg-brand-primary rounded-xl" />
          <View className="w-10 h-10 bg-amber-500 rounded-xl" />
          <View className="w-10 h-10 bg-brand-primary rounded-xl" />
          <View className="w-10 h-10 bg-brand-card/70 rounded-xl" />
          <View className="w-10 h-10 bg-brand-card/70 rounded-xl" />
        </View>
      </View>
    </ScreenContainer>
  );
}