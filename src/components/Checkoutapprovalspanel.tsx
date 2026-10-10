import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, TextInput, Modal } from "react-native";
import { RotateCw, Search, Clock, CheckCircle2, XCircle, Calendar, FileSpreadsheet, AlertCircle } from "lucide-react-native";
import CompactDatePicker from "./CrossPlatformDatePicker";
import { BASE_HOST } from "../constants/config";

interface CheckoutReq {
  requestId: string;
  empId: string;
  empName: string;
  date: string;          // yyyy-MM-dd
  dateLabel: string;
  checkIn?: string;
  requestedTime: string;     // 06:30 PM
  requestedTime24: string;   // 18:30
  reason: string;
  note?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approvedTime?: string;
  approvedBy?: string;
  submittedAt?: string;
  actionedAt?: string;
  rejectReason?: string;
}

const API = `${BASE_HOST}/api/admin/checkout-requests`;
const pad = (n: number) => String(n).padStart(2, "0");

const notify = (title: string, msg: string) =>
  Platform.OS === "web" ? window.alert(`${title}: ${msg}`) : Alert.alert(title, msg);

/**
 * Admin list of missed check-out requests (verify with camera, set exact time, approve or reject).
 * Has no outer ScrollView: it sits inside the parent screen.
 */
export default function CheckoutApprovalsPanel({
  adminId,
  onChanged,
}: {
  adminId: string;
  onChanged?: () => void;
}) {

  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [items, setItems] = useState<CheckoutReq[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  // decision modal
  const [active, setActive] = useState<CheckoutReq | null>(null);
  const [mode, setMode] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [apDate, setApDate] = useState("");
  const [hh, setHh] = useState("");
  const [mm, setMm] = useState("");
  const [ampm, setAmpm] = useState<"AM" | "PM">("PM");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {
      console.log("Could not load checkout requests");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) =>
      r.empName?.toLowerCase().includes(q) || r.empId?.toLowerCase().includes(q) || r.requestId?.toLowerCase().includes(q));
  }, [items, search]);

  const openModal = (r: CheckoutReq, approve: boolean) => {
    setActive(r);
    setMode(approve ? "APPROVE" : "REJECT");
    setRemarks("");
    setError("");
    setApDate(r.date);
    const [h24, m] = (r.requestedTime24 || "18:00").split(":").map(Number);
    setAmpm(h24 >= 12 ? "PM" : "AM");
    setHh(String(h24 % 12 === 0 ? 12 : h24 % 12));
    setMm(pad(m || 0));
  };

  const submit = async () => {
    if (!active) return;
    setError("");

    let url = "";
    let body: any = { adminId };

    if (mode === "APPROVE") {
      const h = parseInt(hh, 10);
      const m = parseInt(mm || "0", 10);
      if (!apDate) return setError("Choose the check-out date.");
      if (isNaN(h) || h < 1 || h > 12 || isNaN(m) || m < 0 || m > 59) return setError("Enter a valid time, for example 6 : 30 PM.");
      let h24 = h % 12;
      if (ampm === "PM") h24 += 12;
      body.approvedDateTime = `${apDate}T${pad(h24)}:${pad(m)}`;
      url = `${API}/${active.requestId}/approve`;
    } else {
      if (!remarks.trim()) return setError("Enter the rejection reason.");
      body.reason = remarks.trim();
      url = `${API}/${active.requestId}/reject`;
    }

    try {
      setBusy(true);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message || "Could not save the decision.");
        return;
      }
      setActive(null);
      setItems((prev) => prev.filter((r) => r.requestId !== active.requestId));
      onChanged?.();
      notify("Done", mode === "APPROVE" ? "Check-out approved and saved to the attendance record." : "Request rejected.");
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <View className="flex-row items-center bg-white border border-[#E7E4F5] rounded-xl px-3.5 py-2.5 mb-3">
        <Search size={16} color="#7A76A6" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by employee name, ID, or ref..."
          placeholderTextColor="#7A76A6"
          className="flex-1 ml-2 text-xs font-bold text-[#1F1B3D]"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} className="mr-2">
            <Text className="text-[10px] font-bold text-[#5B4FD1]">Clear</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={load}>
          <RotateCw size={15} color="#5B4FD1" />
        </TouchableOpacity>
      </View>

      <View className="flex-row bg-[#EEECFA]/70 p-1.5 rounded-2xl mb-4 border border-[#E7E4F5]">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((t) => {
          const act = filter === t;
          return (
            <TouchableOpacity key={t} onPress={() => setFilter(t)} className={`flex-1 py-2 rounded-xl items-center ${act ? "bg-[#5B4FD1]" : ""}`}>
              <Text className={`text-[11px] font-black ${act ? "text-white" : "text-[#7A76A6]"}`}>
                {t === "PENDING" ? "Pending" : t === "APPROVED" ? "Approved" : "Rejected"}
                {act ? ` (${shown.length})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="pb-4">
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="small" color="#5B4FD1" />
          </View>
        ) : shown.length === 0 ? (
          <View className="bg-white border border-[#E7E4F5] rounded-3xl p-8 items-center shadow-xs">
            <View className="w-14 h-14 rounded-2xl bg-[#EEECFA] items-center justify-center mb-3">
              <FileSpreadsheet size={26} color="#5B4FD1" />
            </View>
            <Text className="text-sm font-black text-[#1F1B3D]">No Requests</Text>
            <Text className="text-xs font-semibold text-[#7A76A6] text-center mt-1">
              There are no {filter.toLowerCase()} check-out requests.
            </Text>
          </View>
        ) : (
          shown.map((r) => {
            const initials = (r.empName || "EM").split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
            const ok = r.status === "APPROVED";
            return (
              <View key={r.requestId} className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs mb-3">
                <View className="flex-row justify-between items-start mb-2.5">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-9 h-9 rounded-xl bg-[#5B4FD1] items-center justify-center">
                      <Text className="text-white text-xs font-black">{initials}</Text>
                    </View>
                    <View>
                      <Text className="text-xs font-black text-[#1F1B3D]">{r.empName}</Text>
                      <Text className="text-[10px] font-bold text-[#7A76A6] mt-0.5">{r.empId} • Ref: {r.requestId}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-1 bg-[#EEECFA] px-2.5 py-1 rounded-full border border-[#5B4FD1]/20">
                    <Clock size={13} color="#5B4FD1" />
                    <Text className="text-[10px] font-black text-[#5B4FD1]">Check-Out</Text>
                  </View>
                </View>

                <View className="bg-[#F6F5FC] rounded-xl p-3 mb-2.5">
                  <Text className="text-xs font-bold text-[#1F1B3D]">Missed check-out on {r.dateLabel}</Text>
                  <View className="flex-row justify-between mt-1">
                    <Text className="text-[11px] font-bold text-[#7A76A6]">Check-in: {r.checkIn || "--"}</Text>
                    <Text className="text-[11px] font-black text-[#5B4FD1]">Employee says: {r.requestedTime}</Text>
                  </View>
                  <Text className="text-[11px] font-medium text-[#7A76A6] mt-1">Reason: {r.reason}</Text>
                  {r.note ? (
                    <Text className="text-[11px] font-semibold text-[#1F1B3D] italic mt-1.5 pt-1.5 border-t border-slate-200/60">"{r.note}"</Text>
                  ) : null}
                </View>

                <View className="flex-row items-center gap-1 mb-2">
                  <Calendar size={12} color="#7A76A6" />
                  <Text className="text-[10px] font-semibold text-[#7A76A6]">Submitted: {r.submittedAt}</Text>
                </View>

                {r.status === "PENDING" ? (
                  <View className="flex-row gap-2 pt-1">
                    <TouchableOpacity
                      onPress={() => openModal(r, false)}
                      className="px-4 bg-[#FDE9E8] border border-[#E4453C]/30 py-2.5 rounded-xl items-center justify-center"
                    >
                      <Text className="text-xs font-bold text-[#E4453C]">Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => openModal(r, true)}
                      className="flex-1 bg-[#5B4FD1] py-2.5 rounded-xl items-center justify-center shadow-xs"
                    >
                      <Text className="text-white text-xs font-black">Verify & Approve</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="gap-1.5 pt-1">
                    <View className={`p-2.5 rounded-xl border flex-row justify-between items-center ${ok ? "bg-[#E7FAEE] border-[#1FAE5C]/30" : "bg-[#FDE9E8] border-[#E4453C]/30"}`}>
                      <View className="flex-row items-center gap-1.5">
                        {ok ? <CheckCircle2 size={13} color="#1FAE5C" /> : <XCircle size={13} color="#E4453C" />}
                        <Text className={`text-[10px] font-black uppercase ${ok ? "text-[#1FAE5C]" : "text-[#E4453C]"}`}>{r.status}</Text>
                      </View>
                      <Text className="text-[10px] font-bold text-[#7A76A6]">
                        {ok ? "Approved by" : "Rejected by"} {r.approvedBy} • {r.actionedAt}
                      </Text>
                    </View>
                    {ok && r.approvedTime ? (
                      <Text className="text-[11px] font-black text-[#1FAE5C]">Check-out recorded: {r.approvedTime}</Text>
                    ) : null}
                    {r.rejectReason ? (
                      <View className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex-row items-start gap-1.5">
                        <AlertCircle size={13} color="#7A76A6" />
                        <Text className="text-[11px] font-semibold text-[#1F1B3D] flex-1">Remarks: {r.rejectReason}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      <Modal visible={!!active} transparent animationType="fade" onRequestClose={() => setActive(null)}>
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-white w-full max-w-sm rounded-3xl p-5 border border-[#E7E4F5]">
            <Text className="text-base font-black text-[#1F1B3D] mb-1">
              {mode === "APPROVE" ? "Verify & Approve Check-Out" : "Reject Request"}
            </Text>
            <Text className="text-xs text-[#7A76A6] mb-4">
              {active?.empName} • {active?.dateLabel} • Check-in {active?.checkIn || "--"}
            </Text>

            {mode === "APPROVE" ? (
              <View className="mb-3">
                <Text className="text-[11px] font-bold text-[#1F1B3D] mb-1">
                  Employee asked for {active?.requestedTime}. Check the camera recording and enter the exact time.
                </Text>

                <View className="mb-2">
                  <CompactDatePicker label="Check-out date" value={apDate} onChange={(v: string) => setApDate(v)} />
                </View>

                <View className="flex-row items-center">
                  <TextInput
                    value={hh}
                    onChangeText={(t) => setHh(t.replace(/[^0-9]/g, "").slice(0, 2))}
                    placeholder="HH"
                    keyboardType="number-pad"
                    maxLength={2}
                    className="w-14 text-center bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl py-2 text-sm font-black text-[#1F1B3D]"
                  />
                  <Text className="mx-1.5 text-base font-black text-[#1F1B3D]">:</Text>
                  <TextInput
                    value={mm}
                    onChangeText={(t) => setMm(t.replace(/[^0-9]/g, "").slice(0, 2))}
                    placeholder="MM"
                    keyboardType="number-pad"
                    maxLength={2}
                    className="w-14 text-center bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl py-2 text-sm font-black text-[#1F1B3D]"
                  />
                  <View className="flex-row ml-3 bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-0.5">
                    {(["AM", "PM"] as const).map((ap) => (
                      <TouchableOpacity key={ap} onPress={() => setAmpm(ap)} className={`px-3 py-1.5 rounded-lg ${ampm === ap ? "bg-[#5B4FD1]" : ""}`}>
                        <Text className={`text-[11px] font-black ${ampm === ap ? "text-white" : "text-[#7A76A6]"}`}>{ap}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              <View className="mb-3">
                <Text className="text-[11px] font-bold text-[#1F1B3D] mb-1">Rejection Reason (Required)</Text>
                <TextInput
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="e.g. Camera shows the employee left earlier"
                  multiline
                  numberOfLines={2}
                  className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 py-2 text-xs font-bold text-[#1F1B3D]"
                />
              </View>
            )}

            {error ? <Text className="text-[11px] font-bold text-rose-600 mb-3">{error}</Text> : null}

            <View className="flex-row gap-2">
              <TouchableOpacity onPress={() => setActive(null)} className="flex-1 bg-slate-100 py-2.5 rounded-xl items-center">
                <Text className="text-xs font-bold text-[#7A76A6]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submit}
                disabled={busy}
                className={`flex-1 py-2.5 rounded-xl items-center ${mode === "APPROVE" ? "bg-[#5B4FD1]" : "bg-[#E4453C]"} ${busy ? "opacity-60" : ""}`}
              >
                {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <Text className="text-xs font-black text-white">Confirm {mode === "APPROVE" ? "Approval" : "Rejection"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}