import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Linking,
  Platform,
  Modal,
  ActivityIndicator,
  useWindowDimensions
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  ChevronLeft, Search, UserPlus, UserCheck, FileText, Download, X, MessageCircle, RefreshCw
} from "lucide-react-native";
import * as Clipboard from 'expo-clipboard'; // <-- Added Expo Clipboard import
import ScreenContainer from "../components/ScreenContainer";
import { BASE_HOST } from "../constants/config";
import { UserSession } from "../services/UserSession";
import { useResponsive } from "../hooks/useResponsive";
import { WebPageHeader } from "../components/web/webUi";

type SubmissionStatus = "SUBMITTED" | "WAITING" | "APPROVED" | "REJECTED";

interface SubmittedCandidate {
  id: string;
  fullName: string | null;
  designation: string | null;
  department: string | null;
  mobileNumber: string | null;
  emailAddress: string | null;
  submissionDate: string | null;
  status: SubmissionStatus;
  empId: string | null;
}

interface SubmissionDetail {
  data: Record<string, any>;
  files: string[];
  decidedBy: string | null;
  adminNote: string | null;
}

const API_BASE_URL = `${BASE_HOST}/api/admin`;
const SUBMISSIONS_URL = `${API_BASE_URL}/onboarding/submissions`;

const STATUS_STYLES: Record<SubmissionStatus, { label: string; box: string; text: string }> = {
  SUBMITTED: { label: "PENDING REVIEW", box: "bg-amber-50 border-amber-200", text: "text-amber-700" },
  WAITING: { label: "WAITING", box: "bg-sky-50 border-sky-200", text: "text-sky-700" },
  APPROVED: { label: "APPROVED", box: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  REJECTED: { label: "REJECTED", box: "bg-rose-50 border-rose-200", text: "text-rose-700" },
};

const DOCUMENTS = [
  { key: "aadhaarFile", label: "Aadhaar Card Copy" },
  { key: "panFile", label: "PAN Card Copy" },
  { key: "bankPassbookFile", label: "Bank Passbook / Cancelled Cheque" },
  { key: "resumeFile", label: "Resume & Certificates" },
];

const DETAIL_SECTIONS: { title: string; fields: [string, string][] }[] = [
  {
    title: "Personal Information",
    fields: [
      ["fathersName", "Father's Name"], ["dateOfBirth", "Date of Birth"], ["gender", "Gender"],
      ["maritalStatus", "Marital Status"], ["nationality", "Nationality"], ["bloodGroup", "Blood Group"],
      ["religion", "Religion"], ["identificationMark", "Identification Mark"], ["familyIncome", "Family Income"],
    ],
  },
  {
    title: "Contact & Identity",
    fields: [
      ["mobileNumber", "Mobile"], ["emailAddress", "Email"], ["aadhaarNumber", "Aadhaar"], ["panNumber", "PAN"],
      ["permanentAddress", "Permanent Address"], ["currentAddress", "Current Address"],
    ],
  },
  {
    title: "Employment",
    fields: [["employmentType", "Employment Type"], ["dateOfJoining", "Date of Joining"]],
  },
  {
    title: "Bank Details",
    fields: [
      ["bankName", "Bank"], ["accountHolderName", "Account Holder"], ["accountNumber", "Account Number"],
      ["ifscCode", "IFSC"], ["branch", "Branch"],
    ],
  },
  {
    title: "Emergency Contact",
    fields: [
      ["emergencyName", "Name"], ["emergencyRelationship", "Relationship"],
      ["emergencyPhone1", "Phone"], ["emergencyPhone2", "Alternate Phone"],
    ],
  },
  {
    title: "Reference",
    fields: [["referenceName", "Name"], ["referenceContact", "Contact"], ["referenceDepartment", "Department"]],
  },
];

const showMsg = (title: string, msg: string) => {
  Platform.OS === "web" ? window.alert(`${title}\n${msg}`) : Alert.alert(title, msg);
};

// Forms now send an address object; older submissions hold plain text
const fieldText = (value: any) =>
  value && typeof value === "object"
    ? [value.street, value.village, value.city, value.district, value.pincode].filter(Boolean).join(", ")
    : String(value ?? "").trim();

// Joins the filled parts of a table row from the form into one line
const joinFilled = (parts: unknown[]) =>
  parts.map((p) => String(p ?? "").trim()).filter(Boolean).join(" • ");

// The form's repeating tables (education, work experience, family), as "Title: line" rows
const listRows = (data: Record<string, any>): { title: string; lines: string[] }[] => {
  const education = Object.entries(data.education || {})
    .map(([level, e]: [string, any]) => {
      const line = joinFilled([e?.institution, e?.year, e?.percentage]);
      return line ? `${level.toUpperCase()}: ${line}` : "";
    })
    .filter(Boolean);
  const work = (Array.isArray(data.workExperience) ? data.workExperience : [])
    .map((w: any) => joinFilled([w?.company, w?.location, w?.role, w?.duration, w?.salary, w?.reason]))
    .filter(Boolean);
  const family = (Array.isArray(data.familyMembers) ? data.familyMembers : [])
    .map((f: any) => joinFilled([f?.name, f?.relationship, f?.occupation, f?.contact]))
    .filter(Boolean);
  return [
    { title: "Education", lines: education },
    { title: "Work Experience", lines: work },
    { title: "Family", lines: family },
  ];
};

export default function AdminOnboardingSubmissions({ navigation }: { navigation: any }) {
  const { isWebDesktop } = useResponsive();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // Tabs: "generate" or "completed"
  const [activeTab, setActiveTab] = useState<"generate" | "completed">("generate");
  const [searchQuery, setSearchQuery] = useState("");

  // Link Generator State
  const [onboardingMobile, setOnboardingMobile] = useState("");
  const [generatedOnboardingLink, setGeneratedOnboardingLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);

  // Completed Submissions State
  const [completedCandidates, setCompletedCandidates] = useState<SubmittedCandidate[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");

  const [selectedCandidate, setSelectedCandidate] = useState<SubmittedCandidate | null>(null);

  // Full form and document list of the open candidate
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const openRef = useRef<string | null>(null); // ignores a slow reply for a candidate who is no longer open

  // Admin decision on the open candidate
  const [empIdInput, setEmpIdInput] = useState("");
  const [dojInput, setDojInput] = useState("");
  const [salaryInput, setSalaryInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [deciding, setDeciding] = useState(false);

  // WhatsApp onboarding popup (new, separate from the link flow above)
  const [showWhatsappPopup, setShowWhatsappPopup] = useState(false);

  const loadSubmissions = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const res = await fetch(SUBMISSIONS_URL, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const rows = await res.json();
      setCompletedCandidates(Array.isArray(rows) ? rows : []);
    } catch {
      setListError("Could not load submitted forms. Please check the connection and try again.");
    } finally {
      setListLoading(false);
    }
  }, []);

  // Reload whenever the admin comes back to this screen, so new submissions appear
  useFocusEffect(
    useCallback(() => {
      loadSubmissions();
    }, [loadSubmissions])
  );

  const closeCandidate = () => {
    openRef.current = null;
    setSelectedCandidate(null);
    setDetail(null);
    setDetailError("");
  };

  const openCandidate = async (candidate: SubmittedCandidate) => {
    openRef.current = candidate.id;
    setSelectedCandidate(candidate);
    setDetail(null);
    setDetailError("");
    setEmpIdInput("");
    setDojInput("");
    setSalaryInput("");
    setNoteInput("");
    setDetailLoading(true);
    try {
      const res = await fetch(`${SUBMISSIONS_URL}/${encodeURIComponent(candidate.id)}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error);
      if (openRef.current !== candidate.id) return;
      setDetail({
        data: body.data || {},
        files: Array.isArray(body.files) ? body.files : [],
        decidedBy: body.decidedBy ?? null,
        adminNote: body.adminNote ?? null,
      });
      const joining = String(body.data?.dateOfJoining || "");
      if (/^\d{4}-\d{2}-\d{2}$/.test(joining)) setDojInput(joining);
    } catch (e: any) {
      if (openRef.current === candidate.id) setDetailError(e?.message || "Could not load this submission.");
    } finally {
      if (openRef.current === candidate.id) setDetailLoading(false);
    }

    // Suggest the next free Employee ID; the admin can still change it
    if (candidate.status !== "APPROVED") {
      try {
        const res = await fetch(`${API_BASE_URL}/onboarding/next-emp-id`, { cache: "no-store" });
        const body = await res.json();
        if (res.ok && body?.empId && openRef.current === candidate.id) {
          setEmpIdInput((current) => current || body.empId);
        }
      } catch {
        // the admin can type the ID by hand
      }
    }
  };

  const handleDecision = async (status: "APPROVED" | "WAITING" | "REJECTED") => {
    if (!selectedCandidate || deciding) return;
    if (status === "APPROVED" && (!empIdInput.trim() || !dojInput.trim() || !salaryInput.trim())) {
      showMsg("Details required", "Employee ID, date of joining and monthly salary are required to confirm.");
      return;
    }
    setDeciding(true);
    try {
      const body: Record<string, string> = {
        status,
        adminName: String(UserSession.empId || "Admin"),
        note: noteInput.trim(),
      };
      if (status === "APPROVED") {
        body.empId = empIdInput.trim();
        body.doj = dojInput.trim();
        body.salary = salaryInput.trim();
      }
      const res = await fetch(`${SUBMISSIONS_URL}/${encodeURIComponent(selectedCandidate.id)}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save the decision.");
      showMsg(
        "Saved",
        status === "APPROVED"
          ? `Employee ${data.empId} was created with default work settings. In Edit User, complete the settings, set Config status to ACTIVE and enable login.`
          : `${selectedCandidate.fullName || "Candidate"} is now marked ${status}.`
      );
      closeCandidate();
      loadSubmissions();
    } catch (e: any) {
      showMsg("Could not save", e?.message || "Could not save the decision.");
    } finally {
      setDeciding(false);
    }
  };

  const handleGenerateOnboardingLink = async () => {
    if (!onboardingMobile || onboardingMobile.length < 10) {
      const msg = "Please enter a valid 10-digit mobile number.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Error", msg);
      return;
    }

    setGeneratingLink(true);
    try {
      const res = await fetch(`${API_BASE_URL}/generate-onboarding-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber: onboardingMobile.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.onboardingUrl) {
        setGeneratedOnboardingLink(data.onboardingUrl);
      } else {
        const err = data.error || "Failed to generate link.";
        Platform.OS === "web" ? window.alert(err) : Alert.alert("Error", err);
      }
    } catch (e) {
      Alert.alert("Network Error", "Unable to connect to backend server.");
    } finally {
      setGeneratingLink(false);
    }
  };

  // Robust cross-platform copy handler
  const handleCopyLink = async () => {
    try {
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(generatedOnboardingLink);
        window.alert("Link copied to clipboard!");
      } else {
        await Clipboard.setStringAsync(generatedOnboardingLink);
        Alert.alert("Copied", "Onboarding link copied successfully!");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to copy the link to clipboard.");
    }
  };

  const handleOpenDoc = async (fileKey: string) => {
    if (!selectedCandidate) return;
    const url = `${SUBMISSIONS_URL}/${encodeURIComponent(selectedCandidate.id)}/file/${fileKey}`;
    if (Platform.OS === "web") {
      window.open(url, "_blank");
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      showMsg("Could not open", "Unable to open this document on this device.");
    }
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredCandidates = completedCandidates.filter(c =>
    (c.fullName || "").toLowerCase().includes(query) ||
    (c.mobileNumber || "").includes(query) ||
    (c.department || "").toLowerCase().includes(query)
  );

  return (
    <ScreenContainer scrollable={false} fullWidth={true} webHeader={<WebPageHeader title="Onboarding Management" subtitle="Link generation & completed candidate reviews" onBack={() => (navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate("Home"))} />}>

      {/* Header Bar */}
      {!isWebDesktop && (
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => (navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate("Home"))}
            className="w-10 h-10 bg-white border border-[#E7E4F5] rounded-xl items-center justify-center shadow-xs"
          >
            <ChevronLeft size={20} color="#1F1B3D" />
          </TouchableOpacity>
          <View>
            <Text className="text-xl md:text-2xl font-black text-[#1F1B3D]">Onboarding Management</Text>
            <Text className="text-xs font-bold text-[#7A76A6]">Link generation & completed candidate reviews</Text>
          </View>
        </View>
      </View>
      )}

      {/* Segmented Switcher Tabs */}
      <View className="web:lg:self-start web:lg:w-[480px] flex-row bg-[#EEECFA]/70 p-1.5 rounded-2xl border border-[#E7E4F5] mb-4">
        <TouchableOpacity
          onPress={() => setActiveTab("generate")}
          className={`flex-1 py-2.5 rounded-xl items-center justify-center ${activeTab === "generate" ? "bg-[#5B4FD1] shadow-xs" : ""}`}
        >
          <Text className={`text-xs font-black ${activeTab === "generate" ? "text-white" : "text-[#7A76A6]"}`}>
            Generate Link
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("completed")}
          className={`flex-1 py-2.5 rounded-xl items-center justify-center ${activeTab === "completed" ? "bg-[#5B4FD1] shadow-xs" : ""}`}
        >
          <Text className={`text-xs font-black ${activeTab === "completed" ? "text-white" : "text-[#7A76A6]"}`}>
            Completed User Forms ({completedCandidates.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: GENERATE LINK */}
      {activeTab === "generate" && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }} className="flex-1">
          <View style={{ width: isDesktop ? 600 : "100%", alignSelf: "center" }} className="gap-4">
            <View className="bg-white border border-[#E7E4F5] rounded-3xl p-6 md:p-8 shadow-xs gap-5">

              <View className="flex-row items-center gap-3 pb-3 border-b border-slate-100">
                <View className="w-10 h-10 rounded-xl bg-[#EEECFA] items-center justify-center">
                  <UserPlus size={20} color="#5B4FD1" />
                </View>
                <View>
                  <Text style={{ fontSize: isDesktop ? 18 : 16 }} className="font-black text-[#1F1B3D]">
                    Candidate Onboarding Link
                  </Text>
                  <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6]">
                    Generate a secure tokenized link bound to the candidate's mobile number
                  </Text>
                </View>
              </View>

              <View className="gap-2">
                <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase">
                  Candidate Mobile Number*
                </Text>
                <TextInput
                  value={onboardingMobile}
                  onChangeText={setOnboardingMobile}
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor="#A6A2CE"
                  keyboardType="phone-pad"
                  maxLength={10}
                  style={{ fontSize: isDesktop ? 14 : 12 }}
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5 font-bold text-[#1F1B3D]"
                />
              </View>

              <TouchableOpacity
                onPress={handleGenerateOnboardingLink}
                disabled={generatingLink}
                className="bg-[#5B4FD1] py-4 rounded-xl items-center shadow-xs active:opacity-90 mt-2"
              >
                {generatingLink ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ fontSize: isDesktop ? 13 : 11 }} className="text-white font-black uppercase tracking-wider">
                    Generate Secure Onboarding Link
                  </Text>
                )}
              </TouchableOpacity>

              {generatedOnboardingLink ? (
                <View className="bg-[#EEECFA] border border-[#5B4FD1]/30 rounded-2xl p-4 gap-3 mt-2">
                  <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="font-bold text-[#7A76A6] uppercase">
                    Secure Shareable URL
                  </Text>
                  <TextInput
                    value={generatedOnboardingLink}
                    editable={false}
                    style={{ fontSize: isDesktop ? 12 : 10 }}
                    className="bg-white border border-[#E7E4F5] rounded-xl p-3 font-semibold text-[#1F1B3D]"
                  />
                  <TouchableOpacity
                    onPress={handleCopyLink}
                    className="bg-[#5B4FD1] py-3 rounded-xl items-center"
                  >
                    <Text style={{ fontSize: isDesktop ? 12 : 10 }} className="text-white font-black uppercase">
                      Copy Link for WhatsApp / Email
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

            </View>

            {/* NEW: onboarding by WhatsApp message (opens a popup) */}
            {/* <TouchableOpacity
              onPress={() => setShowWhatsappPopup(true)}
              className="bg-white border border-emerald-200 rounded-2xl p-4 flex-row items-center gap-3 shadow-xs active:opacity-90"
            >
              <View className="w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center">
                <MessageCircle size={20} color="#059669" />
              </View>
              <View className="flex-1">
                <Text style={{ fontSize: isDesktop ? 14 : 12 }} className="font-black text-[#1F1B3D]">WhatsApp Link / Onboarding via WhatsApp</Text>
                <Text style={{ fontSize: isDesktop ? 11 : 10 }} className="font-bold text-[#7A76A6]">
                  Check the number, send a verification message, then the form details as a WhatsApp message
                </Text>
              </View>
            </TouchableOpacity> */}
          </View>
        </ScrollView>
      )}

      {/* TAB 2: COMPLETED USER FORMS & DOCUMENTS */}
      {activeTab === "completed" && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }} className="flex-1">
          <View className="gap-4">
            <View className="flex-row items-center gap-2 mb-2">
              <View className="flex-1 bg-white border border-[#E7E4F5] rounded-2xl px-4 py-3 flex-row items-center shadow-xs">
                <Search size={18} color="#7A76A6" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search candidate by name, mobile or department..."
                  placeholderTextColor="#A6A2CE"
                  className="flex-1 ml-2.5 text-xs font-bold text-[#1F1B3D]"
                />
              </View>
              <TouchableOpacity
                onPress={loadSubmissions}
                disabled={listLoading}
                accessibilityLabel="Refresh submitted forms"
                className="w-11 h-11 bg-white border border-[#E7E4F5] rounded-2xl items-center justify-center shadow-xs"
              >
                {listLoading ? <ActivityIndicator size="small" color="#5B4FD1" /> : <RefreshCw size={16} color="#5B4FD1" />}
              </TouchableOpacity>
            </View>

            {listError ? (
              <View className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                <Text className="text-xs font-bold text-rose-700">{listError}</Text>
              </View>
            ) : null}

            {!listLoading && !listError && filteredCandidates.length === 0 ? (
              <View className="bg-white border border-[#E7E4F5] rounded-3xl p-8 items-center">
                <Text className="text-sm font-black text-[#1F1B3D]">
                  {query ? "No matching candidates" : "No submitted forms yet"}
                </Text>
                <Text className="text-xs font-bold text-[#7A76A6] mt-1 text-center">
                  {query ? "Try a different name, mobile number or department." : "Forms appear here after a candidate submits their link."}
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              {filteredCandidates.map((candidate) => {
                const badge = STATUS_STYLES[candidate.status] || STATUS_STYLES.SUBMITTED;
                const role = joinFilled([candidate.designation, candidate.department]);
                return (
                  <TouchableOpacity
                    key={candidate.id}
                    onPress={() => openCandidate(candidate)}
                    className="bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-xs active:opacity-90"
                    style={{ width: isDesktop ? "32%" : "100%", minHeight: 160 }}
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="w-10 h-10 rounded-xl bg-[#EEECFA] items-center justify-center">
                        <UserCheck size={20} color="#5B4FD1" />
                      </View>
                      <View className={`px-2.5 py-1 rounded-full border ${badge.box}`}>
                        <Text className={`text-[9px] font-black ${badge.text}`}>{badge.label}</Text>
                      </View>
                    </View>

                    <Text className="text-base font-black text-[#1F1B3D]" numberOfLines={1}>{candidate.fullName || "Unnamed candidate"}</Text>
                    {role ? <Text className="text-xs font-bold text-[#5B4FD1] mt-0.5">{role}</Text> : null}
                    {candidate.empId ? <Text className="text-[11px] font-bold text-emerald-700 mt-0.5">Employee ID: {candidate.empId}</Text> : null}

                    <View className="mt-3 pt-3 border-t border-slate-100 flex-row justify-between items-center">
                      <Text className="text-[11px] font-semibold text-[#7A76A6]">Mobile: {candidate.mobileNumber}</Text>
                      <Text className="text-[10px] font-bold text-slate-400">{candidate.submissionDate}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Candidate Document Review Modal */}
      <Modal visible={!!selectedCandidate} transparent animationType="fade">
        <View className="flex-1 bg-black/40 justify-center items-center p-4">
          {selectedCandidate && (
            <View className="w-full max-w-lg bg-white border border-[#E7E4F5] rounded-3xl p-6 shadow-xl gap-5 max-h-[85%]">

              <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
                <View>
                  <Text className="text-lg font-black text-[#1F1B3D]">{selectedCandidate.fullName || "Unnamed candidate"}</Text>
                  <Text className="text-xs font-bold text-[#5B4FD1]">{joinFilled([selectedCandidate.designation, selectedCandidate.department])}</Text>
                </View>
                <TouchableOpacity onPress={closeCandidate} accessibilityLabel="Close">
                  <X size={20} color="#7A76A6" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
                {detailLoading ? <ActivityIndicator size="large" color="#5B4FD1" /> : null}

                {detailError ? (
                  <View className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                    <Text className="text-xs font-bold text-rose-700">{detailError}</Text>
                  </View>
                ) : null}

                {detail ? (
                  <>
                    {DETAIL_SECTIONS.map((section) => {
                      const rows = section.fields.filter(([key]) => fieldText(detail.data[key]));
                      if (rows.length === 0) return null;
                      return (
                        <View key={section.title} className="bg-[#F6F5FC] p-4 rounded-2xl border border-[#E7E4F5] gap-2">
                          <Text className="text-[11px] font-black text-[#1F1B3D] uppercase">{section.title}</Text>
                          {rows.map(([key, label]) => (
                            <Text key={key} className="text-xs font-bold text-[#7A76A6]">
                              {label}: <Text className="text-[#1F1B3D]">{fieldText(detail.data[key])}</Text>
                            </Text>
                          ))}
                        </View>
                      );
                    })}

                    {listRows(detail.data).map((group) =>
                      group.lines.length === 0 ? null : (
                        <View key={group.title} className="bg-[#F6F5FC] p-4 rounded-2xl border border-[#E7E4F5] gap-2">
                          <Text className="text-[11px] font-black text-[#1F1B3D] uppercase">{group.title}</Text>
                          {group.lines.map((line, idx) => (
                            <Text key={idx} className="text-xs font-bold text-[#1F1B3D]">{line}</Text>
                          ))}
                        </View>
                      )
                    )}

                    <View className="gap-2">
                      <Text className="text-[11px] font-black text-[#1F1B3D] uppercase">Uploaded Documents</Text>
                      {DOCUMENTS.map((doc) => {
                        const provided = detail.files.includes(doc.key);
                        return (
                          <View key={doc.key} className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3 gap-2">
                            <View className="flex-row items-center gap-2 flex-1">
                              <FileText size={16} color="#5B4FD1" />
                              <Text className="text-xs font-bold text-[#1F1B3D] flex-1">{doc.label}</Text>
                            </View>
                            {provided ? (
                              <TouchableOpacity
                                onPress={() => handleOpenDoc(doc.key)}
                                className="bg-[#EEECFA] px-3 py-1.5 rounded-lg border border-[#5B4FD1]/30 flex-row items-center gap-1"
                              >
                                <Download size={12} color="#5B4FD1" />
                                <Text className="text-[10px] font-black text-[#5B4FD1]">VIEW / DOWNLOAD</Text>
                              </TouchableOpacity>
                            ) : (
                              <Text className="text-[10px] font-bold text-slate-400">Not provided</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>

                    {detail.decidedBy || detail.adminNote ? (
                      <View className="bg-[#F6F5FC] p-4 rounded-2xl border border-[#E7E4F5] gap-2">
                        <Text className="text-[11px] font-black text-[#1F1B3D] uppercase">Last Decision</Text>
                        {detail.decidedBy ? <Text className="text-xs font-bold text-[#7A76A6]">By: <Text className="text-[#1F1B3D]">{detail.decidedBy}</Text></Text> : null}
                        {detail.adminNote ? <Text className="text-xs font-bold text-[#7A76A6]">Note: <Text className="text-[#1F1B3D]">{detail.adminNote}</Text></Text> : null}
                      </View>
                    ) : null}

                    {selectedCandidate.status !== "APPROVED" ? (
                      <View className="gap-2">
                        <Text className="text-[11px] font-black text-[#1F1B3D] uppercase">Review Decision</Text>
                        <Text className="text-[10px] font-bold text-[#7A76A6]">Employee ID, date of joining and salary are needed only to confirm.</Text>
                        {[
                          { label: "Employee ID*", value: empIdInput, onChange: setEmpIdInput, placeholder: "F9102" },
                          { label: "Date of Joining* (YYYY-MM-DD)", value: dojInput, onChange: setDojInput, placeholder: "2026-11-05" },
                          { label: "Monthly Salary*", value: salaryInput, onChange: setSalaryInput, placeholder: "25000" },
                          { label: "Note (optional)", value: noteInput, onChange: setNoteInput, placeholder: "Reason or remarks" },
                        ].map((input) => (
                          <View key={input.label} className="gap-1">
                            <Text className="text-[10px] font-bold text-[#7A76A6] uppercase">{input.label}</Text>
                            <TextInput
                              value={input.value}
                              onChangeText={input.onChange}
                              placeholder={input.placeholder}
                              placeholderTextColor="#A6A2CE"
                              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-bold text-[#1F1B3D]"
                            />
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </>
                ) : null}
              </ScrollView>

              {detail && selectedCandidate.status !== "APPROVED" ? (
                <View className="gap-2 pt-2 border-t border-slate-100">
                  <TouchableOpacity
                    onPress={() => handleDecision("APPROVED")}
                    disabled={deciding}
                    className="bg-emerald-600 py-3.5 rounded-xl items-center shadow-xs"
                  >
                    {deciding ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white text-xs font-black uppercase">Confirm & Create Employee</Text>}
                  </TouchableOpacity>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => handleDecision("WAITING")}
                      disabled={deciding}
                      className="flex-1 bg-sky-50 border border-sky-200 py-3 rounded-xl items-center"
                    >
                      <Text className="text-sky-700 text-xs font-black uppercase">Mark Waiting</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDecision("REJECTED")}
                      disabled={deciding}
                      className="flex-1 bg-rose-50 border border-rose-200 py-3 rounded-xl items-center"
                    >
                      <Text className="text-rose-700 text-xs font-black uppercase">Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
}