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
} from "lucide-react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import ScreenContainer from "../components/ScreenContainer";

const LOCAL_IP = "192.168.31.133";
const API_BASE_URL = Platform.OS === "web"
  ? "http://192.168.31.133:8080/api/admin/workflow"
  : `http://${LOCAL_IP}:8080/api/admin/workflow`;

const CURRENT_EMP_ID = "EMP-1042";

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

  // Leave State
  const [requestType, setRequestType] = useState<"LEAVE" | "PERMISSION">("LEAVE");
  const [leaveCategory, setLeaveCategory] = useState("Annual / Paid Vacation (EL)");
  const [fromDate, setFromDate] = useState<Date>(new Date(2026, 0, 24));
  const [toDate, setToDate] = useState<Date>(new Date(2026, 0, 26));
  const [permDate, setPermDate] = useState<Date>(new Date(2026, 0, 28));
  const [permTimeSlot, setPermTimeSlot] = useState("02:00 PM - 04:00 PM");
  const [permHours, setPermHours] = useState("2.0");
  const [reason, setReason] = useState("");

  // Expense State
  const [expenseCategory, setExpenseCategory] = useState("Travel & Client Lodging");
  const [expenseAmount, setExpenseAmount] = useState("320.50");
  const [expenseDate, setExpenseDate] = useState<Date>(new Date(2026, 0, 22));
  const [expenseDescription, setExpenseDescription] = useState("");
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);

  // Overtime State
  const [otProject, setOtProject] = useState("PRJ-8092 • Core Banking Migration");
  const [otDate, setOtDate] = useState<Date>(new Date(2026, 0, 20));
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
    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
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
      const payload = {
        leaveType: requestType === "LEAVE" ? leaveCategory : "PERMISSION",
        startDate: requestType === "LEAVE" ? formatDateIso(fromDate) : formatDateIso(permDate),
        endDate: requestType === "LEAVE" ? formatDateIso(toDate) : formatDateIso(permDate),
        days: requestType === "LEAVE" ? calculateLeaveDays() : 0,
        reason: requestType === "PERMISSION" ? `[Slot: ${permTimeSlot} • ${permHours}h] ${reason}` : reason,
      };

      const res = await fetch(`${API_BASE_URL}/users/${CURRENT_EMP_ID}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const msg = `${requestType === "LEAVE" ? "Leave" : "Permission"} request submitted successfully!`;
        Platform.OS === "web" ? window.alert(msg) : Alert.alert("Success", msg);
        setReason("");
      } else {
        throw new Error();
      }
    } catch {
      Alert.alert("Error", "Could not submit request to server.");
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

      const res = await fetch(`${API_BASE_URL}/users/${CURRENT_EMP_ID}/expense`, {
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
    setSubmitting(true);
    try {
      const cleanAmt = parseFloat(advanceAmount.replace(/[^0-9.]/g, "")) || 0;
      if (cleanAmt <= 0) throw new Error("Enter a valid advance amount.");

      setTimeout(() => {
        setSubmitting(false);
        const msg = `Advance request of $${cleanAmt.toLocaleString()} submitted successfully!`;
        Platform.OS === "web" ? window.alert(msg) : Alert.alert("Success", msg);
      }, 700);
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert("Error", e?.message || "Could not submit advance request.");
    }
  };

  return (
    <ScreenContainer>
      {/* 1. Header (MNC Style) */}
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
      {/* TAB 1: LEAVE & PERMISSION                                                 */}
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
                  {requestType === "LEAVE" ? "Full / Multi-Day Leave" : "Short Permission (Hourly)"}
                </Text>
                <ChevronDown size={16} color="#7A76A6" />
              </TouchableOpacity>
            </View>

            {requestType === "LEAVE" && (
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

            {requestType === "LEAVE" ? (
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
            ) : (
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
                <View>
                  <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                    Time Window Slot
                  </Text>
                  <TextInput
                    value={permTimeSlot}
                    onChangeText={setPermTimeSlot}
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
                className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-sm font-black text-[#5B4FD1]"
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              const msg = "Overtime submitted for review.";
              Platform.OS === "web" ? window.alert(msg) : Alert.alert("Success", msg);
            }}
            className="bg-[#5B4FD1] rounded-xl py-3.5 items-center active:opacity-90 shadow-sm"
          >
            <Text className="text-white font-black text-xs uppercase tracking-wider">
              Submit Overtime for Approval
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ADVANCE                                                            */}
      {/* ========================================================================= */}
      {activeTab === "advance" && (
        <View className="mb-8">
          {/* Available Advance Hero Card */}
          <View className="bg-[#4D96FF] rounded-3xl p-5 shadow-sm relative overflow-hidden mb-4">
            <View className="absolute -right-6 -bottom-8 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
            <View className="absolute right-8 -bottom-12 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />

            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-white/90">Available Advance</Text>
              <ChevronRight size={16} color="#FFFFFF" />
            </View>

            <Text className="text-3xl font-black text-white tracking-tight mt-2">$5,000.00</Text>

            <View className="flex-row items-center mt-2">
              <Text className="text-xs font-semibold text-white/80">of $10,000.00</Text>
              <View className="w-24 h-1.5 bg-white/25 rounded-full overflow-hidden ml-2">
                <View className="w-1/2 h-full bg-white rounded-full" />
              </View>
            </View>
          </View>

          {/* Form */}
          <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs">
            <View className="mb-3">
              <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                Advance Type
              </Text>
              <TouchableOpacity
                onPress={() => setShowAdvanceTypeModal(true)}
                className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 flex-row items-center justify-between"
              >
                <Text className="text-xs font-bold text-[#1F1B3D]">{advanceType}</Text>
                <ChevronDown size={16} color="#7A76A6" />
              </TouchableOpacity>
            </View>

            <View className="mb-3">
              <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                Amount (USD)
              </Text>
              <TextInput
                value={advanceAmount}
                onChangeText={(val) => setAdvanceAmount(val.replace(/[^0-9.,]/g, ""))}
                keyboardType="decimal-pad"
                className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-sm font-black text-[#5B4FD1]"
              />
            </View>

            <View className="mb-3">
              <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                Reason
              </Text>
              <TextInput
                value={advanceReason}
                onChangeText={setAdvanceReason}
                placeholder="Enter purpose of advance"
                placeholderTextColor="#A6A2CE"
                className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-medium text-[#1F1B3D]"
              />
            </View>

            <View className="mb-4">
              <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                Repayment Type
              </Text>
              <TouchableOpacity
                onPress={() => setShowRepaymentTypeModal(true)}
                className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 flex-row items-center justify-between"
              >
                <Text className="text-xs font-bold text-[#1F1B3D]">{repaymentType}</Text>
                <ChevronDown size={16} color="#7A76A6" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleSubmitAdvance}
              disabled={submitting}
              className="bg-[#5B4FD1] rounded-xl py-3.5 items-center active:opacity-90 shadow-sm"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-black text-xs uppercase tracking-wider">
                  Submit Request
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

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
              onPress={() => { setRequestType("LEAVE"); setShowRequestTypeModal(false); }}
              className={`p-3 rounded-xl border mb-2 ${requestType === "LEAVE" ? "bg-[#EEECFA] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"}`}
            >
              <Text className="text-xs font-bold text-[#1F1B3D]">Full / Multi-Day Leave</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setRequestType("PERMISSION"); setShowRequestTypeModal(false); }}
              className={`p-3 rounded-xl border ${requestType === "PERMISSION" ? "bg-[#EEECFA] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"}`}
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
                onPress={() => { setLeaveCategory(opt); setShowLeaveCategoryModal(false); }}
                className={`p-3 rounded-xl border flex-row items-center justify-between mb-2 ${leaveCategory === opt ? "bg-[#EEECFA] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"}`}
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
                onPress={() => { setExpenseCategory(opt); setShowExpenseCategoryModal(false); }}
                className={`p-3 rounded-xl border flex-row items-center justify-between mb-2 ${expenseCategory === opt ? "bg-[#EEECFA] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"}`}
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
                onPress={() => { setAdvanceType(opt); setShowAdvanceTypeModal(false); }}
                className={`p-3 rounded-xl border flex-row items-center justify-between mb-2 ${advanceType === opt ? "bg-[#EEECFA] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"}`}
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
                onPress={() => { setRepaymentType(opt); setShowRepaymentTypeModal(false); }}
                className={`p-3 rounded-xl border flex-row items-center justify-between mb-2 ${repaymentType === opt ? "bg-[#EEECFA] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"}`}
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