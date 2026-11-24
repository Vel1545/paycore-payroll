import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform, Modal, Linking } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { ChevronLeft, Database, Trash2, Download, RefreshCw, Lock, CheckCircle2, AlertTriangle, X } from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";
import { BASE_HOST } from "../constants/config";
import { withAuthToken } from "../services/apiAuth";
import { UserSession } from "../services/UserSession";
import { useResponsive } from "../hooks/useResponsive";
import { WebPageHeader } from "../components/web/webUi";

const API = `${BASE_HOST}/api/admin/retention`;

type Dataset = "LOCATION" | "PUNCH";
type MonthRow = {
  month: string; label: string; confirmText: string; rows: number; people: number; points: number;
  deletable: boolean; lockedReason?: string | null;
};
type Job = {
  id: number; dataset: Dataset; month: string; mode: "MANUAL" | "AUTO"; status: "RUNNING" | "DONE" | "FAILED";
  step?: string; rowsFound?: number; rowsDeleted?: number; points?: number;
  hasExcel?: boolean; excelBytes?: number; hasSql?: boolean; sqlBytes?: number;
  message?: string; startedBy?: string; startedAt?: string; finishedAt?: string;
};

const notify = (t: string, m: string) => (Platform.OS === "web" ? window.alert(`${t}\n\n${m}`) : Alert.alert(t, m));
const mb = (b?: number) => (b == null ? "-" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`);
const num = (n?: number) => Number(n || 0).toLocaleString("en-IN");
const when = (s?: string) => {
  if (!s) return "-";
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? s : d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
};
const monthNice = (ym: string) => {
  const d = new Date(`${ym}-01T00:00:00`);
  return isNaN(d.getTime()) ? ym : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || (j && j.success === false)) throw new Error(j?.message || `Request failed (${res.status})`);
  return j;
}

// Admin only: old location traces / raw punch events -> backup to S3 (Excel + SQL) and delete, by whole month.
export default function DataRetentionScreen({ navigation }: { navigation?: any }) {
  const { isWebDesktop } = useResponsive();
  const adminEmpId = String(UserSession.empId || "");
  const q = `adminEmpId=${encodeURIComponent(adminEmpId)}`;
  const goBack = () => (navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate("AdminHub"));

  const [dataset, setDataset] = useState<Dataset>("LOCATION");
  const [info, setInfo] = useState<any>(null);
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [backups, setBackups] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmFor, setConfirmFor] = useState<MonthRow | null>(null);
  const [typed, setTyped] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const pollRef = useRef<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, b] = await Promise.all([
        call(`${API}/months?dataset=${dataset}&${q}`),
        call(`${API}/backups?dataset=${dataset}&${q}`),
      ]);
      setInfo(m);
      setMonths(Array.isArray(m?.months) ? m.months : []);
      setBackups(Array.isArray(b) ? b : []);
    } catch (e: any) {
      notify("Could not load", e.message);
    } finally {
      setLoading(false);
    }
  }, [dataset, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => clearInterval(pollRef.current), []);

  const poll = (id: number) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const j: Job = await call(`${API}/jobs/${id}?${q}`);
        setJob(j);
        if (j.status !== "RUNNING") {
          clearInterval(pollRef.current);
          load();
        }
      } catch {
        /* keep polling; a slow server answers later */
      }
    }, 2000);
  };

  const startDelete = async () => {
    if (!confirmFor) return;
    if (typed.trim().toUpperCase() !== confirmFor.confirmText) {
      notify("Type to confirm", `Type ${confirmFor.confirmText} exactly to confirm.`);
      return;
    }
    try {
      const j: Job = await call(`${API}/delete?${q}`, {
        method: "POST",
        body: JSON.stringify({ dataset, month: confirmFor.month, confirm: typed.trim(), adminEmpId }),
      });
      setConfirmFor(null);
      setTyped("");
      setJob(j);
      poll(j.id);
    } catch (e: any) {
      notify("Could not start", e.message);
    }
  };

  const download = async (b: Job, type: "excel" | "sql") => {
    const url = withAuthToken(`${API}/backups/${b.id}/file?type=${type}&${q}`);
    if (Platform.OS === "web") {
      window.open(url, "_blank");
      return;
    }
    try {
      // token in the link, not a header: the server redirects to S3, which must not get our login header
      const name = `${dataset === "LOCATION" ? "LocationTracking" : "PunchEvents"}_${b.month}.${type === "sql" ? "sql" : "xlsx"}`;
      const out = await FileSystem.downloadAsync(url, `${FileSystem.cacheDirectory}${Date.now()}_${name}`);
      if (out.status !== 200) throw new Error(`HTTP ${out.status}`);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(out.uri, { dialogTitle: name });
      else await Linking.openURL(url);
    } catch (e: any) {
      notify("Download failed", e?.message || "Try again");
    }
  };

  const running = job?.status === "RUNNING" || !!info?.running;

  return (
    <ScreenContainer webMaxWidth={1000}
      webHeader={<WebPageHeader title="Old Data & Backups" subtitle="Backup to S3 (Excel + SQL), then delete" onBack={navigation ? goBack : undefined} />}>
      <View className="px-4 pt-2 pb-10">
        {!isWebDesktop && (
          <View className="flex-row items-center mb-3">
            {navigation && (
              <TouchableOpacity onPress={goBack} className="w-10 h-10 rounded-2xl bg-white border border-[#E7E4F5] items-center justify-center mr-3">
                <ChevronLeft size={18} color="#1F1B3D" />
              </TouchableOpacity>
            )}
            <View className="flex-1">
              <Text className="text-xl font-black text-[#1F1B3D]">Old Data & Backups</Text>
              <Text className="text-xs font-bold text-[#7A76A6]">Backup to S3 (Excel + SQL), then delete</Text>
            </View>
          </View>
        )}

        {/* dataset tabs */}
        <View className="flex-row bg-[#EEECFA]/70 p-1.5 rounded-2xl border border-[#E7E4F5] mb-3">
          {([["LOCATION", "Location tracking"], ["PUNCH", "Punch events"]] as [Dataset, string][]).map(([k, l]) => (
            <TouchableOpacity key={k} onPress={() => { setDataset(k); setJob(null); }}
              className={`flex-1 py-2.5 rounded-xl items-center ${dataset === k ? "bg-[#5B4FD1]" : ""}`}>
              <Text className={`text-xs font-black ${dataset === k ? "text-white" : "text-[#7A76A6]"}`}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* rules */}
        <View className="bg-white border border-[#E7E4F5] rounded-2xl p-3.5 mb-3">
          <Text className="text-[11px] font-black text-[#1F1B3D] mb-1">How it works</Text>
          <Text className="text-[11px] font-semibold text-[#7A76A6] leading-4">
            • Delete works on a whole month, {info?.lastDeletableMonth ? `${monthNice(info.lastDeletableMonth)} and older` : "two months back and older"} (the current and previous month are kept).{"\n"}
            • Before anything is deleted, an Excel and a SQL backup are saved to S3 and checked. If the backup fails, nothing is deleted.{"\n"}
            • Automatic: {info?.autoEnabled ? `on the 1st of each month, ${info?.autoNextDeletes || ""}` : "turned off on the server"} - with the same backup.{"\n"}
            • {dataset === "LOCATION"
              ? "Deleting location data removes old routes from Live Tracking history. Attendance, salary and allowances are not affected."
              : "Raw punch log only. Daily attendance records (check-in / check-out, payroll) are never deleted."}
          </Text>
        </View>

        {/* running / last job */}
        {job && (
          <View className={`rounded-2xl p-3.5 mb-3 border ${job.status === "FAILED" ? "bg-rose-50 border-rose-200" : job.status === "DONE" ? "bg-emerald-50 border-emerald-200" : "bg-[#EEECFA] border-[#D9D5F2]"}`}>
            <View className="flex-row items-center">
              {job.status === "RUNNING" ? <ActivityIndicator size="small" color="#5B4FD1" />
                : job.status === "DONE" ? <CheckCircle2 size={16} color="#059669" /> : <AlertTriangle size={16} color="#E11D48" />}
              <Text className="text-xs font-black text-[#1F1B3D] ml-2 flex-1">
                {monthNice(job.month)} • {job.status === "RUNNING" ? job.step || "Working..." : job.status === "DONE" ? "Finished" : "Stopped"}
              </Text>
            </View>
            <Text className="text-[11px] font-semibold text-[#7A76A6] mt-1">
              {job.message || `Rows: ${num(job.rowsFound)} • deleted: ${num(job.rowsDeleted)}`}
            </Text>
          </View>
        )}

        {/* months */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-black text-[#1F1B3D]">Months with data</Text>
          <TouchableOpacity onPress={load} className="flex-row items-center px-3 py-1.5 rounded-xl bg-white border border-[#E7E4F5]">
            {loading ? <ActivityIndicator size="small" color="#5B4FD1" /> : <RefreshCw size={13} color="#5B4FD1" />}
            <Text className="text-[11px] font-black text-[#5B4FD1] ml-1.5">Refresh</Text>
          </TouchableOpacity>
        </View>
        {months.length === 0 && !loading && (
          <Text className="text-xs font-semibold text-[#A6A2CE] mb-3">No {dataset === "LOCATION" ? "location" : "punch event"} data stored.</Text>
        )}
        {months.map((m) => (
          <View key={m.month} className="bg-white border border-[#E7E4F5] rounded-2xl p-3.5 mb-2 flex-row items-center">
            <View className="w-9 h-9 rounded-xl bg-[#EEECFA] items-center justify-center mr-3">
              <Database size={16} color="#5B4FD1" />
            </View>
            <View className="flex-1 pr-2">
              <Text className="text-sm font-black text-[#1F1B3D]">{m.label}</Text>
              <Text className="text-[11px] font-semibold text-[#7A76A6]">
                {dataset === "LOCATION"
                  ? `${num(m.people)} employee(s) • ${num(m.rows)} day(s) • ${num(m.points)} point(s)`
                  : `${num(m.people)} employee(s) • ${num(m.rows)} punch(es)`}
              </Text>
            </View>
            {m.deletable ? (
              <TouchableOpacity onPress={() => { setConfirmFor(m); setTyped(""); }} disabled={running}
                className="flex-row items-center px-3 py-2 rounded-xl bg-rose-600" style={{ opacity: running ? 0.5 : 1 }}>
                <Trash2 size={13} color="#FFFFFF" />
                <Text className="text-[11px] font-black text-white ml-1.5">Backup & delete</Text>
              </TouchableOpacity>
            ) : (
              <View className="flex-row items-center px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                <Lock size={12} color="#94A3B8" />
                <Text className="text-[10px] font-black text-slate-500 ml-1">Kept</Text>
              </View>
            )}
          </View>
        ))}

        {/* backups */}
        <Text className="text-sm font-black text-[#1F1B3D] mt-4 mb-2">Backups & history</Text>
        {backups.length === 0 && <Text className="text-xs font-semibold text-[#A6A2CE]">No backup yet.</Text>}
        {backups.map((b) => (
          <View key={b.id} className="bg-white border border-[#E7E4F5] rounded-2xl p-3.5 mb-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-black text-[#1F1B3D]">{monthNice(b.month)}</Text>
              <View className={`px-2 py-0.5 rounded-md ${b.status === "DONE" ? "bg-emerald-50" : b.status === "FAILED" ? "bg-rose-50" : "bg-[#EEECFA]"}`}>
                <Text className={`text-[9.5px] font-black ${b.status === "DONE" ? "text-emerald-700" : b.status === "FAILED" ? "text-rose-600" : "text-[#5B4FD1]"}`}>
                  {b.mode === "AUTO" ? "AUTO • " : ""}{b.status}
                </Text>
              </View>
            </View>
            <Text className="text-[10.5px] font-semibold text-[#7A76A6] mt-0.5">
              {when(b.startedAt)} • by {b.startedBy || "-"} • {num(b.rowsDeleted)} of {num(b.rowsFound)} row(s) deleted
            </Text>
            {!!b.message && <Text className="text-[10.5px] font-semibold text-[#7A76A6]" numberOfLines={2}>{b.message}</Text>}
            {(b.hasExcel || b.hasSql) && (
              <View className="flex-row gap-2 mt-2">
                {b.hasExcel && (
                  <TouchableOpacity onPress={() => download(b, "excel")} className="flex-row items-center px-3 py-1.5 rounded-lg bg-[#5B4FD1]">
                    <Download size={12} color="#FFFFFF" />
                    <Text className="text-[10.5px] font-black text-white ml-1">Excel ({mb(b.excelBytes)})</Text>
                  </TouchableOpacity>
                )}
                {b.hasSql && (
                  <TouchableOpacity onPress={() => download(b, "sql")} className="flex-row items-center px-3 py-1.5 rounded-lg bg-white border border-[#5B4FD1]/40">
                    <Download size={12} color="#5B4FD1" />
                    <Text className="text-[10.5px] font-black text-[#5B4FD1] ml-1">SQL ({mb(b.sqlBytes)})</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ))}
      </View>

      {/* confirm */}
      <Modal visible={!!confirmFor} transparent animationType="fade" onRequestClose={() => setConfirmFor(null)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="w-full max-w-md bg-white rounded-3xl p-5">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-base font-black text-[#1F1B3D]">Backup & delete</Text>
              <TouchableOpacity onPress={() => setConfirmFor(null)}><X size={18} color="#7A76A6" /></TouchableOpacity>
            </View>
            {confirmFor && (
              <>
                <Text className="text-xs font-semibold text-[#1F1B3D] leading-5">
                  All {dataset === "LOCATION" ? "location tracking" : "punch event"} data of <Text className="font-black">{confirmFor.label}</Text> will
                  be deleted ({num(confirmFor.rows)} row(s){dataset === "LOCATION" ? `, ${num(confirmFor.points)} point(s)` : ""}).
                  An Excel and a SQL backup are saved to S3 first; if the backup fails, nothing is deleted. This cannot be undone in the app.
                </Text>
                <Text className="text-[11px] font-black text-[#1F1B3D] mt-3 mb-1">Type {confirmFor.confirmText} to confirm</Text>
                <TextInput value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false}
                  placeholder={confirmFor.confirmText} placeholderTextColor="#C9C4EA"
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-2.5 text-sm font-black text-[#1F1B3D] mb-4" />
                <TouchableOpacity onPress={startDelete}
                  disabled={typed.trim().toUpperCase() !== confirmFor.confirmText}
                  className={`rounded-xl py-3 items-center ${typed.trim().toUpperCase() === confirmFor.confirmText ? "bg-rose-600" : "bg-rose-200"}`}>
                  <Text className="text-white text-xs font-black uppercase">Back up and delete {confirmFor.label}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
