import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShieldCheck, ChevronDown, ChevronUp, CheckSquare, Square, LogOut, PenLine } from "lucide-react-native";
import { BASE_HOST } from "../constants/config";
import { getOrCreateDeviceId } from "../utils/authStorage";
import { installedApp } from "../services/appUpdate";

type Policy = {
  id: number;
  code: string;
  title: string;
  category?: string;
  summary?: string;
  body: string;
  version: number;
  mandatory: boolean;
  accepted: boolean;
};

interface Props {
  empId: string;
  onAccepted: () => void;
  onLogout: () => void;
}

// First login of a new joiner: read every company policy, tick it, sign with the full name, then the app opens.
// No back / skip. The server decides who must see it (date of joining) and keeps the signed record.
export default function PolicyAcceptanceScreen({ empId, onAccepted, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [employeeName, setEmployeeName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [opened, setOpened] = useState<Record<number, boolean>>({});
  const [ticked, setTicked] = useState<Record<number, boolean>>({});
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${BASE_HOST}/api/policies/status?empId=${encodeURIComponent(empId)}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "Could not load the company policies.");
      if (j?.required === false) {
        onAccepted();
        return;
      }
      // only the policies still waiting for this employee
      setPolicies((j?.policies || []).filter((p: Policy) => !p.accepted));
      setEmployeeName(j?.employeeName || "");
      setCompanyName(j?.companyName || "");
    } catch (e: any) {
      setLoadError(e?.message || "No connection. Please check the internet and try again.");
    } finally {
      setLoading(false);
    }
  }, [empId, onAccepted]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleOpen = (id: number) => {
    setOpen((o) => ({ ...o, [id]: !o[id] }));
    setOpened((o) => ({ ...o, [id]: true }));
  };

  const toggleTick = (p: Policy) => {
    if (!opened[p.id]) {
      setMsg(`Please open and read "${p.title}" first.`);
      return;
    }
    setMsg(null);
    setTicked((t) => ({ ...t, [p.id]: !t[p.id] }));
  };

  const mandatoryLeft = policies.filter((p) => p.mandatory && !ticked[p.id]).length;
  const canSubmit = !busy && policies.length > 0 && mandatoryLeft === 0 && signature.trim().length >= 2;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setMsg(null);
    try {
      const deviceId = await getOrCreateDeviceId().catch(() => "");
      const app = installedApp();
      const res = await fetch(`${BASE_HOST}/api/policies/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId,
          signatureName: signature.trim(),
          accepted: policies.filter((p) => ticked[p.id]).map((p) => ({ id: p.id, version: p.version })),
          deviceId,
          appBuild: app.build ? String(app.build) : Platform.OS,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.status === "FAILED") throw new Error(j?.message || "Could not save. Please try again.");
      if (j?.required) {
        // a policy changed while reading: show the new list
        setMsg("A policy was updated. Please read the updated policy and accept again.");
        setTicked({});
        setOpened({});
        await load();
        return;
      }
      onAccepted();
    } catch (e: any) {
      setMsg(e?.message || "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#F6F5FC]">
        <ActivityIndicator size="large" color="#5B4FD1" />
        <Text className="text-xs font-bold text-[#7A76A6] mt-3">Loading company policies...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="flex-1 justify-center items-center bg-[#F6F5FC] px-8">
        <ShieldCheck size={40} color="#5B4FD1" />
        <Text className="text-base font-black text-[#1F1B3D] mt-3 text-center">Company policies</Text>
        <Text className="text-xs font-semibold text-[#7A76A6] mt-2 text-center">{loadError}</Text>
        <TouchableOpacity onPress={load} className="bg-[#5B4FD1] rounded-xl px-6 py-3 mt-5 active:opacity-90">
          <Text className="text-white font-black text-xs uppercase tracking-wider">Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onLogout} className="mt-4">
          <Text className="text-xs font-bold text-[#7A76A6]">Log out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-[#F6F5FC]" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-2xl self-center">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <ShieldCheck size={22} color="#5B4FD1" />
              <Text className="text-lg font-black text-[#1F1B3D] ml-2">Company Policies</Text>
            </View>
            <TouchableOpacity onPress={onLogout} className="flex-row items-center px-2 py-1">
              <LogOut size={14} color="#7A76A6" />
              <Text className="text-[11px] font-bold text-[#7A76A6] ml-1">Log out</Text>
            </TouchableOpacity>
          </View>

          <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mb-4">
            <Text className="text-sm font-black text-[#1F1B3D]">
              Welcome{employeeName ? `, ${employeeName}` : ""}!
            </Text>
            <Text className="text-xs font-semibold text-[#7A76A6] mt-1.5 leading-5">
              Before you start, please read the {companyName || "company"} policies below. Open each policy, tick "I have
              read and agree", then type your full name as your e-signature. You can check in after accepting.
            </Text>
          </View>

          {policies.map((p, i) => {
            const isOpen = !!open[p.id];
            const isTicked = !!ticked[p.id];
            return (
              <View
                key={p.id}
                className={`bg-white rounded-2xl mb-3 border ${isTicked ? "border-emerald-300" : "border-[#E7E4F5]"}`}
              >
                <TouchableOpacity onPress={() => toggleOpen(p.id)} className="flex-row items-center p-4" activeOpacity={0.8}>
                  <View className="flex-1 pr-2">
                    <Text className="text-[10px] font-black text-[#5B4FD1] uppercase tracking-wider">
                      {i + 1}. {p.category || "Policy"}
                    </Text>
                    <Text className="text-sm font-black text-[#1F1B3D] mt-0.5">{p.title}</Text>
                    {!!p.summary && <Text className="text-[11px] font-semibold text-[#7A76A6] mt-0.5">{p.summary}</Text>}
                  </View>
                  {isOpen ? <ChevronUp size={18} color="#7A76A6" /> : <ChevronDown size={18} color="#7A76A6" />}
                </TouchableOpacity>

                {isOpen && (
                  <View className="px-4 pb-3">
                    <View className="bg-[#F6F5FC] rounded-xl p-3">
                      <Text className="text-xs font-medium text-[#1F1B3D] leading-5">{p.body}</Text>
                    </View>
                    <Text className="text-[10px] font-semibold text-[#A6A2CE] mt-1.5">
                      {p.code} - version {p.version}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => toggleTick(p)}
                  className="flex-row items-center px-4 py-3 border-t border-[#F1EFFB]"
                  activeOpacity={0.8}
                >
                  {isTicked ? <CheckSquare size={18} color="#059669" /> : <Square size={18} color={opened[p.id] ? "#5B4FD1" : "#CBD5E1"} />}
                  <Text className={`text-xs font-bold ml-2 ${opened[p.id] ? "text-[#1F1B3D]" : "text-slate-400"}`}>
                    I have read and agree{p.mandatory ? "" : " (optional)"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 mt-1">
            <View className="flex-row items-center mb-1">
              <PenLine size={14} color="#5B4FD1" />
              <Text className="text-xs font-black text-[#5B4FD1] ml-1.5">E-signature</Text>
            </View>
            <Text className="text-[11px] font-semibold text-[#7A76A6] mb-2">
              Type your full name{employeeName ? ` exactly as: ${employeeName}` : ""}. This is recorded with the date, time and
              this phone as your acceptance.
            </Text>
            <TextInput
              value={signature}
              onChangeText={setSignature}
              placeholder="Your full name"
              placeholderTextColor="#A6A2CE"
              autoCapitalize="words"
              autoCorrect={false}
              className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-sm font-bold text-[#1F1B3D]"
            />

            {mandatoryLeft > 0 && (
              <Text className="text-[11px] font-bold text-amber-700 mt-2">
                {mandatoryLeft} {mandatoryLeft === 1 ? "policy" : "policies"} still to accept.
              </Text>
            )}
            {!!msg && <Text className="text-[11px] font-bold text-[#E4453C] mt-2">{msg}</Text>}

            <TouchableOpacity
              onPress={submit}
              disabled={!canSubmit}
              className={`rounded-xl py-3.5 mt-3 items-center ${canSubmit ? "bg-[#5B4FD1] active:opacity-90" : "bg-slate-300"}`}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-black text-xs uppercase tracking-wider">Accept & continue</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
