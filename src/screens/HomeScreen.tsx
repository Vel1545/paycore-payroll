import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { 
  Bell, Eye, EyeOff, User, Users, PartyPopper, Scale, 
  Calendar, Receipt, Clock, HelpCircle, ChevronRight, LogOut, 
  MessageSquare 
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";
import { clearActiveSessionOnly } from "../utils/authStorage";

interface HomeScreenProps {
  navigation: any;
  userSession?: { empId: string; isAdmin: boolean };
  onLogout?: () => void;
}

export default function HomeScreen({ navigation, userSession, onLogout }: HomeScreenProps) {
  const [showSalary, setShowSalary] = useState(false);

  const isAdmin = userSession?.isAdmin ?? false;
  const empId = userSession?.empId || "EMP-1042";

  const handleLogoutPress = async () => {
    // 1. Clears active session token while keeping device binding intact
    await clearActiveSessionOnly();

    // 2. Trigger parent navigation reset
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
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-5">
        <View>
          <Text className="text-3xl font-black text-brand-dark tracking-tight">
            {isAdmin ? "Admin Console" : "Hello, Marcus"}
          </Text>
          <Text className="text-xs font-bold text-brand-muted mt-0.5">
            {empId} • {isAdmin ? "System Administrator" : "Engineering Dept."}
          </Text>
        </View>

        <View className="flex-row items-center space-x-2">
          {/* Role Badge */}
          <View className={`px-3 py-1.5 rounded-xl border ${isAdmin ? "bg-brand-hero border-brand-hero" : "bg-teal-700 border-teal-800"}`}>
            <Text className="text-white font-black text-[10px] uppercase tracking-wider">
              {isAdmin ? "Admin" : "Employee"}
            </Text>
          </View>

          {/* Logout Button */}
          <TouchableOpacity 
            onPress={handleLogoutPress}
            className="w-10 h-10 bg-brand-card border border-brand-border rounded-xl items-center justify-center shadow-xs active:opacity-80"
          >
            <LogOut size={16} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Admin Notice or Regular Holiday Banner */}
      {isAdmin ? (
        <TouchableOpacity 
          onPress={() => navigation.navigate("AdminHub")} 
          className="flex-row items-center bg-brand-card border border-brand-border rounded-2xl p-4 mb-5 shadow-xs"
        >
          <View className="w-9 h-9 bg-amber-50 rounded-xl items-center justify-center mr-3">
            <Bell size={18} color="#D97706" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black text-brand-dark">4 Pending Employee Requests</Text>
            <Text className="text-[11px] font-semibold text-brand-muted">Review leave, claim, and advance queues.</Text>
          </View>
          <ChevronRight size={18} color="#0F172A" />
        </TouchableOpacity>
      ) : (
        <View className="flex-row items-center bg-brand-card border border-brand-border rounded-2xl p-4 mb-5 shadow-xs">
          <View className="w-9 h-9 bg-teal-50 rounded-xl items-center justify-center mr-3">
            <Calendar size={18} color="#0D9488" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black text-brand-dark">Upcoming Company Holiday</Text>
            <Text className="text-[11px] font-semibold text-brand-muted">Aug 28 • Company Foundation Day</Text>
          </View>
        </View>
      )}

      {/* Hero Card */}
      <View className="bg-brand-hero border border-brand-hero rounded-3xl p-5 mb-6 shadow-md">
        <View className="flex-row items-center">
          <View className="w-14 h-14 bg-brand-primary rounded-2xl items-center justify-center mr-4">
            <Text className="text-white font-black text-xl leading-none">06</Text>
            <Text className="text-teal-100 text-[9px] uppercase font-black tracking-widest mt-0.5">Days</Text>
          </View>
          <View className="flex-1">
            <Text className="text-white font-black text-base">
              {isAdmin ? "Company Payroll Lock Window" : "Next Payroll Release"}
            </Text>
            <Text className="text-slate-300 text-xs font-medium">Aug 31, 2026 • Monthly Cycle</Text>
            
            <View className="flex-row items-center mt-3">
              <Text className="text-xs text-brand-canvas font-bold mr-2">
                {isAdmin ? "Total Disbursal:" : "Est. Net Pay:"}{" "}
                <Text className="text-white font-black">
                  {showSalary ? (isAdmin ? "$1,420,500.00" : "$5,420.00") : "••••••••"}
                </Text>
              </Text>
              <TouchableOpacity onPress={() => setShowSalary(!showSalary)}>
                {showSalary ? <EyeOff size={15} color="#F6CDA0" /> : <Eye size={15} color="#F6CDA0" />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* System Modules Grid */}
      <Text className="text-xs font-black text-brand-dark uppercase tracking-widest mb-3">System Modules</Text>
      <View className="flex-row flex-wrap justify-between mb-5">
        <TouchableOpacity 
          onPress={() => navigation.navigate("MyHub")} 
          className="w-[48%] bg-brand-card border border-brand-border rounded-2xl p-4 items-center mb-3.5 shadow-xs active:opacity-90"
        >
          <View className="w-11 h-11 bg-teal-50 border border-teal-200 rounded-xl items-center justify-center mb-2">
            <User size={20} color="#0D9488" />
          </View>
          <Text className="font-black text-xs text-brand-dark">My Hub</Text>
          <Text className="text-[11px] font-semibold text-brand-muted">Profile & Payslips</Text>
        </TouchableOpacity>

        {isAdmin && (
          <TouchableOpacity onPress={() => navigation.navigate("AdminHub")} className="w-[48%] bg-brand-card border border-brand-border rounded-2xl p-4 items-center mb-3.5 shadow-xs">
            <View className="w-11 h-11 bg-amber-50 border border-amber-200 rounded-xl items-center justify-center mb-2">
              <Users size={20} color="#D97706" />
            </View>
            <Text className="font-black text-xs text-brand-dark">Team Hub</Text>
            <Text className="text-[11px] font-semibold text-brand-muted">Analytics & Master</Text>
          </TouchableOpacity>
        )}

        {isAdmin ? (
          <TouchableOpacity onPress={() => navigation.navigate("UserDirectory")} className="w-[48%] bg-brand-card border border-brand-border rounded-2xl p-4 items-center shadow-xs mb-3.5">
            <View className="w-11 h-11 bg-purple-50 border border-purple-200 rounded-xl items-center justify-center mb-2">
              <Users size={20} color="#7E22CE" />
            </View>
            <Text className="font-black text-xs text-brand-dark">Staff Directory</Text>
            <Text className="text-[11px] font-semibold text-brand-muted">Table & Filters</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => navigation.navigate("Celebrations")} className="w-[48%] bg-brand-card border border-brand-border rounded-2xl p-4 items-center shadow-xs">
            <View className="w-11 h-11 bg-purple-50 border border-purple-200 rounded-xl items-center justify-center mb-2">
              <PartyPopper size={20} color="#7E22CE" />
            </View>
            <Text className="font-black text-xs text-brand-dark">Celebrations</Text>
            <Text className="text-[11px] font-semibold text-brand-muted">Birthdays & Kudos</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          onPress={() => navigation.navigate(isAdmin ? "AdminReports" : "Payslips")} 
          className="w-[48%] bg-brand-card border border-brand-border rounded-2xl p-4 items-center shadow-xs"
        >
          <View className="w-11 h-11 bg-sky-50 border border-sky-200 rounded-xl items-center justify-center mb-2">
            <Scale size={20} color="#0284C7" />
          </View>
          <Text className="font-black text-xs text-brand-dark">
            {isAdmin ? "Reports & Rules" : "Tax & Policies"}
          </Text>
          <Text className="text-[11px] font-semibold text-brand-muted">
            {isAdmin ? "Exports & Deductions" : "80C & Benefits"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Shortcuts */}
      <Text className="text-xs font-black text-brand-dark uppercase tracking-widest mb-3">Quick Shortcuts</Text>
      <View className="flex-row justify-between bg-brand-card border border-brand-border rounded-2xl p-3 mb-8 shadow-xs">
        <TouchableOpacity onPress={() => navigation.navigate("Apply", { tab: "leave" })} className="items-center flex-1">
          <Calendar size={18} color="#0F172A" />
          <Text className="text-[11px] font-black text-brand-dark mt-1">Leave</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Apply", { tab: "expense" })} className="items-center flex-1">
          <Receipt size={18} color="#0F172A" />
          <Text className="text-[11px] font-black text-brand-dark mt-1">Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Apply", { tab: "overtime" })} className="items-center flex-1">
          <Clock size={18} color="#0F172A" />
          <Text className="text-[11px] font-black text-brand-dark mt-1">Overtime</Text>
        </TouchableOpacity>
        <TouchableOpacity className="items-center flex-1">
          <HelpCircle size={18} color="#0F172A" />
          <Text className="text-[11px] font-black text-brand-dark mt-1">Support</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Chat")} className="items-center flex-1">
          <MessageSquare size={18} color="#0D9488" />
          <Text className="text-[11px] font-black text-brand-dark mt-1">Team Chat</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}