import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { Platform } from "react-native";
import { 
  ArrowLeft, Mail, Calendar, Briefcase, 
  ShieldCheck, Building, Award, Download, 
  ChevronRight, UserCheck, CreditCard
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

interface MyHubScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: any) => void;
  };
  route?: {
    params?: {
      initialTab?: "profile" | "payslip" | "requests";
    };
  };
}

export default function MyHubScreen({ navigation, route }: MyHubScreenProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "payslip">(
    route?.params?.initialTab === "payslip" ? "payslip" : "profile"
  );

  const { user } = useAuth();
  const currentUserId = user?.empId || user?.userId || "EMP-1042";

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

  const handleDownloadPdf = async (empId: string, monthYear: string = "January 2026") => {
  try {
    // Construct the endpoint URL matching your backend workflow API route
    const downloadUrl = `http://192.168.31.133:8080/api/admin/workflow/users/${empId}/payslip/download?month=${encodeURIComponent(monthYear)}`;

    if (Platform.OS === "web") {
      // 🌐 Web Strategy: Open the download link directly in a new tab or trigger a blob download
      window.open(downloadUrl, "_blank");
    } else {
      // 📱 Mobile Native Strategy: Use fetch to pull the file or open it via Linking/Sharing
      // For web-first / simple setups, you can also use:
      // Linking.openURL(downloadUrl);
      
      console.log("Downloading PDF for mobile from:", downloadUrl);
      // Add advanced native file-system downloading here if required
    }
  } catch (error) {
    console.error("Failed to download PDF payslip:", error);
    if (Platform.OS === "web") {
      window.alert("Could not download payslip PDF.");
    }
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
        {/* 1. PREMIUM HEADER / HERO SECTION (Guaranteed Spacing via Inline Styles)    */}
        {/* ========================================================================= */}
        <LinearGradient
          colors={["#4F46E5", "#6366F1", "#818CF8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: 40, paddingBottom: 80, paddingHorizontal: 24 }}
          className="relative overflow-hidden shadow-xl shadow-indigo-950/20 rounded-b-[32px]"
        >
          {/* Decorative Background Glows */}
          <View className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <View className="absolute bottom-0 left-10 w-44 h-44 rounded-full bg-indigo-900/20 blur-2xl pointer-events-none" />

          <View className="max-w-6xl mx-auto w-full">
            {/* Header Navigation & Status Badge */}
            <View className="flex-row items-center justify-between mb-6">
              <TouchableOpacity 
                onPress={() => navigation.goBack()}
                style={{ width: 44, height: 44 }}
                className="bg-white/15 border border-white/25 rounded-2xl items-center justify-center active:opacity-80 shadow-xs"
              >
                <ArrowLeft size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <View className="bg-emerald-500/20 border border-emerald-400/30 px-3.5 py-1.5 rounded-full flex-row items-center gap-1.5">
                <ShieldCheck size={13} color="#34D399" />
                <Text className="text-[10px] font-black text-emerald-200 uppercase tracking-wider">ACTIVE</Text>
              </View>
            </View>

            {/* Title & Subtitle with guaranteed safe clearance */}
            <View className="mt-2">
              <Text className="text-2xl md:text-3xl font-black text-white tracking-tight">My Hub</Text>
              <Text className="text-xs font-bold text-purple-200 mt-1 uppercase tracking-wider">
                Profile records & monthly compensation
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ========================================================================= */}
        {/* 2. MAIN CONTAINER BODY                                                    */}
        {/* ========================================================================= */}
        <View className="max-w-6xl mx-auto w-full px-5 md:px-10 -mt-6">

          {/* Two Tab Switcher */}
          <View className="flex-row bg-white p-1.5 rounded-2xl mb-6 border border-slate-100 shadow-xl shadow-slate-200/50 z-10">
            <TouchableOpacity
              onPress={() => setActiveTab("profile")}
              className={`flex-1 h-14 rounded-xl items-center flex-row justify-center px-2 ${
                activeTab === "profile" ? "bg-[#5B4FD1] shadow-md shadow-purple-600/30" : "bg-transparent"
              }`}
            >
              <UserCheck size={16} color={activeTab === "profile" ? "#FFFFFF" : "#7A76A6"} />
              <Text
                className={`text-xs font-black ml-2 uppercase tracking-wider ${
                  activeTab === "profile" ? "text-white" : "text-[#7A76A6]"
                }`}
                numberOfLines={1}
              >
                Profile Info
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("payslip")}
              className={`flex-1 h-14 rounded-xl items-center flex-row justify-center px-2 ${
                activeTab === "payslip" ? "bg-[#5B4FD1] shadow-md shadow-purple-600/30" : "bg-transparent"
              }`}
            >
              <CreditCard size={16} color={activeTab === "payslip" ? "#FFFFFF" : "#7A76A6"} />
              <Text
                className={`text-xs font-black ml-2 uppercase tracking-wider ${
                  activeTab === "payslip" ? "text-white" : "text-[#7A76A6]"
                }`}
                numberOfLines={1}
              >
                Payslip Breakdown
              </Text>
            </TouchableOpacity>
          </View>

          {/* ========================================================================= */}
          {/* 3. PROFILE VIEW                                                           */}
          {/* ========================================================================= */}
          {activeTab === "profile" && (
            <View className="gap-y-6 mb-10">
              <View className="bg-white border border-slate-100 rounded-[28px] p-6 shadow-xl shadow-slate-200/50 items-center relative overflow-hidden">
                <View className="absolute top-0 left-0 right-0 h-20 bg-indigo-50/50 pointer-events-none" />
                
                <View className="relative mb-3 mt-2">
                  <Image 
                    source={{ uri: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop" }}
                    className="w-24 h-24 rounded-full border-4 border-white shadow-md"
                  />
                  <View className="absolute bottom-0 right-0 bg-[#5B4FD1] p-1.5 rounded-full border-2 border-white shadow-xs">
                    <Award size={14} color="#FFFFFF" />
                  </View>
                </View>

                <Text className="text-xl font-black text-[#1F1B3D] text-center">{userProfile.name}</Text>
                <Text className="text-xs font-bold text-[#7A76A6] mt-0.5 text-center">{userProfile.designation}</Text>
                
                <View className="flex-row items-center gap-2 mt-4 flex-wrap justify-center">
                  <View className="bg-[#EEECFA] px-3.5 py-1 rounded-full border border-[#5B4FD1]/10">
                    <Text className="text-[10px] font-black text-[#5B4FD1] uppercase tracking-wider">{userProfile.empId}</Text>
                  </View>
                  <View className="bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200/80">
                    <Text className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">{userProfile.department}</Text>
                  </View>
                </View>
              </View>

              <View>
                <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-widest mb-3 px-1">
                  Official Records
                </Text>
                <View className="bg-white border border-slate-100 rounded-[28px] p-5 shadow-xl shadow-slate-200/50 divide-y divide-slate-100">
                  <View className="py-3.5 flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 pr-2">
                      <View className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 items-center justify-center mr-3.5 shrink-0">
                        <Mail size={18} color="#0D9488" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Official Email</Text>
                        <Text className="text-xs md:text-sm font-black text-[#1F1B3D] mt-0.5" numberOfLines={1}>{userProfile.officialEmail}</Text>
                      </View>
                    </View>
                  </View>

                  <View className="py-3.5 flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 pr-2">
                      <View className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 items-center justify-center mr-3.5 shrink-0">
                        <Briefcase size={18} color="#D97706" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Date of Joining (DOJ)</Text>
                        <Text className="text-xs md:text-sm font-black text-[#1F1B3D] mt-0.5">{userProfile.doj}</Text>
                      </View>
                    </View>
                    <View className="bg-amber-100/70 border border-amber-200 px-3 py-1 rounded-full shrink-0">
                      <Text className="text-[10px] font-black text-amber-900 uppercase tracking-wider">2+ Yrs Tenured</Text>
                    </View>
                  </View>

                  <View className="py-3.5 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 items-center justify-center mr-3.5 shrink-0">
                        <Calendar size={18} color="#7E22CE" />
                      </View>
                      <View>
                        <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Date of Birth (DOB)</Text>
                        <Text className="text-xs md:text-sm font-black text-[#1F1B3D] mt-0.5">{userProfile.dob}</Text>
                      </View>
                    </View>
                  </View>

                  <View className="py-3.5 flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 pr-2">
                      <View className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 items-center justify-center mr-3.5 shrink-0">
                        <Building size={18} color="#0284C7" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Designation</Text>
                        <Text className="text-xs md:text-sm font-black text-[#1F1B3D] mt-0.5" numberOfLines={1}>{userProfile.designation}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              <View>
                <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-widest mb-3 px-1">
                  Organization & Location
                </Text>
                <View className="bg-white border border-slate-100 rounded-[28px] p-5 shadow-xl shadow-slate-200/50 divide-y divide-slate-100">
                  <View className="py-3 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">Employment Type</Text>
                    <Text className="text-xs font-black text-[#1F1B3D]">{userProfile.employmentType}</Text>
                  </View>
                  <View className="py-3 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">Reporting Manager</Text>
                    <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>{userProfile.reportingManager}</Text>
                  </View>
                  <View className="py-3 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">Work Base</Text>
                    <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>{userProfile.workLocation}</Text>
                  </View>
                  <View className="py-3 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">Blood Group</Text>
                    <Text className="text-xs font-black text-rose-600">{userProfile.bloodGroup}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* 4. PAYSLIP VIEW                                                           */}
          {/* ========================================================================= */}
          {activeTab === "payslip" && (
            <View className="gap-y-6 mb-10">
              <View className="flex-row items-center justify-between bg-white border border-slate-100 rounded-3xl p-5 shadow-xl shadow-slate-200/50">
                <View>
                  <Text className="text-sm font-black text-[#1F1B3D]">Latest Salary Statement</Text>
                  <Text className="text-xs font-bold text-[#7A76A6] mt-0.5">December 2025 • Disbursed Dec 28</Text>
                </View>
               <TouchableOpacity 
  activeOpacity={0.85} 
  onPress={() => handleDownloadPdf(String(currentUserId), "January 2026")}
  className="flex-row items-center bg-[#5B4FD1] px-4 py-2.5 rounded-2xl shadow-md shadow-indigo-500/20"
>
  <Download size={14} color="#FFFFFF" />
  <Text className="text-white font-black text-xs ml-1.5 uppercase tracking-wider">PDF</Text>
</TouchableOpacity>
              </View>

              <View className="bg-[#5B4FD1] border border-indigo-600 rounded-[28px] p-6 shadow-xl shadow-indigo-950/20 relative overflow-hidden">
                <View className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
                <Text className="text-[10px] font-black text-purple-200 uppercase tracking-widest">
                  Take-Home Net Salary
                </Text>
                <Text className="text-3xl md:text-4xl font-black text-white mt-1">$5,420.00</Text>
                <View className="flex-row justify-between pt-4 mt-4 border-t border-white/15">
                  <Text className="text-xs font-semibold text-purple-200">
                    Gross: <Text className="font-black text-white">$6,500.00</Text>
                  </Text>
                  <Text className="text-xs font-semibold text-rose-200">
                    Deductions: <Text className="font-black text-rose-200">-$1,080.00</Text>
                  </Text>
                </View>
              </View>

              <View>
                <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-widest mb-3 px-1">
                  Earnings & Allowances
                </Text>
                <View className="bg-white border border-slate-100 rounded-[28px] p-5 shadow-xl shadow-slate-200/50 divide-y divide-slate-100">
                  <View className="py-3.5 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">Basic Salary</Text>
                    <Text className="text-xs md:text-sm font-black text-[#1F1B3D]">$4,200.00</Text>
                  </View>
                  <View className="py-3.5 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">House Rent Allowance (HRA)</Text>
                    <Text className="text-xs md:text-sm font-black text-[#1F1B3D]">$1,400.00</Text>
                  </View>
                  <View className="py-3.5 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">Special Allowance</Text>
                    <Text className="text-xs md:text-sm font-black text-[#1F1B3D]">$650.00</Text>
                  </View>
                  <View className="py-3.5 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">Performance Bonus</Text>
                    <Text className="text-xs md:text-sm font-black text-emerald-600">+$250.00</Text>
                  </View>
                </View>
              </View>

              <View>
                <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-widest mb-3 px-1">
                  Tax & Statutory Deductions
                </Text>
                <View className="bg-white border border-slate-100 rounded-[28px] p-5 shadow-xl shadow-slate-200/50 divide-y divide-slate-100">
                  <View className="py-3.5 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">Income Tax (TDS)</Text>
                    <Text className="text-xs md:text-sm font-black text-rose-600">-$620.00</Text>
                  </View>
                  <View className="py-3.5 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">Provident Fund (PF)</Text>
                    <Text className="text-xs md:text-sm font-black text-rose-600">-$380.00</Text>
                  </View>
                  <View className="py-3.5 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">Health Insurance</Text>
                    <Text className="text-xs md:text-sm font-black text-rose-600">-$80.00</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity activeOpacity={0.85} className="bg-white border border-slate-100 rounded-[28px] p-5 flex-row items-center justify-between shadow-xl shadow-slate-200/50">
                <View className="flex-row items-center flex-1 pr-2">
                  <View className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 items-center justify-center mr-4 shrink-0">
                    <ShieldCheck size={22} color="#0D9488" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs md:text-sm font-black text-[#1F1B3D]" numberOfLines={1}>Annual Tax Statement (Form 16 / W-2)</Text>
                    <Text className="text-[11px] font-bold text-[#7A76A6] mt-0.5">Total YTD Tax Withheld: $7,440.00</Text>
                  </View>
                </View>
                <ChevronRight size={18} color="#7A76A6" />
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}