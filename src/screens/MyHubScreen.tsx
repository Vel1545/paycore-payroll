import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { Platform } from "react-native";
import { 
  ArrowLeft, Mail, Calendar, Briefcase, 
  ShieldCheck, Building, Award, Download, 
  ChevronRight, UserCheck, CreditCard, Camera
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { BASE_HOST } from "../constants/config";
import { UserSession } from "../services/UserSession";
import { downloadPayslipPdf } from "../services/Payslipdownload";
import PayslipView, { MonthStepper, monthKey, monthLabel } from "../components/Payslipview";

interface MyHubScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: any) => void;
  };
  route?: {
    params?: {
      initialTab?: "profile" | "payslip" | "requests";
    };
  };
}

export default function MyHubScreen({ navigation, route }: MyHubScreenProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "payslip">(
    route?.params?.initialTab === "payslip" ? "payslip" : "profile"
  );

  const { user } = useAuth();
  const currentUserId = user?.empId || user?.userId || UserSession.empId;
  const isAdmin = !!(user?.isAdmin || String(user?.role || "").toUpperCase() === "ADMIN");
  // last month first: the current month is usually not finalized yet
  const [payMonth, setPayMonth] = useState(() => monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)));

  // ---- real records from the server (users / user_configs) ----
  type Profile = {
    name?: string; empId?: string; designation?: string; department?: string; officialEmail?: string;
    dob?: string; doj?: string; tenure?: string; workLocation?: string; employmentType?: string;
    reportingManager?: string; bloodGroup?: string; status?: string; photoUrl?: string | null;
  };
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoV, setPhotoV] = useState((UserSession as any).photoVersion || 0);

  const loadProfile = useCallback(async () => {
    if (!currentUserId) return;
    setProfileLoading(true);
    setProfileError("");
    try {
      const res = await fetch(`${BASE_HOST}/api/profile/${encodeURIComponent(currentUserId)}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Could not load your profile");
      setProfile(await res.json());
    } catch (e: any) {
      setProfileError(e?.message || "Could not load your profile");
    } finally {
      setProfileLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const say = (title: string, msg: string) =>
    Platform.OS === "web" ? window.alert(`${title}\n${msg}`) : Alert.alert(title, msg);

  // the person picks a new photo of their own and it is uploaded
  const changePhoto = async () => {
    if (!currentUserId || photoBusy) return;
    try {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return say("Permission needed", "Allow photo access to change your picture.");
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.7,   // square, compressed
      });
      if (picked.canceled || !picked.assets?.length) return;
      const a = picked.assets[0];

      setPhotoBusy(true);
      const form = new FormData();
      const type = a.mimeType || "image/jpeg";
      if (Platform.OS === "web") {
        const blob = await (await fetch(a.uri)).blob();
        form.append("file", blob, `photo.${type.split("/")[1] || "jpg"}`);
      } else {
        form.append("file", { uri: a.uri, name: `photo.${type.split("/")[1] || "jpg"}`, type } as any);
      }
      const res = await fetch(`${BASE_HOST}/api/profile/${encodeURIComponent(currentUserId)}/photo`, { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Could not save the photo");
      const v = Date.now();
      (UserSession as any).photoVersion = v;   // Home and Profile read this when they show
      setPhotoV(v);
      setPhotoFailed(false);
    } catch (e: any) {
      say("Photo not changed", e?.message || "Try again");
    } finally {
      setPhotoBusy(false);
    }
  };

  // the photo saved on the server for this employee (404 -> initials)
  const photoUri = `${BASE_HOST}/api/profile/${encodeURIComponent(currentUserId || "")}/photo?v=${photoV}`;
  const dash = (v?: string | null) => (v && String(v).trim() ? String(v) : "—");
  const initials = String(profile?.name || user?.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const userProfile = {
    name: profile?.name || user?.name || "—",
    empId: profile?.empId || currentUserId || "—",
    designation: dash(profile?.designation),
    department: dash(profile?.department),
    officialEmail: dash(profile?.officialEmail),
    dob: dash(profile?.dob),
    doj: dash(profile?.doj),
    tenure: profile?.tenure || "",
    workLocation: dash(profile?.workLocation),
    employmentType: dash(profile?.employmentType),
    reportingManager: dash(profile?.reportingManager),
    bloodGroup: dash(profile?.bloodGroup),
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const handleDownloadPdf = async (empId: string, month: string) => {
    if (!empId) return;
    setPdfBusy(true);
    try {
      await downloadPayslipPdf(empId, month);   // month is YYYY-MM
    } catch (e: any) {
      const msg = e?.message || "Try again";
      if (Platform.OS === "web") window.alert(`Payslip not available\n${msg}`);
      else Alert.alert("Payslip not available", msg);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F4F6F9]" edges={["top"]}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
        className="flex-1"
      >
       {/* ========================================================================= */}
        {/* 1. PREMIUM HEADER / HERO SECTION (Guaranteed Spacing via Inline Styles)    */}
        {/* ========================================================================= */}
        <LinearGradient
          colors={["#4F46E5", "#6366F1", "#818CF8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: 40, paddingBottom: 80, paddingHorizontal: 24 }}
          className="relative overflow-hidden shadow-xl shadow-indigo-950/20 rounded-b-[32px]"
        >
          {/* Decorative Background Glows */}
          <View className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <View className="absolute bottom-0 left-10 w-44 h-44 rounded-full bg-indigo-900/20 blur-2xl pointer-events-none" />

          <View className="max-w-6xl mx-auto w-full">
            {/* Header Navigation & Status Badge */}
            <View className="flex-row items-center justify-between mb-6">
              <TouchableOpacity 
                onPress={() => navigation.goBack()}
                style={{ width: 44, height: 44 }}
                className="bg-white/15 border border-white/25 rounded-2xl items-center justify-center active:opacity-80 shadow-xs"
              >
                <ArrowLeft size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <View className="bg-emerald-500/20 border border-emerald-400/30 px-3.5 py-1.5 rounded-full flex-row items-center gap-1.5">
                <ShieldCheck size={13} color="#34D399" />
                <Text className="text-[10px] font-black text-emerald-200 uppercase tracking-wider">{profile?.status || "ACTIVE"}</Text>
              </View>
            </View>

            {/* Title & Subtitle with guaranteed safe clearance */}
            <View className="mt-2">
              <Text className="text-2xl md:text-3xl font-black text-white tracking-tight">My Hub</Text>
              <Text className="text-xs font-bold text-purple-200 mt-1 uppercase tracking-wider">
                Profile records & monthly compensation
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ========================================================================= */}
        {/* 2. MAIN CONTAINER BODY                                                    */}
        {/* ========================================================================= */}
        <View className="max-w-6xl mx-auto w-full px-5 md:px-10 -mt-6">

          {/* Two Tab Switcher */}
          <View className="flex-row bg-white p-1.5 rounded-2xl mb-6 border border-slate-100 shadow-xl shadow-slate-200/50 z-10">
            <TouchableOpacity
              onPress={() => setActiveTab("profile")}
              className={`flex-1 h-14 rounded-xl items-center flex-row justify-center px-2 ${
                activeTab === "profile" ? "bg-[#5B4FD1] shadow-md shadow-purple-600/30" : "bg-transparent"
              }`}
            >
              <UserCheck size={16} color={activeTab === "profile" ? "#FFFFFF" : "#7A76A6"} />
              <Text
                className={`text-xs font-black ml-2 uppercase tracking-wider ${
                  activeTab === "profile" ? "text-white" : "text-[#7A76A6]"
                }`}
                numberOfLines={1}
              >
                Profile Info
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("payslip")}
              className={`flex-1 h-14 rounded-xl items-center flex-row justify-center px-2 ${
                activeTab === "payslip" ? "bg-[#5B4FD1] shadow-md shadow-purple-600/30" : "bg-transparent"
              }`}
            >
              <CreditCard size={16} color={activeTab === "payslip" ? "#FFFFFF" : "#7A76A6"} />
              <Text
                className={`text-xs font-black ml-2 uppercase tracking-wider ${
                  activeTab === "payslip" ? "text-white" : "text-[#7A76A6]"
                }`}
                numberOfLines={1}
              >
                Payslip Breakdown
              </Text>
            </TouchableOpacity>
          </View>

          {/* ========================================================================= */}
          {/* 3. PROFILE VIEW                                                           */}
          {/* ========================================================================= */}
          {activeTab === "profile" && (
            <View className="gap-y-6 mb-10">
              {profileLoading && !profile && <ActivityIndicator color="#5B4FD1" style={{ marginTop: 8 }} />}
              {!!profileError && (
                <TouchableOpacity onPress={loadProfile} className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                  <Text className="text-xs font-bold text-rose-700">{profileError} — tap to retry</Text>
                </TouchableOpacity>
              )}
              <View className="bg-white border border-slate-100 rounded-[28px] p-6 shadow-xl shadow-slate-200/50 items-center relative overflow-hidden">
                <View className="absolute top-0 left-0 right-0 h-20 bg-indigo-50/50 pointer-events-none" />
                
                <TouchableOpacity onPress={changePhoto} activeOpacity={0.85} disabled={photoBusy} className="relative mb-3 mt-2">
                  {!photoFailed ? (
                    <Image
                      source={{ uri: photoUri }}
                      onError={() => setPhotoFailed(true)}
                      className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-slate-100"
                    />
                  ) : (
                    <View className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-[#EEECFA] items-center justify-center">
                      <Text className="text-2xl font-black text-[#5B4FD1]">{initials}</Text>
                    </View>
                  )}
                  {photoBusy && (
                    <View className="absolute inset-0 rounded-full bg-black/40 items-center justify-center">
                      <ActivityIndicator color="#FFFFFF" />
                    </View>
                  )}
                  <View className="absolute bottom-0 right-0 bg-[#5B4FD1] p-1.5 rounded-full border-2 border-white shadow-xs">
                    <Camera size={14} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>

                <Text className="text-xl font-black text-[#1F1B3D] text-center">{userProfile.name}</Text>
                <Text className="text-xs font-bold text-[#7A76A6] mt-0.5 text-center">{userProfile.designation}</Text>
                <Text className="text-[10px] font-bold text-[#5B4FD1] mt-1 text-center">Tap the photo to change it</Text>
                
                <View className="flex-row items-center gap-2 mt-4 flex-wrap justify-center">
                  <View className="bg-[#EEECFA] px-3.5 py-1 rounded-full border border-[#5B4FD1]/10">
                    <Text className="text-[10px] font-black text-[#5B4FD1] uppercase tracking-wider">{userProfile.empId}</Text>
                  </View>
                  <View className="bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200/80">
                    <Text className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">{userProfile.department}</Text>
                  </View>
                </View>
              </View>

              <View>
                <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-widest mb-3 px-1">
                  Official Records
                </Text>
                <View className="bg-white border border-slate-100 rounded-[28px] p-5 shadow-xl shadow-slate-200/50 divide-y divide-slate-100">
                  <View className="py-3.5 flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 pr-2">
                      <View className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 items-center justify-center mr-3.5 shrink-0">
                        <Mail size={18} color="#0D9488" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Official Email</Text>
                        <Text className="text-xs md:text-sm font-black text-[#1F1B3D] mt-0.5" numberOfLines={1}>{userProfile.officialEmail}</Text>
                      </View>
                    </View>
                  </View>

                  <View className="py-3.5 flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 pr-2">
                      <View className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 items-center justify-center mr-3.5 shrink-0">
                        <Briefcase size={18} color="#D97706" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Date of Joining (DOJ)</Text>
                        <Text className="text-xs md:text-sm font-black text-[#1F1B3D] mt-0.5">{userProfile.doj}</Text>
                      </View>
                    </View>
                    {!!userProfile.tenure && <View className="bg-amber-100/70 border border-amber-200 px-3 py-1 rounded-full shrink-0">
                      <Text className="text-[10px] font-black text-amber-900 uppercase tracking-wider">{userProfile.tenure}</Text>
                    </View>}
                  </View>

                  <View className="py-3.5 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 items-center justify-center mr-3.5 shrink-0">
                        <Calendar size={18} color="#7E22CE" />
                      </View>
                      <View>
                        <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Date of Birth (DOB)</Text>
                        <Text className="text-xs md:text-sm font-black text-[#1F1B3D] mt-0.5">{userProfile.dob}</Text>
                      </View>
                    </View>
                  </View>

                  <View className="py-3.5 flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 pr-2">
                      <View className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 items-center justify-center mr-3.5 shrink-0">
                        <Building size={18} color="#0284C7" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">Designation</Text>
                        <Text className="text-xs md:text-sm font-black text-[#1F1B3D] mt-0.5" numberOfLines={1}>{userProfile.designation}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              <View>
                <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-widest mb-3 px-1">
                  Organization & Location
                </Text>
                <View className="bg-white border border-slate-100 rounded-[28px] p-5 shadow-xl shadow-slate-200/50 divide-y divide-slate-100">
                  <View className="py-3 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">Employment Type</Text>
                    <Text className="text-xs font-black text-[#1F1B3D]">{userProfile.employmentType}</Text>
                  </View>
                  <View className="py-3 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">Reporting Manager</Text>
                    <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>{userProfile.reportingManager}</Text>
                  </View>
                  <View className="py-3 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">Work Base</Text>
                    <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>{userProfile.workLocation}</Text>
                  </View>
                  <View className="py-3 flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-[#7A76A6]">Blood Group</Text>
                    <Text className="text-xs font-black text-rose-600">{userProfile.bloodGroup}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* 4. PAYSLIP VIEW                                                           */}
          {/* ========================================================================= */}
          {activeTab === "payslip" && (
            <View className="mb-10">
              {isAdmin && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate("SalaryView")}
                  className="flex-row items-center justify-between bg-[#EEECFA] border border-[#5B4FD1]/20 rounded-2xl px-4 py-3 mb-4"
                >
                  <Text className="text-xs font-black text-[#5B4FD1] uppercase tracking-wider">View all employees' salary</Text>
                  <ChevronRight size={16} color="#5B4FD1" />
                </TouchableOpacity>
              )}

              <MonthStepper month={payMonth} onChange={setPayMonth} />

              <View className="flex-row items-center justify-between bg-white border border-slate-100 rounded-3xl p-5 mb-3 shadow-xl shadow-slate-200/50">
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text className="text-sm font-black text-[#1F1B3D]">Salary statement</Text>
                  <Text className="text-xs font-bold text-[#7A76A6] mt-0.5">{monthLabel(payMonth)}</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleDownloadPdf(String(currentUserId), payMonth)}
                  disabled={pdfBusy}
                  style={{ opacity: pdfBusy ? 0.6 : 1 }}
                  className="flex-row items-center bg-[#5B4FD1] px-4 py-2.5 rounded-2xl shadow-md shadow-indigo-500/20"
                >
                  {pdfBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Download size={14} color="#FFFFFF" />}
                  <Text className="text-white font-black text-xs ml-1.5 uppercase tracking-wider">PDF</Text>
                </TouchableOpacity>
              </View>

              <PayslipView empId={String(currentUserId)} month={payMonth} mode="my" />
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}