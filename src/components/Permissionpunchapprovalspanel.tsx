import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform, TextInput, Modal, Switch, Linking, ScrollView,
} from "react-native";
import { RotateCw, MapPin, AlertCircle, CheckCircle2 } from "lucide-react-native";
import { BASE_HOST } from "../constants/config";

interface Punch {
  id: string;
  empId: string;
  empName: string;
  date: string;
  kind: "PERMISSION" | "OD";
  purpose?: string;
  status: string;
  startTime: string;
  endTime?: string | null;
  startMap?: string | null;
  endMap?: string | null;
  mockLocation?: boolean;
  missingEnd?: boolean;
  closeReason?: string;
  actualMinutes?: number;
  chargedMinutes?: number;
  approvedMinutes?: number | null;
  penaltyMinutes?: number | null;
  workMinutes?: number | null;
  penaltyInr?: number | null;
  penaltyWaived?: boolean;
  decidedBy?: string | null;
  adminNote?: string | null;
  suggestedApprovedMinutes?: number;
  balanceHours?: number;
}

const API = `${BASE_HOST}/api/admin/permission-punches`;

const notify = (title: string, msg: string) =>
  Platform.OS === "web" ? window.alert(`${title}: ${msg}`) : Alert.alert(title, msg);

// "2026-10-30 10:05:00.0" -> "10:05 AM"
const clock = (t?: string | null) => {
  if (!t) return "-";
  const m = /(\d{2}):(\d{2})/.exec(t.replace("T", " ").split(" ")[1] || "");
  if (!m) return t;
  const h = Number(m[1]);
  return `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, "0")}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
};

const REASONS: Record<string, string> = {
  AUTO_CHECKOUT: "Ended by check-out",
  AUTO_CHECKIN: "Ended by check-in",
  AUTO_NEXT_DAY: "Closed next day",
};

/**
 * Admin list of punched permissions / ODs. Verify the time and location, set the approved minutes, approve.
 * No outer ScrollView: it sits inside the Approvals screen, like the check-out panel.
 */
export default function Permissionpunchapprovalspanel({
  adminId,
  kind,
  onChanged,
  highlightId,
}: {
  adminId: string;
  kind: "PERMISSION" | "OD"; // which tab this panel sits in
  onChanged?: () => void;
  highlightId?: string | null;
}) {
  const [filter, setFilter] = useState<"PENDING" | "APPROVED">("PENDING");
  const [all, setAll] = useState<Punch[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [active, setActive] = useState<Punch | null>(null);
  const [minutes, setMinutes] = useState("");
  const [penMinutes, setPenMinutes] = useState("");
  const [waive, setWaive] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}?status=ALL`, { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setAll(Array.isArray(d) ? d : []);
      }
    } catch {
      // keep the last list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // opened from a notification: show the waiting list
  useEffect(() => {
    if (highlightId) setFilter("PENDING");
  }, [highlightId]);

  const mine = all.filter((p: Punch) => p.kind === kind && p.status !== "VOID");
  const items = mine.filter((p: Punch) => p.status === filter);

  const open = (p: Punch) => {
    setActive(p);
    const ch = p.chargedMinutes ?? 0;
    const ac = p.actualMinutes ?? ch;
    const perm = p.approvedMinutes ?? (p.kind === "OD" ? ch : Math.min(ch, p.suggestedApprovedMinutes ?? ch));
    setMinutes(String(perm));
    setPenMinutes(String(p.approvedMinutes != null ? (p.penaltyMinutes ?? 0) : Math.max(0, ac - perm)));
    setWaive(!!p.penaltyWaived);
    setNote(p.adminNote || "");
    setError("");
  };

  const charged = active?.chargedMinutes ?? 0;
  const actual = active?.actualMinutes ?? charged;
  const maxTotal = Math.max(charged, actual);
  const approvedNum = Math.max(0, parseInt(minutes || "0", 10) || 0);
  const penaltyMin = active?.kind === "PERMISSION" ? Math.max(0, parseInt(penMinutes || "0", 10) || 0) : 0;
  const penaltyInr = waive ? 0 : Math.ceil(penaltyMin / 15) * 50;
  // time that is neither permission nor penalty counts as working time
  const workMin = active?.kind === "PERMISSION" ? Math.max(0, actual - approvedNum - penaltyMin) : 0;

  // changing the permission minutes re-fills the penalty with the rest of the real time (the admin can still edit it)
  const setPermission = (v: string) => {
    const n = Math.min(charged, parseInt(v || "0", 10) || 0);
    setMinutes(v === "" ? "" : String(n));
    if (active?.kind === "PERMISSION") setPenMinutes(String(Math.max(0, actual - n)));
  };

  const submit = async () => {
    if (!active) return;
    const n = parseInt(minutes || "", 10);
    if (isNaN(n) || n < 0 || n > charged) {
      setError(`Permission minutes must be between 0 and ${charged}.`);
      return;
    }
    if (active.kind === "PERMISSION" && n + penaltyMin > maxTotal) {
      setError(`Permission + penalty minutes cannot be more than ${maxTotal}.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/${active.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminName: adminId, approvedMinutes: n, penaltyMinutes: active.kind === "PERMISSION" ? penaltyMin : 0, waivePenalty: waive, note: note.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.status === "FAILED") throw new Error(j?.message || "Could not save the decision.");
      setActive(null);
      notify("Saved", `${active.empName || active.empId}: ${n} min approved${j?.penaltyInr ? `, penalty Rs ${j.penaltyInr}` : ""}.`);
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e?.message || "Could not save the decision.");
    } finally {
      setBusy(false);
    }
  };

  const openMap = (url?: string | null) => {
    if (!url) return;
    if (Platform.OS === "web") window.open(url, "_blank");
    else Linking.openURL(url);
  };

  // nothing of this kind has ever been punched (or the new system is off): keep the old screen exactly as it was
  if (!loading && mine.length === 0) return null;

  return (
    <View className="mb-4">
      <Text className="text-[11px] font-black text-[#1F1B3D] uppercase tracking-wider mb-2">
        Punched {kind === "OD" ? "OD" : "permission"} (Start / End)
      </Text>
      {/* Pending / Approved + refresh */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row bg-white border border-[#E7E4F5] p-1 rounded-xl">
          {(["PENDING", "APPROVED"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg ${filter === f ? "bg-[#5B4FD1]" : ""}`}
            >
              <Text className={`text-[11px] font-black ${filter === f ? "text-white" : "text-[#7A76A6]"}`}>
                {f === "PENDING" ? "To verify" : "Verified"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={load} className="w-9 h-9 bg-white border border-[#E7E4F5] rounded-xl items-center justify-center">
          {loading ? <ActivityIndicator size="small" color="#5B4FD1" /> : <RotateCw size={15} color="#5B4FD1" />}
        </TouchableOpacity>
      </View>

      {!loading && items.length === 0 && (
        <Text className="text-xs font-bold text-[#7A76A6] text-center mt-8">
          {filter === "PENDING" ? "Nothing waiting for verification." : "No verified punches yet."}
        </Text>
      )}

      {items.map((p: Punch) => (
        <TouchableOpacity
          key={p.id}
          activeOpacity={0.85}
          onPress={() => open(p)}
          className={`bg-white border rounded-2xl p-4 mb-3 ${highlightId === p.id ? "border-[#5B4FD1] border-2" : "border-[#E7E4F5]"}`}
        >
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-sm font-black text-[#1F1B3D] flex-1" numberOfLines={1}>
              {p.empName || p.empId} <Text className="text-[11px] font-bold text-[#7A76A6]">({p.empId})</Text>
            </Text>
            <View className={`px-2.5 py-1 rounded-full border ${p.kind === "OD" ? "bg-sky-50 border-sky-200" : "bg-[#EEECFA] border-[#5B4FD1]/30"}`}>
              <Text className={`text-[9px] font-black ${p.kind === "OD" ? "text-sky-700" : "text-[#5B4FD1]"}`}>{p.kind}</Text>
            </View>
          </View>
          <Text className="text-xs font-bold text-[#7A76A6]">
            {p.date} • {clock(p.startTime)} to {clock(p.endTime)}
          </Text>
          <Text className="text-xs font-black text-[#1F1B3D] mt-1">
            Counted: {p.chargedMinutes ?? 0} min
            <Text className="text-[#7A76A6] font-bold"> (real {p.actualMinutes ?? 0} min)</Text>
            {p.status === "APPROVED" ? (
              <Text className="text-emerald-700"> • Approved {p.approvedMinutes ?? 0} min{p.penaltyInr ? `, penalty Rs ${p.penaltyInr}` : ""}</Text>
            ) : null}
          </Text>
          {p.kind === "OD" && !!p.purpose && <Text className="text-[11px] font-semibold text-[#7A76A6] mt-1">Purpose: {p.purpose}</Text>}
          <View className="flex-row flex-wrap gap-1.5 mt-2">
            {p.missingEnd && (
              <View className="flex-row items-center bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                <AlertCircle size={10} color="#B45309" />
                <Text className="text-[9px] font-black text-amber-700 ml-1">No end punch</Text>
              </View>
            )}
            {!!p.closeReason && p.closeReason !== "USER" && (
              <View className="bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                <Text className="text-[9px] font-black text-slate-600">{REASONS[p.closeReason] || p.closeReason}</Text>
              </View>
            )}
            {p.mockLocation && (
              <View className="bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
                <Text className="text-[9px] font-black text-rose-700">Fake location</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}

      {/* Decision */}
      <Modal visible={!!active} transparent animationType="fade" onRequestClose={() => setActive(null)}>
        <View className="flex-1 bg-black/40 justify-center items-center p-4">
          {active && (
            <View className="w-full max-w-md bg-white rounded-3xl p-5 border border-[#E7E4F5] max-h-[90%]">
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text className="text-base font-black text-[#1F1B3D]">{active.empName || active.empId}</Text>
                <Text className="text-xs font-bold text-[#7A76A6] mb-3">
                  {active.kind} • {active.date} • {clock(active.startTime)} to {clock(active.endTime)}
                </Text>

                <View className="bg-[#F6F5FC] rounded-2xl p-3 gap-1 mb-3">
                  <Text className="text-xs font-bold text-[#7A76A6]">
                    Counted: <Text className="text-[#1F1B3D]">{charged} min</Text> (real {active.actualMinutes ?? 0} min)
                  </Text>
                  {active.kind === "PERMISSION" && (
                    <Text className="text-xs font-bold text-[#7A76A6]">
                      Paid permission left this month: <Text className="text-[#1F1B3D]">{Number(active.balanceHours ?? 0).toFixed(2)} hr</Text>
                    </Text>
                  )}
                  {!!active.purpose && <Text className="text-xs font-bold text-[#7A76A6]">Purpose: <Text className="text-[#1F1B3D]">{active.purpose}</Text></Text>}
                  <View className="flex-row gap-3 mt-1">
                    {active.startMap && (
                      <TouchableOpacity onPress={() => openMap(active.startMap)} className="flex-row items-center">
                        <MapPin size={12} color="#5B4FD1" />
                        <Text className="text-[11px] font-black text-[#5B4FD1] ml-1">Start location</Text>
                      </TouchableOpacity>
                    )}
                    {active.endMap && (
                      <TouchableOpacity onPress={() => openMap(active.endMap)} className="flex-row items-center">
                        <MapPin size={12} color="#5B4FD1" />
                        <Text className="text-[11px] font-black text-[#5B4FD1] ml-1">End location</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {active.missingEnd && <Text className="text-[11px] font-black text-amber-700">No end punch: the end time is the {REASONS[active.closeReason || ""]?.toLowerCase() || "automatic close"}.</Text>}
                  {active.mockLocation && <Text className="text-[11px] font-black text-rose-700">Fake location was detected on this punch.</Text>}
                </View>

                <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">
                  {active.kind === "OD" ? "OD minutes" : "Permission minutes"} (0 to {charged})
                </Text>
                <TextInput
                  value={minutes}
                  onChangeText={(v: string) => setPermission(v.replace(/[^0-9]/g, ""))}
                  keyboardType="numeric"
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-sm font-black text-[#5B4FD1]"
                />
                {active.kind === "PERMISSION" && (
                  <View className="flex-row flex-wrap gap-2 mt-2 mb-3">
                    {[
                      { label: `All permission (${charged})`, v: charged },
                      ...(actual > 0 && actual < charged ? [{ label: `All penalty (${actual} min)`, v: 0 }] : [{ label: "All penalty", v: 0 }]),
                    ].map((c) => (
                      <TouchableOpacity key={c.label} onPress={() => setPermission(String(c.v))} className="bg-[#EEECFA] border border-[#5B4FD1]/30 rounded-lg px-2.5 py-1.5">
                        <Text className="text-[10px] font-black text-[#5B4FD1]">{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {active.kind === "PERMISSION" && (
                  <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                    <Text className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1.5">Penalty minutes</Text>
                    <TextInput
                      value={penMinutes}
                      onChangeText={(v: string) => setPenMinutes(v.replace(/[^0-9]/g, ""))}
                      keyboardType="numeric"
                      className="bg-white border border-amber-200 rounded-xl p-3 text-sm font-black text-amber-800"
                    />
                    <View className="flex-row items-center justify-between mt-2">
                      <Text className="text-xs font-black text-amber-800">
                        {penaltyMin} min = Rs {penaltyInr}
                      </Text>
                      <View className="flex-row items-center">
                        <Text className="text-[11px] font-bold text-amber-800 mr-2">Waive</Text>
                        <Switch value={waive} onValueChange={setWaive} trackColor={{ false: "#CBD5E1", true: "#5B4FD1" }} />
                      </View>
                    </View>
                    <Text className="text-xs font-black text-emerald-700 mt-2">
                      Counted as working time: {workMin} min (no penalty)
                    </Text>
                    <Text className="text-[10px] font-semibold text-amber-700 mt-1">
                      Real time taken: {actual} min. Rs 50 for every 15 minutes started. Permission hours beyond the paid balance become unpaid.
                    </Text>
                  </View>
                )}

                <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-1.5">Note (optional)</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  multiline
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3 text-xs font-medium text-[#1F1B3D] min-h-[55px] mb-3"
                />

                {!!error && <Text className="text-[11px] font-black text-[#E4453C] mb-2">{error}</Text>}

                <View className="flex-row gap-2">
                  <TouchableOpacity onPress={() => setActive(null)} disabled={busy} className="flex-1 bg-slate-100 py-3.5 rounded-xl items-center">
                    <Text className="text-xs font-black text-slate-600 uppercase">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={submit} disabled={busy} className="flex-1 bg-emerald-600 py-3.5 rounded-xl items-center flex-row justify-center">
                    {busy ? <ActivityIndicator color="#FFFFFF" /> : (
                      <>
                        <CheckCircle2 size={14} color="#FFFFFF" />
                        <Text className="text-xs font-black text-white uppercase ml-1.5">{active.status === "APPROVED" ? "Update" : "Approve"}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}