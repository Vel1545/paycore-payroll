import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { RotateCw, Clock, CheckCircle2, XCircle, AlertCircle, Calendar, FileSpreadsheet } from "lucide-react-native";
import { BASE_HOST } from "../constants/config";

interface CheckoutReq {
  requestId: string;
  date: string;
  dateLabel: string;
  checkIn?: string;
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

type Filter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

/**
 * The employee's own missed check-out requests.
 * No ScrollView inside: it sits inside the parent screen's scroll (Apply screen) or a screen wrapper.
 */
export default function CheckoutRequestsPanel({
  empId,
  onOpenAttendance,
}: {
  empId: string;
  onOpenAttendance?: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [items, setItems] = useState<CheckoutReq[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/checkout-requests?empId=${encodeURIComponent(empId || "")}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {
      console.log("Could not load checkout requests");
    } finally {
      setLoading(false);
    }
  }, [empId]);

  useEffect(() => { load(); }, [load]);

  const count = (s: string) => items.filter((r) => r.status === s).length;
  const shown = useMemo(() => items.filter((r) => filter === "ALL" || r.status === filter), [items, filter]);

  return (
    <View className="mb-8">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">Missed Check-Out Requests</Text>
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
          const active = filter === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setFilter(t.id as Filter)}
              className={`flex-1 py-2 rounded-xl items-center justify-center ${active ? "bg-[#5B4FD1]" : ""}`}
            >
              <Text numberOfLines={1} className={`text-[10px] font-black ${active ? "text-white" : "text-[#7A76A6]"}`}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={onOpenAttendance}
        disabled={!onOpenAttendance}
        className="bg-[#FEF2D9] border border-[#D08A0C]/30 rounded-2xl p-3 mb-3 flex-row items-center gap-2"
      >
        <AlertCircle size={14} color="#D08A0C" />
        <Text className="flex-1 text-[11px] font-bold text-[#D08A0C]">
          To send a new request, open Attendance and tap "Missed check-out? Request it" on that day.
        </Text>
      </TouchableOpacity>

      {loading ? (
        <View className="py-12 items-center">
          <ActivityIndicator size="small" color="#5B4FD1" />
        </View>
      ) : shown.length === 0 ? (
        <View className="bg-white border border-[#E7E4F5] rounded-3xl p-8 items-center shadow-xs">
          <View className="w-14 h-14 rounded-2xl bg-[#EEECFA] items-center justify-center mb-3">
            <FileSpreadsheet size={26} color="#5B4FD1" />
          </View>
          <Text className="text-sm font-black text-[#1F1B3D]">No Requests</Text>
          <Text className="text-xs font-semibold text-[#7A76A6] text-center mt-1">
            You have no {filter === "ALL" ? "" : filter.toLowerCase() + " "}check-out requests.
          </Text>
        </View>
      ) : (
        shown.map((r) => {
          const ok = r.status === "APPROVED";
          const pending = r.status === "PENDING";
          return (
            <View key={r.requestId} className="bg-white border border-[#E7E4F5] rounded-2xl p-4 shadow-xs mb-3">
              <View className="flex-row justify-between items-start mb-2.5">
                <View>
                  <Text className="text-xs font-black text-[#1F1B3D]">Missed Check-Out • {r.dateLabel}</Text>
                  <Text className="text-[10px] font-bold text-[#7A76A6] mt-0.5">Ref: {r.requestId}</Text>
                </View>
                <View className="flex-row items-center gap-1 bg-[#EEECFA] px-2.5 py-1 rounded-full border border-[#5B4FD1]/20">
                  <Clock size={13} color="#5B4FD1" />
                  <Text className="text-[10px] font-black text-[#5B4FD1]">Check-Out</Text>
                </View>
              </View>

              <View className="bg-[#F6F5FC] rounded-xl p-3 mb-2.5">
                <View className="flex-row justify-between">
                  <Text className="text-[11px] font-bold text-[#1F1B3D]">Check-in: {r.checkIn || "--"}</Text>
                  <Text className="text-[11px] font-black text-[#5B4FD1]">You asked: {r.requestedTime}</Text>
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

              <View
                className={`p-2.5 rounded-xl border flex-row justify-between items-center ${
                  ok ? "bg-[#E7FAEE] border-[#1FAE5C]/30" : pending ? "bg-[#FEF2D9] border-amber-300" : "bg-[#FDE9E8] border-[#E4453C]/30"
                }`}
              >
                <View className="flex-row items-center gap-1.5">
                  {ok ? <CheckCircle2 size={13} color="#1FAE5C" /> : pending ? <Clock size={13} color="#D08A0C" /> : <XCircle size={13} color="#E4453C" />}
                  <Text className={`text-[10px] font-black uppercase ${ok ? "text-[#1FAE5C]" : pending ? "text-amber-700" : "text-[#E4453C]"}`}>
                    {pending ? "Request sent" : r.status}
                  </Text>
                </View>
                {pending ? (
                  <Text className="text-[10px] font-bold text-amber-800">Awaiting Admin Review</Text>
                ) : (
                  <Text className="text-[10px] font-bold text-[#7A76A6]">
                    {ok ? "Approved by" : "Rejected by"} {r.approvedBy} • {r.actionedAt}
                  </Text>
                )}
              </View>

              {ok && r.approvedTime ? (
                <Text className="text-[11px] font-black text-[#1FAE5C] mt-2">Check-out recorded: {r.approvedTime}</Text>
              ) : null}
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