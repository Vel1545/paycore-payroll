import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform } from "react-native";
import { ChevronLeft, ShieldCheck, Mail, RefreshCw, Search } from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";
import { BASE_HOST } from "../constants/config";
import { useAuth } from "../context/AuthContext";
import { UserSession } from "../services/UserSession";
import { useResponsive } from "../hooks/useResponsive";
import { WebPageHeader } from "../components/web/webUi";

type Row = {
  empId: string;
  name?: string;
  email?: string;
  designation?: string;
  department?: string;
  doj?: string;
  loginEnabled: boolean;
  exempt: boolean;
  acceptedCount: number;
  requiredCount: number;
  policyStatus: "ACCEPTED" | "PARTLY" | "PENDING" | "EXEMPT";
  acceptedAt?: string;
  signatureName?: string;
  deviceId?: string;
  mailStatus?: "SENT" | "FAILED" | "NO_EMAIL" | null;
  mailSentAt?: string;
  mailError?: string;
};

type Filter = "ALL" | "PENDING" | "ACCEPTED";

const fmt = (s?: string) => {
  if (!s) return "-";
  const d = new Date(s.replace(" ", "T"));
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
};
const fmtDay = (s?: string) => {
  if (!s) return "-";
  const d = new Date(s.substring(0, 10) + "T00:00:00");
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const POLICY_BADGE: Record<string, { text: string; box: string; label: string }> = {
  ACCEPTED: { text: "Accepted", box: "bg-emerald-50 border-emerald-200", label: "text-emerald-700" },
  PARTLY: { text: "Partly accepted", box: "bg-amber-50 border-amber-200", label: "text-amber-700" },
  PENDING: { text: "Not accepted", box: "bg-rose-50 border-rose-200", label: "text-rose-700" },
  EXEMPT: { text: "Exempt", box: "bg-slate-50 border-slate-200", label: "text-slate-600" },
};

// Admin: new joiners (date of joining on / after the policy start date) - login on/off, welcome mail and
// policy acceptance with the e-signature. Resend the welcome mail from here.
export default function PolicyAcceptanceReportScreen({ navigation }: { navigation?: any }) {
  const { isWebDesktop } = useResponsive();
  const { user } = useAuth();
  const myEmpId = String(user?.empId || user?.userId || UserSession.empId || "");
  const [rows, setRows] = useState<Row[]>([]);
  const [dojFrom, setDojFrom] = useState<string | null>(null);
  const [mode, setMode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  const notify = (t: string, m: string) => (Platform.OS === "web" ? window.alert(`${t}\n${m}`) : Alert.alert(t, m));
  const goBack = () => (navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate("AdminHub"));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_HOST}/api/admin/policies/acceptances`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || `HTTP ${res.status}`);
      setRows(j?.rows || []);
      setDojFrom(j?.dojFrom || null);
      setMode(j?.checkinMode || "");
    } catch (e: any) {
      notify("Could not load", e?.message || "Try again");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doResend = async (r: Row) => {
    setSending(r.empId);
    try {
      const res = await fetch(
        `${BASE_HOST}/api/admin/policies/welcome-mail/${encodeURIComponent(r.empId)}?adminEmpId=${encodeURIComponent(myEmpId)}`,
        { method: "POST" }
      );
      const j = await res.json().catch(() => ({}));
      notify(res.ok ? "Welcome mail sent" : "Mail not sent", j?.message || (res.ok ? "Sent." : `HTTP ${res.status}`));
      await load();
    } catch (e: any) {
      notify("Mail not sent", e?.message || "Try again");
    } finally {
      setSending(null);
    }
  };

  const resend = (r: Row) => {
    const msg = `Send the welcome mail (Employee ID + app link + login steps) to ${r.name || r.empId} at ${r.email || "-"}?`;
    if (Platform.OS === "web") {
      if (window.confirm(msg)) doResend(r);
    } else {
      Alert.alert("Welcome mail", msg, [{ text: "Cancel", style: "cancel" }, { text: "Send", onPress: () => doResend(r) }]);
    }
  };

  const shown = useMemo(() => {
    const text = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "ACCEPTED" && r.policyStatus !== "ACCEPTED") return false;
      if (filter === "PENDING" && (r.policyStatus === "ACCEPTED" || r.policyStatus === "EXEMPT")) return false;
      if (!text) return true;
      return `${r.empId} ${r.name || ""} ${r.department || ""}`.toLowerCase().includes(text);
    });
  }, [rows, filter, q]);

  const pendingCount = rows.filter((r) => r.policyStatus === "PENDING" || r.policyStatus === "PARTLY").length;
  const acceptedCount = rows.filter((r) => r.policyStatus === "ACCEPTED").length;
  const subtitle = dojFrom ? `New joiners from ${fmtDay(dojFrom)}` : "Policy screen is off (no start date)";

  return (
    <ScreenContainer
      webMaxWidth={1100}
      webHeader={<WebPageHeader title="Policy acceptance" subtitle={subtitle} onBack={navigation ? goBack : undefined} />}
    >
      <View className="px-4 pt-2 pb-8">
        {!isWebDesktop && (
          <View className="flex-row items-center mb-3">
            {navigation && (
              <TouchableOpacity
                onPress={goBack}
                className="w-10 h-10 rounded-2xl bg-white border border-[#E7E4F5] items-center justify-center mr-3"
              >
                <ChevronLeft size={18} color="#1F1B3D" />
              </TouchableOpacity>
            )}
            <View className="flex-1">
              <Text className="text-xl font-black text-[#1F1B3D]">Policy acceptance</Text>
              <Text className="text-xs font-bold text-[#7A76A6]">{subtitle}</Text>
            </View>
          </View>
        )}

        <View className="flex-row gap-2 mb-3">
          {[
            { k: "ALL" as Filter, label: `All (${rows.length})` },
            { k: "PENDING" as Filter, label: `Not accepted (${pendingCount})` },
            { k: "ACCEPTED" as Filter, label: `Accepted (${acceptedCount})` },
          ].map((f) => (
            <TouchableOpacity
              key={f.k}
              onPress={() => setFilter(f.k)}
              className={`px-3 py-2 rounded-xl border ${filter === f.k ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-white border-[#E7E4F5]"}`}
            >
              <Text className={`text-[11px] font-black ${filter === f.k ? "text-white" : "text-[#7A76A6]"}`}>{f.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={load}
            className="ml-auto w-9 h-9 rounded-xl bg-white border border-[#E7E4F5] items-center justify-center"
          >
            {loading ? <ActivityIndicator size="small" color="#5B4FD1" /> : <RefreshCw size={15} color="#5B4FD1" />}
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center bg-white border border-[#E7E4F5] rounded-xl px-3 mb-3">
          <Search size={14} color="#A6A2CE" />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search name, ID or department"
            placeholderTextColor="#A6A2CE"
            className="flex-1 py-2.5 px-2 text-xs font-semibold text-[#1F1B3D]"
          />
        </View>

        {!!mode && (
          <Text className="text-[10.5px] font-semibold text-[#7A76A6] mb-3">
            Check-in before accepting:{" "}
            {mode.toUpperCase() === "ENFORCE" ? "blocked" : mode.toUpperCase() === "LOG" ? "allowed (logged only)" : "allowed"}.
            Employees who joined before the start date are not asked.
          </Text>
        )}

        {!loading && shown.length === 0 && (
          <View className="bg-white border border-[#E7E4F5] rounded-2xl p-6 items-center">
            <ShieldCheck size={28} color="#A6A2CE" />
            <Text className="text-xs font-bold text-[#7A76A6] mt-2">No new joiners here.</Text>
          </View>
        )}

        {shown.map((r) => {
          const badge = POLICY_BADGE[r.policyStatus] || POLICY_BADGE.PENDING;
          const mailText =
            r.mailStatus === "SENT"
              ? `Sent ${fmt(r.mailSentAt)}`
              : r.mailStatus === "FAILED"
              ? `Failed: ${r.mailError || "mail server error"}`
              : r.mailStatus === "NO_EMAIL"
              ? "No e-mail address"
              : r.loginEnabled
              ? "Not sent"
              : "Sent when the login is switched on";
          return (
            <View key={r.empId} className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-3">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-black text-[#1F1B3D]">
                    {r.name || "-"} <Text className="text-[#5B4FD1]">• {r.empId}</Text>
                  </Text>
                  <Text className="text-[11px] font-semibold text-[#7A76A6] mt-0.5">
                    {[r.designation, r.department].filter(Boolean).join(" • ") || "-"} • Joined {fmtDay(r.doj)}
                  </Text>
                </View>
                <View className={`px-2 py-1 rounded-lg border ${badge.box}`}>
                  <Text className={`text-[10px] font-black ${badge.label}`}>{badge.text}</Text>
                </View>
              </View>

              <View className="mt-3 gap-1">
                <Text className="text-[11px] font-semibold text-[#1F1B3D]">
                  Login: <Text className={r.loginEnabled ? "text-emerald-700 font-black" : "text-slate-500 font-black"}>
                    {r.loginEnabled ? "On" : "Off"}
                  </Text>
                </Text>
                <Text className="text-[11px] font-semibold text-[#1F1B3D]">
                  Policies: {r.exempt ? "exempt" : `${Math.min(r.acceptedCount, r.requiredCount)} of ${r.requiredCount} accepted`}
                  {r.acceptedAt ? ` • ${fmt(r.acceptedAt)}` : ""}
                </Text>
                {!!r.signatureName && (
                  <Text className="text-[11px] font-semibold text-[#1F1B3D]">
                    E-signature: <Text className="font-black italic">{r.signatureName}</Text>
                    {r.deviceId ? <Text className="text-[#A6A2CE]"> • {r.deviceId}</Text> : null}
                  </Text>
                )}
                <Text
                  className={`text-[11px] font-semibold ${
                    r.mailStatus === "FAILED" || r.mailStatus === "NO_EMAIL" ? "text-[#E4453C]" : "text-[#1F1B3D]"
                  }`}
                >
                  Welcome mail: {mailText}
                  {r.email ? <Text className="text-[#7A76A6]"> • {r.email}</Text> : null}
                </Text>
              </View>

              {r.loginEnabled && (
                <TouchableOpacity
                  onPress={() => resend(r)}
                  disabled={sending === r.empId}
                  className="mt-3 self-start flex-row items-center border border-[#5B4FD1]/30 rounded-xl px-3 py-2 active:opacity-80"
                >
                  {sending === r.empId ? (
                    <ActivityIndicator size="small" color="#5B4FD1" />
                  ) : (
                    <>
                      <Mail size={13} color="#5B4FD1" />
                      <Text className="text-[11px] font-black text-[#5B4FD1] ml-1.5">
                        {r.mailStatus === "SENT" ? "Resend welcome mail" : "Send welcome mail"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    </ScreenContainer>
  );
}
