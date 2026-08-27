import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView } from "react-native";
import { 
  Users, CheckCircle2, Clock, XCircle, ArrowLeft,
  Search, ShieldAlert, ChevronRight, Filter, 
  DollarSign, Landmark, UserCheck, CalendarCheck, Edit3
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";

interface AdminHubScreenProps {
  navigation: any;
}

export default function AdminHubScreen({ navigation }: AdminHubScreenProps) {
  const [activeAdminTab, setActiveAdminTab] = useState<"dashboard" | "users" | "inbox">("dashboard");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  
  // User Management State
  const [selectedUser, setSelectedUser] = useState("EMP-1042");
  const [userSubTab, setUserSubTab] = useState<"personal" | "bank" | "salary" | "balances">("personal");

  // Mock Workforce Data
  const workforce = {
    total: 248,
    present: 210,
    absent: 14,
    od: 24,
    permissionCount: 18,
    permissionPercentage: 7.2, // (18 / 248) * 100
  };

  const permissionList = [
    { id: "1", name: "Sarah Jenkins", role: "Software Engineer", slot: "02:00 PM - 04:00 PM", reason: "Medical Checkup" },
    { id: "2", name: "David Miller", role: "Senior Analyst", slot: "09:30 AM - 11:30 AM", reason: "Bank Documentation" },
    { id: "3", name: "Alex Richardson", role: "Product Designer", slot: "03:30 PM - 05:30 PM", reason: "Personal Errand" },
    { id: "4", name: "Elena Gomez", role: "HR Operations", slot: "04:00 PM - 06:00 PM", reason: "Early Departure" },
  ];

  const inboxRequests = [
    { id: "REQ-901", user: "Vikram Rathore", type: "Permission", details: "2 Hours • 03:00 PM - 05:00 PM", status: "Pending" },
    { id: "REQ-902", user: "Sarah Jenkins", type: "Leave Request", details: "Annual Leave • 3 Days (Feb 02 - Feb 04)", status: "Pending" },
    { id: "REQ-903", user: "Michael Chang", type: "Salary Advance", details: "Amount: $1,200.00 • 3 Month Repay", status: "Pending" },
    { id: "REQ-904", user: "Priya Sharma", type: "Expense Claim", details: "Client Outstation Travel • $420.00", status: "Pending" },
  ];

  return (
    <ScreenContainer>
      {/* Top Admin Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            className="w-10 h-10 bg-brand-card border border-brand-border rounded-xl items-center justify-center mr-3 shadow-xs"
          >
            <ArrowLeft size={18} color="#0F172A" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-black text-brand-dark tracking-tight">Team Hub • Admin</Text>
            <Text className="text-xs font-bold text-brand-muted">Human Capital Command Center</Text>
          </View>
        </View>
        <View className="bg-brand-hero px-3 py-1.5 rounded-xl border border-brand-border">
          <Text className="text-[10px] font-black text-brand-canvas uppercase tracking-widest">Admin Role</Text>
        </View>
      </View>

      {/* Top Admin Segmented Navigation Bar */}
      <View className="flex-row bg-brand-hero/10 p-1 rounded-2xl mb-6 border border-brand-border">
        <TouchableOpacity
          onPress={() => setActiveAdminTab("dashboard")}
          className={`flex-1 py-2.5 rounded-xl items-center ${activeAdminTab === "dashboard" ? "bg-brand-hero shadow-xs" : ""}`}
        >
          <Text className={`text-xs font-black ${activeAdminTab === "dashboard" ? "text-white" : "text-brand-dark"}`}>
            Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveAdminTab("users")}
          className={`flex-1 py-2.5 rounded-xl items-center ${activeAdminTab === "users" ? "bg-brand-hero shadow-xs" : ""}`}
        >
          <Text className={`text-xs font-black ${activeAdminTab === "users" ? "text-white" : "text-brand-dark"}`}>
            User Master
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveAdminTab("inbox")}
          className={`flex-1 py-2.5 rounded-xl items-center ${activeAdminTab === "inbox" ? "bg-brand-hero shadow-xs" : ""}`}
        >
          <Text className={`text-xs font-black ${activeAdminTab === "inbox" ? "text-white" : "text-brand-dark"}`}>
            Inbox (4)
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* 1. OVERALL WORKFORCE DASHBOARD (Live Donut, Present/Absent/OD, Permissions) */}
      {/* ========================================================================= */}
      {activeAdminTab === "dashboard" && (
        <View className="space-y-5">
          {/* Donut / Pie Representation Card */}
          <View className="bg-brand-card border border-brand-border rounded-3xl p-5 shadow-xs">
            <Text className="text-xs font-black text-brand-dark uppercase tracking-widest mb-4">
              Real-Time Workforce Attendance
            </Text>

            <View className="flex-row items-center justify-between mb-4">
              {/* Custom High-Contrast Donut Representation */}
              <View className="w-28 h-28 rounded-full border-[10px] border-brand-primary border-t-amber-500 border-r-rose-500 items-center justify-center bg-brand-cardTint shadow-inner">
                <Text className="text-xl font-black text-brand-dark">{workforce.total}</Text>
                <Text className="text-[9px] font-bold text-brand-muted uppercase">Total Staff</Text>
              </View>

              {/* Legend & Breakdown */}
              <View className="flex-1 ml-6 space-y-2.5">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="w-3 h-3 rounded-md bg-brand-primary mr-2" />
                    <Text className="text-xs font-bold text-brand-dark">Present</Text>
                  </View>
                  <Text className="text-xs font-black text-brand-primary">210 (84.6%)</Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="w-3 h-3 rounded-md bg-amber-500 mr-2" />
                    <Text className="text-xs font-bold text-brand-dark">On Duty (OD)</Text>
                  </View>
                  <Text className="text-xs font-black text-amber-600">24 (9.6%)</Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="w-3 h-3 rounded-md bg-rose-500 mr-2" />
                    <Text className="text-xs font-bold text-brand-dark">Absent / Unpaid</Text>
                  </View>
                  <Text className="text-xs font-black text-rose-600">14 (5.8%)</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Inline Permission % and Quick Navigation Row */}
          <View className="bg-brand-card border border-brand-border rounded-3xl p-5 shadow-xs">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-black text-brand-dark uppercase tracking-widest">
                Active Permissions
              </Text>
              <View className="bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                <Text className="text-[10px] font-black text-amber-900">{workforce.permissionCount} Staff</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between my-2">
              <View>
                <Text className="text-2xl font-black text-brand-dark">{workforce.permissionPercentage}%</Text>
                <Text className="text-[11px] font-semibold text-brand-muted">Of total workforce currently on permission</Text>
              </View>

              {/* Button Navigation to view the list of people */}
              <TouchableOpacity
                onPress={() => setShowPermissionModal(!showPermissionModal)}
                className="bg-brand-hero px-4 py-2.5 rounded-xl active:opacity-90 flex-row items-center"
              >
                <Text className="text-white text-xs font-bold mr-1">
                  {showPermissionModal ? "Hide List" : "View Staff List"}
                </Text>
                <ChevronRight size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Expandable Member List Section */}
            {showPermissionModal && (
              <View className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                {permissionList.map((emp) => (
                  <View key={emp.id} className="bg-brand-cardTint border border-brand-border rounded-2xl p-3 flex-row items-center justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-xs font-black text-brand-dark">{emp.name}</Text>
                      <Text className="text-[10px] font-semibold text-brand-muted">{emp.role} • {emp.reason}</Text>
                    </View>
                    <View className="bg-white border border-brand-border px-2.5 py-1 rounded-lg">
                      <Text className="text-[10px] font-black text-brand-primary">{emp.slot}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 2. USER MANAGEMENT SYSTEM (Personal, Bank, Salary Structure, Balances)    */}
      {/* ========================================================================= */}
      {activeAdminTab === "users" && (
        <View className="space-y-4">
          {/* Search Bar & Employee Selector */}
          <View className="bg-brand-card border border-brand-border rounded-2xl px-3.5 py-2.5 flex-row items-center">
            <Search size={16} color="#5C4D41" />
            <TextInput 
              placeholder="Search by Employee ID, Name or Department..."
              placeholderTextColor="#8C7A6B"
              className="flex-1 ml-2.5 text-xs font-semibold text-brand-dark"
            />
          </View>

          {/* Quick User Selector Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-2">
            {[
              { id: "EMP-1042", name: "Marcus Sterling (Lead)" },
              { id: "EMP-2031", name: "Sarah Jenkins (Dev)" },
              { id: "EMP-4092", name: "David Miller (Analyst)" },
            ].map((u) => (
              <TouchableOpacity
                key={u.id}
                onPress={() => setSelectedUser(u.id)}
                className={`px-3.5 py-2 rounded-xl border ${selectedUser === u.id ? "bg-brand-hero border-brand-hero" : "bg-brand-card border-brand-border"}`}
              >
                <Text className={`text-xs font-bold ${selectedUser === u.id ? "text-white" : "text-brand-dark"}`}>
                  {u.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Modification Navigation Sub-Tabs */}
          <View className="flex-row bg-brand-card border border-brand-border p-1 rounded-2xl justify-between">
            {[
              { key: "personal", label: "Personal" },
              { key: "bank", label: "Bank" },
              { key: "salary", label: "Salary" },
              { key: "balances", label: "Balances" },
            ].map((st) => (
              <TouchableOpacity
                key={st.key}
                onPress={() => setUserSubTab(st.key as any)}
                className={`flex-1 py-2 rounded-xl items-center ${userSubTab === st.key ? "bg-brand-primary" : ""}`}
              >
                <Text className={`text-[11px] font-black ${userSubTab === st.key ? "text-white" : "text-brand-dark"}`}>
                  {st.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sub-Tab 1: Personal Details */}
          {userSubTab === "personal" && (
            <View className="bg-brand-card border border-brand-border rounded-3xl p-5 space-y-3 shadow-xs">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs font-black text-brand-dark uppercase tracking-wider">Personal & Official Master</Text>
                <Edit3 size={16} color="#0D9488" />
              </View>

              <View><Text className="text-[10px] font-bold text-brand-muted uppercase">Full Name</Text><TextInput defaultValue="Marcus Vance Sterling" className="bg-brand-cardTint border border-brand-border rounded-xl p-2.5 text-xs font-bold text-brand-dark" /></View>
              <View><Text className="text-[10px] font-bold text-brand-muted uppercase">Designation</Text><TextInput defaultValue="Principal Software Lead" className="bg-brand-cardTint border border-brand-border rounded-xl p-2.5 text-xs font-bold text-brand-dark" /></View>
              <View><Text className="text-[10px] font-bold text-brand-muted uppercase">Official Email</Text><TextInput defaultValue="marcus.sterling@paycore.io" className="bg-brand-cardTint border border-brand-border rounded-xl p-2.5 text-xs font-bold text-brand-dark" /></View>
              <TouchableOpacity className="bg-brand-hero py-3 rounded-xl items-center mt-2"><Text className="text-white font-bold text-xs uppercase">Save Personal Details</Text></TouchableOpacity>
            </View>
          )}

          {/* Sub-Tab 2: Bank Details */}
          {userSubTab === "bank" && (
            <View className="bg-brand-card border border-brand-border rounded-3xl p-5 space-y-3 shadow-xs">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs font-black text-brand-dark uppercase tracking-wider">Statutory & Bank Verification</Text>
                <Landmark size={16} color="#0D9488" />
              </View>

              <View><Text className="text-[10px] font-bold text-brand-muted uppercase">Bank Name</Text><TextInput defaultValue="JPMorgan Chase N.A." className="bg-brand-cardTint border border-brand-border rounded-xl p-2.5 text-xs font-bold text-brand-dark" /></View>
              <View><Text className="text-[10px] font-bold text-brand-muted uppercase">Account Number</Text><TextInput defaultValue="9042-8819-0129" className="bg-brand-cardTint border border-brand-border rounded-xl p-2.5 text-xs font-bold text-brand-dark" /></View>
              <View><Text className="text-[10px] font-bold text-brand-muted uppercase">IFSC / Swift Routing Code</Text><TextInput defaultValue="CHASUS33XXX" className="bg-brand-cardTint border border-brand-border rounded-xl p-2.5 text-xs font-bold text-brand-dark" /></View>
              <TouchableOpacity className="bg-brand-hero py-3 rounded-xl items-center mt-2"><Text className="text-white font-bold text-xs uppercase">Update Bank Master</Text></TouchableOpacity>
            </View>
          )}

          {/* Sub-Tab 3: Salary Details */}
          {userSubTab === "salary" && (
            <View className="bg-brand-card border border-brand-border rounded-3xl p-5 space-y-3 shadow-xs">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs font-black text-brand-dark uppercase tracking-wider">Salary Structure Breakdown</Text>
                <DollarSign size={16} color="#0D9488" />
              </View>

              <View className="flex-row space-x-2">
                <View className="flex-1"><Text className="text-[10px] font-bold text-brand-muted uppercase">Monthly CTC ($)</Text><TextInput defaultValue="6500.00" className="bg-brand-cardTint border border-brand-border rounded-xl p-2.5 text-xs font-bold text-brand-dark" /></View>
                <View className="flex-1"><Text className="text-[10px] font-bold text-brand-muted uppercase">Basic Pay ($)</Text><TextInput defaultValue="4200.00" className="bg-brand-cardTint border border-brand-border rounded-xl p-2.5 text-xs font-bold text-brand-dark" /></View>
              </View>
              <View className="flex-row space-x-2">
                <View className="flex-1"><Text className="text-[10px] font-bold text-brand-muted uppercase">HRA ($)</Text><TextInput defaultValue="1400.00" className="bg-brand-cardTint border border-brand-border rounded-xl p-2.5 text-xs font-bold text-brand-dark" /></View>
                <View className="flex-1"><Text className="text-[10px] font-bold text-brand-muted uppercase">PF Deduction ($)</Text><TextInput defaultValue="380.00" className="bg-brand-cardTint border border-brand-border rounded-xl p-2.5 text-xs font-bold text-rose-600" /></View>
              </View>
              <TouchableOpacity className="bg-brand-hero py-3 rounded-xl items-center mt-2"><Text className="text-white font-bold text-xs uppercase">Commit Salary Revision</Text></TouchableOpacity>
            </View>
          )}

          {/* Sub-Tab 4: Leave, Permission, OD & Overtime Balances */}
          {userSubTab === "balances" && (
            <View className="bg-brand-card border border-brand-border rounded-3xl p-5 space-y-3 shadow-xs">
              <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1">Accrual & Overtime Balances</Text>

              <View className="flex-row space-x-2">
                <View className="flex-1 bg-brand-cardTint border border-brand-border rounded-xl p-3 items-center">
                  <Text className="text-xs font-bold text-brand-muted">Earned Leave</Text>
                  <TextInput defaultValue="14" className="text-base font-black text-brand-dark mt-0.5" />
                </View>
                <View className="flex-1 bg-brand-cardTint border border-brand-border rounded-xl p-3 items-center">
                  <Text className="text-xs font-bold text-brand-muted">Casual Leave</Text>
                  <TextInput defaultValue="04" className="text-base font-black text-brand-dark mt-0.5" />
                </View>
              </View>

              <View className="flex-row space-x-2">
                <View className="flex-1 bg-brand-cardTint border border-brand-border rounded-xl p-3 items-center">
                  <Text className="text-xs font-bold text-brand-muted">OD Permitted</Text>
                  <TextInput defaultValue="08" className="text-base font-black text-amber-700 mt-0.5" />
                </View>
                <View className="flex-1 bg-brand-cardTint border border-brand-border rounded-xl p-3 items-center">
                  <Text className="text-xs font-bold text-brand-muted">OT Hours Logged</Text>
                  <TextInput defaultValue="16.5" className="text-base font-black text-brand-primary mt-0.5" />
                </View>
              </View>
              <TouchableOpacity className="bg-brand-hero py-3 rounded-xl items-center mt-2"><Text className="text-white font-bold text-xs uppercase">Save Balance Quotas</Text></TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* 3. UNIFIED INBOX (All Employee Claims, Leaves, Permissions, Advances)      */}
      {/* ========================================================================= */}
      {activeAdminTab === "inbox" && (
        <View className="space-y-4 mb-8">
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-black text-brand-dark uppercase tracking-widest">Pending Approvals Queue</Text>
            <View className="bg-brand-card border border-brand-border px-3 py-1 rounded-xl flex-row items-center">
              <Filter size={12} color="#5C4D41" />
              <Text className="text-[11px] font-bold text-brand-muted ml-1">All Filters</Text>
            </View>
          </View>

          {inboxRequests.map((req) => (
            <View key={req.id} className="bg-brand-card border border-brand-border rounded-2xl p-4 shadow-xs">
              <View className="flex-row justify-between items-center mb-2">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-brand-hero items-center justify-center mr-2.5">
                    <Text className="text-white text-xs font-bold">{req.user.substring(0, 2).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text className="text-xs font-black text-brand-dark">{req.user}</Text>
                    <Text className="text-[10px] font-semibold text-brand-muted">{req.id}</Text>
                  </View>
                </View>
                <View className="bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-lg">
                  <Text className="text-[10px] font-black text-brand-primary">{req.type}</Text>
                </View>
              </View>

              <Text className="text-xs font-bold text-brand-dark mb-3">• {req.details}</Text>

              <View className="flex-row space-x-2">
                <TouchableOpacity className="flex-1 bg-slate-100 py-2.5 rounded-xl items-center">
                  <Text className="text-xs font-bold text-slate-700">Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-1 bg-brand-hero py-2.5 rounded-xl items-center">
                  <Text className="text-white text-xs font-bold">Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}