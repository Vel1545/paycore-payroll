import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { RotateCw, Clock, CheckCircle2, XCircle, Calendar, FileSpreadsheet } from "lucide-react-native";
import { BASE_HOST } from "../constants/config";

interface CheckinReq {
  requestId: string;
  date: string;
  dateLabel: string;
  savedCheckIn?: string;
  requestedTime: string;
  reason: string;
  note?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approvedTime?: string;
  approvedBy?: string;
  submittedAt?: string;
  actionedAt?: string;
  rejectReason?: string;
}

const API = `${BASE_HOST}/api/attendance`;

/**
 * Late punch request: "I reached at 9:20 but could not punch until 9:45".
 * Shows the employee's own late punch requests and their status. Sits inside the parent screen's scroll.
 */
export default function CheckinRequestsPanel({ empId, highlightId }: { empId: string; highlightId?: string | null }) {
  const [items, setItems] = useState<CheckinReq[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">(highlightId ? "ALL" : "PENDING");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/checkin-requests?empId=${encodeURIComponent(empId || "")}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {
      console.log("Could not load late punch requests");
    } finally {
      setLoading(false);
    }
  }, [empId]);

  useEffect(() => { load(); }, [load]);

  const count = (s: string) => items.filter((r) => r.status === s).length;
  const shown = useMemo(() => items.filter((r) => filter === "ALL" || r.status === filter), [items, filter]);

  return (
    <View className="mb-6">
      {/* the request itself is sent from the small "Late punch" button on today's Attendance card */}
      <View className="bg-[#EEECFA] border border-[#5B4FD1]/20 rounded-2xl p-3 mb-4 flex-row items-center">
        <Clock size={14} color="#5B4FD1" />
        <Text className="text-[11px] font-semibold text-[#5B4FD1] ml-2 flex-1">
          To send a late punch request, use the small "Late punch" button on today's Attendance card. It shows only when you punched more than 5 minutes after your shift start, and only for that day.
        </Text>
      </View>

      {/* ---------------- my requests ---------------- */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">My Late Punch Requests</Text>
        <TouchableOpacity onPress={load} className="w-8 h-8 rounded-xl bg-white border border-[#E7E4F5] items-center justify-center">
          <RotateCw size={14} color="#5B4FD1" />
        </TouchableOpacity>
      </View>

      <View className="flex-row bg-[#EEECFA]/70 p-1.5 rounded-2xl mb-3 border border-[#E7E4F5]">
        {[
          { id: "PENDING", label: `Pending (${count("PENDING")})` },
          { id: "APPROVED", label: `Approved (${count("APPROVED")})` },
          { id: "REJECTED", label: `Rejected (${count("REJECTED")})` },
          { id: "ALL", label: `All (${items.length})` },
        ].map((t) => {
          const act = filter === t.id;
          return (
            <TouchableOpacity key={t.id} onPress={() => setFilter(t.id as any)} className={`flex-1 py-2 rounded-xl items-center justify-center ${act ? "bg-[#5B4FD1]" : ""}`}>
              <Text numberOfLines={1} className={`text-[10px] font-black ${act ? "text-white" : "text-[#7A76A6]"}`}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View className="py-10 items-center"><ActivityIndicator size="small" color="#5B4FD1" /></View>
      ) : shown.length === 0 ? (
        <View className="bg-white border border-[#E7E4F5] rounded-3xl p-8 items-center shadow-xs">
          <View className="w-14 h-14 rounded-2xl bg-[#EEECFA] items-center justify-center mb-3">
            <FileSpreadsheet size={26} color="#5B4FD1" />
          </View>
          <Text className="text-sm font-black text-[#1F1B3D]">No Requests</Text>
          <Text className="text-xs font-semibold text-[#7A76A6] text-center mt-1">
            You have no {filter === "ALL" ? "" : filter.toLowerCase() + " "}late punch requests.
          </Text>
        </View>
      ) : (
        shown.map((r) => {
          const ok = r.status === "APPROVED";
          const pending = r.status === "PENDING";
          return (
            <View key={r.requestId} className={`bg-white border rounded-2xl p-4 shadow-xs mb-3 ${highlightId && highlightId === r.requestId ? "border-[#5B4FD1] border-2" : "border-[#E7E4F5]"}`}>
              <View className="flex-row justify-between items-start mb-2.5">
                <View>
                  <Text className="text-xs font-black text-[#1F1B3D]">Late Punch • {r.dateLabel}</Text>
                  <Text className="text-[10px] font-bold text-[#7A76A6] mt-0.5">Ref: {r.requestId}</Text>
                </View>
                <View className="flex-row items-center gap-1 bg-[#EEECFA] px-2.5 py-1 rounded-full border border-[#5B4FD1]/20">
                  <Clock size={13} color="#5B4FD1" />
                  <Text className="text-[10px] font-black text-[#5B4FD1]">Check-In</Text>
                </View>
              </View>

              <View className="bg-[#F6F5FC] rounded-xl p-3 mb-2.5">
                <View className="flex-row justify-between">
                  <Text className="text-[11px] font-bold text-[#1F1B3D]">Saved check-in: {r.savedCheckIn || "none"}</Text>
                  <Text className="text-[11px] font-black text-[#5B4FD1]">You arrived: {r.requestedTime}</Text>
                </View>
                <Text className="text-[11px] font-medium text-[#7A76A6] mt-1">Reason: {r.reason}</Text>
                {r.note ? <Text className="text-[11px] font-semibold text-[#1F1B3D] italic mt-1.5 pt-1.5 border-t border-slate-200/60">"{r.note}"</Text> : null}
              </View>

              <View className="flex-row items-center gap-1 mb-2">
                <Calendar size={12} color="#7A76A6" />
                <Text className="text-[10px] font-semibold text-[#7A76A6]">Submitted: {r.submittedAt}</Text>
              </View>

              <View className={`p-2.5 rounded-xl border flex-row justify-between items-center ${ok ? "bg-[#E7FAEE] border-[#1FAE5C]/30" : pending ? "bg-[#FEF2D9] border-amber-300" : "bg-[#FDE9E8] border-[#E4453C]/30"}`}>
                <View className="flex-row items-center gap-1.5">
                  {ok ? <CheckCircle2 size={13} color="#1FAE5C" /> : pending ? <Clock size={13} color="#D08A0C" /> : <XCircle size={13} color="#E4453C" />}
                  <Text className={`text-[10px] font-black uppercase ${ok ? "text-[#1FAE5C]" : pending ? "text-amber-700" : "text-[#E4453C]"}`}>{pending ? "Request sent" : r.status}</Text>
                </View>
                {pending ? (
                  <Text className="text-[10px] font-bold text-amber-800">Awaiting Admin Review</Text>
                ) : (
                  <Text className="text-[10px] font-bold text-[#7A76A6]">{ok ? "Approved by" : "Rejected by"} {r.approvedBy} • {r.actionedAt}</Text>
                )}
              </View>

              {ok && r.approvedTime ? <Text className="text-[11px] font-black text-[#1FAE5C] mt-2">Check-in set to: {r.approvedTime}</Text> : null}
              {r.status === "REJECTED" && r.rejectReason ? (
                <View className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 mt-2">
                  <Text className="text-[11px] font-semibold text-[#1F1B3D]">Remarks: {r.rejectReason}</Text>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}