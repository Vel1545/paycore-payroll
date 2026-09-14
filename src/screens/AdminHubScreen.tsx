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
  Search, ShieldAlert, ChevronRight, Filter, 
  DollarSign, Landmark, UserCheck, CalendarCheck, Edit3,
  UserPlus, X, Check, Trash2, Shield, BarChart3, FileSpreadsheet, ShieldCheck
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

const LOCAL_IP = "192.168.31.133";
const API_BASE_URL = Platform.OS === "web"
  ? "http://192.168.31.133:8080/api/admin"
  : `http://${LOCAL_IP}:8080/api/admin`;

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

  const [dashboardStartDate, setDashboardStartDate] = useState(new Date(2026, 0, 1)); // Jan 1, 2026
const [dashboardEndDate, setDashboardEndDate] = useState(new Date(2026, 0, 31));   // Jan 31, 2026
const [selectedDashboardDept, setSelectedDashboardDept] = useState("All Departments");
const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");

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

  const workforce = {
    total: 248,
    present: 210,
    absent: 14,
    od: 24,
    permissionCount: 18,
    permissionPercentage: 7.2,
  };

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
        {/* ========================================================================= */}
        {/* 1. PREMIUM HEADER / HERO SECTION (Proper Spaced & Aligned Gradient)      */}
        {/* ========================================================================= */}
        <LinearGradient
          colors={["#4F46E5", "#6366F1", "#818CF8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: 44, paddingBottom: 36, paddingHorizontal: 24 }}
          className="relative overflow-hidden shadow-xl shadow-indigo-950/25 rounded-b-[36px] mb-6"
        >
          {/* Decorative Background Glows */}
          <View className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <View className="absolute bottom-0 left-10 w-44 h-44 rounded-full bg-indigo-900/20 blur-2xl pointer-events-none" />

          <View className="max-w-6xl mx-auto w-full">
            {/* Header Navigation & Status Badge */}
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

            {/* Title & Subtitle with guaranteed safe clearance */}
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

        {/* Sub-page Back Navigation Bar (Visible when inside any module) */}
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

          {/* ========================================================================= */}
          {/* MENU VIEW (Landing Grid of Options)                                       */}
          {/* ========================================================================= */}
         {adminView === "menu" && (
            <View className="gap-4">
              <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#1F1B3D] mb-1 mt-5">
                Select an Administration Module
              </Text>

              {/* Grid of 5 Command Options */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>

                {/* Option 1: Onboarding Card */}
                <TouchableOpacity 
                  onPress={() => navigation.navigate("AdminOnboardingSubmissions")}
                  activeOpacity={0.85}
                  className="overflow-hidden rounded-[24px] border border-indigo-200/80"
                  style={{ 
                    width: isDesktop ? "48%" : "100%", 
                    minHeight: 140,
                    shadowColor: "#5B4FD1",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 10,
                    elevation: 4,
                  }}
                >
                  <LinearGradient
                    colors={["#F8F7FF", "#EEEDFE", "#E2E0FD"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="relative justify-between"
                    style={{ minHeight: 140, padding: 20 }}
                  >
                    <View className="absolute -bottom-4 -right-4 opacity-[0.15] pointer-events-none">
                      <UserPlus size={80} color="#5B4FD1" />
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <View 
                          className="items-center justify-center shrink-0 shadow-xs"
                          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#EEEDFE", borderWidth: 1, borderColor: "#D4D2FC" }}
                        >
                          <UserPlus size={22} color="#5B4FD1" />
                        </View>
                        <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#1F1B3D] tracking-tight flex-1">
                          Onboarding
                        </Text>
                      </View>

                      <LinearGradient
                        colors={["#818CF8", "#6366F1", "#4F46E5"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        className="shadow-md shrink-0"
                        style={{ 
                          width: 54, 
                          height: 34, 
                          borderRadius: 17, 
                          borderWidth: 1, 
                          borderColor: "#C7D2FE",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <ArrowRight size={20} color="#FFFFFF" strokeWidth={3} />
                      </LinearGradient>
                    </View>

                    <View style={{ marginTop: 12, paddingRight: 40 }}>
                      <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-semibold text-[#7A76A6] leading-snug">
                        Generate secure links & review submissions
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Option 2: Add / Edit User */}
                <TouchableOpacity 
                  onPress={() => setAdminView("users")}
                  activeOpacity={0.85}
                  className="overflow-hidden rounded-[24px] border border-emerald-200/80"
                  style={{ 
                    width: isDesktop ? "48%" : "100%", 
                    minHeight: 140,
                    shadowColor: "#059669",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 10,
                    elevation: 4,
                  }}
                >
                  <LinearGradient
                    colors={["#ECFDF5", "#D1FAE5", "#A7F3D0"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="relative justify-between"
                    style={{ minHeight: 140, padding: 20 }}
                  >
                    <View className="absolute -bottom-4 -right-4 opacity-[0.15] pointer-events-none">
                      <Users size={80} color="#059669" />
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <View 
                          className="items-center justify-center shrink-0 shadow-xs"
                          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#D1FAE5", borderWidth: 1, borderColor: "#A7F3D0" }}
                        >
                          <Users size={22} color="#059669" />
                        </View>
                        <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#064E3B] tracking-tight flex-1">
                          Add / Edit User
                        </Text>
                      </View>

                      <LinearGradient
                        colors={["#34D399", "#10B981", "#059669"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        className="shadow-md shrink-0"
                        style={{ 
                          width: 54, 
                          height: 34, 
                          borderRadius: 17, 
                          borderWidth: 1, 
                          borderColor: "#A7F3D0",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <ArrowRight size={20} color="#FFFFFF" strokeWidth={3} />
                      </LinearGradient>
                    </View>

                    <View style={{ marginTop: 12, paddingRight: 40 }}>
                      <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-semibold text-[#047857] leading-snug">
                        Manage directory, salaries & roles
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Option 3: Download Reports */}
                <TouchableOpacity 
                  onPress={() => navigation.navigate("AdminReports", { initialTab: "reports" })}
                  activeOpacity={0.85}
                  className="overflow-hidden rounded-[24px] border border-amber-200/80"
                  style={{ 
                    width: isDesktop ? "48%" : "100%", 
                    minHeight: 140,
                    shadowColor: "#D97706",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 10,
                    elevation: 4,
                  }}
                >
                  <LinearGradient
                    colors={["#FFFBEB", "#FEF3C7", "#FDE68A"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="relative justify-between"
                    style={{ minHeight: 140, padding: 20 }}
                  >
                    <View className="absolute -bottom-4 -right-4 opacity-[0.15] pointer-events-none">
                      <Landmark size={80} color="#D97706" />
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <View 
                          className="items-center justify-center shrink-0 shadow-xs"
                          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FCD34D" }}
                        >
                          <Landmark size={22} color="#D97706" />
                        </View>
                        <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#78350F] tracking-tight flex-1">
                          Download Reports
                        </Text>
                      </View>

                      <LinearGradient
                        colors={["#FBBF24", "#F59E0B", "#D97706"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        className="shadow-md shrink-0"
                        style={{ 
                          width: 54, 
                          height: 34, 
                          borderRadius: 17, 
                          borderWidth: 1, 
                          borderColor: "#FDE68A",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <ArrowRight size={20} color="#FFFFFF" strokeWidth={3} />
                      </LinearGradient>
                    </View>

                    <View style={{ marginTop: 12, paddingRight: 40 }}>
                      <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-semibold text-[#92400E] leading-snug">
                        Export employee master records, statutory tables, and audit spreadsheets
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Option 4: Overall Dashboard */}
                <TouchableOpacity 
                  onPress={() => setAdminView("dashboard")}
                  activeOpacity={0.85}
                  className="overflow-hidden rounded-[24px] border border-blue-200/80"
                  style={{ 
                    width: isDesktop ? "48%" : "100%", 
                    minHeight: 140,
                    shadowColor: "#2563EB",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 10,
                    elevation: 4,
                  }}
                >
                  <LinearGradient
                    colors={["#EFF6FF", "#DBEAFE", "#BFDBFE"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="relative justify-between"
                    style={{ minHeight: 140, padding: 20 }}
                  >
                    <View className="absolute -bottom-4 -right-4 opacity-[0.15] pointer-events-none">
                      <BarChart3 size={80} color="#2563EB" />
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <View 
                          className="items-center justify-center shrink-0 shadow-xs"
                          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#DBEAFE", borderWidth: 1, borderColor: "#BFDBFE" }}
                        >
                          <BarChart3 size={22} color="#2563EB" />
                        </View>
                        <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#1E3A8A] tracking-tight flex-1">
                          Overall Dashboard
                        </Text>
                      </View>

                      <LinearGradient
                        colors={["#60A5FA", "#3B82F6", "#2563EB"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        className="shadow-md shrink-0"
                        style={{ 
                          width: 54, 
                          height: 34, 
                          borderRadius: 17, 
                          borderWidth: 1, 
                          borderColor: "#93C5FD",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <ArrowRight size={20} color="#FFFFFF" strokeWidth={3} />
                      </LinearGradient>
                    </View>

                    <View style={{ marginTop: 12, paddingRight: 40 }}>
                      <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-semibold text-[#1E40AF] leading-snug">
                        Real-time workforce attendance metrics, active permissions, and pulse
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Option 5: User Reports */}
                <TouchableOpacity 
                  onPress={() => navigation.navigate("UserDirectory")}
                  activeOpacity={0.85}
                  className="overflow-hidden rounded-[24px] border border-purple-200/80"
                  style={{ 
                    width: isDesktop ? "48%" : "100%", 
                    minHeight: 140,
                    shadowColor: "#7E22CE",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 10,
                    elevation: 4,
                  }}
                >
                  <LinearGradient
                    colors={["#FAF5FF", "#F3E8FF", "#E9D5FF"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="relative justify-between"
                    style={{ minHeight: 140, padding: 20 }}
                  >
                    <View className="absolute -bottom-4 -right-4 opacity-[0.15] pointer-events-none">
                      <FileSpreadsheet size={80} color="#7E22CE" />
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <View 
                          className="items-center justify-center shrink-0 shadow-xs"
                          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#F3E8FF", borderWidth: 1, borderColor: "#E9D5FF" }}
                        >
                          <FileSpreadsheet size={22} color="#7E22CE" />
                        </View>
                        <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#581C87] tracking-tight flex-1">
                          User Reports
                        </Text>
                      </View>

                      <LinearGradient
                        colors={["#C084FC", "#A855F7", "#7E22CE"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        className="shadow-md shrink-0"
                        style={{ 
                          width: 54, 
                          height: 34, 
                          borderRadius: 17, 
                          borderWidth: 1, 
                          borderColor: "#D8B4FE",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <ArrowRight size={20} color="#FFFFFF" strokeWidth={3} />
                      </LinearGradient>
                    </View>

                    <View style={{ marginTop: 12, paddingRight: 40 }}>
                      <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-semibold text-[#6B21A8] leading-snug">
                        Access shift management rosters, payroll deductions, and tax configurations
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

              </View>
            </View>
          )}

          {/* ========================================================================= */}
{/* DASHBOARD VIEW (DROPDOWN FILTER ENGINE)                                   */}
{/* ========================================================================= */}
{adminView === "dashboard" && (
  <View className="w-full gap-4">
    
    {/* COMPACT ENTERPRISE DROPDOWN FILTER BAR */}
<View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 md:p-5 shadow-xs gap-4">
  
  {/* FIXED HEADER ROW: Responsive wrapping for mobile view */}
  <View className="flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-2">
    <View className="flex-1 pr-1">
      <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
        Dashboard Filter Controls
      </Text>
      <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5 leading-tight">
        Select parameters to filter workforce analytics in real-time
      </Text>
    </View>
    
    {/* Badge aligned safely to avoid overflow */}
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

  {/* Row 2: Scalable Dropdown Selectors for Department & Leave Type */}
  <View className="flex-col md:flex-row gap-3 pt-1">
    
    {/* Department Dropdown Filter */}
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
          <option value="Engineering">Engineering</option>
          <option value="HR & Operations">HR & Operations</option>
          <option value="Finance">Finance</option>
          <option value="Sales">Sales</option>
        </select>
      </View>
    </View>

    {/* Leave / Status Type Dropdown Filter */}
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

    {/* EXACT ORIGINAL CARD 1: Real-Time Workforce Attendance */}
    <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 md:p-6 shadow-xs gap-4">
      <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-black text-[#1F1B3D] uppercase tracking-wider">
        Real-Time Workforce Attendance ({selectedDashboardDept} • {selectedStatusFilter})
      </Text>

      <View className="flex-col sm:flex-row items-center justify-between gap-5">
        <View className="w-32 h-32 rounded-full border-[10px] border-[#5B4FD1] border-t-amber-500 border-r-rose-500 items-center justify-center bg-[#F6F5FC] shadow-inner shrink-0">
          <Text style={{ fontSize: isDesktop ? 26 : 22 }} className="font-black text-[#1F1B3D]">{workforce.total}</Text>
          <Text style={{ fontSize: isDesktop ? 11 : 9 }} className="font-bold text-[#7A76A6] uppercase">Total Staff</Text>
        </View>

        <View className="flex-1 w-full gap-2.5">
          <View className="flex-row items-center justify-between p-3 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5]">
            <View className="flex-row items-center gap-2">
              <View className="w-3.5 h-3.5 rounded-md bg-[#5B4FD1]" />
              <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-bold text-[#1F1B3D]">Present</Text>
            </View>
            <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-black text-[#5B4FD1]">210 (84.6%)</Text>
          </View>

          <View className="flex-row items-center justify-between p-3 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5]">
            <View className="flex-row items-center gap-2">
              <View className="w-3.5 h-3.5 rounded-md bg-amber-500" />
              <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-bold text-[#1F1B3D]">On Duty (OD)</Text>
            </View>
            <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-black text-amber-600">24 (9.6%)</Text>
          </View>

          <View className="flex-row items-center justify-between p-3 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5]">
            <View className="flex-row items-center gap-2">
              <View className="w-3.5 h-3.5 rounded-md bg-[#E4453C]" />
              <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-bold text-[#1F1B3D]">Absent / Unpaid</Text>
            </View>
            <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-black text-[#E4453C]">14 (5.8%)</Text>
          </View>
        </View>
      </View>
    </View>

    {/* EXACT ORIGINAL CARD 2: Active Permissions */}
    <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-xs gap-3">
      <View className="flex-row items-center justify-between">
        <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="font-black text-[#1F1B3D] uppercase tracking-wider">
          Active Permissions
        </Text>
        <View className="bg-[#FEF2D9] border border-amber-300 px-3 py-0.5 rounded-full">
          <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-black text-amber-800">{workforce.permissionCount} Staff</Text>
        </View>
      </View>

      <View className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 mb-4">
        {/* Top Category Header Row */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
            Active Permissions
          </Text>
          <View className="bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
            <Text className="text-[10px] font-black text-amber-700">10 Staff</Text>
          </View>
        </View>

        {/* Bottom Row: Metric Text & Cleanly Contained Button */}
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
            onPress={() => setShowPermissionModal(!showPermissionModal)}
            activeOpacity={0.85}
            className="bg-[#5B4FD1] px-4 py-3 rounded-2xl flex-row items-center justify-center shrink-0 shadow-xs"
          >
            <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="text-white font-bold mr-1.5">
              {showPermissionModal ? "Hide List" : "View Staff List"}
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

          {/* ========================================================================= */}
          {/* USERS VIEW (Staff Directory & Management)                                 */}
          {/* ========================================================================= */}
          {adminView === "users" && (
            <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 24, alignItems: "flex-start", width: "100%" }}>
              
              {/* LEFT COLUMN: Search & Directory List */}
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

              {/* RIGHT COLUMN: User Detail Views */}
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

          {/* ========================================================================= */}
          {/* REPORTS VIEW                                                              */}
          {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* 5. ADD / EDIT EMPLOYEE MODAL                                              */}
      {/* ========================================================================= */}
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