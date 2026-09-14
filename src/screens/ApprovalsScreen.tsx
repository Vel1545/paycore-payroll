import React, { useState, useEffect, useMemo } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert, 
  Platform,
  TextInput
} from "react-native";
import { 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  FileSpreadsheet, 
  RotateCw,
  ChevronLeft,
  Clock,
  Wallet,
  Receipt,
  FileText,
  Send,
  Search,
  Check
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";
import { useAuth } from "../context/AuthContext";

interface InboxRequest {
  id: string;
  userId: string;
  userName: string;
  category: "Leave" | "Permission" | "Expense" | "Advance" | "Shift";
  type: string;
  details: string;
  note: string;
  date: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  balance?: number;
  amount?: string;
  actionedBy?: string;
  actionedAt?: string;
}

interface ApprovalsScreenProps {
  navigation?: {
    goBack?: () => void;
    navigate?: (screen: string, params?: any) => void;
    canGoBack?: () => boolean;
  };
  route?: {
    params?: {
      userRole?: "USER" | "ADMIN";
      currentUserId?: string;
    };
  };
}

const LOCAL_IP = "192.168.31.133";
const API_BASE_URL = Platform.OS === "web"
  ? "http://192.168.31.133:8080/api/admin/workflow"
  : `http://${LOCAL_IP}:8080/api/admin/workflow`;

export default function ApprovalsScreen({ navigation, route }: ApprovalsScreenProps) {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const currentUserId = user?.empId || user?.userId || "EMP-1042";
  const userRole = user?.role ? user.role.toUpperCase() : (isAdmin ? "ADMIN" : "USER");

  const [activeFilter, setActiveFilter] = useState<"PENDING" | "APPROVED" | "HISTORY">("PENDING");
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // NEW: Admin search & bulk selection states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);

  // 1. Fetch Requests based on Role
  const fetchInbox = async () => {
    try {
      setLoading(true);
      const endpoint = userRole === "ADMIN" 
        ? `${API_BASE_URL}/inbox` 
        : `${API_BASE_URL}/users/${currentUserId}/my-requests`;
        
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
        // Reset selections on refresh
        setSelectedRequestIds([]);
      }
    } catch {
      console.log("Could not load request records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, [userRole]);

  // 2. Single Admin Action Handler
  const handleAction = async (item: InboxRequest, approve: boolean) => {
    try {
      setProcessingId(item.id);
      const endpointType = item.category.toLowerCase();
      const res = await fetch(
        `${API_BASE_URL}/users/${item.userId}/${endpointType}/${item.id}/action?approve=${approve}&adminName=Marcus+Sterling+(Admin)`,
        { method: "POST" }
      );

      if (res.ok) {
        setRequests((prev) =>
          prev.map((req) =>
            req.id === item.id
              ? {
                  ...req,
                  status: approve ? "APPROVED" : "REJECTED",
                  actionedBy: "Marcus Sterling (Admin)",
                  actionedAt: new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                  }),
                }
              : req
          )
        );
        const msg = `Request ${item.id} ${approve ? "Approved" : "Rejected"} successfully!`;
        Platform.OS === "web" ? window.alert(msg) : Alert.alert("Success", msg);
      } else {
        throw new Error();
      }
    } catch {
      Alert.alert("Error", "Could not process approval action.");
    } finally {
      setProcessingId(null);
    }
  };

  // 3. Bulk Action: Approve Selected Requests
  const handleApproveSelected = async () => {
    if (selectedRequestIds.length === 0) return;
    
    try {
      setLoading(true);
      // Iterate through selected IDs and post approval sequentially or in parallel
      for (const id of selectedRequestIds) {
        const item = requests.find((r) => r.id === id);
        if (item && item.status?.toUpperCase() === "PENDING") {
          const endpointType = item.category.toLowerCase();
          await fetch(
            `${API_BASE_URL}/users/${item.userId}/${endpointType}/${item.id}/action?approve=true&adminName=Marcus+Sterling+(Admin)`,
            { method: "POST" }
          );
        }
      }

      // Update local state for all selected items
      setRequests((prev) =>
        prev.map((req) =>
          selectedRequestIds.includes(req.id)
            ? {
                ...req,
                status: "APPROVED",
                actionedBy: "Marcus Sterling (Admin)",
                actionedAt: new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                }),
              }
            : req
        )
      );

      setSelectedRequestIds([]);
      const msg = "Selected requests approved successfully!";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Success", msg);
    } catch {
      Alert.alert("Error", "Could not process bulk approval actions.");
    } finally {
      setLoading(false);
    }
  };

  // 4. Bulk Action: Approve All Filtered Visible Pending Requests
  const handleApproveAll = async () => {
    const pendingFilteredIds = filteredRequests
      .filter((r) => r.status?.toUpperCase() === "PENDING")
      .map((r) => r.id);

    if (pendingFilteredIds.length === 0) {
      Alert.alert("Notice", "No pending requests available to approve in this view.");
      return;
    }

    try {
      setLoading(true);
      for (const id of pendingFilteredIds) {
        const item = requests.find((r) => r.id === id);
        if (item) {
          const endpointType = item.category.toLowerCase();
          await fetch(
            `${API_BASE_URL}/users/${item.userId}/${endpointType}/${item.id}/action?approve=true&adminName=Marcus+Sterling+(Admin)`,
            { method: "POST" }
          );
        }
      }

      setRequests((prev) =>
        prev.map((req) =>
          pendingFilteredIds.includes(req.id)
            ? {
                ...req,
                status: "APPROVED",
                actionedBy: "Marcus Sterling (Admin)",
                actionedAt: new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                }),
              }
            : req
        )
      );

      setSelectedRequestIds([]);
      const msg = "All visible pending requests approved successfully!";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Success", msg);
    } catch {
      Alert.alert("Error", "Could not process approve-all action.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle selection for individual items
  const toggleSelectRequest = (id: string) => {
    if (selectedRequestIds.includes(id)) {
      setSelectedRequestIds(selectedRequestIds.filter((item) => item !== id));
    } else {
      setSelectedRequestIds([...selectedRequestIds, id]);
    }
  };

  // Select/Deselect all visible filtered pending items
  const handleSelectAllToggle = () => {
    const pendingIds = filteredRequests
      .filter((r) => r.status?.toUpperCase() === "PENDING")
      .map((r) => r.id);

    if (selectedRequestIds.length === pendingIds.length) {
      setSelectedRequestIds([]);
    } else {
      setSelectedRequestIds(pendingIds);
    }
  };

  // 3. Filter & Sort & Search Requests
  const filteredRequests = useMemo(() => {
    return requests
      .filter((r) => {
        // Tab filtering logic
        if (activeFilter === "PENDING" && r.status?.toUpperCase() !== "PENDING") return false;
        if (activeFilter === "APPROVED" && r.status?.toUpperCase() !== "APPROVED") return false;
        
        // Search query filtering (by employee name or employee ID or request ID)
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const nameMatch = r.userName?.toLowerCase().includes(query) ?? false;
          const idMatch = r.userId?.toLowerCase().includes(query) ?? false;
          const refMatch = r.id?.toLowerCase().includes(query) ?? false;
          return nameMatch || idMatch || refMatch;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [requests, activeFilter, searchQuery]);

  const pendingCount = requests.filter((r) => r.status?.toUpperCase() === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status?.toUpperCase() === "APPROVED").length;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Leave":
        return <Calendar size={14} color="#5B4FD1" />;
      case "Permission":
        return <Clock size={14} color="#5B4FD1" />;
      case "Expense":
        return <Receipt size={14} color="#5B4FD1" />;
      case "Advance":
        return <Wallet size={14} color="#5B4FD1" />;
      default:
        return <FileText size={14} color="#5B4FD1" />;
    }
  };

  return (
    <ScreenContainer>
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER (Adapts to Role)                                            */}
      {/* ========================================================================= */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5">
            {navigation && (
              <TouchableOpacity
                onPress={() => (navigation.canGoBack?.() ? navigation.goBack?.() : navigation.navigate?.("Home"))}
                className="w-8 h-8 rounded-xl bg-white border border-[#E7E4F5] items-center justify-center shadow-xs active:bg-slate-50"
              >
                <ChevronLeft size={18} color="#1F1B3D" />
              </TouchableOpacity>
            )}
            <View>
              <Text className="text-2xl font-black text-[#1F1B3D] tracking-tight">
                {userRole === "ADMIN" ? "Approval Queue" : "My Requests & Tracker"}
              </Text>
              <Text className="text-xs font-bold text-[#7A76A6] mt-0.5">
                {userRole === "ADMIN" 
                  ? "Review & action team submissions" 
                  : "Track status of leaves, claims, permissions & shifts"}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {userRole === "USER" && (
              <TouchableOpacity 
                pressRef-if-needed
                onPress={() => navigation?.navigate?.("Apply")}
                className="bg-[#5B4FD1] px-3.5 py-2 rounded-xl flex-row items-center gap-1.5 shadow-xs"
              >
                <Send size={13} color="#FFFFFF" />
                <Text className="text-white text-[11px] font-black uppercase">New Request</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              onPress={fetchInbox}
              className="w-9 h-9 rounded-xl bg-white border border-[#E7E4F5] items-center justify-center shadow-xs active:bg-slate-50"
            >
              <RotateCw size={15} color="#5B4FD1" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

    {/* ========================================================================= */}
      {/* 1.5. ADMIN SEARCH & BULK ACTION TOOLBAR (Admin Role Only) - ALIGNED       */}
      {/* ========================================================================= */}
      {userRole === "ADMIN" && (
        <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-4 shadow-xs gap-3">
          {/* Row 1: Search Bar Input */}
          <View className="flex-row items-center bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3.5 py-2.5">
            <Search size={16} color="#7A76A6" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by Employee Name, ID, or Ref..."
              placeholderTextColor="#7A76A6"
              className="flex-1 ml-2 text-xs font-bold text-[#1F1B3D]"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} className="px-1">
                <Text className="text-[10px] font-bold text-[#5B4FD1]">Clear</Text>
              </TouchableOpacity>
            )}
          </View>

         {/* Row 2 & 3: Cleanly Stacked Actions */}
          <View className="flex-col gap-3 pt-1">
            {/* Styled Button for Select All / Deselect All */}
            <TouchableOpacity 
              onPress={handleSelectAllToggle}
              activeOpacity={0.85}
              className="self-start bg-[#EEECFA] border border-[#5B4FD1]/30 px-3.5 py-1.5 rounded-xl flex-row items-center gap-1.5"
            >
              <View className={`w-3.5 h-3.5 rounded-md border items-center justify-center ${
                selectedRequestIds.length > 0 && selectedRequestIds.length === filteredRequests.filter(r => r.status?.toUpperCase() === "PENDING").length
                  ? "bg-[#5B4FD1] border-[#5B4FD1]"
                  : "bg-white border-[#E7E4F5]"
              }`}>
                {selectedRequestIds.length > 0 && selectedRequestIds.length === filteredRequests.filter(r => r.status?.toUpperCase() === "PENDING").length && (
                  <Check size={10} color="#FFFFFF" strokeWidth={3} />
                )}
              </View>
              <Text className="text-[11px] font-black text-[#5B4FD1]">
                {selectedRequestIds.length > 0 && selectedRequestIds.length === filteredRequests.filter(r => r.status?.toUpperCase() === "PENDING").length
                  ? "Deselect All"
                  : "Select All"}
              </Text>
            </TouchableOpacity>

            {/* Action Buttons Row (Balanced width sharing) */}
            <View className="flex-row items-center gap-2 w-full">
              <TouchableOpacity
                onPress={handleApproveSelected}
                disabled={selectedRequestIds.length === 0}
                activeOpacity={0.85}
                className={`flex-1 py-2.5 px-3 rounded-xl border items-center ${
                  selectedRequestIds.length > 0 
                    ? "bg-[#5B4FD1] border-[#5B4FD1]" 
                    : "bg-[#F6F5FC] border-[#E7E4F5] opacity-50"
                }`}
              >
                <Text className={`text-xs font-bold ${selectedRequestIds.length > 0 ? "text-white" : "text-[#7A76A6]"}`} numberOfLines={1}>
                  Approve Selected ({selectedRequestIds.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleApproveAll}
                activeOpacity={0.85}
                className="flex-1 bg-[#1F1B3D] py-2.5 px-3 rounded-xl items-center"
              >
                <Text className="text-xs font-bold text-white" numberOfLines={1}>
                  Approve All
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 2. FILTER PILLS                                                           */}
      {/* ========================================================================= */}
      <View className="flex-row bg-[#EEECFA]/70 p-1.5 rounded-2xl mb-5 border border-[#E7E4F5]">
        {[
          { id: "PENDING", label: `Pending (${pendingCount})` },
          { id: "APPROVED", label: `Approved (${approvedCount})` },
          { id: "HISTORY", label: `All History (${requests.length})` },
        ].map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveFilter(tab.id as any)}
              className={`flex-1 py-2 rounded-xl items-center justify-center ${
                isActive ? "bg-[#5B4FD1] shadow-xs" : ""
              }`}
            >
              <Text
                className={`text-[11px] font-black ${
                  isActive ? "text-white" : "text-[#7A76A6]"
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ========================================================================= */}
      {/* 3. REQUEST CARDS FEED (Role-Tailored Layout)                              */}
      {/* ========================================================================= */}
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 80 }}
        className="flex-1"
      >
        {loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="small" color="#5B4FD1" />
            <Text className="text-xs font-bold text-[#7A76A6] mt-2.5">
              Loading requests...
            </Text>
          </View>
        ) : filteredRequests.length === 0 ? (
          <View className="bg-white border border-[#E7E4F5] rounded-3xl p-8 items-center justify-center shadow-xs">
            <View className="w-14 h-14 rounded-2xl bg-[#EEECFA] items-center justify-center mb-3">
              <FileSpreadsheet size={26} color="#5B4FD1" />
            </View>
            <Text className="text-sm font-black text-[#1F1B3D]">No Submissions Found</Text>
            <Text className="text-xs font-semibold text-[#7A76A6] text-center mt-1">
              {userRole === "ADMIN" 
                ? `There are no matching ${activeFilter.toLowerCase()} submissions.` 
                : `You haven't submitted any ${activeFilter.toLowerCase()} requests yet.`}
            </Text>
          </View>
        ) : (
          filteredRequests.map((item) => {
            const isPending = item.status?.toUpperCase() === "PENDING";
            const isApproved = item.status?.toUpperCase() === "APPROVED";
            const isBusy = processingId === item.id;
            const isSelected = selectedRequestIds.includes(item.id);

            const initials = item.userName
              ? item.userName.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
              : "EM";

            return (
              <View 
                key={item.id} 
                className={`border rounded-2xl p-4 shadow-xs mb-3 transition-all ${
                  isSelected ? "bg-[#EEECFA]/40 border-[#5B4FD1]" : "bg-white border-[#E7E4F5]"
                }`}
              >
                {/* Header Row: Employee Info (Admin) vs Request Type (User) */}
                <View className="flex-row justify-between items-start mb-2.5">
                  <View className="flex-row items-center gap-2.5">
                    {/* Admin Checkbox integration for bulk selection */}
                    {userRole === "ADMIN" && isPending && (
                      <TouchableOpacity
                        onPress={() => toggleSelectRequest(item.id)}
                        className={`w-5 h-5 rounded-lg border items-center justify-center mr-1 ${
                          isSelected ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-white border-[#E7E4F5]"
                        }`}
                      >
                        {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </TouchableOpacity>
                    )}

                    {userRole === "ADMIN" && (
                      <View className="w-9 h-9 rounded-xl bg-[#5B4FD1] items-center justify-center">
                        <Text className="text-white text-xs font-black">{initials}</Text>
                      </View>
                    )}
                    <View>
                      <Text className="text-xs font-black text-[#1F1B3D]">
                        {userRole === "ADMIN" ? item.userName : item.type}
                      </Text>
                      <Text className="text-[10px] font-bold text-[#7A76A6] mt-0.5">
                        {userRole === "ADMIN" ? `${item.userId} • Ref: ${item.id}` : `Ref ID: ${item.id}`}
                      </Text>
                    </View>
                  </View>

                  {/* Category Chip */}
                  <View className="flex-row items-center gap-1 bg-[#EEECFA] px-2.5 py-1 rounded-full border border-[#5B4FD1]/20">
                    {getCategoryIcon(item.category)}
                    <Text className="text-[10px] font-black text-[#5B4FD1]">
                      {item.category}
                    </Text>
                  </View>
                </View>

                {/* Details Container */}
                <View className="bg-[#F6F5FC] rounded-xl p-3 mb-2.5">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-xs font-bold text-[#1F1B3D]">
                      {userRole === "ADMIN" ? item.type : item.details}
                    </Text>
                    {item.amount && (
                      <Text className="text-xs font-black text-[#5B4FD1]">
                        {item.amount}
                      </Text>
                    )}
                    {item.balance !== undefined && (
                      <Text className="text-[10px] font-black text-emerald-600">
                        Quota Bal: {item.balance}d
                      </Text>
                    )}
                  </View>

                  {userRole === "ADMIN" && (
                    <Text className="text-[11px] font-medium text-[#7A76A6]">
                      {item.details}
                    </Text>
                  )}

                  {item.note ? (
                    <Text className="text-[11px] font-semibold text-[#1F1B3D] italic mt-1.5 pt-1.5 border-t border-slate-200/60">
                      "{item.note}"
                    </Text>
                  ) : null}
                </View>

                {/* Date Tag */}
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-1">
                    <Calendar size={12} color="#7A76A6" />
                    <Text className="text-[10px] font-semibold text-[#7A76A6]">
                      Submitted: {item.date}
                    </Text>
                  </View>
                  {item.actionedAt && (
                    <Text className="text-[10px] font-bold text-[#7A76A6]">
                      Actioned: {item.actionedAt}
                    </Text>
                  )}
                </View>

                {/* ACTION CONTROLS (Admin) vs STATUS BADGE (Normal User) */}
                {userRole === "ADMIN" && isPending ? (
                  <View className="flex-row gap-2 pt-1">
                    <TouchableOpacity 
                      onPress={() => handleAction(item, false)}
                      disabled={isBusy}
                      className="flex-1 bg-[#FDE9E8] border border-[#E4453C]/30 py-2.5 rounded-xl items-center active:opacity-80"
                    >
                      <Text className="text-xs font-bold text-[#E4453C]">Reject</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => handleAction(item, true)}
                      disabled={isBusy}
                      className="flex-1 bg-[#5B4FD1] py-2.5 rounded-xl items-center active:opacity-90 shadow-xs"
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text className="text-white text-xs font-black">Approve</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View 
                    className={`p-2.5 rounded-xl border flex-row justify-between items-center ${
                      isApproved 
                        ? "bg-[#E7FAEE] border-[#1FAE5C]/30" 
                        : isPending 
                        ? "bg-[#FEF2D9] border-amber-300"
                        : "bg-[#FDE9E8] border-[#E4453C]/30"
                    }`}
                  >
                    <View className="flex-row items-center gap-1.5">
                      {isApproved ? (
                        <CheckCircle2 size={13} color="#1FAE5C" />
                      ) : isPending ? (
                        <Clock size={13} color="#D08A0C" />
                      ) : (
                        <XCircle size={13} color="#E4453C" />
                      )}
                      <Text 
                        className={`text-[10px] font-black uppercase ${
                          isApproved ? "text-[#1FAE5C]" : isPending ? "text-amber-700" : "text-[#E4453C]"
                        }`}
                      >
                        {item.status}
                      </Text>
                    </View>

                    {item.actionedBy ? (
                      <Text className="text-[10px] font-bold text-[#7A76A6]">
                        Actioned by {item.actionedBy}
                      </Text>
                    ) : (
                      <Text className="text-[10px] font-bold text-amber-800">
                        Awaiting Manager Review
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenContainer>
  );
}