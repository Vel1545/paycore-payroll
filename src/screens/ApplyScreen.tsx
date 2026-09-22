import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  Upload,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Calendar as CalendarIcon,
  Clock,
  FileText,
  Wallet,
  AlertCircle,
} from "lucide-react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import ScreenContainer from "../components/ScreenContainer";
import { UserSession } from "../services/UserSession";

const LOCAL_IP = "192.168.31.228";
const API_BASE_URL =
  Platform.OS === "web"
    ? "http://192.168.31.228:8080/api/admin/workflow"
    : `http://${LOCAL_IP}:8080/api/admin/workflow`;

const CURRENT_EMP_ID = UserSession.empId;

interface AttachedFile {
  name: string;
  size?: number;
  uri: string;
  mimeType?: string;
}

interface DatePickerFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
}

function DatePickerField({ label, value, onChange }: DatePickerFieldProps) {
  const [showNativePicker, setShowNativePicker] = useState(false);

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const formatDateIso = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  if (Platform.OS === "web") {
    return (
      <View className="flex-1">
        <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
          {label}
        </Text>
        <View className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 flex-row justify-between items-center">
          <input
            type="date"
            value={formatDateIso(value)}
            onChange={(e) => {
              if (e.target.value) {
                const [year, month, day] = e.target.value.split("-").map(Number);
                onChange(new Date(year, month - 1, day));
              }
            }}
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
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
        {label}
      </Text>
      <TouchableOpacity
        onPress={() => setShowNativePicker(true)}
        className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 flex-row justify-between items-center"
      >
        <Text className="text-xs font-bold text-[#1F1B3D]">{formatDateDisplay(value)}</Text>
        <CalendarIcon size={15} color="#5B4FD1" />
      </TouchableOpacity>

      {showNativePicker && (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            setShowNativePicker(false);
            if (event.type === "set" && selectedDate) {
              onChange(selectedDate);
            }
          }}
        />
      )}
    </View>
  );
}

export default function ApplyScreen({ route }: any) {
  const [activeTab, setActiveTab] = useState<"leave" | "expense" | "overtime" | "advance">(
    route?.params?.tab || "leave"
  );

  // Leave State (Added HALF_DAY and halfDaySession)
  const [requestType, setRequestType] = useState<"LEAVE" | "HALF_DAY" | "PERMISSION">("LEAVE");
  const [halfDaySession, setHalfDaySession] = useState<"FIRST_HALF" | "SECOND_HALF">("FIRST_HALF");
  const [leaveCategory, setLeaveCategory] = useState("Casual Leave (CL)");
  const [fromDate, setFromDate] = useState<Date>(new Date());
  const [toDate, setToDate] = useState<Date>(new Date());
  const [halfDayDate, setHalfDayDate] = useState<Date>(new Date());
  const [permDate, setPermDate] = useState<Date>(new Date());
  const [permTimeSlot, setPermTimeSlot] = useState("");
  const [permHours, setPermHours] = useState("2.0");
  const [reason, setReason] = useState("");

  // Expense State
  const [expenseCategory, setExpenseCategory] = useState("Travel & Client Lodging");
  const [expenseAmount, setExpenseAmount] = useState("320.50");
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [expenseDescription, setExpenseDescription] = useState("");
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);

  // Overtime State
  const [otProject, setOtProject] = useState("PRJ-8092 • Core Banking Migration");
  const [otDate, setOtDate] = useState<Date>(new Date());
  const [otHours, setOtHours] = useState("4.5");

  // Advance State
  const [advanceAmount, setAdvanceAmount] = useState("1,500.00");
  const [advanceType, setAdvanceType] = useState("Salary Advance");
  const [advanceReason, setAdvanceReason] = useState("Personal Requirements");
  const [repaymentType, setRepaymentType] = useState("Monthly Deduction");

  // Modals & Submission
  const [submitting, setSubmitting] = useState(false);
  const [showRequestTypeModal, setShowRequestTypeModal] = useState(false);
  const [showLeaveCategoryModal, setShowLeaveCategoryModal] = useState(false);
  const [showExpenseCategoryModal, setShowExpenseCategoryModal] = useState(false);
  const [showAdvanceTypeModal, setShowAdvanceTypeModal] = useState(false);
  const [showRepaymentTypeModal, setShowRepaymentTypeModal] = useState(false);

  const leaveOptions = [
    "Annual / Paid Vacation (EL)",
    "Casual Leave (CL)",
    "Sick / Medical Leave (SL)",
    "On Duty / Client Visit (OD)",
  ];

  const expenseOptions = [
    "Travel & Client Lodging",
    "Office Supplies & Stationary",
    "Food & Client Entertainment",
    "Certification & Course Fees",
  ];

  const advanceTypeOptions = [
    "Salary Advance",
    "Emergency Medical Loan",
    "Relocation / Travel Advance",
    "Equipment Allowance",
  ];

  const repaymentOptions = [
    "Monthly Deduction",
    "Bi-Weekly Deduction",
    "Single Bullet Repayment (Next Payroll)",
  ];

  const formatDateIso = (date: Date) => date.toISOString().split("T")[0];

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `(${(bytes / 1024).toFixed(1)} KB)`;
    return `(${(bytes / (1024 * 1024)).toFixed(1)} MB)`;
  };

  const calculateLeaveDays = () => {
    if (requestType === "HALF_DAY") return 0.5;
    if (requestType === "PERMISSION") return 0;
    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
  };

const [submittingOt, setSubmittingOt] = useState(false);
// Safely formats Date object or string to YYYY-MM-DD
    let formattedDate = "";
    if (otDate instanceof Date) {
      const year = otDate.getFullYear();
      const month = String(otDate.getMonth() + 1).padStart(2, "0");
      const day = String(otDate.getDate()).padStart(2, "0");
      formattedDate = `${year}-${month}-${day}`;
    } else if (typeof otDate === "string") {
      const str = (otDate as string).trim();
      if (str.includes("-") && str.split("-")[0].length === 2) {
        const [d, m, y] = str.split("-");
        formattedDate = `${y}-${m}-${d}`;
      } else {
        formattedDate = str;
      }
    }

const handleSubmitOvertime = async () => {
    const hours = parseFloat(otHours) || 0;
    if (hours <= 0) {
      const msg = "Please enter valid overtime hours logged.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Invalid Input", msg);
      return;
    }

    if (!otDate) {
      const msg = "Please select the overtime date.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Missing Date", msg);
      return;
    }

    // Convert Date object or formatted string to standard 'YYYY-MM-DD'
    let formattedDate = "";
    if (otDate instanceof Date) {
      const year = otDate.getFullYear();
      const month = String(otDate.getMonth() + 1).padStart(2, "0");
      const day = String(otDate.getDate()).padStart(2, "0");
      formattedDate = `${year}-${month}-${day}`;
    } else if (typeof otDate === "string") {
      const str = (otDate as string).trim();
      if (str.includes("-") && str.split("-")[0].length === 2) {
        const [d, m, y] = str.split("-");
        formattedDate = `${y}-${m}-${d}`;
      } else {
        formattedDate = str;
      }
    }

    try {
      setSubmittingOt(true);

      const payload = {
        empId: UserSession.empId,
        overtimeDate: formattedDate,
        hours: hours,
        reason: otProject?.trim() || "Project Overtime Work",
      };

      const res = await fetch(`${API_BASE_URL}/users/${UserSession.empId}/overtime`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        const refId = data?.requestId ? ` (Ref: ${data.requestId})` : "";
        const msg = `Overtime request for ${hours} hr(s) submitted successfully!${refId}`;
        Platform.OS === "web" ? window.alert(msg) : Alert.alert("Success", msg);

        setOtHours("");
        setOtProject("");
      } else {
        const errText = await res.text();
        throw new Error(errText || `Server responded with ${res.status}`);
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Could not connect to backend.";
      Platform.OS === "web" ? window.alert(errorMsg) : Alert.alert("Submission Failed", errorMsg);
    } finally {
      setSubmittingOt(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setAttachedFile({
          name: file.name,
          size: file.size,
          uri: file.uri,
          mimeType: file.mimeType,
        });
      }
    } catch {
      Alert.alert("File Error", "Unable to select document.");
    }
  };

const handleSubmitLeave = async () => {
  if (!reason.trim()) {
    const msg = "Please enter a reason or handover note.";
    Platform.OS === "web" ? window.alert(msg) : Alert.alert("Required", msg);
    return;
  }

  setSubmitting(true);
  try {
    // 2. Resolve dates based on request type
    let targetStartDate = formatDateIso(fromDate);
    let targetEndDate = formatDateIso(toDate);

    if (requestType === "HALF_DAY") {
      targetStartDate = formatDateIso(halfDayDate);
      targetEndDate = formatDateIso(halfDayDate);
    } else if (requestType === "PERMISSION") {
      targetStartDate = formatDateIso(permDate);
      targetEndDate = formatDateIso(permDate);
    }

    // 3. Exact payload matching LeaveRequestItem / DTO in Spring Boot
    const payload = {
      employeeId: UserSession.empId,
      leaveCategory: requestType === "PERMISSION" ? "Permission" : leaveCategory,
      requestType: requestType, // "LEAVE", "HALF_DAY", "PERMISSION"
      session: requestType === "HALF_DAY" ? halfDaySession : null, // "FIRST_HALF", "SECOND_HALF", or null
      startDate: targetStartDate, // "2026-09-15"
      endDate: targetEndDate,     // "2026-09-15"
      days: calculateLeaveDays(), // 0.5 for HALF_DAY, 0 for PERMISSION, or full days
      reason: requestType === "PERMISSION"
        ? `[Slot: ${permTimeSlot} • ${permHours}h] ${reason}`
        : reason.trim(),
    };

    // 4. Hit endpoint using dynamic logged-in user ID
    const res = await fetch(`${API_BASE_URL}/users/${UserSession.empId}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.ok) {
      const typeName =
        requestType === "HALF_DAY"
          ? "Half Day Leave"
          : requestType === "PERMISSION"
          ? "Permission"
          : "Leave";
      
      const msg = `${typeName} request submitted successfully! (Ref: ${data.requestId})`;
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Success", msg);
      setReason("");
    } else {
      throw new Error(data.error || "Submission failed");
    }
  } catch (err: any) {
    Alert.alert("Error", err.message || "Could not submit request to server.");
  } finally {
    setSubmitting(false);
  }
};

  const handleSubmitExpense = async () => {
    setSubmitting(true);
    try {
      const payload = {
        claimType: expenseCategory,
        amount: parseFloat(expenseAmount.replace(/[^0-9.]/g, "")) || 0,
        expenseDate: formatDateIso(expenseDate),
        description: expenseDescription.trim() || "Reimbursement claim",
        attachmentUrl: attachedFile ? attachedFile.name : null,
      };

      const res = await fetch(`${API_BASE_URL}/users/${UserSession.empId}/expense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const msg = "Expense claim submitted successfully!";
        Platform.OS === "web" ? window.alert(msg) : Alert.alert("Success", msg);
        setExpenseDescription("");
        setAttachedFile(null);
      } else {
        throw new Error();
      }
    } catch {
      Alert.alert("Error", "Could not submit expense claim.");
    } finally {
      setSubmitting(false);
    }
  };

const handleSubmitAdvance = async () => {
    // 1. Policy Validation: Strictly allowed AFTER the 15th of the month
    const currentDay = new Date().getDate();
    if (currentDay <= 15) {
      const msg = "Salary Advance requests are only accepted after the 15th of each month (from the 16th onward).";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Window Closed", msg);
      return;
    }

    // 2. Input Validation
    const cleanAmt = parseFloat(advanceAmount.replace(/[^0-9.]/g, "")) || 0;
    if (cleanAmt <= 0) {
      const msg = "Please enter a valid advance amount.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Invalid Amount", msg);
      return;
    }

    try {
      setSubmitting(true);

      // 3. Backend API Request
      const endpoint = `${API_BASE_URL}/users/${UserSession.empId}/advance`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          amount: cleanAmt,
          reason: advanceReason?.trim() || "Salary Advance Request",
          advanceType: advanceType || "Emergency",
          repaymentType: repaymentType || "Full Next Month"
        })
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        const refId = data?.requestId ? ` (Ref: ${data.requestId})` : "";
        const successMsg = `Advance request of ₹${cleanAmt.toLocaleString()}${refId} submitted successfully!`;

        Platform.OS === "web" ? window.alert(successMsg) : Alert.alert("Success", successMsg);

        // Reset form inputs
        setAdvanceAmount("");
        setAdvanceReason("");
      } else {
        // Parse backend rejection or exception message
        const errData = await res.json().catch(() => null);
        const errText = errData?.message || await res.text();
        throw new Error(errText || `Server returned error (${res.status})`);
      }
    } catch (e: any) {
      const errorMsg = e?.message || "Could not submit advance request. Check network connection.";
      Platform.OS === "web" ? window.alert(errorMsg) : Alert.alert("Submission Failed", errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      {/* 1. Header */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-black text-[#1F1B3D] tracking-tight">
            Unified Request
          </Text>
          <View className="bg-[#EEECFA] px-2.5 py-1 rounded-full border border-[#5B4FD1]/20">
            <Text className="text-[10px] font-black text-[#5B4FD1] uppercase tracking-wider">
              {CURRENT_EMP_ID}
            </Text>
          </View>
        </View>
        <Text className="text-xs font-bold text-[#7A76A6] mt-0.5">
          Submit leaves, reimbursement claims, overtime or advances
        </Text>
      </View>

      {/* 2. Four-Tab Switcher */}
      <View className="flex-row bg-[#EEECFA]/70 p-1.5 rounded-2xl mb-5 border border-[#E7E4F5]">
        {[
          { id: "leave", label: "Leave", icon: CalendarIcon },
          { id: "expense", label: "Expense", icon: FileText },
          { id: "overtime", label: "Overtime", icon: Clock },
          { id: "advance", label: "Advance", icon: Wallet },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${
                isActive ? "bg-[#5B4FD1] shadow-xs" : ""
              }`}
            >
              <Icon size={14} color={isActive ? "#FFFFFF" : "#7A76A6"} />
              <Text
                className={`text-[11px] font-black ml-1.5 ${
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
      {/* TAB 1: LEAVE / HALF DAY / PERMISSION                                      */}
      {/* ========================================================================= */}
      {activeTab === "leave" && (
        <View>
          {/* Balance Cards */}
          <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-4 shadow-xs">
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-2">
              Available Leave Balances
            </Text>
            <View className="flex-row justify-between">
              <View className="flex-1 bg-[#E7FAEE] rounded-xl p-2.5 items-center mr-2">
                <Text className="text-sm font-black text-[#1FAE5C]">14/18</Text>
                <Text className="text-[9.5px] font-bold text-[#1FAE5C] mt-0.5">Earned</Text>
              </View>
              <View className="flex-1 bg-[#FEF2D9] rounded-xl p-2.5 items-center mr-2">
                <Text className="text-sm font-black text-[#D08A0C]">4/8</Text>
                <Text className="text-[9.5px] font-bold text-[#D08A0C] mt-0.5">Sick</Text>
              </View>
              <View className="flex-1 bg-[#FDE9E8] rounded-xl p-2.5 items-center">
                <Text className="text-sm font-black text-[#E4453C]">6/6</Text>
                <Text className="text-[9.5px] font-bold text-[#E4453C] mt-0.5">Casual</Text>
              </View>
            </View>
          </View>

          {/* Form */}
          <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs mb-8">
            <View className="mb-3">
              <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                Request Type
              </Text>
              <TouchableOpacity
                onPress={() => setShowRequestTypeModal(true)}
                className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 flex-row justify-between items-center"
              >
                <Text className="text-xs font-bold text-[#1F1B3D]">
                  {requestType === "LEAVE"
                    ? "Full / Multi-Day Leave"
                    : requestType === "HALF_DAY"
                    ? "Half Day Leave"
                    : "Short Permission (Hourly)"}
                </Text>
                <ChevronDown size={16} color="#7A76A6" />
              </TouchableOpacity>
            </View>

            {/* Category selection for Full or Half Day Leave */}
            {requestType !== "PERMISSION" && (
              <View className="mb-3">
                <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                  Leave Category
                </Text>
                <TouchableOpacity
                  onPress={() => setShowLeaveCategoryModal(true)}
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 flex-row justify-between items-center"
                >
                  <Text className="text-xs font-bold text-[#1F1B3D]">{leaveCategory}</Text>
                  <ChevronDown size={16} color="#7A76A6" />
                </TouchableOpacity>
              </View>
            )}

            {/* CASE 1: FULL DAY LEAVE */}
            {requestType === "LEAVE" && (
              <View className="mb-3">
                <View className="flex-row mb-2">
                  <View className="flex-1 mr-2">
                    <DatePickerField label="From Date" value={fromDate} onChange={setFromDate} />
                  </View>
                  <View className="flex-1">
                    <DatePickerField label="To Date" value={toDate} onChange={setToDate} />
                  </View>
                </View>
                <View className="bg-[#EEECFA] rounded-xl p-2.5 flex-row justify-between items-center">
                  <Text className="text-[11px] font-bold text-[#7A76A6]">Total Duration</Text>
                  <Text className="text-xs font-black text-[#5B4FD1]">
                    {calculateLeaveDays()} Working Days
                  </Text>
                </View>
              </View>
            )}

            {/* CASE 2: HALF DAY LEAVE */}
            {requestType === "HALF_DAY" && (
              <View className="mb-3">
                <View className="mb-3">
                  <DatePickerField
                    label="Leave Date"
                    value={halfDayDate}
                    onChange={setHalfDayDate}
                  />
                </View>

                {/* First Half / Second Half Selection */}
                <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                  Select Session
                </Text>
                <View className="flex-row mb-3">
                  <TouchableOpacity
                    onPress={() => setHalfDaySession("FIRST_HALF")}
                    className={`flex-1 py-3 px-2 rounded-xl mr-2 border items-center ${
                      halfDaySession === "FIRST_HALF"
                        ? "bg-[#EEECFA] border-[#5B4FD1]"
                        : "bg-[#F6F5FC] border-[#E7E4F5]"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        halfDaySession === "FIRST_HALF" ? "text-[#5B4FD1]" : "text-[#1F1B3D]"
                      }`}
                    >
                      First Half
                    </Text>
                    <Text className="text-[9.5px] text-[#7A76A6] mt-0.5">Morning Session</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setHalfDaySession("SECOND_HALF")}
                    className={`flex-1 py-3 px-2 rounded-xl border items-center ${
                      halfDaySession === "SECOND_HALF"
                        ? "bg-[#EEECFA] border-[#5B4FD1]"
                        : "bg-[#F6F5FC] border-[#E7E4F5]"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        halfDaySession === "SECOND_HALF" ? "text-[#5B4FD1]" : "text-[#1F1B3D]"
                      }`}
                    >
                      Second Half
                    </Text>
                    <Text className="text-[9.5px] text-[#7A76A6] mt-0.5">Afternoon Session</Text>
                  </TouchableOpacity>
                </View>

                <View className="bg-[#EEECFA] rounded-xl p-2.5 flex-row justify-between items-center">
                  <Text className="text-[11px] font-bold text-[#7A76A6]">Total Duration</Text>
                  <Text className="text-xs font-black text-[#5B4FD1]">0.5 Working Day</Text>
                </View>
              </View>
            )}

            {/* CASE 3: PERMISSION */}
            {requestType === "PERMISSION" && (
              <View className="mb-3">
                <View className="flex-row mb-2">
                  <View className="flex-1 mr-2">
                    <DatePickerField label="Permission Date" value={permDate} onChange={setPermDate} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                      Hours
                    </Text>
                    <TextInput
                      value={permHours}
                      onChangeText={setPermHours}
                      keyboardType="numeric"
                      className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]"
                    />
                  </View>
                </View>
                <View className="mb-3">
  <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
    Time Window Slot
  </Text>
  <TextInput
    value={permTimeSlot}
    onChangeText={setPermTimeSlot}
    placeholder="e.g. 02:00 PM - 04:00 PM"
    placeholderTextColor="#A6A2CE"
    className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]"
  />
</View>
              </View>
            )}

            <View className="mb-4">
              <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                Reason / Handover Note
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                placeholder="Provide reason or team handover details..."
                placeholderTextColor="#A6A2CE"
                className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-medium text-[#1F1B3D] min-h-[75px]"
              />
            </View>

            <TouchableOpacity
              onPress={handleSubmitLeave}
              disabled={submitting}
              className="bg-[#5B4FD1] rounded-xl py-3.5 items-center active:opacity-90 shadow-sm"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-black text-xs uppercase tracking-wider">
                  Submit Leave Request
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EXPENSE                                                            */}
      {/* ========================================================================= */}
      {activeTab === "expense" && (
        <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs mb-8">
          <View className="mb-3">
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
              Expense Category
            </Text>
            <TouchableOpacity
              onPress={() => setShowExpenseCategoryModal(true)}
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 flex-row justify-between items-center"
            >
              <Text className="text-xs font-bold text-[#1F1B3D]">{expenseCategory}</Text>
              <ChevronDown size={16} color="#7A76A6" />
            </TouchableOpacity>
          </View>

          <View className="flex-row mb-3">
            <View className="flex-1 mr-2">
              <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                Amount (USD)
              </Text>
              <TextInput
                value={expenseAmount}
                onChangeText={setExpenseAmount}
                keyboardType="numeric"
                className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-sm font-black text-[#5B4FD1]"
              />
            </View>
            <View className="flex-1">
              <DatePickerField label="Expense Date" value={expenseDate} onChange={setExpenseDate} />
            </View>
          </View>

          <View className="mb-3">
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
              Description / Purpose
            </Text>
            <TextInput
              value={expenseDescription}
              onChangeText={setExpenseDescription}
              placeholder="e.g. Client dinner and team cab fare"
              placeholderTextColor="#A6A2CE"
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-medium text-[#1F1B3D]"
            />
          </View>

          <TouchableOpacity
            onPress={handlePickDocument}
            className="border-2 border-dashed border-[#E7E4F5] bg-[#F6F5FC] rounded-xl p-4 items-center justify-center mb-4 active:bg-[#EEECFA]"
          >
            <Upload size={22} color="#5B4FD1" />
            {attachedFile ? (
              <View className="items-center mt-1">
                <Text className="text-xs font-bold text-[#1F1B3D] text-center" numberOfLines={1}>
                  {attachedFile.name} {formatFileSize(attachedFile.size)}
                </Text>
                <Text className="text-[10px] font-bold text-emerald-600 mt-0.5">
                  ✓ File attached. Tap to replace.
                </Text>
              </View>
            ) : (
              <View className="items-center mt-1">
                <Text className="text-xs font-bold text-[#1F1B3D]">Upload Bill Receipt / Document</Text>
                <Text className="text-[10px] font-medium text-[#7A76A6] mt-0.5">PDF, PNG, JPG up to 10MB</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSubmitExpense}
            disabled={submitting}
            className="bg-[#5B4FD1] rounded-xl py-3.5 items-center active:opacity-90 shadow-sm"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-white font-black text-xs uppercase tracking-wider">
                Submit Claim
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: OVERTIME                                                           */}
      {/* ========================================================================= */}
    {activeTab === "overtime" && (
        <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs mb-8">
          <View className="mb-3">
            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
              Project / Cost Center
            </Text>
            <TextInput
              value={otProject}
              onChangeText={setOtProject}
              placeholder="e.g. Project Apollo / Production Support"
              placeholderTextColor="#A6A2CE"
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]"
            />
          </View>

          <View className="flex-row mb-4">
            <View className="flex-1 mr-2">
              <DatePickerField label="OT Date" value={otDate} onChange={setOtDate} />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                Hours Logged
              </Text>
              <TextInput
                value={otHours}
                onChangeText={setOtHours}
                keyboardType="numeric"
                placeholder="e.g. 2.5"
                placeholderTextColor="#A6A2CE"
                className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-sm font-black text-[#5B4FD1]"
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSubmitOvertime}
            disabled={submittingOt}
            className={`rounded-xl py-3.5 items-center shadow-sm ${
              submittingOt ? "bg-[#5B4FD1]/70" : "bg-[#5B4FD1] active:opacity-90"
            }`}
          >
            {submittingOt ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-white font-black text-xs uppercase tracking-wider">
                Submit Overtime for Approval
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ADVANCE                                                            */}
      {/* ========================================================================= */}
     {activeTab === "advance" && (() => {
        const today = new Date();
        const currentDay = today.getDate();
        // Policy: Strictly allowed AFTER the 15th (i.e., day >= 16)
        const isAdvanceWindowOpen = currentDay > 15;

        return (
          <View className="mb-8">
            {/* Top Stat Card */}
            <View className="bg-[#4D96FF] rounded-3xl p-5 shadow-sm relative overflow-hidden mb-4">
              <View className="absolute -right-6 -bottom-8 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
              <View className="absolute right-8 -bottom-12 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />

              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-white/90">Available Advance</Text>
                <ChevronRight size={16} color="#FFFFFF" />
              </View>

              <Text className="text-3xl font-black text-white tracking-tight mt-2">₹5,000.00</Text>

              <View className="flex-row items-center mt-2">
                <Text className="text-xs font-semibold text-white/80">of ₹10,000.00</Text>
                <View className="w-24 h-1.5 bg-white/25 rounded-full overflow-hidden ml-2">
                  <View className="w-1/2 h-full bg-white rounded-full" />
                </View>
              </View>
            </View>

            {/* Policy Window Status Notice */}
            <View
              className={`border rounded-2xl p-3 mb-3 flex-row items-start gap-2.5 ${
                isAdvanceWindowOpen
                  ? "bg-[#E7FAEE] border-[#1FAE5C]/30"
                  : "bg-[#FEF2D9] border-amber-300"
              }`}
            >
              <AlertCircle
                size={16}
                color={isAdvanceWindowOpen ? "#1FAE5C" : "#D97706"}
                className="mt-0.5"
              />
              <View className="flex-1">
                <Text
                  className={`text-xs font-black ${
                    isAdvanceWindowOpen ? "text-[#1FAE5C]" : "text-amber-800"
                  }`}
                >
                  {isAdvanceWindowOpen ? "Advance Window Open" : "Advance Window Closed"}
                </Text>
                <Text className="text-[11px] font-semibold text-[#7A76A6] mt-0.5">
                  {isAdvanceWindowOpen
                    ? "Requests are open for this month's salary advance."
                    : `Salary advance requests are only accepted after the 15th of the month. Window opens in ${
                        16 - currentDay
                      } day(s).`}
                </Text>
              </View>
            </View>

            {/* Advance Request Form */}
            <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs">
              <View className="mb-3">
                <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                  Advance Type
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAdvanceTypeModal(true)}
                  disabled={!isAdvanceWindowOpen}
                  className={`border rounded-xl p-3 flex-row items-center justify-between ${
                    isAdvanceWindowOpen
                      ? "bg-[#F6F5FC] border-[#E7E4F5]"
                      : "bg-slate-100 border-slate-200 opacity-60"
                  }`}
                >
                  <Text className="text-xs font-bold text-[#1F1B3D]">{advanceType}</Text>
                  <ChevronDown size={16} color="#7A76A6" />
                </TouchableOpacity>
              </View>

              <View className="mb-3">
                <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                  Amount (INR)
                </Text>
                <TextInput
                  value={advanceAmount}
                  onChangeText={(val) => setAdvanceAmount(val.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                  editable={isAdvanceWindowOpen}
                  placeholder="0.00"
                  placeholderTextColor="#A6A2CE"
                  className={`border rounded-xl p-3 text-sm font-black ${
                    isAdvanceWindowOpen
                      ? "bg-[#F6F5FC] border-[#E7E4F5] text-[#5B4FD1]"
                      : "bg-slate-100 border-slate-200 text-slate-400"
                  }`}
                />
              </View>

              <View className="mb-3">
                <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                  Reason
                </Text>
                <TextInput
                  value={advanceReason}
                  onChangeText={setAdvanceReason}
                  editable={isAdvanceWindowOpen}
                  placeholder="Enter purpose of advance"
                  placeholderTextColor="#A6A2CE"
                  className={`border rounded-xl p-3 text-xs font-medium ${
                    isAdvanceWindowOpen
                      ? "bg-[#F6F5FC] border-[#E7E4F5] text-[#1F1B3D]"
                      : "bg-slate-100 border-slate-200 text-slate-400"
                  }`}
                />
              </View>

              <View className="mb-4">
                <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                  Repayment Type
                </Text>
                <TouchableOpacity
                  onPress={() => setShowRepaymentTypeModal(true)}
                  disabled={!isAdvanceWindowOpen}
                  className={`border rounded-xl p-3 flex-row items-center justify-between ${
                    isAdvanceWindowOpen
                      ? "bg-[#F6F5FC] border-[#E7E4F5]"
                      : "bg-slate-100 border-slate-200 opacity-60"
                  }`}
                >
                  <Text className="text-xs font-bold text-[#1F1B3D]">{repaymentType}</Text>
                  <ChevronDown size={16} color="#7A76A6" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleSubmitAdvance}
                disabled={submitting || !isAdvanceWindowOpen}
                className={`rounded-xl py-3.5 items-center shadow-sm ${
                  isAdvanceWindowOpen
                    ? "bg-[#5B4FD1] active:opacity-90"
                    : "bg-slate-300 opacity-80"
                }`}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-black text-xs uppercase tracking-wider">
                    {isAdvanceWindowOpen ? "Submit Request" : "Window Opens on 16th"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}
      <Modal visible={showRequestTypeModal} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowRequestTypeModal(false)}
          className="flex-1 bg-black/40 justify-center items-center p-4"
        >
          <View className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-xl border border-[#E7E4F5]">
            <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider mb-2">
              Select Request Type
            </Text>
            <TouchableOpacity
              onPress={() => {
                setRequestType("LEAVE");
                setShowRequestTypeModal(false);
              }}
              className={`p-3 rounded-xl border mb-2 ${
                requestType === "LEAVE"
                  ? "bg-[#EEECFA] border-[#5B4FD1]"
                  : "bg-[#F6F5FC] border-[#E7E4F5]"
              }`}
            >
              <Text className="text-xs font-bold text-[#1F1B3D]">Full / Multi-Day Leave</Text>
            </TouchableOpacity>

            {/* Half Day Option */}
            <TouchableOpacity
              onPress={() => {
                setRequestType("HALF_DAY");
                setShowRequestTypeModal(false);
              }}
              className={`p-3 rounded-xl border mb-2 ${
                requestType === "HALF_DAY"
                  ? "bg-[#EEECFA] border-[#5B4FD1]"
                  : "bg-[#F6F5FC] border-[#E7E4F5]"
              }`}
            >
              <Text className="text-xs font-bold text-[#1F1B3D]">Half Day Leave</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setRequestType("PERMISSION");
                setShowRequestTypeModal(false);
              }}
              className={`p-3 rounded-xl border ${
                requestType === "PERMISSION"
                  ? "bg-[#EEECFA] border-[#5B4FD1]"
                  : "bg-[#F6F5FC] border-[#E7E4F5]"
              }`}
            >
              <Text className="text-xs font-bold text-[#1F1B3D]">Short Permission (Hourly)</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showLeaveCategoryModal} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowLeaveCategoryModal(false)}
          className="flex-1 bg-black/40 justify-center items-center p-4"
        >
          <View className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-xl border border-[#E7E4F5]">
            <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider mb-2">
              Select Category
            </Text>
            {leaveOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => {
                  setLeaveCategory(opt);
                  setShowLeaveCategoryModal(false);
                }}
                className={`p-3 rounded-xl border flex-row items-center justify-between mb-2 ${
                  leaveCategory === opt
                    ? "bg-[#EEECFA] border-[#5B4FD1]"
                    : "bg-[#F6F5FC] border-[#E7E4F5]"
                }`}
              >
                <Text className="text-xs font-bold text-[#1F1B3D]">{opt}</Text>
                {leaveCategory === opt && <CheckCircle2 size={15} color="#5B4FD1" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showExpenseCategoryModal} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowExpenseCategoryModal(false)}
          className="flex-1 bg-black/40 justify-center items-center p-4"
        >
          <View className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-xl border border-[#E7E4F5]">
            <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider mb-2">
              Select Expense Category
            </Text>
            {expenseOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => {
                  setExpenseCategory(opt);
                  setShowExpenseCategoryModal(false);
                }}
                className={`p-3 rounded-xl border flex-row items-center justify-between mb-2 ${
                  expenseCategory === opt
                    ? "bg-[#EEECFA] border-[#5B4FD1]"
                    : "bg-[#F6F5FC] border-[#E7E4F5]"
                }`}
              >
                <Text className="text-xs font-bold text-[#1F1B3D]">{opt}</Text>
                {expenseCategory === opt && <CheckCircle2 size={15} color="#5B4FD1" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showAdvanceTypeModal} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowAdvanceTypeModal(false)}
          className="flex-1 bg-black/40 justify-center items-center p-4"
        >
          <View className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-xl border border-[#E7E4F5]">
            <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider mb-2">
              Select Advance Type
            </Text>
            {advanceTypeOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => {
                  setAdvanceType(opt);
                  setShowAdvanceTypeModal(false);
                }}
                className={`p-3 rounded-xl border flex-row items-center justify-between mb-2 ${
                  advanceType === opt
                    ? "bg-[#EEECFA] border-[#5B4FD1]"
                    : "bg-[#F6F5FC] border-[#E7E4F5]"
                }`}
              >
                <Text className="text-xs font-bold text-[#1F1B3D]">{opt}</Text>
                {advanceType === opt && <CheckCircle2 size={15} color="#5B4FD1" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showRepaymentTypeModal} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowRepaymentTypeModal(false)}
          className="flex-1 bg-black/40 justify-center items-center p-4"
        >
          <View className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-xl border border-[#E7E4F5]">
            <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider mb-2">
              Select Repayment Frequency
            </Text>
            {repaymentOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => {
                  setRepaymentType(opt);
                  setShowRepaymentTypeModal(false);
                }}
                className={`p-3 rounded-xl border flex-row items-center justify-between mb-2 ${
                  repaymentType === opt
                    ? "bg-[#EEECFA] border-[#5B4FD1]"
                    : "bg-[#F6F5FC] border-[#E7E4F5]"
                }`}
              >
                <Text className="text-xs font-bold text-[#1F1B3D]">{opt}</Text>
                {repaymentType === opt && <CheckCircle2 size={15} color="#5B4FD1" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScreenContainer>
  );
}