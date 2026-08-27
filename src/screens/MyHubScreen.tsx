import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { 
  ArrowLeft, Mail, Calendar, Briefcase, 
  ShieldCheck, Building, Award, Download, 
  ChevronRight, UserCheck, CreditCard
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";

interface MyHubScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string) => void;
  };
  route?: {
    params?: {
      initialTab?: "profile" | "payslip";
    };
  };
}

export default function MyHubScreen({ navigation, route }: MyHubScreenProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "payslip">(
    route?.params?.initialTab || "profile"
  );

  const userProfile = {
    name: "Marcus Vance Sterling",
    empId: "EMP-1042",
    designation: "Principal Software Lead",
    department: "Core Platform & Infrastructure",
    officialEmail: "marcus.sterling@paycore.io",
    dob: "14 Aug 1994",
    doj: "15 Mar 2024",
    workLocation: "Bangalore HQ • Tech Park",
    employmentType: "Full-Time Regular",
    reportingManager: "Sarah Jenkins (Director of Eng)",
    bloodGroup: "O +ve",
  };

  return (
    <ScreenContainer>
      {/* Top Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            className="w-10 h-10 bg-brand-card border border-brand-border rounded-xl items-center justify-center mr-3 shadow-xs"
          >
            <ArrowLeft size={18} color="#0F172A" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-black text-brand-dark tracking-tight">My Hub</Text>
            <Text className="text-xs font-bold text-brand-muted">Profile records & monthly compensation</Text>
          </View>
        </View>

        <View className="bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-xl flex-row items-center">
          <ShieldCheck size={14} color="#065F46" />
          <Text className="text-[10px] font-black text-emerald-900 ml-1">ACTIVE</Text>
        </View>
      </View>

      {/* Two Tab Switcher */}
      <View className="flex-row bg-brand-hero/10 p-1 rounded-2xl mb-6 border border-brand-border">
        <TouchableOpacity
          onPress={() => setActiveTab("profile")}
          className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${
            activeTab === "profile" ? "bg-brand-hero shadow-xs" : ""
          }`}
        >
          <UserCheck size={14} color={activeTab === "profile" ? "#FFFFFF" : "#0F172A"} />
          <Text
            className={`text-xs font-black ml-1.5 ${
              activeTab === "profile" ? "text-white" : "text-brand-dark"
            }`}
          >
            Profile Info
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("payslip")}
          className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${
            activeTab === "payslip" ? "bg-brand-hero shadow-xs" : ""
          }`}
        >
          <CreditCard size={14} color={activeTab === "payslip" ? "#FFFFFF" : "#0F172A"} />
          <Text
            className={`text-xs font-black ml-1.5 ${
              activeTab === "payslip" ? "text-white" : "text-brand-dark"
            }`}
          >
            Payslip Breakdown
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* 1. PROFILE VIEW                                                           */}
      {/* ========================================================================= */}
      {activeTab === "profile" && (
        <View className="space-y-5 mb-8">
          {/* Hero Identity Card */}
          <View className="bg-brand-hero border border-brand-hero rounded-3xl p-6 shadow-sm items-center">
            <View className="relative mb-3">
              <Image 
                source={{ uri: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop" }}
                className="w-24 h-24 rounded-full border-4 border-brand-border"
              />
              <View className="absolute bottom-0 right-0 bg-brand-primary p-1.5 rounded-full border-2 border-brand-hero">
                <Award size={14} color="#FFFFFF" />
              </View>
            </View>

            <Text className="text-xl font-black text-white">{userProfile.name}</Text>
            <Text className="text-xs font-bold text-brand-canvas mt-0.5">{userProfile.designation}</Text>
            
            <View className="flex-row items-center space-x-2 mt-3">
              <View className="bg-white/10 px-3 py-1 rounded-full border border-white/15">
                <Text className="text-[11px] font-black text-white">{userProfile.empId}</Text>
              </View>
              <View className="bg-brand-primary/30 px-3 py-1 rounded-full border border-brand-primary/40">
                <Text className="text-[11px] font-bold text-teal-200">{userProfile.department}</Text>
              </View>
            </View>
          </View>

          {/* Official Records Block */}
          <Text className="text-xs font-black text-brand-dark uppercase tracking-widest">
            Official Records
          </Text>
          <View className="bg-brand-card border border-brand-border rounded-3xl p-5 shadow-xs divide-y divide-slate-100">
            {/* Official Email */}
            <View className="py-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 items-center justify-center mr-3">
                  <Mail size={16} color="#0D9488" />
                </View>
                <View>
                  <Text className="text-[10px] font-bold text-brand-muted uppercase">Official Email</Text>
                  <Text className="text-xs font-black text-brand-dark mt-0.5">{userProfile.officialEmail}</Text>
                </View>
              </View>
            </View>

            {/* Date of Joining (DOJ) */}
            <View className="py-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 items-center justify-center mr-3">
                  <Briefcase size={16} color="#D97706" />
                </View>
                <View>
                  <Text className="text-[10px] font-bold text-brand-muted uppercase">Date of Joining (DOJ)</Text>
                  <Text className="text-xs font-black text-brand-dark mt-0.5">{userProfile.doj}</Text>
                </View>
              </View>
              <View className="bg-amber-100 px-2.5 py-0.5 rounded-md">
                <Text className="text-[10px] font-black text-amber-900">2+ Yrs Tenured</Text>
              </View>
            </View>

            {/* Date of Birth (DOB) */}
            <View className="py-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 items-center justify-center mr-3">
                  <Calendar size={16} color="#7E22CE" />
                </View>
                <View>
                  <Text className="text-[10px] font-bold text-brand-muted uppercase">Date of Birth (DOB)</Text>
                  <Text className="text-xs font-black text-brand-dark mt-0.5">{userProfile.dob}</Text>
                </View>
              </View>
            </View>

            {/* Designation */}
            <View className="py-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3">
                  <Building size={16} color="#0284C7" />
                </View>
                <View>
                  <Text className="text-[10px] font-bold text-brand-muted uppercase">Designation</Text>
                  <Text className="text-xs font-black text-brand-dark mt-0.5">{userProfile.designation}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Organization & Location Meta */}
          <Text className="text-xs font-black text-brand-dark uppercase tracking-widest">
            Organization & Location
          </Text>
          <View className="bg-brand-card border border-brand-border rounded-3xl p-5 shadow-xs divide-y divide-slate-100">
            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-brand-muted">Employment Type</Text>
              <Text className="text-xs font-black text-brand-dark">{userProfile.employmentType}</Text>
            </View>
            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-brand-muted">Reporting Manager</Text>
              <Text className="text-xs font-black text-brand-dark">{userProfile.reportingManager}</Text>
            </View>
            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-brand-muted">Work Base</Text>
              <Text className="text-xs font-black text-brand-dark">{userProfile.workLocation}</Text>
            </View>
            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-brand-muted">Blood Group</Text>
              <Text className="text-xs font-black text-rose-600">{userProfile.bloodGroup}</Text>
            </View>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 2. PAYSLIP VIEW                                                           */}
      {/* ========================================================================= */}
      {activeTab === "payslip" && (
        <View className="space-y-5 mb-8">
          {/* Download Action Banner */}
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-black text-brand-dark">Latest Salary Statement</Text>
              <Text className="text-xs font-bold text-brand-muted">December 2025 • Disbursed Dec 28</Text>
            </View>
            <TouchableOpacity className="flex-row items-center bg-brand-hero px-4 py-2 rounded-xl active:opacity-90 shadow-xs">
              <Download size={14} color="#FFFFFF" />
              <Text className="text-white font-black text-xs ml-1.5">Download PDF</Text>
            </TouchableOpacity>
          </View>

          {/* Take-Home Net Pay Hero Banner */}
          <View className="bg-brand-hero border border-brand-hero rounded-3xl p-6 shadow-sm">
            <Text className="text-xs font-black text-slate-300 uppercase tracking-widest">
              Take-Home Net Salary
            </Text>
            <Text className="text-3xl font-black text-brand-canvas mt-1">$5,420.00</Text>
            <View className="flex-row justify-between pt-3 mt-3 border-t border-white/10">
              <Text className="text-xs font-medium text-slate-300">
                Gross: <Text className="font-bold text-white">$6,500.00</Text>
              </Text>
              <Text className="text-xs font-medium text-rose-300">
                Deductions: <Text className="font-bold text-rose-300">-$1,080.00</Text>
              </Text>
            </View>
          </View>

          {/* Earnings Breakdown */}
          <Text className="text-xs font-black text-brand-dark uppercase tracking-widest">
            Earnings & Allowances
          </Text>
          <View className="bg-brand-card border border-brand-border rounded-3xl p-5 shadow-xs divide-y divide-slate-100">
            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-brand-muted">Basic Salary</Text>
              <Text className="text-xs font-black text-brand-dark">$4,200.00</Text>
            </View>
            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-brand-muted">House Rent Allowance (HRA)</Text>
              <Text className="text-xs font-black text-brand-dark">$1,400.00</Text>
            </View>
            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-brand-muted">Special Allowance</Text>
              <Text className="text-xs font-black text-brand-dark">$650.00</Text>
            </View>
            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-brand-muted">Performance Bonus</Text>
              <Text className="text-xs font-black text-brand-primary">+$250.00</Text>
            </View>
          </View>

          {/* Deductions Breakdown */}
          <Text className="text-xs font-black text-brand-dark uppercase tracking-widest">
            Tax & Statutory Deductions
          </Text>
          <View className="bg-brand-card border border-brand-border rounded-3xl p-5 shadow-xs divide-y divide-slate-100">
            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-brand-muted">Income Tax (TDS)</Text>
              <Text className="text-xs font-black text-rose-600">-$620.00</Text>
            </View>
            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-brand-muted">Provident Fund (PF)</Text>
              <Text className="text-xs font-black text-rose-600">-$380.00</Text>
            </View>
            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-brand-muted">Health Insurance</Text>
              <Text className="text-xs font-black text-rose-600">-$80.00</Text>
            </View>
          </View>

          {/* Tax Declaration Summary */}
          <View className="bg-brand-card border border-brand-border rounded-3xl p-5 flex-row items-center justify-between shadow-xs">
            <View className="flex-row items-center">
              <ShieldCheck size={22} color="#0D9488" />
              <View className="ml-3">
                <Text className="text-xs font-black text-brand-dark">Annual Tax Statement (Form 16 / W-2)</Text>
                <Text className="text-[11px] font-semibold text-brand-muted">Total YTD Tax Withheld: $7,440.00</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#0F172A" />
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}