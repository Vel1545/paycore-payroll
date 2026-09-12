import React, { useState, useMemo } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  Alert, 
  ActivityIndicator,
  Modal 
} from "react-native";
import { 
  ChevronLeft, Search, Download, SlidersHorizontal,
  ShieldCheck, CheckSquare, Square, X, Calendar, DollarSign, Building 
} from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import ScreenContainer from "../components/ScreenContainer";

interface EmployeeRecord {
  id: string;
  name: string;
  role: string;
  dept: string;
  joinDate: string; // YYYY-MM-DD format
  ctc: number;
  status: "Active" | "On Leave" | "Probation";
}

interface ExportColumn {
  key: keyof EmployeeRecord | "role";
  label: string;
  selected: boolean;
}

const LOCAL_IP = "192.168.31.133";
const REPORT_API_URL = Platform.OS === "web"
  ? "http://192.168.31.133:8080/api/admin/reports/employees/excel"
  : `http://${LOCAL_IP}:8080/api/admin/reports/employees/excel`;

const INITIAL_EMPLOYEES: EmployeeRecord[] = [
  { id: "EMP-1042", name: "Marcus Sterling", role: "Principal Tech Lead", dept: "Engineering", joinDate: "2024-03-15", ctc: 6500, status: "Active" },
  { id: "EMP-2031", name: "Sarah Jenkins", role: "Software Engineer I", dept: "Engineering", joinDate: "2025-06-01", ctc: 4800, status: "Active" },
  { id: "EMP-4092", name: "David Miller", role: "Senior Data Analyst", dept: "Product", joinDate: "2024-11-20", ctc: 5600, status: "Active" },
  { id: "EMP-3011", name: "Alex Richardson", role: "Senior Product Designer", dept: "Design", joinDate: "2025-01-10", ctc: 5200, status: "On Leave" },
  { id: "EMP-5088", name: "Priya Sharma", role: "Principal DevOps Lead", dept: "DevOps", joinDate: "2024-01-25", ctc: 7200, status: "Active" },
  { id: "EMP-6014", name: "Elena Gomez", role: "HR Operations Lead", dept: "HR", joinDate: "2025-08-12", ctc: 4500, status: "Active" },
  { id: "EMP-7023", name: "David Vance", role: "QA Automation Lead", dept: "Engineering", joinDate: "2026-02-01", ctc: 4900, status: "Probation" },
  { id: "EMP-8045", name: "Michael Chang", role: "Frontend Architect", dept: "Engineering", joinDate: "2024-07-18", ctc: 6800, status: "Active" },
];

export default function UserDirectoryScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedSalRange, setSelectedSalRange] = useState("All");
  const [selectedYear, setSelectedYear] = useState("All");
  const [sortBy, setSortBy] = useState<"name" | "ctc" | "joinDate">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isExporting, setIsExporting] = useState(false);

  // Column Selector Modal State for Custom Specific Column Exports
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportColumns, setExportColumns] = useState<ExportColumn[]>([
    { key: "id", label: "Employee ID", selected: true },
    { key: "name", label: "Employee Name", selected: true },
    { key: "dept", label: "Department", selected: true },
    { key: "role", label: "Designation / Role", selected: true },
    { key: "joinDate", label: "Joining Date (DOJ)", selected: true },
    { key: "ctc", label: "Salary (CTC)", selected: true },
    { key: "status", label: "Employment Status", selected: false },
  ]);

  const departments = ["All", "Engineering", "Product", "Design", "HR", "DevOps"];
  const salaryRanges = [
    { label: "All Salaries", value: "All" },
    { label: "< $5,000", value: "low" },
    { label: "$5k - $7k", value: "mid" },
    { label: "> $7,000", value: "high" },
  ];
  const joinYears = ["All", "2026", "2025", "2024"];

  const toggleColumnSelection = (key: string) => {
    setExportColumns(prev =>
      prev.map(col => col.key === key ? { ...col, selected: !col.selected } : col)
    );
  };

  // Trigger Custom Column Export
  const handleConfirmCustomExport = async () => {
    const selectedKeys = exportColumns.filter(c => c.selected).map(c => c.key);
    if (selectedKeys.length === 0) {
      Alert.alert("Selection Required", "Please select at least one data column to export.");
      return;
    }

    setShowExportModal(false);
    try {
      setIsExporting(true);
      const queryParams = `?columns=${selectedKeys.join(",")}&dept=${selectedDept}&year=${selectedYear}&salary=${selectedSalRange}`;
      const targetUrl = `${REPORT_API_URL}${queryParams}`;

      if (Platform.OS === "web") {
        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error("Failed to generate report");

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.setAttribute("download", `Tailored_Employee_Directory_${Date.now()}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        const fileUri = `${FileSystem.documentDirectory}Tailored_Employee_Directory.xlsx`;
        const downloadRes = await FileSystem.downloadAsync(targetUrl, fileUri);

        if (downloadRes.status === 200) {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(downloadRes.uri, {
              mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              dialogTitle: "Download Tailored Report",
              UTI: "com.microsoft.excel.xlsx",
            });
          } else {
            Alert.alert("Saved", `Report downloaded to: ${downloadRes.uri}`);
          }
        } else {
          Alert.alert("Error", "Could not generate report from backend.");
        }
      }
    } catch (error) {
      Alert.alert("Export Failed", "Unable to download the tailored Excel report.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSortToggle = (field: "name" | "ctc" | "joinDate") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const filteredEmployees = useMemo(() => {
    return INITIAL_EMPLOYEES.filter((emp) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        emp.name.toLowerCase().includes(query) ||
        emp.id.toLowerCase().includes(query) ||
        emp.role.toLowerCase().includes(query);

      const matchesDept = selectedDept === "All" || emp.dept === selectedDept;
      const matchesYear = selectedYear === "All" || emp.joinDate.startsWith(selectedYear);

      let matchesSal = true;
      if (selectedSalRange === "low") matchesSal = emp.ctc < 5000;
      else if (selectedSalRange === "mid") matchesSal = emp.ctc >= 5000 && emp.ctc <= 7000;
      else if (selectedSalRange === "high") matchesSal = emp.ctc > 7000;

      return matchesSearch && matchesDept && matchesYear && matchesSal;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "ctc") {
        comparison = a.ctc - b.ctc;
      } else if (sortBy === "joinDate") {
        comparison = new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime();
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [searchQuery, selectedDept, selectedSalRange, selectedYear, sortBy, sortOrder]);

  return (
    <ScreenContainer>
      
      {/* ========================================================================= */}
      {/* 1. TOP PURPLE BANNER HEADER (Matched Design Pattern)                      */}
      {/* ========================================================================= */}
      <View className="bg-[#5B4FD1] rounded-3xl pt-4 pb-6 px-5 mb-4 shadow-xs relative overflow-hidden">
        <View 
          className="absolute -top-3 -right-4 w-20 h-20 rounded-3xl border-2 border-white/20 pointer-events-none"
          style={{ transform: [{ rotate: "20deg" }] }}
        />
        <View 
          className="absolute top-12 -left-6 w-16 h-16 rounded-2xl border-2 border-white/10 pointer-events-none"
          style={{ transform: [{ rotate: "-15deg" }] }}
        />

        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity 
            onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate("Home"))}
            className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center active:opacity-80"
          >
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View className="bg-white/20 px-3 py-1 rounded-full border border-white/25 flex-row items-center">
            <ShieldCheck size={12} color="#FFFFFF" />
            <Text className="text-[10px] font-black text-white ml-1 uppercase tracking-wider">
              MNC Corporate Directory
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xl md:text-2xl font-black text-white tracking-tight">
              Employee Directory
            </Text>
            <Text className="text-xs font-semibold text-white/80 mt-0.5">
              {filteredEmployees.length} of {INITIAL_EMPLOYEES.length} Active Records
            </Text>
          </View>

          <TouchableOpacity 
            onPress={() => setShowExportModal(true)}
            disabled={isExporting}
            className="bg-white px-4 py-2.5 rounded-xl flex-row items-center shadow-xs active:opacity-90"
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#5B4FD1" />
            ) : (
              <>
                <Download size={14} color="#5B4FD1" />
                <Text className="text-[#5B4FD1] text-xs font-black ml-1.5 uppercase">Export</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2. SEARCH BAR                                                             */}
      {/* ========================================================================= */}
      <View className="bg-white border border-[#E7E4F5] rounded-2xl px-4 py-3 flex-row items-center mb-4 shadow-xs">
        <Search size={18} color="#7A76A6" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by Employee ID, Name or Designation..."
          placeholderTextColor="#A6A2CE"
          className="flex-1 ml-2.5 text-xs font-bold text-[#1F1B3D]"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <X size={16} color="#7A76A6" />
          </TouchableOpacity>
        )}
      </View>

      {/* ========================================================================= */}
      {/* 3. STRUCTURED MNC FILTER HUBS (Group by Dept, DOJ, Salary)                 */}
      {/* ========================================================================= */}
      <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 mb-4 shadow-xs gap-4">
        
        <View className="flex-row items-center justify-between pb-2 border-b border-slate-100">
          <View className="flex-row items-center gap-2">
            <SlidersHorizontal size={15} color="#5B4FD1" />
            <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
              Advanced Filter & Grouping Hub
            </Text>
          </View>
          {(selectedDept !== "All" || selectedSalRange !== "All" || selectedYear !== "All") && (
            <TouchableOpacity 
              onPress={() => {
                setSelectedDept("All");
                setSelectedSalRange("All");
                setSelectedYear("All");
              }}
            >
              <Text className="text-[11px] font-black text-[#E4453C]">Reset All Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Group 1: Group by Department */}
        <View className="gap-1.5">
          <View className="flex-row items-center gap-1.5">
            <Building size={12} color="#7A76A6" />
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Group by Department</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {departments.map((dept) => (
              <TouchableOpacity
                key={dept}
                onPress={() => setSelectedDept(dept)}
                className={`px-3.5 py-2 rounded-xl border ${
                  selectedDept === dept ? "bg-[#5B4FD1] border-[#5B4FD1] shadow-xs" : "bg-[#F6F5FC] border-[#E7E4F5]"
                }`}
              >
                <Text className={`text-xs font-bold ${selectedDept === dept ? "text-white" : "text-[#1F1B3D]"}`}>
                  {dept}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Filter Group 2: Joining Date (DOJ Year) */}
        <View className="gap-1.5">
          <View className="flex-row items-center gap-1.5">
            <Calendar size={12} color="#7A76A6" />
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Group by Joining Year (DOJ)</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {joinYears.map((yr) => (
              <TouchableOpacity
                key={yr}
                onPress={() => setSelectedYear(yr)}
                className={`px-3.5 py-2 rounded-xl border ${
                  selectedYear === yr ? "bg-[#5B4FD1] border-[#5B4FD1] shadow-xs" : "bg-[#F6F5FC] border-[#E7E4F5]"
                }`}
              >
                <Text className={`text-xs font-bold ${selectedYear === yr ? "text-white" : "text-[#1F1B3D]"}`}>
                  {yr}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Filter Group 3: Salary Tier (CTC) */}
        <View className="gap-1.5">
          <View className="flex-row items-center gap-1.5">
            <DollarSign size={12} color="#7A76A6" />
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Filter by Salary Tier (CTC)</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {salaryRanges.map((sal) => (
              <TouchableOpacity
                key={sal.value}
                onPress={() => setSelectedSalRange(sal.value)}
                className={`px-3.5 py-2 rounded-xl border ${
                  selectedSalRange === sal.value ? "bg-[#5B4FD1] border-[#5B4FD1] shadow-xs" : "bg-[#F6F5FC] border-[#E7E4F5]"
                }`}
              >
                <Text className={`text-xs font-bold ${selectedSalRange === sal.value ? "text-white" : "text-[#1F1B3D]"}`}>
                  {sal.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

      </View>

      {/* ========================================================================= */}
      {/* 4. SORT TOGGLE CHIPS BAR                                                  */}
      {/* ========================================================================= */}
      <View className="flex-row items-center justify-between mb-3 px-1">
        <Text className="text-[11px] font-black text-[#1F1B3D] uppercase tracking-wider">
          Sort Directory ({sortOrder.toUpperCase()}):
        </Text>
        <View className="flex-row gap-2">
          {[
            { key: "name", label: "Name" },
            { key: "ctc", label: "Salary" },
            { key: "joinDate", label: "Joining Date" },
          ].map((s) => (
            <TouchableOpacity
              key={s.key}
              onPress={() => handleSortToggle(s.key as any)}
              className={`px-3 py-1 rounded-lg border ${
                sortBy === s.key ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-white border-[#E7E4F5]"
              }`}
            >
              <Text className={`text-[10px] font-black ${sortBy === s.key ? "text-white" : "text-[#1F1B3D]"}`}>
                {s.label} {sortBy === s.key ? (sortOrder === "asc" ? "↑" : "↓") : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 5. MNC EMPLOYEE DATA TABLE                                                */}
      {/* ========================================================================= */}
      <View className="bg-white border border-[#E7E4F5] rounded-3xl overflow-hidden shadow-xs mb-8">
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View>
            <View className="flex-row bg-[#150F38] px-4 py-3.5 items-center">
              <Text className="text-white text-[11px] font-black uppercase tracking-wider w-24">Emp ID</Text>
              <Text className="text-white text-[11px] font-black uppercase tracking-wider w-40">Employee Name</Text>
              <Text className="text-white text-[11px] font-black uppercase tracking-wider w-28">Department</Text>
              <Text className="text-white text-[11px] font-black uppercase tracking-wider w-28">Joining Date</Text>
              <Text className="text-white text-[11px] font-black uppercase tracking-wider w-28 text-right">Monthly CTC</Text>
              <Text className="text-white text-[11px] font-black uppercase tracking-wider w-24 text-center ml-4">Status</Text>
            </View>

            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp, idx) => (
                <View 
                  key={emp.id} 
                  className={`flex-row px-4 py-3.5 items-center border-b border-[#E7E4F5] ${
                    idx % 2 === 1 ? "bg-[#F6F5FC]" : "bg-white"
                  }`}
                >
                  <Text className="text-xs font-black text-[#5B4FD1] w-24">{emp.id}</Text>

                  <View className="w-40 pr-2">
                    <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>{emp.name}</Text>
                    <Text className="text-[10px] font-semibold text-[#7A76A6]" numberOfLines={1}>{emp.role}</Text>
                  </View>

                  <View className="w-28">
                    <View className="bg-[#EEECFA] border border-[#5B4FD1]/20 self-start px-2.5 py-0.5 rounded-md">
                      <Text className="text-[10px] font-bold text-[#5B4FD1]">{emp.dept}</Text>
                    </View>
                  </View>

                  <Text className="text-xs font-semibold text-[#7A76A6] w-28">{emp.joinDate}</Text>

                  <Text className="text-xs font-black text-[#1F1B3D] w-28 text-right">
                    ${emp.ctc.toLocaleString()}.00
                  </Text>

                  <View className="w-24 items-center ml-4">
                    <View 
                      className={`px-2.5 py-0.5 rounded-full border ${
                        emp.status === "Active" 
                          ? "bg-[#E7FAEE] border-[#1FAE5C]/20" 
                          : emp.status === "On Leave" 
                          ? "bg-[#FEF2D9] border-[#D08A0C]/20" 
                          : "bg-[#EEECFA] border-[#5B4FD1]/20"
                      }`}
                    >
                      <Text 
                        className={`text-[9.5px] font-black ${
                          emp.status === "Active" 
                            ? "text-[#1FAE5C]" 
                            : emp.status === "On Leave" 
                            ? "text-[#D08A0C]" 
                            : "text-[#5B4FD1]"
                        }`}
                      >
                        {emp.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View className="py-12 items-center justify-center w-[600px]">
                <Text className="text-xs font-bold text-[#7A76A6]">No employees match your filter criteria.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* ========================================================================= */}
      {/* 6. SPECIFIC COLUMN DATA SELECTOR EXPORT MODAL WITH SCROLLVIEW             */}
      {/* ========================================================================= */}
      <Modal visible={showExportModal} transparent animationType="fade">
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setShowExportModal(false)}
          className="flex-1 bg-black/40 justify-center items-center p-4"
        >
          <View className="w-full max-w-md bg-white border border-[#E7E4F5] rounded-3xl p-6 shadow-xl gap-4 max-h-[85%]">
            
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
              <View>
                <Text className="text-base font-black text-[#1F1B3D]">Select Specific Data Columns</Text>
                <Text className="text-[11px] font-semibold text-[#7A76A6]">Check columns to write into the Excel file</Text>
              </View>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <X size={18} color="#7A76A6" />
              </TouchableOpacity>
            </View>

            {/* Checklist items wrapped in a ScrollView to prevent content cutoffs */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {exportColumns.map((col) => (
                <TouchableOpacity
                  key={col.key}
                  onPress={() => toggleColumnSelection(col.key)}
                  className="flex-row items-center justify-between bg-[#F6F5FC] border border-[#E7E4F5] p-3.5 rounded-xl active:bg-slate-100"
                >
                  <Text className="text-xs font-black text-[#1F1B3D]">{col.label}</Text>
                  {col.selected ? (
                    <CheckSquare size={18} color="#5B4FD1" />
                  ) : (
                    <Square size={18} color="#CBD5E1" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Confirm Export Button */}
            <TouchableOpacity
              onPress={handleConfirmCustomExport}
              className="bg-[#5B4FD1] py-4 rounded-xl items-center shadow-xs active:opacity-90 mt-1"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">
                Download Tailored Excel File
              </Text>
            </TouchableOpacity>

          </View>
        </TouchableOpacity>
      </Modal>

    </ScreenContainer>
  );
}