import React, { useState } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Alert, 
  Platform,
  Modal,
  ActivityIndicator,
  useWindowDimensions
} from "react-native";
import { 
  ChevronLeft, Search, UserPlus, UserCheck, FileText, Download, X 
} from "lucide-react-native";
import * as Clipboard from 'expo-clipboard'; // <-- Added Expo Clipboard import
import ScreenContainer from "../components/ScreenContainer";

interface SubmittedCandidate {
  id: string;
  fullName: string;
  designation: string;
  department: string;
  mobileNumber: string;
  emailAddress: string;
  submissionDate: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  documents: {
    aadhaarUrl?: string;
    panUrl?: string;
    resumeUrl?: string;
  };
}

const LOCAL_IP = "192.168.31.133";
const API_BASE_URL = Platform.OS === "web"
  ? "http://192.168.31.133:8080/api/admin"
  : `http://${LOCAL_IP}:8080/api/admin`;

export default function AdminOnboardingSubmissions({ navigation }: { navigation: any }) {
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
  const [completedCandidates, setCompletedCandidates] = useState<SubmittedCandidate[]>([
    {
      id: "CAND-501",
      fullName: "Alex Sterling",
      designation: "Software Engineer",
      department: "Engineering",
      mobileNumber: "9876543210",
      emailAddress: "alex.sterling@example.com",
      submissionDate: "2026-06-07",
      status: "PENDING_REVIEW",
      documents: {
        aadhaarUrl: "https://example.com/docs/aadhaar.pdf",
        panUrl: "https://example.com/docs/pan.pdf",
        resumeUrl: "https://example.com/docs/resume.pdf",
      }
    },
    {
      id: "CAND-502",
      fullName: "Samantha Wright",
      designation: "Product Designer",
      department: "Design",
      mobileNumber: "9123456780",
      emailAddress: "sam.wright@example.com",
      submissionDate: "2026-06-06",
      status: "APPROVED",
      documents: {
        aadhaarUrl: "https://example.com/docs/aadhaar2.pdf",
        panUrl: "https://example.com/docs/pan2.pdf",
      }
    }
  ]);

  const [selectedCandidate, setSelectedCandidate] = useState<SubmittedCandidate | null>(null);

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

  const handleDownloadDoc = (docName: string, url?: string) => {
    if (!url) {
      Alert.alert("Not Found", "Document was not provided.");
      return;
    }
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Alert.alert("Download Started", `Downloading ${docName}...`);
    }
  };

  const filteredCandidates = completedCandidates.filter(c => 
    c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.mobileNumber.includes(searchQuery) ||
    c.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScreenContainer scrollable={false} fullWidth={true}>
      
      {/* Header Bar */}
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
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

      {/* Segmented Switcher Tabs */}
      <View className="flex-row bg-[#EEECFA]/70 p-1.5 rounded-2xl border border-[#E7E4F5] mb-4">
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
          </View>
        </ScrollView>
      )}

      {/* TAB 2: COMPLETED USER FORMS & DOCUMENTS */}
      {activeTab === "completed" && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }} className="flex-1">
          <View className="gap-4">
            <View className="bg-white border border-[#E7E4F5] rounded-2xl px-4 py-3 flex-row items-center shadow-xs mb-2">
              <Search size={18} color="#7A76A6" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search candidate by name, mobile or department..."
                placeholderTextColor="#A6A2CE"
                className="flex-1 ml-2.5 text-xs font-bold text-[#1F1B3D]"
              />
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              {filteredCandidates.map((candidate) => (
                <TouchableOpacity
                  key={candidate.id}
                  onPress={() => setSelectedCandidate(candidate)}
                  className="bg-white border border-[#E7E4F5] rounded-3xl p-5 shadow-xs active:opacity-90"
                  style={{ width: isDesktop ? "32%" : "100%", minHeight: 160 }}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="w-10 h-10 rounded-xl bg-[#EEECFA] items-center justify-center">
                      <UserCheck size={20} color="#5B4FD1" />
                    </View>
                    <View className={`px-2.5 py-1 rounded-full border ${candidate.status === "APPROVED" ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                      <Text className={`text-[9px] font-black ${candidate.status === "APPROVED" ? "text-emerald-700" : "text-amber-700"}`}>
                        {candidate.status}
                      </Text>
                    </View>
                  </View>

                  <Text className="text-base font-black text-[#1F1B3D]" numberOfLines={1}>{candidate.fullName}</Text>
                  <Text className="text-xs font-bold text-[#5B4FD1] mt-0.5">{candidate.designation} • {candidate.department}</Text>
                  
                  <View className="mt-3 pt-3 border-t border-slate-100 flex-row justify-between items-center">
                    <Text className="text-[11px] font-semibold text-[#7A76A6]">Mobile: {candidate.mobileNumber}</Text>
                    <Text className="text-[10px] font-bold text-slate-400">{candidate.submissionDate}</Text>
                  </View>
                </TouchableOpacity>
              ))}
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
                  <Text className="text-lg font-black text-[#1F1B3D]">{selectedCandidate.fullName}</Text>
                  <Text className="text-xs font-bold text-[#5B4FD1]">{selectedCandidate.designation} ({selectedCandidate.department})</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedCandidate(null)}>
                  <X size={20} color="#7A76A6" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                <View className="bg-[#F6F5FC] p-4 rounded-2xl border border-[#E7E4F5] gap-2">
                  <Text className="text-[11px] font-black text-[#1F1B3D] uppercase">Contact Information</Text>
                  <Text className="text-xs font-bold text-[#7A76A6]">Mobile: <Text className="text-[#1F1B3D]">{selectedCandidate.mobileNumber}</Text></Text>
                  <Text className="text-xs font-bold text-[#7A76A6]">Email: <Text className="text-[#1F1B3D]">{selectedCandidate.emailAddress}</Text></Text>
                </View>

                <View className="gap-2">
                  <Text className="text-[11px] font-black text-[#1F1B3D] uppercase">Uploaded Documents</Text>
                  {[
                    { label: "Aadhaar Card Copy", url: selectedCandidate.documents.aadhaarUrl },
                    { label: "PAN Card Copy", url: selectedCandidate.documents.panUrl },
                    { label: "Resume & Certificates", url: selectedCandidate.documents.resumeUrl },
                  ].map((doc, idx) => (
                    <View key={idx} className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <View className="flex-row items-center gap-2">
                        <FileText size={16} color="#5B4FD1" />
                        <Text className="text-xs font-bold text-[#1F1B3D]">{doc.label}</Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => handleDownloadDoc(doc.label, doc.url)}
                        className="bg-[#EEECFA] px-3 py-1.5 rounded-lg border border-[#5B4FD1]/30 flex-row items-center gap-1"
                      >
                        <Download size={12} color="#5B4FD1" />
                        <Text className="text-[10px] font-black text-[#5B4FD1]">VIEW / DOWNLOAD</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>

              <View className="flex-row gap-2 pt-2 border-t border-slate-100">
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert("Approved", `${selectedCandidate.fullName} has been approved.`);
                    setSelectedCandidate(null);
                  }}
                  className="flex-1 bg-emerald-600 py-3.5 rounded-xl items-center shadow-xs"
                >
                  <Text className="text-white text-xs font-black uppercase">Approve & Move to Core</Text>
                </TouchableOpacity>
              </View>

            </View>
          )}
        </View>
      </Modal>

    </ScreenContainer>
  );
}