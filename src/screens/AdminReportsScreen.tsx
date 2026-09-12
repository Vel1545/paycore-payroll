import React, { useState, useMemo } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Alert, 
  Platform,
  Modal
} from "react-native";
import { 
  ChevronLeft, 
  Download, 
  FileSpreadsheet, 
  Calendar, 
  Percent, 
  ShieldCheck, 
  FileText, 
  Clock, 
  Calculator, 
  DollarSign, 
  Layers, 
  RotateCw,
  Building,
  CheckCircle2,
  Users,
  Edit3,
  SlidersHorizontal,
  Search
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";

interface AdminReportsScreenProps {
  navigation: any;
}

interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceTime: string;
  workCycle: string;
}

interface ShiftRosterRecord {
  empId: string;
  name: string;
  department: string;
  shiftId: string;
  shiftName: string;
  timing: string;
  graceTime: string;
  workCycle: string;
}

export default function AdminReportsScreen({ navigation }: AdminReportsScreenProps) {
  const [activeTab, setActiveTab] = useState<"reports" | "shifts" | "salCalc" | "deductions" | "payslipConfig">("reports");
  
  // Date Range Filters
  const [cycleType, setCycleType] = useState<"monthly" | "weekly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState("January 2026");

  // Salary Deduction Percentage Configs
  const [pfPercent, setPfPercent] = useState("12.0");
  const [tdsBasePercent, setTdsBasePercent] = useState("10.0");
  const [healthInsuranceDeduction, setHealthInsuranceDeduction] = useState("80.00");
  const [lopMultiplier, setLopMultiplier] = useState("1.0");

  // Payslip Layout Configs
  const [companyHeader, setCompanyHeader] = useState("PayCore Global Technologies Inc.");
  const [authorizedSignatory, setAuthorizedSignatory] = useState("HR Operations Director");
  const [showYtdTotals, setShowYtdTotals] = useState(true);
  const [showEmployerPfMatch, setShowEmployerPfMatch] = useState(true);
  const [showTaxDeclarationNotes, setShowTaxDeclarationNotes] = useState(true);

  // ==========================================
  // Salary Calculation Simulator State
  // ==========================================
  const [calcMode, setCalcMode] = useState<"MONTHLY" | "DAY_WISE" | "WEEKLY">("MONTHLY");
  const [calcBasicSalary, setCalcBasicSalary] = useState("3200");
  const [totalMonthDays, setTotalMonthDays] = useState("30");
  const [workedDays, setWorkedDays] = useState("30");
  const [workedWeeks, setWorkedWeeks] = useState("4");
  const [allowancesRate, setAllowancesRate] = useState("600");
  const [overtimeHours, setOvertimeHours] = useState("0");
  const [otHourlyRate, setOtHourlyRate] = useState("20");

  // Dynamic Salary Calculations
  const calculatedSalary = useMemo(() => {
    const basic = parseFloat(calcBasicSalary) || 0;
    const mDays = parseFloat(totalMonthDays) || 30;
    const wDays = parseFloat(workedDays) || 0;
    const wWeeks = parseFloat(workedWeeks) || 0;
    const allow = parseFloat(allowancesRate) || 0;
    const otHrs = parseFloat(overtimeHours) || 0;
    const otRate = parseFloat(otHourlyRate) || 0;

    const dailyRate = mDays > 0 ? basic / mDays : 0;
    const weeklyRate = (basic * 12) / 52;

    let earnedBasic = basic;
    if (calcMode === "DAY_WISE") {
      earnedBasic = dailyRate * wDays;
    } else if (calcMode === "WEEKLY") {
      earnedBasic = weeklyRate * wWeeks;
    }

    const otPay = otHrs * otRate;
    const grossSalary = earnedBasic + allow + otPay;

    const pfRate = parseFloat(pfPercent) / 100 || 0.12;
    const tdsRate = parseFloat(tdsBasePercent) / 100 || 0.10;
    const insurance = parseFloat(healthInsuranceDeduction) || 80;

    const pfAmount = earnedBasic * pfRate;
    const tdsAmount = grossSalary * tdsRate;
    const totalDeductions = pfAmount + tdsAmount + insurance;
    const netSalary = Math.max(0, grossSalary - totalDeductions);

    return {
      dailyRate,
      weeklyRate,
      earnedBasic,
      allowances: allow,
      otPay,
      grossSalary,
      pfAmount,
      tdsAmount,
      insurance,
      totalDeductions,
      netSalary,
    };
  }, [
    calcMode,
    calcBasicSalary,
    totalMonthDays,
    workedDays,
    workedWeeks,
    allowancesRate,
    overtimeHours,
    otHourlyRate,
    pfPercent,
    tdsBasePercent,
    healthInsuranceDeduction,
  ]);

  // ==========================================
  // Shift Management State & Datastore
  // ==========================================
  const [shiftSubTab, setShiftSubTab] = useState<"roster" | "templates">("roster");
  const [selectedShiftFilter, setSelectedShiftFilter] = useState("All");
  const [searchRosterText, setSearchRosterText] = useState("");
  const [workCyclePolicy, setWorkCyclePolicy] = useState<"5_DAYS" | "ALT_SAT" | "6_DAYS">("ALT_SAT");

  // Configured Shift Templates
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([
    { id: "S-01", name: "General Day Shift", startTime: "09:00 AM", endTime: "06:00 PM", graceTime: "15 mins", workCycle: "Mon - Fri" },
    { id: "S-02", name: "Early Support", startTime: "06:00 AM", endTime: "03:00 PM", graceTime: "10 mins", workCycle: "Rotational" },
    { id: "S-03", name: "Night US / EMEA", startTime: "06:30 PM", endTime: "03:30 AM", graceTime: "15 mins", workCycle: "Mon - Fri" },
    { id: "S-04", name: "UK Shift Support", startTime: "01:30 PM", endTime: "10:30 PM", graceTime: "15 mins", workCycle: "Mon - Fri" },
  ]);

  // Dynamic Employee Roster Records
  const [rosterData, setRosterData] = useState<ShiftRosterRecord[]>([
    { empId: "EMP-1042", name: "Marcus Sterling", department: "Engineering", shiftId: "S-01", shiftName: "General Day Shift", timing: "09:00 AM - 06:00 PM", graceTime: "15 mins", workCycle: "Mon - Fri" },
    { empId: "EMP-2031", name: "Sarah Jenkins", department: "Engineering", shiftId: "S-01", shiftName: "General Day Shift", timing: "09:00 AM - 06:00 PM", graceTime: "15 mins", workCycle: "Mon - Fri" },
    { empId: "EMP-4092", name: "David Miller", department: "Product", shiftId: "S-02", shiftName: "Early Support", timing: "06:00 AM - 03:00 PM", graceTime: "10 mins", workCycle: "Rotational" },
    { empId: "EMP-3011", name: "Alex Richardson", department: "Design", shiftId: "S-01", shiftName: "General Day Shift", timing: "09:00 AM - 06:00 PM", graceTime: "15 mins", workCycle: "Mon - Fri" },
    { empId: "EMP-5088", name: "Priya Sharma", department: "DevOps", shiftId: "S-03", shiftName: "Night US / EMEA", timing: "06:30 PM - 03:30 AM", graceTime: "15 mins", workCycle: "Mon - Fri" },
    { empId: "EMP-6014", name: "Elena Gomez", department: "HR Ops", shiftId: "S-04", shiftName: "UK Shift Support", timing: "01:30 PM - 10:30 PM", graceTime: "15 mins", workCycle: "Mon - Fri" },
  ]);

  // Modal States
  const [singleAssignModal, setSingleAssignModal] = useState(false);
  const [selectedUserForShift, setSelectedUserForShift] = useState<ShiftRosterRecord | null>(null);

  const [bulkDeptModal, setBulkDeptModal] = useState(false);
  const [bulkTargetDept, setBulkTargetDept] = useState("Engineering");
  const [bulkTargetShiftId, setBulkTargetShiftId] = useState("S-01");

  const [editTemplateModal, setEditTemplateModal] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<ShiftTemplate | null>(null);

  const [companyTaxId, setCompanyTaxId] = useState("US-9928192-A");
const [showPfUan, setShowPfUan] = useState(true);
const [showBankDetails, setShowBankDetails] = useState(true);
const [showOvertime, setShowOvertime] = useState(true);
const [showBonus, setShowBonus] = useState(true);
const [showYtd, setShowYtd] = useState(false); // Advanced MNC metric
const [showHrNotes, setShowHrNotes] = useState(true);
const [hrDisclaimerNote, setHrDisclaimerNote] = useState("For any discrepancies, please contact the HR department within 5 working days.");

  const departmentsList = ["Engineering", "Product", "DevOps", "Design", "HR Ops", "Sales"];

  // Filtered Roster Computation
  const filteredRoster = useMemo(() => {
    return rosterData.filter((r) => {
      const matchesFilter = selectedShiftFilter === "All" || r.shiftName === selectedShiftFilter;
      const matchesSearch = 
        r.name.toLowerCase().includes(searchRosterText.toLowerCase()) ||
        r.empId.toLowerCase().includes(searchRosterText.toLowerCase()) ||
        r.department.toLowerCase().includes(searchRosterText.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [rosterData, selectedShiftFilter, searchRosterText]);

  // Shift Action Handlers
  const handleAssignSingleUserShift = (template: ShiftTemplate) => {
    if (!selectedUserForShift) return;
    setRosterData((prev) =>
      prev.map((emp) =>
        emp.empId === selectedUserForShift.empId
          ? {
              ...emp,
              shiftId: template.id,
              shiftName: template.name,
              timing: `${template.startTime} - ${template.endTime}`,
              graceTime: template.graceTime,
              workCycle: template.workCycle,
            }
          : emp
      )
    );
    setSingleAssignModal(false);
    const msg = `Shift changed to ${template.name} for ${selectedUserForShift.name}`;
    Platform.OS === "web" ? window.alert(msg) : Alert.alert("Shift Assigned", msg);
  };

  const handleBulkDeptAssign = () => {
    const matchedTemplate = shiftTemplates.find((t) => t.id === bulkTargetShiftId);
    if (!matchedTemplate) return;

    setRosterData((prev) =>
      prev.map((emp) =>
        emp.department === bulkTargetDept
          ? {
              ...emp,
              shiftId: matchedTemplate.id,
              shiftName: matchedTemplate.name,
              timing: `${matchedTemplate.startTime} - ${matchedTemplate.endTime}`,
              graceTime: matchedTemplate.graceTime,
              workCycle: matchedTemplate.workCycle,
            }
          : emp
      )
    );
    setBulkDeptModal(false);
    const msg = `All ${bulkTargetDept} members reassigned to ${matchedTemplate.name}`;
    Platform.OS === "web" ? window.alert(msg) : Alert.alert("Department Shift Updated", msg);
  };

  const handleSaveShiftTemplate = () => {
    if (!activeTemplate) return;
    setShiftTemplates((prev) =>
      prev.map((t) => (t.id === activeTemplate.id ? activeTemplate : t))
    );

    // Propagate updated timing to currently assigned employees
    setRosterData((prev) =>
      prev.map((emp) =>
        emp.shiftId === activeTemplate.id
          ? {
              ...emp,
              shiftName: activeTemplate.name,
              timing: `${activeTemplate.startTime} - ${activeTemplate.endTime}`,
              graceTime: activeTemplate.graceTime,
              workCycle: activeTemplate.workCycle,
            }
          : emp
      )
    );

    setEditTemplateModal(false);
    const msg = `Shift ${activeTemplate.name} updated successfully.`;
    Platform.OS === "web" ? window.alert(msg) : Alert.alert("Template Saved", msg);
  };

  const [selectedReportCategory, setSelectedReportCategory] = useState("ALL"); // "ALL" | "ATTENDANCE" | "SALARY" | "STATUTORY"
const [filterDepartment, setFilterDepartment] = useState("");
const [filterShift, setFilterShift] = useState("");
const [dateRange, setDateRange] = useState("2026-01-01 to 2026-01-31");
const [salaryFilter, setSalaryFilter] = useState("");

  const handleDownload = (reportName: string, format: "PDF" | "CSV") => {
    const msg = `Generated ${reportName} (${format}) for ${selectedMonth} (${cycleType.toUpperCase()})`;
    Platform.OS === "web" ? window.alert(msg) : Alert.alert("Report Generated", msg);
  };

  const handleSaveConfig = (sectionName: string) => {
    const msg = `${sectionName} settings have been saved and applied to upcoming payroll cycles.`;
    Platform.OS === "web" ? window.alert(msg) : Alert.alert("Configuration Saved", msg);
  };

  const handleDownloadWithFilters = (reportName: string, format: string) => {
  const queryParams = new URLSearchParams({
    reportType: reportName,
    format: format,
    department: filterDepartment || "ALL",
    shift: filterShift || "ALL",
    dateRange: dateRange,
    salaryTier: salaryFilter || "ALL"
  });

  const exportUrl = `http://192.168.31.133:8080/api/admin/reports/export?${queryParams.toString()}`;
  
  console.log(`📥 Exporting [${reportName}] as ${format} with filters:`, exportUrl);

  if (Platform.OS === "web") {
    window.open(exportUrl, "_blank");
  } else {
    // Mobile native file handling or Linking
  }
};

  return (
    <ScreenContainer>
      {/* 1. Header Bar */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5 flex-1 pr-2">
            <TouchableOpacity 
              onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate("Home"))}
              className="w-9 h-9 bg-white border border-[#E7E4F5] rounded-xl items-center justify-center shadow-xs active:bg-slate-50"
            >
              <ChevronLeft size={20} color="#1F1B3D" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-xl md:text-2xl font-black text-[#1F1B3D] tracking-tight">
                Reports & Rules
              </Text>
              <Text className="text-[11px] font-bold text-[#7A76A6] mt-0.5" numberOfLines={1}>
                Workforce analytics, payroll rules & shifts
              </Text>
            </View>
          </View>

          <View className="bg-[#EEECFA] border border-[#5B4FD1]/20 px-2.5 py-1 rounded-full shrink-0">
            <Text className="text-[10px] font-black text-[#5B4FD1] uppercase tracking-wider">
              Admin Engine
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Top Segmented Tabs Bar */}
      <View className="mb-4">
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
          className="bg-[#EEECFA]/70 p-1.5 rounded-2xl border border-[#E7E4F5]"
        >
          {[
            { id: "reports", label: "Reports Hub", icon: FileSpreadsheet },
            { id: "salCalc", label: "Salary Calc", icon: Calculator },
            { id: "shifts", label: "Shift Engine", icon: Clock },
            { id: "deductions", label: "Deductions", icon: Percent },
            { id: "payslipConfig", label: "Payslip Format", icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id as any)}
                className={`h-9 px-3.5 rounded-xl flex-row items-center justify-center ${
                  isActive ? "bg-[#5B4FD1] shadow-xs" : ""
                }`}
              >
                <Icon size={14} color={isActive ? "#FFFFFF" : "#7A76A6"} />
                <Text className={`text-xs font-black ml-1.5 ${isActive ? "text-white" : "text-[#7A76A6]"}`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ========================================================================= */}
      {/* TAB 1: SAL CALCULATION TAB (UNTOUCHED LOGIC & INPUTS)                     */}
      {/* ========================================================================= */}
      {activeTab === "salCalc" && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} className="flex-1">
          {/* Cycle Mode Switcher */}
          <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-xs mb-4">
            <Text className="text-[11px] font-black text-[#1F1B3D] uppercase tracking-wider mb-3">
              Calculation Mode & Base Setup
            </Text>
            <View className="flex-row gap-2">
              {[
                { id: "MONTHLY", label: "Monthly Cycle" },
                { id: "DAY_WISE", label: "Day-Wise" },
                { id: "WEEKLY", label: "Weekly" },
              ].map((m) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => setCalcMode(m.id as any)}
                  className={`flex-1 py-2.5 rounded-xl items-center border ${
                    calcMode === m.id
                      ? "bg-[#5B4FD1] border-[#5B4FD1] shadow-xs"
                      : "bg-[#F6F5FC] border-[#E7E4F5]"
                  }`}
                >
                  <Text className={`text-xs font-black ${calcMode === m.id ? "text-white" : "text-[#1F1B3D]"}`}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Input Parameters Card */}
          <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-xs mb-4 gap-3.5">
            <Text className="text-[11px] font-black text-[#1F1B3D] uppercase tracking-wider">
              Simulation Inputs
            </Text>

            {/* Base Salary Input */}
            <View>
              <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                Base Monthly Salary (USD)
              </Text>
              <View className="flex-row items-center bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-2.5">
                <DollarSign size={16} color="#5B4FD1" />
                <TextInput
                  value={calcBasicSalary}
                  onChangeText={setCalcBasicSalary}
                  keyboardType="numeric"
                  placeholder="e.g. 3200"
                  placeholderTextColor="#A6A2CE"
                  className="flex-1 ml-1 text-xs font-bold text-[#1F1B3D]"
                />
              </View>
            </View>

            {/* Mode-specific Fields */}
            {calcMode === "DAY_WISE" ? (
              <View className="flex-row gap-2.5">
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                    Month Total Days
                  </Text>
                  <TextInput
                    value={totalMonthDays}
                    onChangeText={setTotalMonthDays}
                    keyboardType="numeric"
                    className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                    Payable Attended Days
                  </Text>
                  <TextInput
                    value={workedDays}
                    onChangeText={setWorkedDays}
                    keyboardType="numeric"
                    className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-black text-[#5B4FD1]"
                  />
                </View>
              </View>
            ) : calcMode === "WEEKLY" ? (
              <View className="flex-row gap-2.5">
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                    Weeks Payable
                  </Text>
                  <TextInput
                    value={workedWeeks}
                    onChangeText={setWorkedWeeks}
                    keyboardType="numeric"
                    className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-black text-[#5B4FD1]"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                    Calculated Weekly Rate
                  </Text>
                  <View className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 justify-center">
                    <Text className="text-xs font-bold text-[#1F1B3D]">
                      ${calculatedSalary.weeklyRate.toFixed(2)} / wk
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="bg-[#EEECFA]/70 border border-[#5B4FD1]/20 rounded-xl p-3">
                <Text className="text-[11px] font-bold text-[#7A76A6]">
                  Standard Daily Wage Rate:{" "}
                  <Text className="text-[#5B4FD1] font-black">
                    ${calculatedSalary.dailyRate.toFixed(2)} / day
                  </Text>{" "}
                  (Based on {totalMonthDays} days)
                </Text>
              </View>
            )}

            {/* Allowances & OT */}
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                  Allowances (HRA/Special)
                </Text>
                <TextInput
                  value={allowancesRate}
                  onChangeText={setAllowancesRate}
                  keyboardType="numeric"
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                  Overtime (Hours)
                </Text>
                <TextInput
                  value={overtimeHours}
                  onChangeText={setOvertimeHours}
                  keyboardType="numeric"
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]"
                />
              </View>
            </View>
          </View>

          {/* Take-Home Net Result Banner */}
          <View className="bg-[#5B4FD1] rounded-3xl p-6 shadow-md mb-4 relative overflow-hidden">
            <View className="absolute -right-6 -bottom-8 w-44 h-44 rounded-full bg-white/10 pointer-events-none" />
            <Text className="text-xs font-bold text-purple-200 uppercase tracking-wider">
              Automated Calculated Take-Home Salary
            </Text>
            <Text className="text-3xl font-black text-white mt-1.5 tracking-tight">
              ${calculatedSalary.netSalary.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>

            <View className="flex-row justify-between pt-3 mt-3 border-t border-white/20">
              <Text className="text-xs font-medium text-white/80">
                Gross: <Text className="font-black text-white">${calculatedSalary.grossSalary.toFixed(2)}</Text>
              </Text>
              <Text className="text-xs font-medium text-rose-200">
                Deductions: <Text className="font-black text-white">-${calculatedSalary.totalDeductions.toFixed(2)}</Text>
              </Text>
            </View>
          </View>

          {/* Itemized Audit List */}
          <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-xs divide-y divide-slate-100">
            <Text className="text-[11px] font-black text-[#1F1B3D] uppercase tracking-wider pb-2">
              Itemized Computation Details
            </Text>

            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-[#7A76A6]">Computed Basic Pay</Text>
              <Text className="text-xs font-black text-[#1F1B3D]">${calculatedSalary.earnedBasic.toFixed(2)}</Text>
            </View>

            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-[#7A76A6]">Fixed Allowances</Text>
              <Text className="text-xs font-black text-[#1F1B3D]">${calculatedSalary.allowances.toFixed(2)}</Text>
            </View>

            {calculatedSalary.otPay > 0 && (
              <View className="py-2.5 flex-row justify-between items-center">
                <Text className="text-xs font-bold text-[#7A76A6]">Overtime ({overtimeHours}h @ ${otHourlyRate}/h)</Text>
                <Text className="text-xs font-black text-emerald-600">+${calculatedSalary.otPay.toFixed(2)}</Text>
              </View>
            )}

            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-[#7A76A6]">Employee PF ({pfPercent}%)</Text>
              <Text className="text-xs font-black text-[#E4453C]">-${calculatedSalary.pfAmount.toFixed(2)}</Text>
            </View>

            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-[#7A76A6]">TDS Income Tax ({tdsBasePercent}%)</Text>
              <Text className="text-xs font-black text-[#E4453C]">-${calculatedSalary.tdsAmount.toFixed(2)}</Text>
            </View>

            <View className="py-2.5 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-[#7A76A6]">Health Insurance</Text>
              <Text className="text-xs font-black text-[#E4453C]">-${calculatedSalary.insurance.toFixed(2)}</Text>
            </View>
          </View>
        </ScrollView>
      )}

{/* ========================================================================= */}
{/* TAB 2: REPORTS HUB (MNC ENTERPRISE - WITH ADVANCED FILTERS)                */}
{/* ========================================================================= */}
{activeTab === "reports" && (
  <ScrollView 
    showsVerticalScrollIndicator={false} 
    contentContainerStyle={{ paddingBottom: 120 }} 
    className="flex-1"
  >
    <View className="max-w-5xl mx-auto w-full gap-4">
      
      {/* 1. ADVANCED FILTER & PARAMETER CONTROL PANEL */}
      <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-xs gap-4">
        <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
          <View>
            <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
              MNC Enterprise Report Filters
            </Text>
            <Text className="text-[10px] font-semibold text-[#7A76A6]">
              Filter by date range, department, shift profile, and report category
            </Text>
          </View>
          <View className="bg-[#EEECFA] px-2.5 py-1 rounded-full border border-[#5B4FD1]/20">
            <Text className="text-[10px] font-black text-[#5B4FD1] uppercase">Active Engine</Text>
          </View>
        </View>

        {/* Filter Grid: Report Name Type / Category Filter */}
        <View>
          <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-2">Report Category Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
            {[
              { id: "ALL", label: "All Master Reports" },
              { id: "ATTENDANCE", label: "Attendance Summary" },
              { id: "SALARY", label: "Salary Details & Register" },
              { id: "STATUTORY", label: "Statutory & Tax" },
            ].map((cat) => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedReportCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl border ${
                  selectedReportCategory === cat.id
                    ? "bg-[#5B4FD1] border-[#5B4FD1]"
                    : "bg-[#F6F5FC] border-[#E7E4F5]"
                }`}
              >
                <Text className={`text-xs font-bold ${selectedReportCategory === cat.id ? "text-white" : "text-[#1F1B3D]"}`}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Filter Row: Department & Shift */}
        <View className="flex-col md:flex-row gap-3">
          <View className="flex-1">
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">Department</Text>
            <TextInput
              value={filterDepartment}
              onChangeText={setFilterDepartment}
              placeholder="e.g. Engineering, HR, All"
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]"
            />
          </View>

          <View className="flex-1">
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">Shift Profile</Text>
            <TextInput
              value={filterShift}
              onChangeText={setFilterShift}
              placeholder="e.g. General, Night, Rotational"
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]"
            />
          </View>
        </View>

        {/* Filter Row: Date Range & Salary Bracket */}
        <View className="flex-col md:flex-row gap-3">
          <View className="flex-1">
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">Date Range (Start - End)</Text>
            <View className="flex-row items-center bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-3">
              <Calendar size={16} color="#5B4FD1" />
              <TextInput
                value={dateRange}
                onChangeText={setDateRange}
                placeholder="YYYY-MM-DD to YYYY-MM-DD"
                className="flex-1 ml-2 text-xs font-bold text-[#1F1B3D]"
              />
            </View>
          </View>

          <View className="flex-1">
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">Salary Tier / Min Bracket</Text>
            <TextInput
              value={salaryFilter}
              onChangeText={setSalaryFilter}
              placeholder="e.g. > $3000 or All"
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]"
            />
          </View>
        </View>
      </View>

      {/* Cycle Configuration Status Bar */}
      <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 flex-row items-center justify-between shadow-xs">
        <View className="flex-row items-center gap-2">
          <Calendar size={18} color="#5B4FD1" />
          <Text className="text-xs font-bold text-[#1F1B3D]">Active Window: {dateRange || selectedMonth}</Text>
        </View>
        <View className="bg-[#E7FAEE] px-3 py-1 rounded-md border border-[#1FAE5C]/30">
          <Text className="text-[11px] font-black text-[#1FAE5C]">Filtered Records Ready</Text>
        </View>
      </View>

      {/* DYNAMIC REPORT CARD 1: Attendance & Biometrics Master */}
      {(selectedReportCategory === "ALL" || selectedReportCategory === "ATTENDANCE") && (
        <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-xs flex-col md:flex-row md:items-center justify-between gap-4">
          <View className="flex-row items-center gap-3.5 flex-1 pr-2">
            <View className="w-12 h-12 rounded-2xl bg-[#EEECFA] items-center justify-center shrink-0">
              <FileSpreadsheet size={22} color="#5B4FD1" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm md:text-base font-black text-[#1F1B3D]">
                  Attendance Summary & Biometrics Master
                </Text>
                <View className="bg-[#EEECFA] px-2 py-0.5 rounded-md hidden sm:flex">
                  <Text className="text-[9px] font-black text-[#5B4FD1] uppercase">Time & GPS</Text>
                </View>
              </View>
              <Text className="text-xs font-medium text-[#7A76A6] mt-0.5">
                Dept: {filterDepartment || "All"} | Shift: {filterShift || "All"} • Check-in, OD & LOP summaries
              </Text>
            </View>
          </View>

          <View className="flex-row gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 md:shrink-0">
            <TouchableOpacity 
              onPress={() => handleDownloadWithFilters("Attendance Summary", "CSV")}
              activeOpacity={0.85}
              className="flex-1 md:flex-none md:w-36 bg-[#F6F5FC] border border-[#E7E4F5] py-2.5 px-3.5 rounded-xl items-center flex-row justify-center active:bg-slate-100"
            >
              <Download size={14} color="#1F1B3D" />
              <Text className="text-xs font-bold text-[#1F1B3D] ml-1.5">Export CSV</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => handleDownloadWithFilters("Attendance Summary", "PDF")}
              activeOpacity={0.85}
              className="flex-1 md:flex-none md:w-36 bg-[#5B4FD1] py-2.5 px-3.5 rounded-xl items-center flex-row justify-center active:opacity-90 shadow-xs"
            >
              <Download size={14} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white ml-1.5">Export PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* DYNAMIC REPORT CARD 2: Gross-to-Net Salary Register */}
      {(selectedReportCategory === "ALL" || selectedReportCategory === "SALARY") && (
        <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-xs flex-col md:flex-row md:items-center justify-between gap-4">
          <View className="flex-row items-center gap-3.5 flex-1 pr-2">
            <View className="w-12 h-12 rounded-2xl bg-[#FEF2D9] items-center justify-center shrink-0">
              <FileText size={22} color="#D08A0C" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm md:text-base font-black text-[#1F1B3D]">
                  Salary Details & Gross-to-Net Register
                </Text>
                <View className="bg-[#FEF2D9] px-2 py-0.5 rounded-md hidden sm:flex">
                  <Text className="text-[9px] font-black text-[#D08A0C] uppercase">Payroll Audit</Text>
                </View>
              </View>
              <Text className="text-xs font-medium text-[#7A76A6] mt-0.5">
                Dept: {filterDepartment || "All"} | Sal Tier: {salaryFilter || "All"} • CTC, Allowances & TDS
              </Text>
            </View>
          </View>

          <View className="flex-row gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 md:shrink-0">
            <TouchableOpacity 
              onPress={() => handleDownloadWithFilters("Salary Details", "CSV")}
              activeOpacity={0.85}
              className="flex-1 md:flex-none md:w-36 bg-[#F6F5FC] border border-[#E7E4F5] py-2.5 px-3.5 rounded-xl items-center flex-row justify-center active:bg-slate-100"
            >
              <Download size={14} color="#1F1B3D" />
              <Text className="text-xs font-bold text-[#1F1B3D] ml-1.5">Export CSV</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => handleDownloadWithFilters("Salary Details", "PDF")}
              activeOpacity={0.85}
              className="flex-1 md:flex-none md:w-36 bg-[#5B4FD1] py-2.5 px-3.5 rounded-xl items-center flex-row justify-center active:opacity-90 shadow-xs"
            >
              <Download size={14} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white ml-1.5">Export PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </View>
  </ScrollView>
)}

      {/* ========================================================================= */}
      {/* TAB 3: SHIFT ENGINE (ALIGNED RESPONSIVELY FOR MOBILE AND WEB)              */}
      {/* ========================================================================= */}
      {activeTab === "shifts" && (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: 120 }} 
          className="flex-1"
        >
          {/* Main Governance Card */}
          <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 md:p-5 shadow-xs mb-4 gap-4">
            {/* Header: Title and Action Button (Auto-wrapping to eliminate horizontal clipping) */}
            <View className="flex-col sm:flex-row sm:items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-base font-black text-[#1F1B3D] tracking-tight">
                  Enterprise Shift Governance
                </Text>
                <Text className="text-xs font-medium text-[#7A76A6] mt-0.5">
                  Departmental deployments and template configurations
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setBulkDeptModal(true)}
                className="bg-[#5B4FD1] px-3.5 py-2.5 rounded-xl flex-row items-center justify-center shadow-xs active:opacity-90 self-start sm:self-auto"
              >
                <Users size={14} color="#FFFFFF" />
                <Text className="text-white text-xs font-black ml-1.5">Assign by Dept</Text>
              </TouchableOpacity>
            </View>

            {/* Corporate Work Week Module */}
            <View className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl p-3.5 gap-2.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-[10px] font-black text-[#1F1B3D] uppercase tracking-wider">
                  Corporate Work Week
                </Text>
                <View className="bg-[#E7FAEE] px-2 py-0.5 rounded-md border border-[#1FAE5C]/30">
                  <Text className="text-[9px] font-black text-[#1FAE5C] uppercase">Enforced</Text>
                </View>
              </View>

              {/* 3 Work-Week Buttons with structured height and multi-line formatting */}
              <View className="flex-row gap-2">
                {[
                  { id: "5_DAYS", label: "5 Days", sub: "(Mon-Fri)" },
                  { id: "ALT_SAT", label: "Alt Sat", sub: "(2nd/4th Off)" },
                  { id: "6_DAYS", label: "6 Days", sub: "(Mon-Sat)" },
                ].map((opt) => {
                  const isSelected = workCyclePolicy === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => setWorkCyclePolicy(opt.id as any)}
                      className={`flex-1 py-2.5 px-1 rounded-xl border items-center justify-center min-h-[50px] ${
                        isSelected 
                          ? "bg-[#5B4FD1] border-[#5B4FD1] shadow-xs" 
                          : "bg-white border-[#E7E4F5] active:bg-slate-50"
                      }`}
                    >
                      <Text className={`text-[11px] font-black text-center ${isSelected ? "text-white" : "text-[#1F1B3D]"}`}>
                        {opt.label}
                      </Text>
                      <Text className={`text-[9.5px] font-bold text-center mt-0.5 ${isSelected ? "text-purple-100" : "text-[#7A76A6]"}`}>
                        {opt.sub}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Sub-Switch: Live Roster vs Shift Templates */}
            <View className="flex-row bg-[#EEECFA]/70 p-1.5 rounded-2xl border border-[#E7E4F5]">
              <TouchableOpacity
                onPress={() => setShiftSubTab("roster")}
                className={`flex-1 py-2 rounded-xl items-center justify-center ${
                  shiftSubTab === "roster" ? "bg-white shadow-xs" : ""
                }`}
              >
                <Text className={`text-xs font-black ${shiftSubTab === "roster" ? "text-[#5B4FD1]" : "text-[#7A76A6]"}`}>
                  Employee Roster ({rosterData.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShiftSubTab("templates")}
                className={`flex-1 py-2 rounded-xl items-center justify-center ${
                  shiftSubTab === "templates" ? "bg-white shadow-xs" : ""
                }`}
              >
                <Text className={`text-xs font-black ${shiftSubTab === "templates" ? "text-[#5B4FD1]" : "text-[#7A76A6]"}`}>
                  Shift Templates ({shiftTemplates.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* VIEW A: SHIFT TEMPLATES LIST */}
          {shiftSubTab === "templates" && (
            <View className="gap-3">
              {shiftTemplates.map((template) => (
                <View 
                  key={template.id}
                  className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs flex-row justify-between items-center"
                >
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-sm font-black text-[#1F1B3D]">
                        {template.name}
                      </Text>
                      <View className="bg-[#EEECFA] px-2 py-0.5 rounded-md">
                        <Text className="text-[10px] font-black text-[#5B4FD1]">
                          {template.id}
                        </Text>
                      </View>
                    </View>

                    <Text className="text-xs font-bold text-[#5B4FD1]">
                      {template.startTime} - {template.endTime}
                    </Text>
                    <Text className="text-[11px] font-medium text-[#7A76A6] mt-0.5">
                      Grace Buffer: {template.graceTime} • Work Cycle: {template.workCycle}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      setActiveTemplate(template);
                      setEditTemplateModal(true);
                    }}
                    className="w-10 h-10 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5] items-center justify-center active:bg-[#EEECFA]"
                  >
                    <Edit3 size={16} color="#5B4FD1" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* VIEW B: EMPLOYEE ROSTER & USER-LEVEL SHIFT REASSIGNMENT */}
          {shiftSubTab === "roster" && (
            <View className="gap-3">
              {/* Search Field */}
              <View className="bg-white border border-[#E7E4F5] rounded-2xl px-3.5 py-3 shadow-xs flex-row items-center gap-2">
                <Search size={16} color="#7A76A6" />
                <TextInput
                  value={searchRosterText}
                  onChangeText={setSearchRosterText}
                  placeholder="Filter by name, ID or department..."
                  placeholderTextColor="#A6A2CE"
                  className="flex-1 text-xs font-bold text-[#1F1B3D]"
                />
              </View>

              {/* Roster Cards */}
              {filteredRoster.map((item) => (
                <View 
                  key={item.empId} 
                  className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs"
                >
                  <View className="flex-row justify-between items-start mb-2.5">
                    <View>
                      <Text className="text-sm font-black text-[#1F1B3D]">{item.name}</Text>
                      <Text className="text-[11px] font-bold text-[#7A76A6] mt-0.5">
                        {item.empId} • {item.department}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => {
                        setSelectedUserForShift(item);
                        setSingleAssignModal(true);
                      }}
                      className="bg-[#EEECFA] border border-[#5B4FD1]/30 px-2.5 py-1.5 rounded-lg flex-row items-center active:opacity-80"
                    >
                      <SlidersHorizontal size={11} color="#5B4FD1" />
                      <Text className="text-[10px] font-black text-[#5B4FD1] ml-1">Change Shift</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 flex-row justify-between items-center">
                    <View>
                      <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Active Shift Assignment</Text>
                      <Text className="text-xs font-black text-[#1F1B3D] mt-0.5">{item.shiftName}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-xs font-black text-[#5B4FD1]">{item.timing}</Text>
                      <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5">Grace: {item.graceTime}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DEDUCTIONS TAB (UNTOUCHED LOGIC & INPUTS)                          */}
      {/* ========================================================================= */}
      {activeTab === "deductions" && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} className="flex-1">
          <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-xs gap-4 mb-4">
            <View className="flex-row justify-between items-center pb-2 border-b border-slate-100">
              <View>
                <Text className="text-sm font-black text-[#1F1B3D]">Statutory Deduction Rules</Text>
                <Text className="text-[10px] font-semibold text-[#7A76A6]">Enterprise parameters applied company-wide</Text>
              </View>
              <Percent size={18} color="#5B4FD1" />
            </View>

            <View>
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-xs font-bold text-[#1F1B3D]">Employee Provident Fund (PF)</Text>
                <Text className="text-xs font-black text-[#5B4FD1]">{pfPercent}% of Basic</Text>
              </View>
              <View className="flex-row items-center bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-2.5">
                <TextInput 
                  value={pfPercent} 
                  onChangeText={setPfPercent}
                  keyboardType="numeric"
                  className="flex-1 text-xs font-bold text-[#1F1B3D]" 
                />
                <Text className="text-xs font-bold text-[#7A76A6]">%</Text>
              </View>
            </View>

            <View>
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-xs font-bold text-[#1F1B3D]">Income Tax TDS Baseline</Text>
                <Text className="text-xs font-black text-[#5B4FD1]">{tdsBasePercent}%</Text>
              </View>
              <View className="flex-row items-center bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-2.5">
                <TextInput 
                  value={tdsBasePercent} 
                  onChangeText={setTdsBasePercent}
                  keyboardType="numeric"
                  className="flex-1 text-xs font-bold text-[#1F1B3D]" 
                />
                <Text className="text-xs font-bold text-[#7A76A6]">%</Text>
              </View>
            </View>

            <View>
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-xs font-bold text-[#1F1B3D]">Monthly Health Insurance Premium</Text>
                <Text className="text-xs font-black text-[#E4453C]">${healthInsuranceDeduction}</Text>
              </View>
              <View className="flex-row items-center bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-2.5">
                <Text className="text-xs font-bold text-[#7A76A6] mr-1">$</Text>
                <TextInput 
                  value={healthInsuranceDeduction} 
                  onChangeText={setHealthInsuranceDeduction}
                  keyboardType="numeric"
                  className="flex-1 text-xs font-bold text-[#1F1B3D]" 
                />
              </View>
            </View>

            <TouchableOpacity 
              onPress={() => handleSaveConfig("Deduction rules")}
              className="bg-[#5B4FD1] py-3.5 rounded-xl items-center mt-2 shadow-xs active:opacity-90"
            >
              <Text className="text-white font-black text-xs uppercase tracking-wider">Save Deduction Configurations</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PAYSLIP CONFIG TAB (UNTOUCHED LOGIC & INPUTS)                      */}
      {/* ========================================================================= */}
     {activeTab === "payslipConfig" && (
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} className="flex-1">
    <View className="bg-white border border-[#E7E4F5] rounded-3xl p-6 shadow-xs gap-6 mb-4">
      
      {/* Header Info */}
      <View className="flex-row justify-between items-center pb-3 border-b border-slate-100">
        <View>
          <Text className="text-sm font-black text-[#1F1B3D]">MNC Payslip Template & Parameter Builder</Text>
          <Text className="text-[10px] font-semibold text-[#7A76A6]">Configure statutory fields, corporate identifiers, and salary head toggles</Text>
        </View>
        <Layers size={18} color="#5B4FD1" />
      </View>

      {/* SECTION 1: Corporate Identity & Signatory */}
      <View className="gap-3">
        <Text className="text-xs font-black text-[#5B4FD1] uppercase tracking-wider">1. Corporate Identity</Text>
        
        <View>
          <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">Company Legal Entity Title</Text>
          <TextInput 
            value={companyHeader} 
            onChangeText={setCompanyHeader}
            placeholder="e.g. PayCore Global Technologies Inc."
            className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]" 
          />
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">Corporate Tax / EIN ID</Text>
            <TextInput 
              value={companyTaxId} 
              onChangeText={setCompanyTaxId}
              placeholder="e.g. XX-XXXXXXX"
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]" 
            />
          </View>
          <View className="flex-1">
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">Authorized Signatory Title</Text>
            <TextInput 
              value={authorizedSignatory} 
              onChangeText={setAuthorizedSignatory}
              placeholder="e.g. HR Operations Director"
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]" 
            />
          </View>
        </View>
      </View>

      {/* SECTION 2: MNC Mandatory Display Toggles (Add / Remove Params) */}
      <View className="gap-3 pt-2 border-t border-slate-100">
        <Text className="text-xs font-black text-[#5B4FD1] uppercase tracking-wider">2. Template Field Toggles (Add / Remove Params)</Text>
        <Text className="text-[10px] text-[#7A76A6]">Enable or disable specific blocks to comply with regional MNC payroll requirements.</Text>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
          {[
            { id: "showPfUan", label: "Statutory IDs (PF / UAN / Insurance)", state: showPfUan, setter: setShowPfUan },
            { id: "showBankDetails", label: "Bank Account & Routing Info", state: showBankDetails, setter: setShowBankDetails },
            { id: "showOvertime", label: "Overtime & Extra Hours Breakdown", state: showOvertime, setter: setShowOvertime },
            { id: "showBonus", label: "Performance Bonus & Incentives", state: showBonus, setter: setShowBonus },
            { id: "showYtd", label: "YTD (Year-to-Date) Earnings Summary", state: showYtd, setter: setShowYtd },
            { id: "showHrNotes", label: "Standard HR Policy Disclaimer Footnote", state: showHrNotes, setter: setShowHrNotes },
          ].map((toggle) => (
            <TouchableOpacity
              key={toggle.id}
              onPress={() => toggle.setter(!toggle.state)}
              className="flex-row items-center justify-between p-3 bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl"
            >
              <Text className="text-xs font-bold text-[#1F1B3D]">{toggle.label}</Text>
              <View className={`w-5 h-5 rounded-md border items-center justify-center ${toggle.state ? "bg-[#5B4FD1] border-[#5B4FD1]" : "border-slate-300 bg-white"}`}>
                {toggle.state && <Text className="text-white text-xs font-black">✓</Text>}
              </View>
            </TouchableOpacity>
          ))}
        </div>
      </View>

      {/* SECTION 3: Standard Custom Footer / Disclaimer */}
      <View className="gap-3 pt-2 border-t border-slate-100">
        <Text className="text-xs font-black text-[#5B4FD1] uppercase tracking-wider">3. HR Footnote Note</Text>
        <TextInput 
          value={hrDisclaimerNote}
          onChangeText={setHrDisclaimerNote}
          multiline
          numberOfLines={3}
          placeholder="For any discrepancies, please contact HR within 5 working days."
          className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-semibold text-[#1F1B3D] h-20 text-top"
        />
      </View>

      {/* Save Button */}
      <TouchableOpacity 
        onPress={() => handleSaveConfig("MNC Payslip Template layout & parameters")}
        className="bg-[#5B4FD1] py-4 rounded-xl items-center mt-2 shadow-xs active:opacity-90"
      >
        <Text className="text-white font-black text-xs uppercase tracking-wider">Commit MNC Template Settings</Text>
      </TouchableOpacity>

    </View>
  </ScrollView>
)}

      {/* ========================================================================= */}
      {/* MODAL 1: REASSIGN SINGLE USER SHIFT                                       */}
      {/* ========================================================================= */}
      <Modal visible={singleAssignModal} transparent animationType="fade">
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setSingleAssignModal(false)}
          className="flex-1 bg-black/40 justify-center items-center p-5"
        >
          <View className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-xl border border-[#E7E4F5] gap-3">
            <Text className="text-sm font-black text-[#1F1B3D]">
              Assign Shift • {selectedUserForShift?.name}
            </Text>
            <Text className="text-xs font-bold text-[#7A76A6]">
              {selectedUserForShift?.empId} • {selectedUserForShift?.department}
            </Text>

            <View className="gap-2 pt-1">
              {shiftTemplates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  onPress={() => handleAssignSingleUserShift(template)}
                  className="bg-[#F6F5FC] border border-[#E7E4F5] p-3 rounded-xl flex-row justify-between items-center active:bg-[#EEECFA]"
                >
                  <View>
                    <Text className="text-xs font-black text-[#1F1B3D]">{template.name}</Text>
                    <Text className="text-[10px] font-semibold text-[#5B4FD1] mt-0.5">{template.startTime} - {template.endTime}</Text>
                  </View>
                  <CheckCircle2 size={16} color="#5B4FD1" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: BULK DEPARTMENT ASSIGNMENT                                       */}
      {/* ========================================================================= */}
      <Modal visible={bulkDeptModal} transparent animationType="fade">
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setBulkDeptModal(false)}
          className="flex-1 bg-black/40 justify-center items-center p-5"
        >
          <View className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-xl border border-[#E7E4F5] gap-3.5">
            <Text className="text-sm font-black text-[#1F1B3D]">Bulk Shift Assignment by Dept</Text>
            
            <View>
              <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">Select Department</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {departmentsList.map((dept) => (
                  <TouchableOpacity
                    key={dept}
                    onPress={() => setBulkTargetDept(dept)}
                    className={`px-3 py-1.5 rounded-lg border ${bulkTargetDept === dept ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"}`}
                  >
                    <Text className={`text-xs font-bold ${bulkTargetDept === dept ? "text-white" : "text-[#1F1B3D]"}`}>{dept}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View>
              <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">Select Target Shift</Text>
              {shiftTemplates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  onPress={() => setBulkTargetShiftId(template.id)}
                  className={`p-2.5 rounded-xl border mb-1.5 flex-row justify-between items-center ${bulkTargetShiftId === template.id ? "bg-[#EEECFA] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"}`}
                >
                  <Text className="text-xs font-bold text-[#1F1B3D]">{template.name}</Text>
                  <Text className="text-[10px] font-semibold text-[#5B4FD1]">{template.startTime} - {template.endTime}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleBulkDeptAssign}
              className="bg-[#5B4FD1] py-3 rounded-xl items-center mt-1 active:opacity-90 shadow-xs"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">Apply to Department</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT SHIFT TIMINGS & PARAMETERS                                 */}
      {/* ========================================================================= */}
      <Modal visible={editTemplateModal} transparent animationType="fade">
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setEditTemplateModal(false)}
          className="flex-1 bg-black/40 justify-center items-center p-5"
        >
          {activeTemplate && (
            <View className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-xl border border-[#E7E4F5] gap-3">
              <Text className="text-sm font-black text-[#1F1B3D]">Configure Shift Timing</Text>
              
              <View>
                <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1">Shift Name</Text>
                <TextInput
                  value={activeTemplate.name}
                  onChangeText={(val) => setActiveTemplate({ ...activeTemplate, name: val })}
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-2.5 text-xs font-bold text-[#1F1B3D]"
                />
              </View>

              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1">Start Time</Text>
                  <TextInput
                    value={activeTemplate.startTime}
                    onChangeText={(val) => setActiveTemplate({ ...activeTemplate, startTime: val })}
                    className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-2.5 text-xs font-bold text-[#1F1B3D]"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1">End Time</Text>
                  <TextInput
                    value={activeTemplate.endTime}
                    onChangeText={(val) => setActiveTemplate({ ...activeTemplate, endTime: val })}
                    className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-2.5 text-xs font-bold text-[#1F1B3D]"
                  />
                </View>
              </View>

              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1">Grace Period</Text>
                  <TextInput
                    value={activeTemplate.graceTime}
                    onChangeText={(val) => setActiveTemplate({ ...activeTemplate, graceTime: val })}
                    className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-2.5 text-xs font-bold text-[#1F1B3D]"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1">Work Cycle</Text>
                  <TextInput
                    value={activeTemplate.workCycle}
                    onChangeText={(val) => setActiveTemplate({ ...activeTemplate, workCycle: val })}
                    className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-2.5 text-xs font-bold text-[#1F1B3D]"
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSaveShiftTemplate}
                className="bg-[#5B4FD1] py-3 rounded-xl items-center mt-2 active:opacity-90 shadow-xs"
              >
                <Text className="text-white text-xs font-black uppercase tracking-wider">Save Shift Parameters</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </ScreenContainer>
  );
}