import React, { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { 
  ArrowLeft, Search, Filter, ArrowUpDown, ChevronDown, 
  UserCheck, Download, SlidersHorizontal
} from "lucide-react-native";
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

  const departments = ["All", "Engineering", "Product", "Design", "HR", "DevOps"];
  const salaryRanges = [
    { label: "All Salaries", value: "All" },
    { label: "< $5,000", value: "low" },
    { label: "$5,000 - $7,000", value: "mid" },
    { label: "> $7,000", value: "high" },
  ];
  const joinYears = ["All", "2026", "2025", "2024"];

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
      // Search match
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        emp.name.toLowerCase().includes(query) ||
        emp.id.toLowerCase().includes(query) ||
        emp.role.toLowerCase().includes(query);

      // Dept filter
      const matchesDept = selectedDept === "All" || emp.dept === selectedDept;

      // Year filter
      const matchesYear = selectedYear === "All" || emp.joinDate.startsWith(selectedYear);

      // Salary filter
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
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            className="w-10 h-10 bg-brand-card border border-brand-border rounded-xl items-center justify-center mr-3 shadow-xs"
          >
            <ArrowLeft size={18} color="#0F172A" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-black text-brand-dark tracking-tight">Employee Directory</Text>
            <Text className="text-xs font-bold text-brand-muted">
              {filteredEmployees.length} of {INITIAL_EMPLOYEES.length} Records Found
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          onPress={() => {}}
          className="bg-brand-hero px-3.5 py-2 rounded-xl flex-row items-center active:opacity-90 shadow-xs"
        >
          <Download size={14} color="#FFFFFF" />
          <Text className="text-white text-xs font-black ml-1.5">Export</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View className="bg-brand-card border border-brand-border rounded-2xl px-4 py-3 flex-row items-center mb-4 shadow-xs">
        <Search size={18} color="#5C4D41" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by Employee ID, Name or Role..."
          placeholderTextColor="#8C7A6B"
          className="flex-1 ml-2.5 text-xs font-bold text-brand-dark"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Text className="text-xs font-black text-brand-muted">Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Section */}
      <View className="bg-brand-card border border-brand-border rounded-3xl p-4 mb-5 shadow-xs space-y-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <SlidersHorizontal size={14} color="#0D9488" />
            <Text className="text-xs font-black text-brand-dark ml-1.5 uppercase tracking-wider">
              Directory Filters
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
              <Text className="text-[11px] font-bold text-rose-600">Reset All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 1. Department Filter Pills */}
        <View>
          <Text className="text-[10px] font-black text-brand-muted uppercase tracking-wider mb-1.5">
            Department
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-1.5">
            {departments.map((dept) => (
              <TouchableOpacity
                key={dept}
                onPress={() => setSelectedDept(dept)}
                className={`px-3 py-1.5 rounded-xl border ${
                  selectedDept === dept
                    ? "bg-brand-hero border-brand-hero"
                    : "bg-brand-cardTint border-brand-border"
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    selectedDept === dept ? "text-white" : "text-brand-dark"
                  }`}
                >
                  {dept}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 2. Salary & Joining Year Row */}
        <View className="flex-row space-x-3 pt-1">
          {/* Salary Filter */}
          <View className="flex-1">
            <Text className="text-[10px] font-black text-brand-muted uppercase tracking-wider mb-1.5">
              Salary (CTC)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-1.5">
              {salaryRanges.map((sal) => (
                <TouchableOpacity
                  key={sal.value}
                  onPress={() => setSelectedSalRange(sal.value)}
                  className={`px-2.5 py-1.5 rounded-xl border ${
                    selectedSalRange === sal.value
                      ? "bg-brand-primary border-brand-primary"
                      : "bg-brand-cardTint border-brand-border"
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      selectedSalRange === sal.value ? "text-white" : "text-brand-dark"
                    }`}
                  >
                    {sal.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Join Year Filter */}
          <View className="w-36">
            <Text className="text-[10px] font-black text-brand-muted uppercase tracking-wider mb-1.5">
              Joining Year
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-1.5">
              {joinYears.map((yr) => (
                <TouchableOpacity
                  key={yr}
                  onPress={() => setSelectedYear(yr)}
                  className={`px-2.5 py-1.5 rounded-xl border ${
                    selectedYear === yr
                      ? "bg-brand-primary border-brand-primary"
                      : "bg-brand-cardTint border-brand-border"
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      selectedYear === yr ? "text-white" : "text-brand-dark"
                    }`}
                  >
                    {yr}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>

      {/* Interactive Sort Chips */}
      <View className="flex-row items-center justify-between mb-3 px-1">
        <Text className="text-[11px] font-black text-brand-dark uppercase tracking-wider">
          Sort Column ({sortOrder.toUpperCase()}):
        </Text>
        <View className="flex-row space-x-2">
          <TouchableOpacity
            onPress={() => handleSortToggle("name")}
            className={`px-2.5 py-1 rounded-lg border ${
              sortBy === "name" ? "bg-brand-hero border-brand-hero" : "bg-brand-card border-brand-border"
            }`}
          >
            <Text className={`text-[10px] font-bold ${sortBy === "name" ? "text-white" : "text-brand-dark"}`}>
              Name {sortBy === "name" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleSortToggle("ctc")}
            className={`px-2.5 py-1 rounded-lg border ${
              sortBy === "ctc" ? "bg-brand-hero border-brand-hero" : "bg-brand-card border-brand-border"
            }`}
          >
            <Text className={`text-[10px] font-bold ${sortBy === "ctc" ? "text-white" : "text-brand-dark"}`}>
              Salary {sortBy === "ctc" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleSortToggle("joinDate")}
            className={`px-2.5 py-1 rounded-lg border ${
              sortBy === "joinDate" ? "bg-brand-hero border-brand-hero" : "bg-brand-card border-brand-border"
            }`}
          >
            <Text className={`text-[10px] font-bold ${sortBy === "joinDate" ? "text-white" : "text-brand-dark"}`}>
              Date {sortBy === "joinDate" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Master Data Table */}
      <View className="bg-brand-card border border-brand-border rounded-3xl overflow-hidden shadow-xs mb-8">
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View>
            {/* Table Header Row */}
            <View className="flex-row bg-brand-hero px-4 py-3.5 items-center">
              <Text className="text-white text-[11px] font-black uppercase tracking-wider w-24">Emp ID</Text>
              <Text className="text-white text-[11px] font-black uppercase tracking-wider w-40">Employee Name</Text>
              <Text className="text-white text-[11px] font-black uppercase tracking-wider w-28">Department</Text>
              <Text className="text-white text-[11px] font-black uppercase tracking-wider w-28">Joining Date</Text>
              <Text className="text-white text-[11px] font-black uppercase tracking-wider w-28 text-right">Monthly CTC</Text>
              <Text className="text-white text-[11px] font-black uppercase tracking-wider w-24 text-center ml-4">Status</Text>
            </View>

            {/* Table Body Rows */}
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp, idx) => (
                <View 
                  key={emp.id} 
                  className={`flex-row px-4 py-3.5 items-center border-b border-brand-border ${
                    idx % 2 === 1 ? "bg-brand-cardTint/50" : "bg-brand-card"
                  }`}
                >
                  {/* Emp ID */}
                  <Text className="text-xs font-black text-brand-primary w-24">{emp.id}</Text>

                  {/* Name & Role */}
                  <View className="w-40 pr-2">
                    <Text className="text-xs font-black text-brand-dark" numberOfLines={1}>{emp.name}</Text>
                    <Text className="text-[10px] font-semibold text-brand-muted" numberOfLines={1}>{emp.role}</Text>
                  </View>

                  {/* Department */}
                  <View className="w-28">
                    <View className="bg-brand-cardTint border border-brand-border self-start px-2 py-0.5 rounded-md">
                      <Text className="text-[10px] font-bold text-brand-dark">{emp.dept}</Text>
                    </View>
                  </View>

                  {/* Joining Date */}
                  <Text className="text-xs font-semibold text-brand-muted w-28">{emp.joinDate}</Text>

                  {/* Monthly CTC */}
                  <Text className="text-xs font-black text-brand-dark w-28 text-right">
                    ${emp.ctc.toLocaleString()}.00
                  </Text>

                  {/* Status Badge */}
                  <View className="w-24 items-center ml-4">
                    <View 
                      className={`px-2.5 py-0.5 rounded-full ${
                        emp.status === "Active" 
                          ? "bg-emerald-100 border border-emerald-300" 
                          : emp.status === "On Leave" 
                          ? "bg-amber-100 border border-amber-300"
                          : "bg-blue-100 border border-blue-300"
                      }`}
                    >
                      <Text 
                        className={`text-[9px] font-black ${
                          emp.status === "Active" 
                            ? "text-emerald-800" 
                            : emp.status === "On Leave" 
                            ? "text-amber-800"
                            : "text-blue-800"
                        }`}
                      >
                        {emp.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View className="py-10 items-center justify-center w-[600px]">
                <Text className="text-xs font-bold text-brand-muted">No employees match your filter criteria.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}