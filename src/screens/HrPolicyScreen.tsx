import React, { useState } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  useWindowDimensions 
} from "react-native";
import { 
  ChevronLeft, 
  FileText, 
  ShieldCheck, 
  BookOpen, 
  Lock, 
  Award, 
  Briefcase, 
  CheckCircle2 
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";

interface HrPolicyScreenProps {
  navigation?: {
    goBack?: () => void;
    navigate?: (screen: string, params?: any) => void;
    canGoBack?: () => boolean;
  };
}

export default function HrPolicyAndTermsScreen({ navigation }: HrPolicyScreenProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [activeTab, setActiveTab] = useState<"policy" | "terms">("policy");

  const hrPolicies = [
    {
      id: "POL-01",
      title: "Code of Conduct & Ethics",
      category: "Workplace Standards",
      description: "Guidelines on professional integrity, anti-harassment, conflict of interest, and maintaining a respectful corporate culture.",
      icon: <ShieldCheck size={20} color="#5B4FD1" />,
    },
    {
      id: "POL-02",
      title: "Leave & Attendance Policy",
      category: "Time Management",
      description: "Standard operating procedures for casual leaves, earned leaves, sick leaves, compensatory off, and regularizing time logs.",
      icon: <BookOpen size={20} color="#2563EB" />,
    },
    {
      id: "POL-03",
      title: "Information Security & Data Privacy",
      category: "Compliance",
      description: "Protocols regarding confidential enterprise data, customer records, secure password handling, and prohibition of unauthorized leaks.",
      icon: <Lock size={20} color="#059669" />,
    },
    {
      id: "POL-04",
      title: "Performance & Appraisal Framework",
      category: "Growth",
      description: "Yearly review cycles, KPI benchmarking, promotion evaluation metrics, and professional development allowances.",
      icon: <Award size={20} color="#D97706" />,
    },
  ];

  const companyTerms = [
    {
      id: "TRM-01",
      title: "Employment Agreement & Tenure",
      clause: "Section 1.1",
      detail: "Employment with the organization is subject to successful background verification, compliance with assigned designation terms, and adherence to notice period clauses upon separation.",
    },
    {
      id: "TRM-02",
      title: "Compensation, Payroll & Statutory Deductions",
      clause: "Section 2.4",
      detail: "Salaries are processed on or before the last working day of every month. Deductions include applicable Provident Fund (PF), Professional Tax, Income Tax (TDS), and authorized insurance schemes.",
    },
    {
      id: "TRM-03",
      title: "Intellectual Property & Work Product",
      clause: "Section 4.2",
      detail: "All software code, designs, documentation, patents, and deliverables created during employment hours or utilizing company hardware remain the exclusive property of the organization.",
    },
    {
      id: "TRM-04",
      title: "Non-Disclosure & Confidentiality Obligations",
      clause: "Section 5.0",
      detail: "Employees are bound by strict non-disclosure covenants during and after their active tenure, protecting trade secrets, client databases, and proprietary business architectures.",
    },
  ];

  return (
    <ScreenContainer scrollable={false} fullWidth={true}>
      {/* Outer wrapper with clean horizontal padding to prevent edge bleeding */}
      <View className="flex-1 px-5 md:px-8 pt-4 pb-2">
        
        {/* Properly Aligned Header Bar */}
        <View className="mb-5 flex-row items-center gap-3.5">
          <TouchableOpacity 
            onPress={() => (navigation?.goBack ? navigation.goBack() : null)}
            className="w-11 h-11 bg-white border border-[#E7E4F5] rounded-2xl items-center justify-center shadow-xs shrink-0"
          >
            <ChevronLeft size={22} color="#1F1B3D" />
          </TouchableOpacity>
          <View className="flex-1 pr-2">
            <Text className="text-xl md:text-2xl font-black text-[#1F1B3D] tracking-tight" numberOfLines={1}>
              HR Policy & Terms
            </Text>
            <Text className="text-xs font-bold text-[#7A76A6] mt-0.5" numberOfLines={1}>
              Corporate guidelines, compliance, and terms of service
            </Text>
          </View>
        </View>

        {/* Clean Segmented Switcher Tabs */}
        <View className="flex-row bg-[#EEECFA]/70 p-1.5 rounded-2xl border border-[#E7E4F5] mb-5">
          <TouchableOpacity
            onPress={() => setActiveTab("policy")}
            className={`flex-1 py-3 rounded-xl items-center justify-center ${activeTab === "policy" ? "bg-[#5B4FD1] shadow-xs" : ""}`}
          >
            <Text className={`text-xs font-black uppercase tracking-wider ${activeTab === "policy" ? "text-white" : "text-[#7A76A6]"}`}>
              HR Policies
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("terms")}
            className={`flex-1 py-3 rounded-xl items-center justify-center ${activeTab === "terms" ? "bg-[#5B4FD1] shadow-xs" : ""}`}
          >
            <Text className={`text-xs font-black uppercase tracking-wider ${activeTab === "terms" ? "text-white" : "text-[#7A76A6]"}`}>
              Terms & Conditions
            </Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable Content Area */}
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: 60, gap: 16 }} 
          className="flex-1"
        >
          <View style={{ width: isDesktop ? "85%" : "100%", alignSelf: "center" }} className="gap-4 w-full">
            
            {activeTab === "policy" ? (
              <>
                {/* Info Callout Banner */}
                <View className="bg-indigo-50/80 border border-indigo-100 rounded-2xl p-4 flex-row items-center gap-3">
                  <Briefcase size={22} color="#5B4FD1" className="shrink-0" />
                  <View className="flex-1">
                    <Text className="text-xs font-black text-[#1F1B3D]">Workplace Guidelines</Text>
                    <Text className="text-[11px] font-semibold text-[#7A76A6] mt-0.5 leading-snug">
                      All employees are required to review and comply with active company policies.
                    </Text>
                  </View>
                </View>

                {/* Policies Cards Grid */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                  {hrPolicies.map((policy) => (
                    <View 
                      key={policy.id}
                      className="bg-white border border-[#E7E4F5] rounded-3xl p-5 md:p-6 shadow-xs justify-between"
                      style={{ width: isDesktop ? "48%" : "100%", minHeight: 180 }}
                    >
                      <View>
                        <View className="flex-row items-center justify-between mb-3.5">
                          <View className="w-11 h-11 rounded-2xl bg-[#EEECFA] items-center justify-center border border-[#5B4FD1]/20">
                            {policy.icon}
                          </View>
                          <View className="bg-slate-100 px-3 py-1 rounded-full">
                            <Text className="text-[10px] font-black text-slate-600 uppercase tracking-wide">{policy.category}</Text>
                          </View>
                        </View>

                        <Text className="text-base font-black text-[#1F1B3D] tracking-tight mb-2">
                          {policy.title}
                        </Text>
                        <Text className="text-xs font-semibold text-[#7A76A6] leading-relaxed">
                          {policy.description}
                        </Text>
                      </View>

                      <View className="mt-4 pt-3.5 border-t border-slate-100 flex-row items-center justify-between">
                        <Text className="text-[10px] font-bold text-slate-400">ID: {policy.id}</Text>
                        <View className="flex-row items-center gap-1">
                          <CheckCircle2 size={12} color="#059669" />
                          <Text className="text-[10px] font-black text-emerald-700 uppercase">Active</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <>
                {/* Info Callout Banner */}
                <View className="bg-amber-50/80 border border-amber-100 rounded-2xl p-4 flex-row items-center gap-3">
                  <FileText size={22} color="#D97706" className="shrink-0" />
                  <View className="flex-1">
                    <Text className="text-xs font-black text-[#1F1B3D]">Legal Terms of Service</Text>
                    <Text className="text-[11px] font-semibold text-[#7A76A6] mt-0.5 leading-snug">
                      Binding terms governing employment relationship and corporate responsibilities.
                    </Text>
                  </View>
                </View>

                {/* Terms Cards List */}
                <View className="gap-4">
                  {companyTerms.map((term) => (
                    <View 
                      key={term.id}
                      className="bg-white border border-[#E7E4F5] rounded-3xl p-5 md:p-6 shadow-xs gap-3.5"
                    >
                      <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 gap-3">
                        <View className="flex-row items-center gap-3 flex-1">
                          <View className="w-9 h-9 rounded-xl bg-amber-50 items-center justify-center border border-amber-200 shrink-0">
                            <Text className="text-[11px] font-black text-amber-800">
                              {term.id.replace("TRM-", "")}
                            </Text>
                          </View>
                          <Text 
                            className="text-sm md:text-base font-black text-[#1F1B3D] flex-1 leading-snug"
                            numberOfLines={2}
                          >
                            {term.title}
                          </Text>
                        </View>

                        <View className="bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 shrink-0">
                          <Text className="text-[10px] font-black text-[#5B4FD1]">{term.clause}</Text>
                        </View>
                      </View>

                      <Text className="text-xs font-semibold text-[#7A76A6] leading-relaxed">
                        {term.detail}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}