import React, { useState, useEffect, useMemo } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert, 
  Platform,
  TextInput,
  Modal
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
  Check,
  Briefcase,
  AlertCircle
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";
import CheckoutApprovalsPanel from "../components/Checkoutapprovalspanel";
import CheckinApprovalsPanel from "../utils/Checkinapprovalspanel";
import CheckinRequestsPanel from "../utils/Checkinrequestspanel";
import CheckoutRequestsPanel from "../components/Checkoutrequestspanel";
import CompactDatePicker from "../components/CrossPlatformDatePicker";
import { useAuth } from "../context/AuthContext";
import { UserSession } from "../services/UserSession";
import { BASE_HOST } from "../constants/config";

interface InboxRequest {
  id: string;
  userId: string;
  userName: string;
  category: "Leave" | "Permission" | "Expense" | "Advance" | "Shift" | "Overtime" | "OD";
  type: string;
  details: string;
  note: string;
  date: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  balance?: number;
  amount?: string;
  requestedHours?: number;
  requestedDays?: number;
  approvedHours?: number;
  approvedDays?: number;
  actionedBy?: string;
  actionedAt?: string;
  rejectionReason?: string;
}

// The 4 admin groups (tabs). A notification opens one of them: route.params = { tab, requestId, kind }
type Group = "leave" | "otod" | "money" | "checkout";
const GROUP_TABS: { id: Group; label: string }[] = [
  { id: "leave", label: "Leave • Permission • Half Day" },
  { id: "otod", label: "OT & OD" },
  { id: "money", label: "Advance & Claim" },
  { id: "checkout", label: "Check-out" },
];
// kind sent by the notification -> group
const KIND_GROUP: Record<string, Group> = {
  LEAVE: "leave", PERMISSION: "leave", HALF_DAY: "leave",
  OD: "otod", OVERTIME: "otod",
  ADVANCE: "money", CLAIM: "money",
  CHECKOUT: "checkout", CHECKIN: "checkout",
};
// request category (from the inbox list) -> group
const groupOfCategory = (category?: string): Group => {
  const c = (category || "").toLowerCase();
  if (c === "overtime" || c === "od") return "otod";
  if (c === "expense" || c === "claim" || c === "advance") return "money";
  return "leave"; // leave, permission, half day, shift
};

interface ApprovalsScreenProps {
  route?: { params?: { tab?: string; requestId?: string; kind?: string } };
  navigation?: {
    goBack?: () => void;
    navigate?: (screen: string, params?: any) => void;
    canGoBack?: () => boolean;
  };
}

const API_BASE_URL= `${BASE_HOST}/api/admin/workflow`;

export default function ApprovalsScreen({ navigation, route }: ApprovalsScreenProps) {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const currentUserId = user?.empId || user?.userId || UserSession.empId;
  // Who is approving: the person's real name (never the role "Admin"); falls back to the employee id
  const approverName: string =
    String((user as any)?.fullName || (user as any)?.name || (UserSession as any)?.name || user?.userName || currentUserId || "").trim() || "Approver";
  const userRole = user?.role ? user.role.toUpperCase() : (isAdmin ? "ADMIN" : "USER");

  const [activeFilter, setActiveFilter] = useState<"PENDING" | "APPROVED" | "HISTORY" | "REJECTED">("PENDING");
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Admin: the 4 groups (tabs) with the number of requests waiting in each
  const [group, setGroup] = useState<Group>("leave");
  const [counts, setCounts] = useState<Record<Group, number>>({ leave: 0, otod: 0, money: 0, checkout: 0 });
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const loadCounts = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/pending-counts`, { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setCounts({ leave: d.leave || 0, otod: d.otod || 0, money: d.money || 0, checkout: d.checkout || 0 });
      }
    } catch { /* badges are optional */ }
  };
  const loadCheckoutPending = loadCounts; // the check-out panel calls this after an approval

  useEffect(() => {
    if (userRole === "ADMIN") loadCounts();
  }, [userRole]);

  // Opened from a notification (or the pending banner): go to the right tab and highlight the request
  useEffect(() => {
    const prm = route?.params;
    if (!prm) return;
    if (userRole !== "ADMIN") {
      // employee opened from an "approved / rejected" notification: open its category, show that request (it is decided, so under History)
      const mine = (GROUP_TABS.find((t) => t.id === prm.tab)?.id as Group | undefined) ?? (prm.kind ? KIND_GROUP[prm.kind] : undefined);
      if (mine) setGroup(mine);
      if (prm.requestId) {
        setHighlightId(String(prm.requestId));
        setActiveFilter("HISTORY");
        setSearchQuery("");
      }
      return;
    }
    const g = (GROUP_TABS.find((t) => t.id === prm.tab)?.id as Group | undefined) ?? (prm.kind ? KIND_GROUP[prm.kind] : undefined);
    if (g) setGroup(g);
    if (prm.requestId) {
      setHighlightId(String(prm.requestId));
      setActiveFilter("PENDING");
      setSearchQuery("");
      applyDatePreset("ALL");   // make sure an older request is still inside the window
    } else {
      setHighlightId(null);
    }
    loadCounts();
  }, [route?.params?.tab, route?.params?.requestId, route?.params?.kind, userRole]);

  // Employee opened a decided request from a bell alert: when the alert had no kind, the request itself tells the category
  useEffect(() => {
    if (userRole === "ADMIN" || !highlightId) return;
    const r = requests.find((x) => x.id === highlightId);
    if (r) setGroup(groupOfCategory(r.category));
  }, [requests, highlightId, userRole]);

  // Search & Bulk Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);

  // Admin Decision Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<InboxRequest | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [customHours, setCustomHours] = useState("");
  const [customDays, setCustomDays] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [adminRemarks, setAdminRemarks] = useState("");

  // Date range states (default: last 30 days)
  const [datePreset, setDatePreset] = useState<"7D" | "30D" | "ALL" | "CUSTOM">("30D");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);



  // Fetch Requests based on Role & Active Filters
  const fetchInbox = async () => {
    try {
      setLoading(true);
      let endpoint = "";

      if (userRole === "ADMIN") {
        // always load every status once; the tabs (Pending / Approved / History / Rejected) filter on the phone,
        // so all four counts are correct from the start
        endpoint = `${API_BASE_URL}/inbox?status=ALL&fromDate=${startDate}&toDate=${endDate}`;
      } else {
        endpoint = `${API_BASE_URL}/users/${currentUserId}/requests`;
      }

      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
        setSelectedRequestIds([]);
        loadCounts();
      }
    } catch {
      console.log("Could not load request records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, [userRole, startDate, endDate]);

  // Quick date preset handler
  const applyDatePreset = (preset: "7D" | "30D" | "ALL") => {
    setDatePreset(preset);
    const now = new Date();
    const endStr = now.toISOString().split("T")[0];

    if (preset === "ALL") {
      setStartDate("2020-01-01");
      setEndDate(endStr);
      return;
    }

    const start = new Date();
    start.setDate(now.getDate() - (preset === "7D" ? 7 : 30));
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(endStr);
  };

  // Open Decision Modal for Admin
  const openDecisionModal = (item: InboxRequest, approve: boolean) => {
    setActiveItem(item);
    setActionType(approve ? "APPROVE" : "REJECT");
    setAdminRemarks("");
    setCustomHours(item.requestedHours ? item.requestedHours.toString() : "");
    setCustomDays(item.requestedDays ? item.requestedDays.toString() : "");
    const rawAmt = item.amount ? item.amount.replace(/[^0-9.]/g, "") : "";
    setCustomAmount(rawAmt);
    setIsModalOpen(true);
  };

  // State update helper
  const handleActionSuccess = (
    targetRequestId: string, 
    approve: boolean, 
    remarks?: string, 
    approvedHours?: number | null, 
    approvedDays?: number | null
  ) => {
    const formattedActionDate = new Date().toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const newStatus = approve ? "APPROVED" : "REJECTED";

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === targetRequestId) {
          return {
            ...req,
            status: newStatus,
            actionedBy: approverName,
            actionedAt: formattedActionDate,
            rejectionReason: remarks || (approve ? `Approved by ${approverName}` : `Rejected by ${approverName}`),
            approvedHours: approvedHours !== undefined && approvedHours !== null ? approvedHours : req.approvedHours,
            approvedDays: approvedDays !== undefined && approvedDays !== null ? approvedDays : req.approvedDays,
          };
        }
        return req;
      })
    );

    setSelectedRequestIds((prev) => prev.filter((id) => id !== targetRequestId));
    if (highlightId === targetRequestId) setHighlightId(null);
    loadCounts();
  };

  // Submit Modal Action
  const submitDecision = async () => {
    if (!activeItem) return;
    try {
      setProcessingId(activeItem.id);
      setIsModalOpen(false);

      const endpointType = activeItem.category.toLowerCase();
      const isApproved = actionType === "APPROVE";

      const payload = {
        approved: isApproved,
        adminName: approverName,
        remarks: adminRemarks || (isApproved ? `Approved by ${approverName}` : `Rejected by ${approverName}`),
        approvedHours: customHours ? parseFloat(customHours) : null,
        approvedDays: customDays ? parseFloat(customDays) : null,
        approvedAmount: customAmount ? parseFloat(customAmount) : null
      };

      const res = await fetch(
        `${API_BASE_URL}/users/${activeItem.userId}/${endpointType}/${activeItem.id}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      if (res.ok) {
        handleActionSuccess(activeItem.id, isApproved, payload.remarks, payload.approvedHours, payload.approvedDays);
        const msg = `Request ${activeItem.id} ${isApproved ? "Approved" : "Rejected"} successfully!`;
        Platform.OS === "web" ? window.alert(msg) : Alert.alert("Success", msg);
      } else {
        throw new Error();
      }
    } catch {
      Alert.alert("Error", "Could not process review decision.");
    } finally {
      setProcessingId(null);
      setActiveItem(null);
    }
  };

  // Direct Quick Action
  const handleDirectAction = async (item: InboxRequest, approve: boolean) => {
    try {
      setProcessingId(item.id);
      const targetUserId = item.userId || currentUserId;
      const endpointType = item.category?.toLowerCase() || "leave";

      const payload = {
        approved: approve,
        adminName: approverName,
        remarks: approve ? `Approved by ${approverName}` : `Rejected by ${approverName}`,
        approvedHours: item.requestedHours || null,
        approvedDays: item.requestedDays || null
      };

      const res = await fetch(
        `${API_BASE_URL}/users/${targetUserId}/${endpointType}/${item.id}/action`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      if (res.ok) {
        handleActionSuccess(item.id, approve, payload.remarks, payload.approvedHours, payload.approvedDays);
        const msg = `Request ${item.id} ${approve ? "Approved" : "Rejected"} successfully!`;
        Platform.OS === "web" ? window.alert(msg) : Alert.alert("Success", msg);
      } else {
        const errorText = await res.text();
        Alert.alert("Failed", `Server error (${res.status}): ${errorText || "Could not process request"}`);
      }
    } catch (err: any) {
      Alert.alert("Network Error", `Could not connect to ${API_BASE_URL}. Ensure backend is running.`);
    } finally {
      setProcessingId(null);
    }
  };

  // Bulk Approval
  const handleBulkApprove = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      setLoading(true);
      for (const id of ids) {
        const item = requests.find((r) => r.id === id);
        if (item && item.status?.toUpperCase() === "PENDING") {
          const endpointType = item.category.toLowerCase();
          await fetch(
            `${API_BASE_URL}/users/${item.userId}/${endpointType}/${item.id}/action`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                approved: true,
                adminName: approverName,
                remarks: `Bulk approved by ${approverName}`
              })
            }
          );
        }
      }

      const nowStr = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric"
      });

      setRequests((prev) =>
        prev.map((req) =>
          ids.includes(req.id)
            ? { ...req, status: "APPROVED", actionedBy: approverName, actionedAt: nowStr }
            : req
        )
      );

      setSelectedRequestIds([]);
      Alert.alert("Success", "Requests approved successfully!");
    } catch {
      Alert.alert("Error", "Could not process bulk approvals.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectRequest = (id: string) => {
    setSelectedRequestIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllToggle = () => {
    const pendingIds = filteredRequests
      .filter((r) => r.status?.toUpperCase() === "PENDING")
      .map((r) => r.id);

    setSelectedRequestIds(selectedRequestIds.length === pendingIds.length ? [] : pendingIds);
  };

  // Filtering & Sorting
  // Everyone (admin and employee) sees one category at a time
  const groupRequests = useMemo(
    () => requests.filter((r) => groupOfCategory(r.category) === group),
    [requests, group]
  );

  // Employee tabs: how many of my own requests are still pending in each category (check-out has its own lists)
  const myPending = useMemo(() => {
    const c: Record<Group, number> = { leave: 0, otod: 0, money: 0, checkout: 0 };
    requests.forEach((r) => { if (r.status?.toUpperCase() === "PENDING") c[groupOfCategory(r.category)] += 1; });
    return c;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return groupRequests
      .filter((r) => {
        const status = r.status?.toUpperCase();

        if (activeFilter === "PENDING" && status !== "PENDING") return false;
        if (activeFilter === "APPROVED" && status !== "APPROVED") return false;
        if (activeFilter === "REJECTED" && status !== "REJECTED") return false;
        if (activeFilter === "HISTORY" && status !== "APPROVED" && status !== "REJECTED") return false;

        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          return (
            (r.userName?.toLowerCase().includes(query) ?? false) ||
            (r.userId?.toLowerCase().includes(query) ?? false) ||
            (r.id?.toLowerCase().includes(query) ?? false)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (highlightId) {
          if (a.id === highlightId) return -1;   // the request from the notification goes to the top
          if (b.id === highlightId) return 1;
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [groupRequests, activeFilter, searchQuery, highlightId]);

  // If the request from the notification is already decided, show it under History
  useEffect(() => {
    if (!highlightId || loading || activeFilter !== "PENDING") return;
    const hit = requests.find((r) => r.id === highlightId);
    if (hit && hit.status?.toUpperCase() !== "PENDING") setActiveFilter("HISTORY");
  }, [requests, highlightId, loading]);

  // Tab Counters
  const pendingCount = useMemo(() => 
    groupRequests.filter((r) => r.status?.toUpperCase() === "PENDING").length, 
    [groupRequests]
  );
  const rejectCount = useMemo(() => 
    groupRequests.filter((r) => r.status?.toUpperCase() === "REJECTED").length, 
    [groupRequests]
  );
  const approvedCount = useMemo(() => 
    groupRequests.filter((r) => r.status?.toUpperCase() === "APPROVED").length, 
    [groupRequests]
  );
  const historyCount = useMemo(() => 
    groupRequests.filter((r) => {
      const s = r.status?.toUpperCase();
      return s === "APPROVED" || s === "REJECTED";
    }).length, 
    [groupRequests]
  );

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Leave":
        return <Calendar size={13} color="#5B4FD1" />;
      case "Permission":
        return <Clock size={13} color="#5B4FD1" />;
      case "Expense":
        return <Receipt size={13} color="#5B4FD1" />;
      case "Advance":
        return <Wallet size={13} color="#5B4FD1" />;
      case "Overtime":
        return <Clock size={13} color="#D97706" />;
      case "OD":
        return <Briefcase size={13} color="#0D9488" />;
      default:
        return <FileText size={13} color="#5B4FD1" />;
    }
  };

  return (
    <ScreenContainer>
      {/* Top Header */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5">
            {navigation && (
              <TouchableOpacity
                onPress={() => (navigation.canGoBack?.() ? navigation.goBack?.() : navigation.navigate?.("Home"))}
                className="w-8 h-8 rounded-xl bg-white border border-[#E7E4F5] items-center justify-center shadow-xs"
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
                  ? "Review, allocate hours & action submissions" 
                  : "Track status of leaves, claims, permissions & OT"}
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
              className="w-9 h-9 rounded-xl bg-white border border-[#E7E4F5] items-center justify-center shadow-xs"
            >
              <RotateCw size={15} color="#5B4FD1" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Category tabs with pending counts: admin sees all pending, employee sees their own */}
      {(
        <View className="flex-row bg-white border border-[#E7E4F5] p-1 rounded-2xl mb-4">
          {GROUP_TABS.map((t) => {
            const active = group === t.id;
            const n = (userRole === "ADMIN" ? counts[t.id] : myPending[t.id]) || 0;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => { setGroup(t.id); setHighlightId(null); setSelectedRequestIds([]); if (userRole === "ADMIN") loadCounts(); }}
                className={`flex-1 py-2.5 px-1 rounded-xl items-center justify-center ${active ? "bg-[#5B4FD1]" : ""}`}
              >
                <Text numberOfLines={2} style={{ textAlign: "center" }} className={`text-[10px] font-black ${active ? "text-white" : "text-[#7A76A6]"}`}>
                  {t.label}
                </Text>
                {n > 0 && (
                  <View className={`mt-1 min-w-[18px] px-1 h-[18px] rounded-full items-center justify-center ${active ? "bg-white" : "bg-[#E4453C]"}`}>
                    <Text className={`text-[10px] font-black ${active ? "text-[#5B4FD1]" : "text-white"}`}>{n}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {group === "checkout" ? (
        userRole === "ADMIN" ? (
          <>
            <CheckinApprovalsPanel
              adminId={approverName}
              onChanged={loadCheckoutPending}
              highlightId={highlightId}
            />
            <CheckoutApprovalsPanel
              adminId={approverName}
              onChanged={loadCheckoutPending}
            />
          </>
        ) : (
          <>
            {/* Employee: my late punch requests, then my missed check-out requests, each with its own status tabs */}
            <CheckinRequestsPanel empId={String(currentUserId || "")} highlightId={highlightId} />
            <CheckoutRequestsPanel
              empId={String(currentUserId || "")}
              onOpenAttendance={() => navigation?.navigate?.("Attendance")}
              highlightId={highlightId}
            />
          </>
        )
      ) : (
      <>
      {/* Admin Search & Toolbar */}
      {userRole === "ADMIN" && (
        <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-4 shadow-xs gap-3">
          
          {/* Row 1: Search Bar */}
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

          {/* Row 2: Date Range & Native Calendar Pickers */}
          <View className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-2.5 gap-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Calendar size={14} color="#5B4FD1" />
                <Text className="text-[11px] font-black text-[#1F1B3D]">Window Filter</Text>
              </View>

              {/* Quick Presets */}
              <View className="flex-row items-center gap-1.5">
                {[
                  { id: "7D", label: "Last 7D" },
                  { id: "30D", label: "Last 30D" },
                  { id: "ALL", label: "All Time" },
                ].map((preset) => {
                  const isActive = datePreset === preset.id;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      onPress={() => applyDatePreset(preset.id as "7D" | "30D" | "ALL")}
                      className={`px-2.5 py-1 rounded-lg border ${
                        isActive
                          ? "bg-[#5B4FD1] border-[#5B4FD1]"
                          : "bg-white border-[#E7E4F5]"
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-black ${
                          isActive ? "text-white" : "text-[#7A76A6]"
                        }`}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Embedded Native Calendar Pickers */}
            <View className="flex-row items-center gap-2 pt-1">
             <CompactDatePicker
  label="From"
  value={startDate}
  onChange={(val: string) => {
    setDatePreset("CUSTOM");
    setStartDate(val);
  }}
/>

              <Text className="text-[11px] font-black text-[#7A76A6]">→</Text>

              <CompactDatePicker
  label="To"
  value={endDate}
  onChange={(val: string) => {
    setDatePreset("CUSTOM");
    setEndDate(val);
  }}
/>
            </View>
          </View>

          {/* Row 3: Select All & Bulk Actions */}
          <View className="flex-col gap-3 pt-1">
            <TouchableOpacity 
              onPress={handleSelectAllToggle}
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

            <View className="flex-row items-center gap-2 w-full">
              <TouchableOpacity
                onPress={() => handleBulkApprove(selectedRequestIds)}
                disabled={selectedRequestIds.length === 0}
                className={`flex-1 py-2.5 px-3 rounded-xl border items-center ${
                  selectedRequestIds.length > 0 ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5] opacity-50"
                }`}
              >
                <Text className={`text-xs font-bold ${selectedRequestIds.length > 0 ? "text-white" : "text-[#7A76A6]"}`}>
                  Approve Selected ({selectedRequestIds.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleBulkApprove(filteredRequests.filter((r) => r.status?.toUpperCase() === "PENDING").map((r) => r.id))}
                className="flex-1 bg-[#1F1B3D] py-2.5 px-3 rounded-xl items-center"
              >
                <Text className="text-xs font-bold text-white">Approve All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Filter Tabs */}
      <View className="flex-row bg-[#EEECFA]/70 p-1.5 rounded-2xl mb-5 border border-[#E7E4F5]">
        {[
          { id: "PENDING", label: `Pending (${pendingCount})` },
          { id: "APPROVED", label: `Approved (${approvedCount})` },
          { id: "HISTORY", label: `History (${historyCount})` },
          { id: "REJECTED", label: `Rejected (${rejectCount})` },
        ].map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveFilter(tab.id as any)}
              className={`flex-1 py-2 rounded-xl items-center justify-center ${isActive ? "bg-[#5B4FD1] shadow-xs" : ""}`}
            >
              <Text className={`text-[11px] font-black ${isActive ? "text-white" : "text-[#7A76A6]"}`}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Request Cards Feed */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }} className="flex-1">
        {loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="small" color="#5B4FD1" />
            <Text className="text-xs font-bold text-[#7A76A6] mt-2.5">Loading requests...</Text>
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
                className={`border rounded-2xl p-4 shadow-xs mb-3 ${
                  item.id === highlightId
                    ? "bg-[#FFFBEB] border-[#F59E0B] border-2"
                    : isSelected ? "bg-[#EEECFA]/40 border-[#5B4FD1]" : "bg-white border-[#E7E4F5]"
                }`}
              >
                {item.id === highlightId && (
                  <Text className="text-[10px] font-black text-[#B45309] uppercase tracking-wider mb-1.5">From your notification</Text>
                )}
                {/* Header */}
                <View className="flex-row justify-between items-start mb-2.5">
                  <View className="flex-row items-center gap-2.5">
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
                        {userRole === "ADMIN" ? `${item.userId} • Ref: ${item.id}` : `Ref: ${item.id}`}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-1 bg-[#EEECFA] px-2.5 py-1 rounded-full border border-[#5B4FD1]/20">
                    {getCategoryIcon(item.category)}
                    <Text className="text-[10px] font-black text-[#5B4FD1]">{item.category}</Text>
                  </View>
                </View>

                {/* Details Container */}
                <View className="bg-[#F6F5FC] rounded-xl p-3 mb-2.5">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-xs font-bold text-[#1F1B3D]">
                      {userRole === "ADMIN" ? item.type : item.details}
                    </Text>
                    {item.amount && (
                      <Text className="text-xs font-black text-[#5B4FD1]">{item.amount}</Text>
                    )}
                    {item.balance !== undefined && (
                      <Text className="text-[10px] font-black text-emerald-600">
                        Quota Bal: {item.balance}d
                      </Text>
                    )}
                  </View>

                  {userRole === "ADMIN" && (
                    <Text className="text-[11px] font-medium text-[#7A76A6]">{item.details}</Text>
                  )}

                  {/* Quantity Breakdown */}
                  {(item.requestedHours || item.requestedDays) && (
                    <View className="flex-row gap-3 mt-1 pt-1 border-t border-slate-200/50">
                      {item.requestedHours && (
                        <Text className="text-[10px] font-bold text-[#5B4FD1]">
                          Requested: {item.requestedHours} hr(s)
                          {item.approvedHours !== undefined && ` • Approved: ${item.approvedHours} hr(s)`}
                        </Text>
                      )}
                      {item.requestedDays && (
                        <Text className="text-[10px] font-bold text-[#5B4FD1]">
                          Days: {item.requestedDays}d
                          {item.approvedDays !== undefined && ` • Approved: ${item.approvedDays}d`}
                        </Text>
                      )}
                    </View>
                  )}

                  {item.note ? (
                    <Text className="text-[11px] font-semibold text-[#1F1B3D] italic mt-1.5 pt-1.5 border-t border-slate-200/60">
                      "{item.note}"
                    </Text>
                  ) : null}
                </View>

                {/* Submission Date */}
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-1">
                    <Calendar size={12} color="#7A76A6" />
                    <Text className="text-[10px] font-semibold text-[#7A76A6]">
                      Submitted: {item.date}
                    </Text>
                  </View>
                </View>

                {/* Action Section */}
                {userRole === "ADMIN" && isPending ? (
                  <View className="flex-row gap-2 pt-1">
                    <TouchableOpacity 
                      onPress={() => handleDirectAction(item, false)}
                      disabled={isBusy}
                      className="px-3 bg-[#FDE9E8] border border-[#E4453C]/30 py-2.5 rounded-xl items-center justify-center"
                    >
                      <Text className="text-xs font-bold text-[#E4453C]">Reject</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => openDecisionModal(item, true)}
                      disabled={isBusy}
                      className="flex-1 bg-[#EEECFA] border border-[#5B4FD1]/30 py-2.5 rounded-xl items-center justify-center"
                    >
                      <Text className="text-xs font-bold text-[#5B4FD1]">Adjust</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => handleDirectAction(item, true)}
                      disabled={isBusy}
                      className="flex-1 bg-[#5B4FD1] py-2.5 rounded-xl items-center justify-center shadow-xs"
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text className="text-white text-xs font-black">Approve</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="gap-1.5 pt-1">
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
                        <Text className={`text-[10px] font-black uppercase ${
                          isApproved ? "text-[#1FAE5C]" : isPending ? "text-amber-700" : "text-[#E4453C]"
                        }`}>
                          {item.status}
                        </Text>
                      </View>

                      {item.actionedBy && item.actionedAt ? (
                        <Text className="text-[10px] font-bold text-[#7A76A6]">
                          {isApproved ? "Approved by" : "Rejected by"} {item.actionedBy} • {item.actionedAt}
                        </Text>
                      ) : (
                        <Text className="text-[10px] font-bold text-amber-800">
                          Awaiting Manager Review
                        </Text>
                      )}
                    </View>

                    {item.rejectionReason ? (
                      <View className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex-row items-start gap-1.5">
                        <AlertCircle size={13} color="#7A76A6" className="mt-0.5" />
                        <Text className="text-[11px] font-semibold text-[#1F1B3D] flex-1">
                          Remarks: {item.rejectionReason}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
      </>
      )}

      {/* Admin Action Modal */}
      <Modal visible={isModalOpen} transparent animationType="fade">
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-white w-full max-w-sm rounded-3xl p-5 border border-[#E7E4F5] shadow-xl">
            <Text className="text-base font-black text-[#1F1B3D] mb-1">
              {actionType === "APPROVE" ? "Approve Request" : "Reject Request"}
            </Text>
            <Text className="text-xs text-[#7A76A6] mb-4">
              Review details for {activeItem?.userName} ({activeItem?.category})
            </Text>

            {actionType === "APPROVE" && (
              <View className="gap-3 mb-3">
                {/* Expense / Claim / Advance */}
                {(activeItem?.category?.toLowerCase() === "expense" || 
                  activeItem?.category?.toLowerCase() === "claim" || 
                  activeItem?.category?.toLowerCase() === "advance") && (
                  <View>
                    <Text className="text-[11px] font-bold text-[#1F1B3D] mb-1">
                      Approved Amount (Requested: {activeItem?.amount || "N/A"})
                    </Text>
                    <TextInput
                      value={customAmount}
                      onChangeText={setCustomAmount}
                      placeholder="e.g. 450.00"
                      keyboardType="numeric"
                      className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-2 text-xs font-bold text-[#1F1B3D]"
                    />
                  </View>
                )}

                {/* Overtime / Permission */}
                {(activeItem?.category?.toLowerCase() === "overtime" || 
                  activeItem?.category?.toLowerCase() === "permission") && (
                  <View>
                    <Text className="text-[11px] font-bold text-[#1F1B3D] mb-1">
                      Approved Hours (Requested: {activeItem?.requestedHours || "N/A"})
                    </Text>
                    <TextInput
                      value={customHours}
                      onChangeText={setCustomHours}
                      placeholder="e.g. 1.5"
                      keyboardType="numeric"
                      className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-2 text-xs font-bold text-[#1F1B3D]"
                    />
                  </View>
                )}

                {/* Leave / OD */}
                {(activeItem?.category?.toLowerCase() === "leave" || 
                  activeItem?.category?.toLowerCase() === "od") && (
                  <View>
                    <Text className="text-[11px] font-bold text-[#1F1B3D] mb-1">
                      Approved Days (Requested: {activeItem?.requestedDays || "N/A"})
                    </Text>
                    <TextInput
                      value={customDays}
                      onChangeText={setCustomDays}
                      placeholder="e.g. 1.0"
                      keyboardType="numeric"
                      className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-2 text-xs font-bold text-[#1F1B3D]"
                    />
                  </View>
                )}
              </View>
            )}

            {/* Remarks */}
            <View className="mb-4">
              <Text className="text-[11px] font-bold text-[#1F1B3D] mb-1">
                {actionType === "APPROVE" ? "Approval Remarks (Optional)" : "Rejection Reason (Required)"}
              </Text>
              <TextInput
                value={adminRemarks}
                onChangeText={setAdminRemarks}
                placeholder={actionType === "APPROVE" ? "e.g. Verified task completion" : "e.g. Quota exceeded"}
                multiline
                numberOfLines={2}
                className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-2 text-xs font-bold text-[#1F1B3D]"
              />
            </View>

            {/* Modal Buttons */}
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setIsModalOpen(false)}
                className="flex-1 bg-slate-100 py-2.5 rounded-xl items-center"
              >
                <Text className="text-xs font-bold text-[#7A76A6]">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={submitDecision}
                className={`flex-1 py-2.5 rounded-xl items-center ${
                  actionType === "APPROVE" ? "bg-[#5B4FD1]" : "bg-[#E4453C]"
                }`}
              >
                <Text className="text-xs font-black text-white">
                  Confirm {actionType === "APPROVE" ? "Approval" : "Rejection"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}