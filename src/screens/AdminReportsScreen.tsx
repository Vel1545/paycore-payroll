import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, Platform } from "react-native";
import { 
  ArrowLeft, Download, FileSpreadsheet, Settings, 
  Calendar, Percent, ShieldCheck, CheckCircle2,
  FileText, Sliders, RefreshCw, Layers, Clock, Users, Plus, RotateCw
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";

interface AdminReportsScreenProps {
  navigation: any;
}

interface ShiftRosterRecord {
  empId: string;
  name: string;
  department: string;
  shiftName: string;
  timing: string;
  graceTime: string;
  workCycle: string;
}

export default function AdminReportsScreen({ navigation }: AdminReportsScreenProps) {
  // Added "shifts" tab alongside your 3 original tabs
  const [activeTab, setActiveTab] = useState<"reports" | "deductions" | "payslipConfig" | "shifts">("reports");
  
  // Date Range Filters
  const [cycleType, setCycleType] = useState<"monthly" | "weekly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState("January 2026");

  // Salary Deduction Percentage Configs
  const [pfPercent, setPfPercent] = useState("12.0");
  const [tdsBasePercent, setTdsBasePercent] = useState("10.0");
  const [healthInsuranceDeduction, setHealthInsuranceDeduction] = useState("80.00");
  const [lopMultiplier, setLopMultiplier] = useState("1.0"); // 1 day wage per LOP

  // Payslip Layout & Rule Configs
  const [companyHeader, setCompanyHeader] = useState("PayCore Global Technologies Inc.");
  const [authorizedSignatory, setAuthorizedSignatory] = useState("HR Operations Director");
  const [showYtdTotals, setShowYtdTotals] = useState(true);
  const [showEmployerPfMatch, setShowEmployerPfMatch] = useState(true);
  const [showTaxDeclarationNotes, setShowTaxDeclarationNotes] = useState(true);

  // ==========================================
  // Shift Management State & Datastore
  // ==========================================
  const [selectedShiftFilter, setSelectedShiftFilter] = useState("All");
  const [workCyclePolicy, setWorkCyclePolicy] = useState<"5_DAYS" | "ALT_SAT" | "6_DAYS">("ALT_SAT");
  const [rosterData, setRosterData] = useState<ShiftRosterRecord[]>([
    { empId: "EMP-1042", name: "Marcus Sterling", department: "Engineering", shiftName: "General Day Shift", timing: "09:00 AM - 06:00 PM", graceTime: "15 mins", workCycle: "Mon - Fri" },
    { empId: "EMP-2031", name: "Sarah Jenkins", department: "Engineering", shiftName: "General Day Shift", timing: "09:00 AM - 06:00 PM", graceTime: "15 mins", workCycle: "Mon - Fri" },
    { empId: "EMP-4092", name: "David Miller", department: "Product", shiftName: "Early Support", timing: "06:00 AM - 03:00 PM", graceTime: "10 mins", workCycle: "Rotational" },
    { empId: "EMP-3011", name: "Alex Richardson", department: "Design", shiftName: "General Day Shift", timing: "09:00 AM - 06:00 PM", graceTime: "15 mins", workCycle: "Mon - Fri" },
    { empId: "EMP-5088", name: "Priya Sharma", department: "DevOps", shiftName: "Night US / EMEA", timing: "06:30 PM - 03:30 AM", graceTime: "15 mins", workCycle: "Mon - Fri" },
    { empId: "EMP-6014", name: "Elena Gomez", department: "HR Ops", shiftName: "General Day Shift", timing: "09:00 AM - 06:00 PM", graceTime: "15 mins", workCycle: "Mon - Fri" },
  ]);

  const handleDownload = (reportName: string, format: "PDF" | "CSV") => {
    const msg = `Generated ${reportName} (${format}) for ${selectedMonth} (${cycleType.toUpperCase()})`;
    if (Platform.OS === "web") {
      window.alert(msg);
    } else {
      Alert.alert("Report Generated", msg);
    }
  };

  const handleSaveConfig = (sectionName: string) => {
    const msg = `${sectionName} settings have been saved and applied to upcoming payroll cycles.`;
    if (Platform.OS === "web") {
      window.alert(msg);
    } else {
      Alert.alert("Configuration Saved", msg);
    }
  };

  const filteredRoster = selectedShiftFilter === "All" 
    ? rosterData 
    : rosterData.filter(r => r.shiftName === selectedShiftFilter);

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
            <Text className="text-2xl font-black text-brand-dark tracking-tight">Reports & Rules</Text>
            <Text className="text-xs font-bold text-brand-muted">Analytics, Deductions, Shifts & Payslip Engine</Text>
          </View>
        </View>
        <View className="bg-brand-hero px-3 py-1.5 rounded-xl border border-brand-border">
          <Text className="text-[10px] font-black text-brand-canvas uppercase tracking-widest">Admin</Text>
        </View>
      </View>

      {/* Top Segmented Tabs (Horizontal Scroll for Clean Header Display) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
        <View className="flex-row bg-brand-hero/10 p-1 rounded-2xl border border-brand-border space-x-1">
          <TouchableOpacity
            onPress={() => setActiveTab("reports")}
            className={`px-4 py-2.5 rounded-xl items-center ${activeTab === "reports" ? "bg-brand-hero shadow-xs" : ""}`}
          >
            <Text className={`text-xs font-black ${activeTab === "reports" ? "text-white" : "text-brand-dark"}`}>
              Reports Hub
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("shifts")}
            className={`px-4 py-2.5 rounded-xl items-center flex-row ${activeTab === "shifts" ? "bg-brand-hero shadow-xs" : ""}`}
          >
            <Clock size={13} color={activeTab === "shifts" ? "#FFFFFF" : "#0F172A"} />
            <Text className={`text-xs font-black ml-1.5 ${activeTab === "shifts" ? "text-white" : "text-brand-dark"}`}>
              Shift Engine
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("deductions")}
            className={`px-4 py-2.5 rounded-xl items-center ${activeTab === "deductions" ? "bg-brand-hero shadow-xs" : ""}`}
          >
            <Text className={`text-xs font-black ${activeTab === "deductions" ? "text-white" : "text-brand-dark"}`}>
              Deductions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("payslipConfig")}
            className={`px-4 py-2.5 rounded-xl items-center ${activeTab === "payslipConfig" ? "bg-brand-hero shadow-xs" : ""}`}
          >
            <Text className={`text-xs font-black ${activeTab === "payslipConfig" ? "text-white" : "text-brand-dark"}`}>
              Payslip Format
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ========================================================================= */}
      {/* 1. REPORTS & EXPORTS HUB (Attendance & Monthly/Weekly Payroll Reports)   */}
      {/* ========================================================================= */}
      {activeTab === "reports" && (
        <View className="space-y-4 mb-8">
          {/* Cycle & Range Selector */}
          <View className="bg-brand-card border border-brand-border rounded-3xl p-5 shadow-xs">
            <Text className="text-xs font-black text-brand-dark uppercase tracking-widest mb-3">
              Export Schedule & Cycle
            </Text>
            
            <View className="flex-row space-x-2 mb-3">
              <TouchableOpacity
                onPress={() => setCycleType("monthly")}
                className={`flex-1 py-2 rounded-xl items-center border ${cycleType === "monthly" ? "bg-brand-primary border-brand-primary" : "bg-brand-cardTint border-brand-border"}`}
              >
                <Text className={`text-xs font-black ${cycleType === "monthly" ? "text-white" : "text-brand-dark"}`}>
                  Monthly Cycle
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCycleType("weekly")}
                className={`flex-1 py-2 rounded-xl items-center border ${cycleType === "weekly" ? "bg-brand-primary border-brand-primary" : "bg-brand-cardTint border-brand-border"}`}
              >
                <Text className={`text-xs font-black ${cycleType === "weekly" ? "text-white" : "text-brand-dark"}`}>
                  Weekly Sprint Cycle
                </Text>
              </TouchableOpacity>
            </View>

            <View className="bg-brand-cardTint border border-brand-border rounded-2xl px-4 py-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Calendar size={18} color="#5C4D41" />
                <Text className="text-xs font-bold text-brand-dark ml-2.5">{selectedMonth}</Text>
              </View>
              <Text className="text-[11px] font-bold text-brand-primary">248 Active Records</Text>
            </View>
          </View>

          {/* Report 1: Attendance Master Log */}
          <View className="bg-brand-card border border-brand-border rounded-3xl p-5 shadow-xs">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-teal-50 border border-teal-200 rounded-xl items-center justify-center mr-3">
                  <FileSpreadsheet size={20} color="#0D9488" />
                </View>
                <View>
                  <Text className="text-sm font-black text-brand-dark">Attendance & Biometrics Master</Text>
                  <Text className="text-[10px] font-semibold text-brand-muted">Check-in, Check-out, OD, Permissions & LOPs</Text>
                </View>
              </View>
            </View>
            <View className="flex-row space-x-2 mt-3 pt-3 border-t border-slate-100">
              <TouchableOpacity 
                onPress={() => handleDownload("Attendance Master", "CSV")}
                className="flex-1 bg-brand-cardTint border border-brand-border py-2.5 rounded-xl items-center flex-row justify-center active:opacity-80"
              >
                <Download size={14} color="#0F172A" />
                <Text className="text-xs font-bold text-brand-dark ml-1.5">Download CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handleDownload("Attendance Master", "PDF")}
                className="flex-1 bg-brand-hero py-2.5 rounded-xl items-center flex-row justify-center active:opacity-90"
              >
                <Download size={14} color="#FFFFFF" />
                <Text className="text-white text-xs font-bold ml-1.5">Download PDF</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Report 2: Gross-to-Net Payroll Report */}
          <View className="bg-brand-card border border-brand-border rounded-3xl p-5 shadow-xs">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-amber-50 border border-amber-200 rounded-xl items-center justify-center mr-3">
                  <FileText size={20} color="#D97706" />
                </View>
                <View>
                  <Text className="text-sm font-black text-brand-dark">Gross-to-Net Salary Register</Text>
                  <Text className="text-[10px] font-semibold text-brand-muted">Itemized CTC, HRA, Allowances, PF, TDS & Payout</Text>
                </View>
              </View>
            </View>
            <View className="flex-row space-x-2 mt-3 pt-3 border-t border-slate-100">
              <TouchableOpacity 
                onPress={() => handleDownload("Salary Register", "CSV")}
                className="flex-1 bg-brand-cardTint border border-brand-border py-2.5 rounded-xl items-center flex-row justify-center active:opacity-80"
              >
                <Download size={14} color="#0F172A" />
                <Text className="text-xs font-bold text-brand-dark ml-1.5">Download CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handleDownload("Salary Register", "PDF")}
                className="flex-1 bg-brand-hero py-2.5 rounded-xl items-center flex-row justify-center active:opacity-90"
              >
                <Download size={14} color="#FFFFFF" />
                <Text className="text-white text-xs font-bold ml-1.5">Download PDF</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Report 3: Bank Payout Direct Deposit Statement */}
          <View className="bg-brand-card border border-brand-border rounded-3xl p-5 shadow-xs">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-purple-50 border border-purple-200 rounded-xl items-center justify-center mr-3">
                  <ShieldCheck size={20} color="#7E22CE" />
                </View>
                <View>
                  <Text className="text-sm font-black text-brand-dark">Bank NACH / NEFT Payout File</Text>
                  <Text className="text-[10px] font-semibold text-brand-muted">Account numbers, Swift codes & Disbursal total</Text>
                </View>
              </View>
            </View>
            <View className="flex-row space-x-2 mt-3 pt-3 border-t border-slate-100">
              <TouchableOpacity 
                onPress={() => handleDownload("Bank Payout Statement", "CSV")}
                className="flex-1 bg-brand-cardTint border border-brand-border py-2.5 rounded-xl items-center flex-row justify-center active:opacity-80"
              >
                <Download size={14} color="#0F172A" />
                <Text className="text-xs font-bold text-brand-dark ml-1.5">Download CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handleDownload("Bank Payout Statement", "PDF")}
                className="flex-1 bg-brand-hero py-2.5 rounded-xl items-center flex-row justify-center active:opacity-90"
              >
                <Download size={14} color="#FFFFFF" />
                <Text className="text-white text-xs font-bold ml-1.5">Download PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 2. SHIFT ENGINE TAB (Roster, Table View & Downloadable Allocations)       */}
      {/* ========================================================================= */}
      {activeTab === "shifts" && (
        <View className="space-y-4 mb-8">
          {/* Work Cycle Policies Card */}
          <View className="bg-brand-card border border-brand-border rounded-3xl p-5 shadow-xs">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <Calendar size={18} color="#0D9488" />
                <Text className="text-xs font-black text-brand-dark ml-2 uppercase tracking-wider">
                  Company Work Week Schedule
                </Text>
              </View>
              <View className="bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                <Text className="text-[10px] font-black text-emerald-800">ENFORCED</Text>
              </View>
            </View>

            <View className="flex-row space-x-2 mb-3">
              {[
                { id: "5_DAYS", label: "5 Days (Mon-Fri)" },
                { id: "ALT_SAT", label: "Alt Sat (2nd & 4th Off)" },
                { id: "6_DAYS", label: "6 Days (Mon-Sat)" },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setWorkCyclePolicy(opt.id as any)}
                  className={`flex-1 p-2 rounded-xl border items-center ${
                    workCyclePolicy === opt.id ? "bg-brand-hero border-brand-hero" : "bg-brand-cardTint border-brand-border"
                  }`}
                >
                  <Text className={`text-[10px] font-bold ${workCyclePolicy === opt.id ? "text-white" : "text-brand-dark"}`}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Export Roster Buttons */}
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-black text-brand-dark uppercase tracking-widest">
              Staff Shift Roster Table
            </Text>
            <View className="flex-row space-x-2">
              <TouchableOpacity 
                onPress={() => handleDownload("Shift Roster Register", "CSV")}
                className="bg-brand-cardTint border border-brand-border px-3 py-1.5 rounded-xl flex-row items-center"
              >
                <Download size={12} color="#0F172A" />
                <Text className="text-[10px] font-black text-brand-dark ml-1">CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handleDownload("Shift Roster Register", "PDF")}
                className="bg-brand-hero px-3 py-1.5 rounded-xl flex-row items-center"
              >
                <Download size={12} color="#FFFFFF" />
                <Text className="text-[10px] font-black text-white ml-1">PDF</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-1.5">
            {["All", "General Day Shift", "Early Support", "Night US / EMEA"].map((shift) => (
              <TouchableOpacity
                key={shift}
                onPress={() => setSelectedShiftFilter(shift)}
                className={`px-3 py-1.5 rounded-xl border ${
                  selectedShiftFilter === shift ? "bg-brand-primary border-brand-primary" : "bg-brand-card border-brand-border"
                }`}
              >
                <Text className={`text-[10px] font-bold ${selectedShiftFilter === shift ? "text-white" : "text-brand-dark"}`}>
                  {shift}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Roster Table View (Horizontal Scrollable) */}
          <View className="bg-brand-card border border-brand-border rounded-3xl overflow-hidden shadow-xs">
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
                {/* Table Header Row */}
                <View className="flex-row bg-brand-hero px-4 py-3.5 items-center">
                  <Text className="text-white text-[10px] font-black uppercase tracking-wider w-24">Emp ID</Text>
                  <Text className="text-white text-[10px] font-black uppercase tracking-wider w-36">Employee</Text>
                  <Text className="text-white text-[10px] font-black uppercase tracking-wider w-28">Department</Text>
                  <Text className="text-white text-[10px] font-black uppercase tracking-wider w-40">Assigned Shift</Text>
                  <Text className="text-white text-[10px] font-black uppercase tracking-wider w-44">Shift Timings</Text>
                  <Text className="text-white text-[10px] font-black uppercase tracking-wider w-24 text-center">Grace Time</Text>
                </View>

                {/* Table Body Rows */}
                {filteredRoster.map((r, idx) => (
                  <View 
                    key={r.empId} 
                    className={`flex-row px-4 py-3.5 items-center border-b border-brand-border ${
                      idx % 2 === 1 ? "bg-brand-cardTint/50" : "bg-brand-card"
                    }`}
                  >
                    <Text className="text-xs font-black text-brand-primary w-24">{r.empId}</Text>
                    <Text className="text-xs font-black text-brand-dark w-36" numberOfLines={1}>{r.name}</Text>
                    <Text className="text-xs font-medium text-brand-muted w-28">{r.department}</Text>
                    
                    {/* Shift Badge */}
                    <View className="w-40 pr-2">
                      <View className="bg-brand-cardTint border border-brand-border px-2 py-0.5 rounded-md self-start">
                        <Text className="text-[10px] font-bold text-brand-dark">{r.shiftName}</Text>
                      </View>
                    </View>

                    <Text className="text-xs font-bold text-brand-dark w-44">{r.timing}</Text>
                    <Text className="text-xs font-semibold text-brand-primary w-24 text-center">{r.graceTime}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 3. DEDUCTION & STATUTORY RULES CONFIGURATOR                               */}
      {/* ========================================================================= */}
      {activeTab === "deductions" && (
        <View className="bg-brand-card border border-brand-border rounded-3xl p-5 space-y-4 shadow-xs mb-8">
          <View className="flex-row justify-between items-center pb-2 border-b border-slate-100">
            <View>
              <Text className="text-sm font-black text-brand-dark">Statutory Deduction Rules</Text>
              <Text className="text-[10px] font-semibold text-brand-muted">Automatic calculations applied across company staff</Text>
            </View>
            <Percent size={18} color="#0D9488" />
          </View>

          {/* Provident Fund (PF) Rule */}
          <View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-xs font-bold text-brand-dark">Employee Provident Fund (PF)</Text>
              <Text className="text-xs font-black text-brand-primary">{pfPercent}% of Basic</Text>
            </View>
            <View className="flex-row items-center bg-brand-cardTint border border-brand-border rounded-xl px-3 py-2">
              <TextInput 
                value={pfPercent} 
                onChangeText={setPfPercent}
                keyboardType="numeric"
                className="flex-1 text-xs font-bold text-brand-dark" 
              />
              <Text className="text-xs font-bold text-brand-muted">%</Text>
            </View>
            <Text className="text-[10px] text-brand-muted mt-1">Matched equally by employer as statutory contribution.</Text>
          </View>

          {/* TDS Income Tax Rate */}
          <View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-xs font-bold text-brand-dark">Baseline Income Tax TDS Benchmark</Text>
              <Text className="text-xs font-black text-brand-primary">{tdsBasePercent}%</Text>
            </View>
            <View className="flex-row items-center bg-brand-cardTint border border-brand-border rounded-xl px-3 py-2">
              <TextInput 
                value={tdsBasePercent} 
                onChangeText={setTdsBasePercent}
                keyboardType="numeric"
                className="flex-1 text-xs font-bold text-brand-dark" 
              />
              <Text className="text-xs font-bold text-brand-muted">%</Text>
            </View>
            <Text className="text-[10px] text-brand-muted mt-1">Adjusted automatically based on employee 80C declarations.</Text>
          </View>

          {/* Health Insurance Fixed Premium */}
          <View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-xs font-bold text-brand-dark">Monthly Health Insurance Premium</Text>
              <Text className="text-xs font-black text-rose-600">${healthInsuranceDeduction}</Text>
            </View>
            <View className="flex-row items-center bg-brand-cardTint border border-brand-border rounded-xl px-3 py-2">
              <Text className="text-xs font-bold text-brand-muted mr-1">$</Text>
              <TextInput 
                value={healthInsuranceDeduction} 
                onChangeText={setHealthInsuranceDeduction}
                keyboardType="numeric"
                className="flex-1 text-xs font-bold text-brand-dark" 
              />
            </View>
          </View>

          {/* Loss of Pay (LOP) Multiplier */}
          <View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-xs font-bold text-brand-dark">Loss of Pay (LOP) Daily Wage Multiplier</Text>
              <Text className="text-xs font-black text-brand-dark">{lopMultiplier}x Daily Rate</Text>
            </View>
            <View className="flex-row items-center bg-brand-cardTint border border-brand-border rounded-xl px-3 py-2">
              <TextInput 
                value={lopMultiplier} 
                onChangeText={setLopMultiplier}
                keyboardType="numeric"
                className="flex-1 text-xs font-bold text-brand-dark" 
              />
              <Text className="text-xs font-bold text-brand-muted">Factor</Text>
            </View>
          </View>

          <TouchableOpacity 
            onPress={() => handleSaveConfig("Deduction rules")}
            className="bg-brand-hero py-3.5 rounded-2xl items-center mt-2 shadow-sm active:opacity-90"
          >
            <Text className="text-white font-black text-xs uppercase tracking-wider">Save Deduction Configurations</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 4. PAYSLIP TEMPLATE & RULE CONFIGURATOR                                   */}
      {/* ========================================================================= */}
      {activeTab === "payslipConfig" && (
        <View className="bg-brand-card border border-brand-border rounded-3xl p-5 space-y-4 shadow-xs mb-8">
          <View className="flex-row justify-between items-center pb-2 border-b border-slate-100">
            <View>
              <Text className="text-sm font-black text-brand-dark">Payslip Template & Metadata</Text>
              <Text className="text-[10px] font-semibold text-brand-muted">Customize employee payslip layout & printed fields</Text>
            </View>
            <Layers size={18} color="#0D9488" />
          </View>

          {/* Company Legal Name */}
          <View>
            <Text className="text-[10px] font-bold text-brand-muted uppercase mb-1">Company Legal Entity Title</Text>
            <TextInput 
              value={companyHeader} 
              onChangeText={setCompanyHeader}
              className="bg-brand-cardTint border border-brand-border rounded-xl p-3 text-xs font-bold text-brand-dark" 
            />
          </View>

          {/* Authorized Signatory */}
          <View>
            <Text className="text-[10px] font-bold text-brand-muted uppercase mb-1">Authorized Signatory Title</Text>
            <TextInput 
              value={authorizedSignatory} 
              onChangeText={setAuthorizedSignatory}
              className="bg-brand-cardTint border border-brand-border rounded-xl p-3 text-xs font-bold text-brand-dark" 
            />
          </View>

          {/* Layout Feature Toggles */}
          <Text className="text-xs font-black text-brand-dark uppercase tracking-widest mt-2">Display Fields</Text>

          <TouchableOpacity 
            onPress={() => setShowYtdTotals(!showYtdTotals)}
            className="flex-row items-center justify-between p-3 bg-brand-cardTint border border-brand-border rounded-2xl"
          >
            <View className="flex-1 pr-2">
              <Text className="text-xs font-bold text-brand-dark">Include YTD (Year-To-Date) Cumulative Summary</Text>
              <Text className="text-[10px] text-brand-muted">Prints total gross earnings and tax paid since fiscal start</Text>
            </View>
            <View className={`w-5 h-5 rounded-md border items-center justify-center ${showYtdTotals ? "bg-brand-primary border-brand-primary" : "border-slate-400 bg-white"}`}>
              {showYtdTotals && <Text className="text-white text-[10px] font-black">✓</Text>}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setShowEmployerPfMatch(!showEmployerPfMatch)}
            className="flex-row items-center justify-between p-3 bg-brand-cardTint border border-brand-border rounded-2xl"
          >
            <View className="flex-1 pr-2">
              <Text className="text-xs font-bold text-brand-dark">Display Employer Statutory Contribution Match</Text>
              <Text className="text-[10px] text-brand-muted">Shows company-paid PF and gratuity allocations</Text>
            </View>
            <View className={`w-5 h-5 rounded-md border items-center justify-center ${showEmployerPfMatch ? "bg-brand-primary border-brand-primary" : "border-slate-400 bg-white"}`}>
              {showEmployerPfMatch && <Text className="text-white text-[10px] font-black">✓</Text>}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setShowTaxDeclarationNotes(!showTaxDeclarationNotes)}
            className="flex-row items-center justify-between p-3 bg-brand-cardTint border border-brand-border rounded-2xl"
          >
            <View className="flex-1 pr-2">
              <Text className="text-xs font-bold text-brand-dark">Append Tax Declaration (80C / W-4) Footnotes</Text>
              <Text className="text-[10px] text-brand-muted">Includes exemption balances and taxable ceiling</Text>
            </View>
            <View className={`w-5 h-5 rounded-md border items-center justify-center ${showTaxDeclarationNotes ? "bg-brand-primary border-brand-primary" : "border-slate-400 bg-white"}`}>
              {showTaxDeclarationNotes && <Text className="text-white text-[10px] font-black">✓</Text>}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => handleSaveConfig("Payslip template layout")}
            className="bg-brand-hero py-3.5 rounded-2xl items-center mt-2 shadow-sm active:opacity-90"
          >
            <Text className="text-white font-black text-xs uppercase tracking-wider">Commit Payslip Format Updates</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}