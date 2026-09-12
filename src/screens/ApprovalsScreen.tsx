import React, { useState, useEffect, useMemo } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert, 
  Platform 
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
  Send
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
  // Determine role: if passed via route params, use it. Otherwise fallback safely.
  const { user, loading: authLoading } = useAuth();
  // 2. Determine permissions securely from the global user object
  // If user.isAdmin is true, they see the admin queue. Otherwise, they see their own personal requests.
  const isAdmin = user?.isAdmin ?? false;
  const currentUserId = user?.empId || user?.userId || "EMP-1042";
  const userRole = user?.role ? user.role.toUpperCase() : (isAdmin ? "ADMIN" : "USER");
 // Resolve admin status safely with proper boolean fallback chaining
   const [activeFilter, setActiveFilter] = useState<"PENDING" | "APPROVED" | "HISTORY">("PENDING");
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // 1. Fetch Requests based on Role (All team requests for Admin, Personal requests for User)
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

  // 2. Admin Action Handler
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

  // 3. Filter & Sort Requests
  const filteredRequests = useMemo(() => {
    return requests
      .filter((r) => {
        if (activeFilter === "PENDING") return r.status?.toUpperCase() === "PENDING";
        if (activeFilter === "APPROVED") return r.status?.toUpperCase() === "APPROVED";
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [requests, activeFilter]);

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
                ? `There are no ${activeFilter.toLowerCase()} department submissions.` 
                : `You haven't submitted any ${activeFilter.toLowerCase()} requests yet.`}
            </Text>
          </View>
        ) : (
          filteredRequests.map((item) => {
            const isPending = item.status?.toUpperCase() === "PENDING";
            const isApproved = item.status?.toUpperCase() === "APPROVED";
            const isBusy = processingId === item.id;

            const initials = item.userName
              ? item.userName.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
              : "EM";

            return (
              <View 
                key={item.id} 
                className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs mb-3"
              >
                {/* Header Row: Employee Info (Admin) vs Request Type (User) */}
                <View className="flex-row justify-between items-start mb-2.5">
                  <View className="flex-row items-center gap-2.5">
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
                        {userRole === "ADMIN" ? `${item.userId} • ${item.id}` : `Ref ID: ${item.id}`}
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