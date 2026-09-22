import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Alert, 
  Platform, 
  Modal, 
  Switch, 
  ActivityIndicator, 
  useWindowDimensions 
} from "react-native";
import CrossPlatformDatePicker from "../components/CrossPlatformDatePicker";
import { LinearGradient } from "expo-linear-gradient";
import { 
  Users, ArrowRight, Clock, XCircle, ChevronLeft,
  Search, Navigation, ChevronRight, Filter, 
  DollarSign, Landmark, UserCheck, CalendarCheck, Edit3,
  UserPlus, X, ClipboardList, Trash2, Shield, BarChart3, FileSpreadsheet, ShieldCheck
} from "lucide-react-native";

interface AdminHubScreenProps {
  navigation: any;
}

export type RoleType = "EMPLOYEE" | "MANAGER" | "ADMIN";

export interface UserItem {
  id?: number;
  empId: string;
  fullName: string;
  email: string;
  mobileNumber?: string;
  role: RoleType;
  active: boolean;
}

export interface WorkforceMetrics {
  total: number;
  present: number;
  presentPercentage: number;
  od: number;
  odPercentage: number;
  absent: number;
  absentPercentage: number;
  permissionCount: number;
  permissionPercentage: number;
}

const LOCAL_IP = "192.168.31.228";
const API_BASE_URL = Platform.OS === "web"
  ? "http://192.168.31.228:8080/api/admin"
  : `http://${LOCAL_IP}:8080/api/admin`;

const ATTENDANCE_API_URL = Platform.OS === "web"
  ? "http://192.168.31.228:8080/api/attendance"
  : `http://${LOCAL_IP}:8080/api/attendance`;

export default function AdminHubScreen({ navigation }: AdminHubScreenProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [adminView, setAdminView] = useState<"menu" | "users" | "dashboard" | "onboarding" | "reports">("menu");
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const [earnedLeave, setEarnedLeave] = useState("14");
  const [casualLeave, setCasualLeave] = useState("04");
  const [odPermitted, setOdPermitted] = useState("08");
  const [otHours, setOtHours] = useState("16.5");
  
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [selectedUserEmpId, setSelectedUserEmpId] = useState<string>("");
  const [userSubTab, setUserSubTab] = useState<"personal" | "bank" | "salary" | "balances">("personal");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [formEmpId, setFormEmpId] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formRole, setFormRole] = useState<RoleType>("EMPLOYEE");
  const [formActive, setFormActive] = useState(true);
  const [savingUser, setSavingUser] = useState(false);

  // Dashboard Filters & State
  const [dashboardStartDate, setDashboardStartDate] = useState<any>(new Date());
  const [dashboardEndDate, setDashboardEndDate] = useState<any>(new Date());
  const [selectedDashboardDept, setSelectedDashboardDept] = useState("All Departments");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const [workforce, setWorkforce] = useState<WorkforceMetrics>({
    total: 0,
    present: 0,
    presentPercentage: 0,
    od: 0,
    odPercentage: 0,
    absent: 0,
    absentPercentage: 0,
    permissionCount: 0,
    permissionPercentage: 0,
  });

  // Date Formatter Helper (YYYY-MM-DD)
  const formatDateToIso = (d: any) => {
    if (!d) return new Date().toISOString().split("T")[0];
    if (typeof d === "string") return d.split("T")[0];
    if (d instanceof Date) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return new Date().toISOString().split("T")[0];
  };

  // Fetch Live Workforce Metrics from Spring Boot
  const fetchWorkforceMetrics = async () => {
    try {
      setLoadingMetrics(true);
      const formattedDate = formatDateToIso(dashboardStartDate);
      const queryParams = new URLSearchParams({
        targetDate: formattedDate,
        department: selectedDashboardDept,
        statusFilter: selectedStatusFilter,
      });

      const res = await fetch(`${ATTENDANCE_API_URL}/workforce-summary?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setWorkforce({
          total: data.total || 0,
          present: data.present || 0,
          presentPercentage: data.presentPercentage || 0,
          od: data.od || 0,
          odPercentage: data.odPercentage || 0,
          absent: data.absent || 0,
          absentPercentage: data.absentPercentage || 0,
          permissionCount: data.permissionCount || 0,
          permissionPercentage: data.permissionPercentage || 0,
        });
      }
    } catch (e) {
      console.warn("Could not fetch workforce dashboard metrics:", e);
    } finally {
      setLoadingMetrics(false);
    }
  };
  useEffect(() => {
    if (adminView === "dashboard") {
      fetchWorkforceMetrics();
    }
  }, [adminView, dashboardStartDate, dashboardEndDate, selectedDashboardDept, selectedStatusFilter]);

  const fetchUsersFromDb = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch(`${API_BASE_URL}/users`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setUsersList(data);
        setSelectedUserEmpId((prevId) => 
          data.some((u: UserItem) => u.empId === prevId) ? prevId : data[0].empId
        );
      } else {
        setUsersList([]);
        setSelectedUserEmpId("");
      }
    } catch (e) {
      console.log("Failed to fetch users from database API.");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsersFromDb();
  }, []);

  const selectedUserObj = usersList.find((u) => u.empId === selectedUserEmpId) || usersList[0];

  const handleOpenAddModal = () => {
    setIsEditingUser(false);
    setFormEmpId("");
    setFormFullName("");
    setFormEmail("");
    setFormMobile("");
    setFormRole("EMPLOYEE");
    setFormActive(true);
    setShowUserModal(true);
  };

  const handleOpenEditModal = (user: UserItem) => {
    setIsEditingUser(true);
    setFormEmpId(user.empId);
    setFormFullName(user.fullName);
    setFormEmail(user.email);
    setFormMobile(user.mobileNumber || "");
    setFormRole(user.role || "EMPLOYEE");
    setFormActive(user.active ?? true);
    setShowUserModal(true);
  };

  const handleSaveUser = async () => {
    if (!formFullName.trim() || !formEmail.trim() || (!isEditingUser && !formEmpId.trim())) {
      const msg = "Please enter Employee ID, Full Name, and Official Email.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Required Fields", msg);
      return;
    }

    setSavingUser(true);
    try {
      const url = isEditingUser 
        ? `${API_BASE_URL}/users/${formEmpId}` 
        : `${API_BASE_URL}/users`;
      
      const method = isEditingUser ? "PUT" : "POST";
      const payload = isEditingUser
        ? { fullName: formFullName.trim(), email: formEmail.trim(), mobileNumber: formMobile.trim(), role: formRole, active: formActive }
        : { empId: formEmpId.trim().toUpperCase(), fullName: formFullName.trim(), email: formEmail.trim(), mobileNumber: formMobile.trim(), role: formRole };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success || res.ok) {
        setShowUserModal(false);
        await fetchUsersFromDb();
        if (!isEditingUser) setSelectedUserEmpId(formEmpId.trim().toUpperCase());
        const msg = isEditingUser ? "User updated successfully!" : "New user created successfully!";
        Platform.OS === "web" ? window.alert(msg) : Alert.alert("Success", msg);
      } else {
        const err = data.error || "Failed to save user details.";
        Platform.OS === "web" ? window.alert(err) : Alert.alert("Error", err);
      }
    } catch (e) {
      Alert.alert("Network Error", "Unable to connect to backend server.");
    } finally {
      setSavingUser(false);
    }
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.empId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const permissionList = [
    { id: "1", name: "Sarah Jenkins", role: "Software Engineer", slot: "02:00 PM - 04:00 PM", reason: "Medical Checkup" },
    { id: "2", name: "David Miller", role: "Senior Analyst", slot: "09:30 AM - 11:30 AM", reason: "Bank Documentation" },
    { id: "3", name: "Alex Richardson", role: "Product Designer", slot: "03:30 PM - 05:30 PM", reason: "Personal Errand" },
    { id: "4", name: "Elena Gomez", role: "HR Operations", slot: "04:00 PM - 06:00 PM", reason: "Early Departure" },
  ];

  return (
    <View className="flex-1 bg-[#F4F6F9]">
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
        className="flex-1"
      >
        {/* 1. HERO HEADER */}
        <LinearGradient
          colors={["#4F46E5", "#6366F1", "#818CF8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: 44, paddingBottom: 36, paddingHorizontal: 24 }}
          className="relative overflow-hidden shadow-xl shadow-indigo-950/25 rounded-b-[36px] mb-6"
        >
          <View className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <View className="absolute bottom-0 left-10 w-44 h-44 rounded-full bg-indigo-900/20 blur-2xl pointer-events-none" />

          <View className="max-w-6xl mx-auto w-full">
            <View className="flex-row items-center justify-between mb-6">
              <TouchableOpacity 
                onPress={() => {
                  if (adminView !== "menu") {
                    setAdminView("menu");
                  } else {
                    navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate("Home");
                  }
                }}
                style={{ width: 44, height: 44 }}
                className="bg-white/15 border border-white/25 rounded-2xl items-center justify-center active:opacity-80 shadow-xs"
              >
                <ChevronLeft size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <View className="bg-emerald-500/20 border border-emerald-400/30 px-3.5 py-1.5 rounded-full flex-row items-center gap-1.5">
                <ShieldCheck size={13} color="#34D399" />
                <Text className="text-[10px] font-black text-emerald-200 uppercase tracking-wider">ADMIN ROLE</Text>
              </View>
            </View>

            <View className="mt-1">
              <Text className="text-2xl md:text-3xl font-black text-white tracking-tight">
                {adminView === "menu" ? "Team Hub" : `Admin • ${adminView.toUpperCase()}`}
              </Text>
              <Text className="text-xs font-bold text-purple-200 mt-1 uppercase tracking-wider">
                Human Capital Command Center
              </Text>
            </View>
          </View>
        </LinearGradient>

        {adminView !== "menu" && (
          <View className="max-w-6xl mt-1 mx-auto w-full px-5 md:px-10 mb-4">
            <TouchableOpacity 
              onPress={() => setAdminView("menu")}
              className="flex-row items-center gap-2 bg-[#EEECFA] px-4 py-2.5 rounded-2xl self-start border border-[#5B4FD1]/20 shadow-xs"
            >
              <ChevronLeft size={16} color="#5B4FD1" />
              <Text className="text-xs font-black text-[#5B4FD1] uppercase">Back to Admin Hub Menu</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 2. MAIN CONTAINER BODY                                                    */}
        {/* ========================================================================= */}
        <View className="max-w-6xl mx-auto w-full px-5 md:px-10">

          {/* MENU VIEW */}
          {adminView === "menu" && (
            <View className="gap-4">
              <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#1F1B3D] mb-1 mt-5">
                Select an Administration Module
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                {/* Onboarding */}
                <TouchableOpacity 
                  onPress={() => navigation.navigate("AdminOnboardingSubmissions")}
                  activeOpacity={0.85}
                  className="overflow-hidden rounded-[24px] border border-indigo-200/80"
                  style={{ width: isDesktop ? "48%" : "100%", minHeight: 140 }}
                >
                  <LinearGradient colors={["#F8F7FF", "#EEEDFE", "#E2E0FD"]} style={{ minHeight: 140, padding: 20 }}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#EEEDFE", borderWidth: 1, borderColor: "#D4D2FC" }} className="items-center justify-center">
                          <UserPlus size={22} color="#5B4FD1" />
                        </View>
                        <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#1F1B3D] tracking-tight">Onboarding</Text>
                      </View>
                      <View style={{ width: 54, height: 34, borderRadius: 17, backgroundColor: "#4F46E5", alignItems: "center", justifyContent: "center" }}>
                        <ArrowRight size={20} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    </View>
                    <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-semibold text-[#7A76A6] mt-3">Generate secure links & review submissions</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Users */}
                <TouchableOpacity 
                  onPress={() => setAdminView("users")}
                  activeOpacity={0.85}
                  className="overflow-hidden rounded-[24px] border border-emerald-200/80"
                  style={{ width: isDesktop ? "48%" : "100%", minHeight: 140 }}
                >
                  <LinearGradient colors={["#ECFDF5", "#D1FAE5", "#A7F3D0"]} style={{ minHeight: 140, padding: 20 }}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#D1FAE5", borderWidth: 1, borderColor: "#A7F3D0" }} className="items-center justify-center">
                          <Users size={22} color="#059669" />
                        </View>
                        <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#064E3B] tracking-tight">Add / Edit User</Text>
                      </View>
                      <View style={{ width: 54, height: 34, borderRadius: 17, backgroundColor: "#059669", alignItems: "center", justifyContent: "center" }}>
                        <ArrowRight size={20} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    </View>
                    <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-semibold text-[#047857] mt-3">Manage directory, salaries & roles</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Reports */}
                <TouchableOpacity 
                  onPress={() => navigation.navigate("AdminReports", { initialTab: "reports" })}
                  activeOpacity={0.85}
                  className="overflow-hidden rounded-[24px] border border-amber-200/80"
                  style={{ width: isDesktop ? "48%" : "100%", minHeight: 140 }}
                >
                  <LinearGradient colors={["#FFFBEB", "#FEF3C7", "#FDE68A"]} style={{ minHeight: 140, padding: 20 }}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FCD34D" }} className="items-center justify-center">
                          <Landmark size={22} color="#D97706" />
                        </View>
                        <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#78350F] tracking-tight">Download Reports</Text>
                      </View>
                      <View style={{ width: 54, height: 34, borderRadius: 17, backgroundColor: "#D97706", alignItems: "center", justifyContent: "center" }}>
                        <ArrowRight size={20} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    </View>
                    <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-semibold text-[#92400E] mt-3">Export employee master records & audit sheets</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Dashboard */}
                <TouchableOpacity 
                  onPress={() => setAdminView("dashboard")}
                  activeOpacity={0.85}
                  className="overflow-hidden rounded-[24px] border border-blue-200/80"
                  style={{ width: isDesktop ? "48%" : "100%", minHeight: 140 }}
                >
                  <LinearGradient colors={["#EFF6FF", "#DBEAFE", "#BFDBFE"]} style={{ minHeight: 140, padding: 20 }}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#DBEAFE", borderWidth: 1, borderColor: "#BFDBFE" }} className="items-center justify-center">
                          <BarChart3 size={22} color="#2563EB" />
                        </View>
                        <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#1E3A8A] tracking-tight">Overall Dashboard</Text>
                      </View>
                      <View style={{ width: 54, height: 34, borderRadius: 17, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center" }}>
                        <ArrowRight size={20} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    </View>
                    <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-semibold text-[#1E40AF] mt-3">Real-time attendance metrics & pulse</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Attendance Audit */}
                <TouchableOpacity 
                  onPress={() => navigation.navigate("AttendanceAuditTabs")}
                  activeOpacity={0.85}
                  className="overflow-hidden rounded-[24px] border border-teal-200/80"
                  style={{ width: isDesktop ? "48%" : "100%", minHeight: 140 }}
                >
                  <LinearGradient colors={["#F0FDFA", "#CCFBF1", "#99F6E4"]} style={{ minHeight: 140, padding: 20 }}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#CCFBF1", borderWidth: 1, borderColor: "#99F6E4" }} className="items-center justify-center">
                          <ClipboardList size={22} color="#0D9488" />
                        </View>
                        <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#134E4A] tracking-tight">Overall Attendance</Text>
                      </View>
                      <View style={{ width: 54, height: 34, borderRadius: 17, backgroundColor: "#0D9488", alignItems: "center", justifyContent: "center" }}>
                        <ArrowRight size={20} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    </View>
                    <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-semibold text-[#115E59] mt-3">Check-in logs, leaves, and permissions</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* User Directory */}
                <TouchableOpacity 
                  onPress={() => navigation.navigate("UserDirectory")}
                  activeOpacity={0.85}
                  className="overflow-hidden rounded-[24px] border border-purple-200/80"
                  style={{ width: isDesktop ? "48%" : "100%", minHeight: 140 }}
                >
                  <LinearGradient colors={["#FAF5FF", "#F3E8FF", "#E9D5FF"]} style={{ minHeight: 140, padding: 20 }}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#F3E8FF", borderWidth: 1, borderColor: "#E9D5FF" }} className="items-center justify-center">
                          <FileSpreadsheet size={22} color="#7E22CE" />
                        </View>
                        <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#581C87] tracking-tight">User Reports</Text>
                      </View>
                      <View style={{ width: 54, height: 34, borderRadius: 17, backgroundColor: "#7E22CE", alignItems: "center", justifyContent: "center" }}>
                        <ArrowRight size={20} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    </View>
                    <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-semibold text-[#6B21A8] mt-3">Access shift rosters & statutory configs</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* DASHBOARD VIEW (CONNECTED DYNAMICALLY TO MYSQL BACKEND)                   */}
          {/* ========================================================================= */}
          {adminView === "dashboard" && (
            <View className="w-full gap-4">
              
              {/* COMPACT ENTERPRISE DROPDOWN FILTER BAR */}
              <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 md:p-5 shadow-xs gap-4">
                <View className="flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-2">
                  <View className="flex-1 pr-1">
                    <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
                      Dashboard Filter Controls
                    </Text>
                    <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5 leading-tight">
                      Select parameters to filter workforce analytics in real-time
                    </Text>
                  </View>
                  
                  <View className="self-start sm:self-auto bg-[#EEECFA] px-2.5 py-1 rounded-full border border-[#5B4FD1]/20 shrink-0">
                    <Text className="text-[9px] font-black text-[#5B4FD1] uppercase">Parametric Engine</Text>
                  </View>
                </View>

                {/* Row 1: CrossPlatform Date Pickers */}
                <View className="flex-col md:flex-row gap-3">
                  <CrossPlatformDatePicker
                    label="From Date"
                    value={dashboardStartDate}
                    onChange={setDashboardStartDate}
                  />
                  <CrossPlatformDatePicker
                    label="To Date"
                    value={dashboardEndDate}
                    onChange={setDashboardEndDate}
                  />
                </View>

                {/* Row 2: Dropdowns */}
                <View className="flex-col md:flex-row gap-3 pt-1">
                  {/* Department Filter */}
                  <View className="flex-1">
                    <Text className="text-[10px] font-black text-[#7A76A6] uppercase tracking-wider mb-1.5">
                      Department Filter
                    </Text>
                    <View className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl px-3.5 py-3">
                      <select
                        value={selectedDashboardDept}
                        onChange={(e) => setSelectedDashboardDept(e.target.value)}
                        style={{
                          backgroundColor: "transparent",
                          border: "none",
                          outline: "none",
                          fontFamily: "inherit",
                          fontSize: "12px",
                          fontWeight: "700",
                          color: "#1F1B3D",
                          width: "100%",
                          cursor: "pointer",
                        }}
                      >
                        <option value="All Departments">All Departments</option>
                        <option value="Degital Team">Degital Team</option>
                        <option value="HR">HR</option>
                        <option value="Finance">Finance</option>
                        <option value="Sales">Sales</option>
                      </select>
                    </View>
                  </View>

                  {/* Status Type Filter */}
                  <View className="flex-1">
                    <Text className="text-[10px] font-black text-[#7A76A6] uppercase tracking-wider mb-1.5">
                      Leave / Status Type Filter
                    </Text>
                    <View className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl px-3.5 py-3">
                      <select
                        value={selectedStatusFilter}
                        onChange={(e) => setSelectedStatusFilter(e.target.value)}
                        style={{
                          backgroundColor: "transparent",
                          border: "none",
                          outline: "none",
                          fontFamily: "inherit",
                          fontSize: "12px",
                          fontWeight: "700",
                          color: "#1F1B3D",
                          width: "100%",
                          cursor: "pointer",
                        }}
                      >
                        <option value="ALL">All Status Types</option>
                        <option value="PRESENT">Present</option>
                        <option value="LEAVE">Leave</option>
                        <option value="PERMISSION">Permission</option>
                        <option value="OD">On Duty (OD)</option>
                        <option value="ABSENT">Absent / Unpaid</option>
                      </select>
                    </View>
                  </View>
                </View>
              </View>

              {/* DYNAMIC CARD 1: Real-Time Workforce Attendance */}
              <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 md:p-6 shadow-xs gap-4">
                <View className="flex-row items-center justify-between">
                  <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-black text-[#1F1B3D] uppercase tracking-wider">
                    Real-Time Workforce Attendance ({selectedDashboardDept} • {selectedStatusFilter})
                  </Text>
                  {loadingMetrics && <ActivityIndicator size="small" color="#5B4FD1" />}
                </View>

                <View className="flex-col sm:flex-row items-center justify-between gap-5">
                  {/* Circular Donut Badge */}
                  <View className="w-32 h-32 rounded-full border-[10px] border-[#5B4FD1] border-t-amber-500 border-r-rose-500 items-center justify-center bg-[#F6F5FC] shadow-inner shrink-0">
                    <Text style={{ fontSize: isDesktop ? 26 : 22 }} className="font-black text-[#1F1B3D]">
                      {workforce.total}
                    </Text>
                    <Text style={{ fontSize: isDesktop ? 11 : 9 }} className="font-bold text-[#7A76A6] uppercase">
                      Total Staff
                    </Text>
                  </View>

                  {/* Metrics Rows */}
                  <View className="flex-1 w-full gap-2.5">
                    {/* Present */}
                    <View className="flex-row items-center justify-between p-3 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5]">
                      <View className="flex-row items-center gap-2">
                        <View className="w-3.5 h-3.5 rounded-md bg-[#5B4FD1]" />
                        <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-bold text-[#1F1B3D]">Present</Text>
                      </View>
                      <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-black text-[#5B4FD1]">
                        {workforce.present} ({workforce.presentPercentage}%)
                      </Text>
                    </View>

                    {/* OD */}
                    <View className="flex-row items-center justify-between p-3 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5]">
                      <View className="flex-row items-center gap-2">
                        <View className="w-3.5 h-3.5 rounded-md bg-amber-500" />
                        <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-bold text-[#1F1B3D]">On Duty (OD)</Text>
                      </View>
                      <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-black text-amber-600">
                        {workforce.od} ({workforce.odPercentage}%)
                      </Text>
                    </View>

                    {/* Absent */}
                    <View className="flex-row items-center justify-between p-3 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5]">
                      <View className="flex-row items-center gap-2">
                        <View className="w-3.5 h-3.5 rounded-md bg-[#E4453C]" />
                        <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-bold text-[#1F1B3D]">Absent / Unpaid</Text>
                      </View>
                      <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-black text-[#E4453C]">
                        {workforce.absent} ({workforce.absentPercentage}%)
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* LIVE FLEET TRACKING ACTION CARD */}
              <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-xs gap-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center gap-2">
                      <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-black text-[#1F1B3D] uppercase tracking-wider">
                        Live Fleet & Remote Tracker
                      </Text>
                      <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    </View>
                    <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-semibold text-[#7A76A6] mt-0.5">
                      Live GPS breadcrumbs for on-shift Sales & WFH staff
                    </Text>
                  </View>

                  <View className="bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                    <Text style={{ fontSize: isDesktop ? 11 : 9 }} className="font-black text-emerald-700 uppercase">
                      Live GPS Active
                    </Text>
                  </View>
                </View>

                <View className="flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#F6F5FC] border border-[#E7E4F5]">
                  <View className="flex-row items-center gap-3">
                    <View className="w-12 h-12 rounded-2xl bg-[#5B4FD1] items-center justify-center shadow-xs">
                      <Navigation size={22} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#1F1B3D]">
                        Field & Remote Workforce
                      </Text>
                      <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-semibold text-[#7A76A6]">
                        Real-time location stream & travel paths
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate("LiveTracking")}
                    className="w-full sm:w-auto bg-[#5B4FD1] px-5 py-3 rounded-2xl flex-row items-center justify-center gap-2 shadow-xs"
                  >
                    <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="text-white font-black">
                      Open Live Tracking Fleet
                    </Text>
                    <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* CARD 2: Active Permissions */}
              <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-xs gap-3">
                <View className="flex-row items-center justify-between">
                  <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-black text-[#1F1B3D] uppercase tracking-wider">
                    Active Permissions
                  </Text>
                  <View className="bg-[#FEF2D9] border border-amber-300 px-3 py-0.5 rounded-full">
                    <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-black text-amber-800">
                      {workforce.permissionCount} Staff
                    </Text>
                  </View>
                </View>

                <View className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 mb-4">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
                      Active Permissions
                    </Text>
                    <View className="bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                      <Text className="text-[10px] font-black text-amber-700">
                        {workforce.permissionCount} Staff
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                      <Text style={{ fontSize: isDesktop ? 26 : 22 }} className="font-black text-[#1F1B3D]">
                        {workforce.permissionPercentage}%
                      </Text>
                      <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-semibold text-[#7A76A6] mt-0.5 leading-snug">
                        Of total workforce currently on permission
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => navigation.navigate("AttendanceAuditTabs")}
                      activeOpacity={0.85}
                      className="bg-[#5B4FD1] px-4 py-3 rounded-2xl flex-row items-center justify-center shrink-0 shadow-xs"
                    >
                      <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="text-white font-bold mr-1.5">
                        View Staff List
                      </Text>
                      <ChevronRight size={isDesktop ? 16 : 14} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                </View>

                {showPermissionModal && (
                  <View className="mt-2 pt-3 border-t border-slate-100 gap-2.5">
                    {permissionList.map((emp) => (
                      <View key={emp.id} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl p-3.5 flex-row items-center justify-between">
                        <View className="flex-1 pr-2">
                          <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-black text-[#1F1B3D]">{emp.name}</Text>
                          <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-semibold text-[#7A76A6]">{emp.role} • {emp.reason}</Text>
                        </View>
                        <View className="bg-white border border-[#E7E4F5] px-3 py-1 rounded-lg">
                          <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-black text-[#5B4FD1]">{emp.slot}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

            </View>
          )}

          {/* USERS VIEW */}
          {adminView === "users" && (
            <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 24, alignItems: "flex-start", width: "100%" }}>
              {/* Directory Left Column */}
              <View style={{ width: isDesktop ? 380 : "100%", gap: 14 }}>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1 bg-white border border-[#E7E4F5] rounded-2xl px-3.5 py-3 shadow-xs flex-row items-center">
                    <Search size={isDesktop ? 18 : 16} color="#7A76A6" />
                    <TextInput 
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search by Employee ID, Name or Role..."
                      placeholderTextColor="#A6A2CE"
                      style={{ fontSize: isDesktop ? 14 : 12 }}
                      className="flex-1 ml-2 font-semibold text-[#1F1B3D]"
                    />
                    {searchQuery ? (
                      <TouchableOpacity onPress={() => setSearchQuery("")}>
                        <X size={isDesktop ? 16 : 14} color="#7A76A6" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    onPress={handleOpenAddModal}
                    className="bg-[#5B4FD1] px-4 py-3 rounded-2xl flex-row items-center justify-center active:opacity-90 shadow-xs shrink-0"
                  >
                    <UserPlus size={isDesktop ? 16 : 14} color="#FFFFFF" />
                    <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="text-white font-black ml-1.5">Add</Text>
                  </TouchableOpacity>
                </View>

                <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 shadow-xs w-full">
                  <View className="flex-row items-center justify-between pb-2.5 mb-2 border-b border-slate-100 px-1">
                    <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-black text-[#1F1B3D] uppercase tracking-wider">
                      Staff Directory ({filteredUsers.length})
                    </Text>
                    <TouchableOpacity onPress={handleOpenAddModal}>
                      <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-black text-[#5B4FD1]">+ New</Text>
                    </TouchableOpacity>
                  </View>

                  {loadingUsers ? (
                    <View className="py-6 justify-center items-center flex-row">
                      <ActivityIndicator size="small" color="#5B4FD1" />
                      <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="text-[#7A76A6] ml-2 font-bold">Loading users...</Text>
                    </View>
                  ) : filteredUsers.length === 0 ? (
                    <View className="py-4 px-2">
                      <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="text-[#7A76A6] font-bold">No employees found.</Text>
                    </View>
                  ) : isDesktop ? (
                    <View style={{ gap: 8, maxHeight: 600, overflow: "scroll" as any }} className="pr-1">
                      {filteredUsers.map((u) => {
                        const isSelected = selectedUserEmpId === u.empId;
                        return (
                          <TouchableOpacity
                            key={u.empId}
                            onPress={() => setSelectedUserEmpId(u.empId)}
                            className={`p-3.5 rounded-2xl border flex-row items-center justify-between ${
                              isSelected 
                                ? "bg-[#EEECFA] border-[#5B4FD1]" 
                                : "bg-[#F6F5FC] border-[#E7E4F5]"
                            }`}
                          >
                            <View className="flex-row items-center gap-3.5 flex-1 pr-1">
                              <View className={`w-10 h-10 rounded-xl items-center justify-center ${isSelected ? "bg-[#5B4FD1]" : "bg-[#E7E4F5]"}`}>
                                <Text style={{ fontSize: 14 }} className={`font-black ${isSelected ? "text-white" : "text-[#5B4FD1]"}`}>
                                  {u.fullName.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                              <View className="flex-1">
                                <Text style={{ fontSize: 14 }} className="font-bold text-[#1F1B3D]" numberOfLines={1}>{u.fullName}</Text>
                                <Text style={{ fontSize: 12 }} className="text-[#7A76A6] mt-0.5" numberOfLines={1}>{u.empId} • {u.role}</Text>
                              </View>
                            </View>
                            <ChevronRight size={16} color={isSelected ? "#5B4FD1" : "#A6A2CE"} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {filteredUsers.map((u) => {
                        const isSelected = selectedUserEmpId === u.empId;
                        return (
                          <TouchableOpacity
                            key={u.empId}
                            onPress={() => setSelectedUserEmpId(u.empId)}
                            className={`px-3.5 py-2 rounded-xl border flex-row items-center ${
                              isSelected 
                                ? "bg-[#5B4FD1] border-[#5B4FD1] shadow-xs" 
                                : "bg-[#F6F5FC] border-[#E7E4F5]"
                            }`}
                          >
                            <Text style={{ fontSize: 12 }} className={`font-bold ${isSelected ? "text-white" : "text-[#1F1B3D]"}`}>
                              {u.fullName.split(" ")[0]} ({u.role.substring(0, 3)})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              </View>

              {/* User Detail Right Column */}
              <View style={{ flex: 1, width: "100%", gap: 16 }}>
                <View className="flex-row bg-[#EEECFA]/70 border border-[#E7E4F5] p-1.5 rounded-2xl justify-between gap-2">
                  {[
                    { key: "personal", label: "Personal" },
                    { key: "bank", label: "Bank" },
                    { key: "salary", label: "Salary" },
                    { key: "balances", label: "Balances" },
                  ].map((st) => {
                    const isActive = userSubTab === st.key;
                    return (
                      <TouchableOpacity
                        key={st.key}
                        onPress={() => setUserSubTab(st.key as any)}
                        className={`flex-1 py-3 rounded-xl items-center justify-center ${
                          isActive ? "bg-[#5B4FD1] shadow-xs" : ""
                        }`}
                      >
                        <Text style={{ fontSize: isDesktop ? 14 : 12 }} className={`font-black ${isActive ? "text-white" : "text-[#7A76A6]"}`}>
                          {st.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {userSubTab === "personal" && selectedUserObj && (
                  <View className="bg-white border border-[#E7E4F5] rounded-3xl p-6 md:p-7 gap-5 shadow-xs">
                    <View className="flex-row justify-between items-center pb-3 border-b border-slate-100">
                      <View>
                        <Text style={{ fontSize: isDesktop ? 15 : 12 }} className="font-black text-[#1F1B3D] uppercase tracking-wider">
                          Personal & Official Master
                        </Text>
                        <Text style={{ fontSize: isDesktop ? 13 : 10 }} className="font-bold text-[#7A76A6] mt-0.5">
                          ID: {selectedUserObj.empId} • Role: {selectedUserObj.role} • Status: {selectedUserObj.active ? "Active" : "Inactive"}
                        </Text>
                      </View>
                      
                      <TouchableOpacity 
                        onPress={() => handleOpenEditModal(selectedUserObj)}
                        className="w-10 h-10 rounded-xl bg-[#EEECFA] border border-[#5B4FD1]/20 items-center justify-center active:opacity-80"
                      >
                        <Edit3 size={isDesktop ? 18 : 16} color="#5B4FD1" />
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 16 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1.5">Full Name</Text>
                        <TextInput value={selectedUserObj.fullName} editable={false} style={{ fontSize: isDesktop ? 14 : 12 }} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5 font-bold text-[#1F1B3D]" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1.5">Employee ID</Text>
                        <TextInput value={selectedUserObj.empId} editable={false} style={{ fontSize: isDesktop ? 14 : 12 }} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5 font-bold text-[#1F1B3D]" />
                      </View>
                    </View>

                    <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 16 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1.5">Official Email</Text>
                        <TextInput value={selectedUserObj.email} editable={false} style={{ fontSize: isDesktop ? 14 : 12 }} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5 font-bold text-[#1F1B3D]" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1.5">Mobile Number</Text>
                        <TextInput value={selectedUserObj.mobileNumber || "Not Provided"} editable={false} style={{ fontSize: isDesktop ? 14 : 12 }} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5 font-bold text-[#1F1B3D]" />
                      </View>
                    </View>

                    <TouchableOpacity onPress={() => handleOpenEditModal(selectedUserObj)} style={{ width: isDesktop ? 260 : "100%" }} className="bg-[#5B4FD1] py-3.5 rounded-xl items-center shadow-xs active:opacity-90">
                      <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="text-white font-black uppercase tracking-wider">Edit & Save Personal Details</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {userSubTab === "bank" && (
                  <View className="bg-white border border-[#E7E4F5] rounded-3xl p-6 md:p-7 gap-5 shadow-xs">
                    <View className="flex-row justify-between items-center pb-3 border-b border-slate-100">
                      <Text style={{ fontSize: isDesktop ? 15 : 12 }} className="font-black text-[#1F1B3D] uppercase tracking-wider">Statutory & Bank Verification</Text>
                      <Landmark size={isDesktop ? 20 : 18} color="#5B4FD1" />
                    </View>
                    <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 16 }}>
                      <View style={{ flex: 1 }}><Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1.5">Bank Name</Text><TextInput defaultValue="JPMorgan Chase N.A." style={{ fontSize: isDesktop ? 14 : 12 }} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5 font-bold text-[#1F1B3D]" /></View>
                      <View style={{ flex: 1 }}><Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1.5">Account Number</Text><TextInput defaultValue="9042-8819-0129" style={{ fontSize: isDesktop ? 14 : 12 }} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5 font-bold text-[#1F1B3D]" /></View>
                      <View style={{ flex: 1 }}><Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1.5">IFSC Code</Text><TextInput defaultValue="JPMU0000129" style={{ fontSize: isDesktop ? 14 : 12 }} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5 font-bold text-[#1F1B3D]" /></View>
                      <View style={{ flex: 1 }}><Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1.5">Branch Name</Text><TextInput defaultValue="New York" style={{ fontSize: isDesktop ? 14 : 12 }} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5 font-bold text-[#1F1B3D]" /></View>
                    </View>
                  </View>
                )}

                {userSubTab === "salary" && (
                  <View className="bg-white border border-[#E7E4F5] rounded-3xl p-6 md:p-7 gap-5 shadow-xs">
                    <View className="flex-row justify-between items-center pb-3 border-b border-slate-100">
                      <Text style={{ fontSize: isDesktop ? 15 : 12 }} className="font-black text-[#1F1B3D] uppercase tracking-wider">Salary Structure Breakdown</Text>
                      <DollarSign size={isDesktop ? 20 : 18} color="#5B4FD1" />
                    </View>
                    <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 16 }}>
                      <View style={{ flex: 1 }}><Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1.5">Monthly CTC ($)</Text><TextInput defaultValue="6500.00" style={{ fontSize: isDesktop ? 14 : 12 }} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5 font-bold text-[#1F1B3D]" /></View>
                      <View style={{ flex: 1 }}><Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1.5">Basic Pay ($)</Text><TextInput defaultValue="4200.00" style={{ fontSize: isDesktop ? 14 : 12 }} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5 font-bold text-[#1F1B3D]" /></View>
                      <View style={{ flex: 1 }}><Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1.5">HRA ($)</Text><TextInput defaultValue="1200.00" style={{ fontSize: isDesktop ? 14 : 12 }} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5 font-bold text-[#1F1B3D]" /></View>
                      <View style={{ flex: 1 }}><Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1.5">PF Deduction ($)</Text><TextInput defaultValue="200.00" style={{ fontSize: isDesktop ? 14 : 12 }} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5 font-bold text-[#1F1B3D]" /></View>
                    </View>
                  </View>
                )}

                {userSubTab === "balances" && (
                  <View className="bg-white border border-[#E7E4F5] rounded-3xl p-6 md:p-7 gap-5 shadow-xs">
                    <Text style={{ fontSize: isDesktop ? 15 : 12 }} className="font-black text-[#1F1B3D] uppercase tracking-wider">
                      Accrual & Overtime Balances
                    </Text>

                    <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 14 }}>
                      <View className="flex-1 bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl p-4 items-center">
                        <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-bold text-[#7A76A6]">Earned Leave</Text>
                        <TextInput value={earnedLeave} onChangeText={setEarnedLeave} keyboardType="numeric" style={{ fontSize: isDesktop ? 20 : 16 }} className="font-black text-[#1F1B3D] mt-1 text-center" />
                      </View>
                      <View className="flex-1 bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl p-4 items-center">
                        <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-bold text-[#7A76A6]">Casual Leave</Text>
                        <TextInput value={casualLeave} onChangeText={setCasualLeave} keyboardType="numeric" style={{ fontSize: isDesktop ? 20 : 16 }} className="font-black text-[#1F1B3D] mt-1 text-center" />
                      </View>
                      <View className="flex-1 bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl p-4 items-center">
                        <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-bold text-[#7A76A6]">OD Permitted</Text>
                        <TextInput value={odPermitted} onChangeText={setOdPermitted} keyboardType="numeric" style={{ fontSize: isDesktop ? 20 : 16 }} className="font-black text-amber-700 mt-1 text-center" />
                      </View>
                      <View className="flex-1 bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl p-4 items-center">
                        <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-bold text-[#7A76A6]">OT Hours Logged</Text>
                        <TextInput value={otHours} onChangeText={setOtHours} keyboardType="numeric" style={{ fontSize: isDesktop ? 20 : 16 }} className="font-black text-[#5B4FD1] mt-1 text-center" />
                      </View>
                    </View>

                    <View className="pt-2">
                      <TouchableOpacity 
                        onPress={() => {
                          const msg = "Balance quotas saved successfully!";
                          Platform.OS === "web" ? window.alert(msg) : Alert.alert("Success", msg);
                        }}
                        style={{ width: isDesktop ? 220 : "100%" }}
                        className="bg-[#5B4FD1] py-3.5 rounded-xl items-center shadow-xs active:opacity-90"
                      >
                        <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="text-white font-black uppercase tracking-wider">
                          Save Balance Quotas
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* REPORTS VIEW */}
          {adminView === "reports" && (
            <View style={{ width: isDesktop ? 600 : "100%", alignSelf: "center" }} className="gap-4">
              <View className="bg-white border border-[#E7E4F5] rounded-3xl p-6 md:p-8 shadow-xs gap-5">
                <View className="flex-row items-center gap-3 pb-3 border-b border-slate-100">
                  <View className="w-10 h-10 rounded-xl bg-[#EEECFA] items-center justify-center">
                    <Landmark size={20} color="#5B4FD1" />
                  </View>
                  <View>
                    <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#1F1B3D]">
                      Download User Details & Reports
                    </Text>
                    <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6]">
                      Export employee master directories, statutory sheets, and audit files
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="text-[#7A76A6] leading-relaxed">
                  Generate and download comprehensive spreadsheet exports containing employee personal details, banking identifiers, salary breakdowns, and active accrual quotas.
                </Text>

                <TouchableOpacity 
                  onPress={() => {
                    const msg = "Downloading master employee spreadsheet report...";
                    Platform.OS === "web" ? window.alert(msg) : Alert.alert("Export Successful", msg);
                  }}
                  className="bg-[#5B4FD1] py-4 rounded-xl items-center shadow-xs active:opacity-90 mt-2"
                >
                  <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="text-white font-black uppercase tracking-wider">
                    Download Full Master Report (.xlsx)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </View>
      </ScrollView>

      {/* 5. ADD / EDIT EMPLOYEE MODAL */}
      <Modal visible={showUserModal} transparent animationType="fade">
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setShowUserModal(false)}
          className="flex-1 bg-black/40 justify-center items-center p-4"
        >
          <View className="w-full max-w-md bg-white border border-[#E7E4F5] rounded-3xl p-5 md:p-6 shadow-xl gap-4">
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
              <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#1F1B3D]">
                {isEditingUser ? "Edit Employee Details" : "Add New Employee"}
              </Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <X size={18} color="#7A76A6" />
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-96 gap-3.5" showsVerticalScrollIndicator={false}>
              <View>
                <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1">Employee ID</Text>
                <TextInput
                  value={formEmpId}
                  onChangeText={setFormEmpId}
                  editable={!isEditingUser}
                  placeholder="e.g. EMP-1050"
                  placeholderTextColor="#A6A2CE"
                  autoCapitalize="characters"
                  style={{ fontSize: isDesktop ? 14 : 12 }}
                  className={`border rounded-xl p-3 font-bold ${
                    isEditingUser 
                      ? "bg-slate-100 border-slate-200 text-slate-500" 
                      : "bg-[#F6F5FC] border-[#E7E4F5] text-[#1F1B3D]"
                  }`}
                />
              </View>

              <View>
                <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1">Full Name</Text>
                <TextInput
                  value={formFullName}
                  onChangeText={setFormFullName}
                  placeholder="e.g. Alex Sterling"
                  placeholderTextColor="#A6A2CE"
                  style={{ fontSize: isDesktop ? 14 : 12 }}
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 font-bold text-[#1F1B3D]"
                />
              </View>

              <View>
                <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1">Official Email</Text>
                <TextInput
                  value={formEmail}
                  onChangeText={setFormEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="alex@paycore.io"
                  placeholderTextColor="#A6A2CE"
                  style={{ fontSize: isDesktop ? 14 : 12 }}
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 font-bold text-[#1F1B3D]"
                />
              </View>

              <View>
                <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1">Mobile Number</Text>
                <TextInput
                  value={formMobile}
                  onChangeText={setFormMobile}
                  keyboardType="phone-pad"
                  placeholder="+91 9876543210"
                  placeholderTextColor="#A6A2CE"
                  style={{ fontSize: isDesktop ? 14 : 12 }}
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 font-bold text-[#1F1B3D]"
                />
              </View>

              <View>
                <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase mb-1">System Role</Text>
                <View className="flex-row gap-2">
                  {(["EMPLOYEE", "MANAGER", "ADMIN"] as RoleType[]).map((r) => {
                    const isSelected = formRole === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setFormRole(r)}
                        className={`flex-1 py-2.5 rounded-xl border items-center ${
                          isSelected 
                            ? "bg-[#5B4FD1] border-[#5B4FD1]" 
                            : "bg-[#F6F5FC] border-[#E7E4F5]"
                        }`}
                      >
                        <Text style={{ fontSize: isDesktop ? 12 : 10 }} className={`font-black ${isSelected ? "text-white" : "text-[#1F1B3D]"}`}>
                          {r}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {isEditingUser && (
                <View className="flex-row items-center justify-between pt-1">
                  <View>
                    <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-bold text-[#1F1B3D]">Account Status</Text>
                    <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="text-[#7A76A6]">Allow employee system login</Text>
                  </View>
                  <Switch
                    value={formActive}
                    onValueChange={setFormActive}
                    trackColor={{ false: "#CBD5E1", true: "#5B4FD1" }}
                  />
                </View>
              )}
            </ScrollView>

            <View className="flex-row gap-2.5 pt-2 border-t border-slate-100">
              <TouchableOpacity
                onPress={() => setShowUserModal(false)}
                className="flex-1 bg-[#F6F5FC] border border-[#E7E4F5] py-3 rounded-xl items-center active:bg-slate-100"
              >
                <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-black text-[#1F1B3D]">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveUser}
                disabled={savingUser}
                className="flex-1 bg-[#5B4FD1] py-3 rounded-xl items-center shadow-xs active:opacity-90"
              >
                <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-black text-white">
                  {savingUser ? "Saving..." : isEditingUser ? "Save Changes" : "Create Employee"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}