import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { CalendarOff } from "lucide-react-native";
import { BASE_HOST } from "../constants/config";

/** Admin: approve or reject week-off requests. <WeekOffApprovalsPanel adminEmpId={String(UserSession.empId || "")} isDesktop={isDesktop} /> */
const API = `${BASE_HOST}/api/weekoff`;

interface Req {
  emp_id: string;
  full_name: string | null;
  department: string | null;
  off_date: string;
  dayName: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requested_at: string | null;
  allowedPerWeek: number;
  approvedThisWeek: number;
}

const say = (t: string, m: string) => (Platform.OS === "web" ? window.alert(`${t}\n${m}`) : Alert.alert(t, m));

export default function WeekOffApprovalsPanel({ adminEmpId, isDesktop }: { adminEmpId: string; isDesktop: boolean }) {
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/requests?adminEmpId=${encodeURIComponent(adminEmpId)}&status=${filter}`, { cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || `Request failed (${res.status})`);
      setRows(Array.isArray(j) ? j : []);
    } catch (e: any) {
      setRows([]);
      setError(e.message || "Could not load the requests");
    } finally {
      setLoading(false);
    }
  }, [adminEmpId, filter]);

  useEffect(() => { load(); }, [load]);

  const decide = async (r: Req, action: "APPROVE" | "REJECT" | "REVOKE") => {
    const key = `${r.emp_id}|${r.off_date}`;
    setBusyKey(key);
    try {
      const res = await fetch(`${API}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmpId, empId: r.emp_id, date: r.off_date, action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) say("Week off", j?.error || "Could not save. Please try again.");
      else await load();
    } catch {
      say("Week off", "No connection. Please try again.");
    } finally {
      setBusyKey(null);
    }
  };

  const ask = (r: Req, action: "APPROVE" | "REJECT" | "REVOKE") => {
    const verb = action === "APPROVE" ? "Approve" : action === "REJECT" ? "Reject" : "Revoke";
    const msg = `${verb} ${r.full_name || r.emp_id}'s week off on ${r.dayName} ${r.off_date}?`;
    if (Platform.OS === "web") { if (window.confirm(msg)) decide(r, action); return; }
    Alert.alert(`${verb} week off`, msg, [{ text: "Cancel", style: "cancel" }, { text: verb, onPress: () => decide(r, action) }]);
  };

  const fs = (d: number, m: number) => ({ fontSize: isDesktop ? d : m });

  return (
    <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 gap-4" style={{ width: isDesktop ? 720 : "100%", alignSelf: "center" }}>
      <View className="flex-row items-center gap-3 pb-3 border-b border-slate-100">
        <View className="w-10 h-10 rounded-xl bg-[#EEECFA] items-center justify-center">
          <CalendarOff size={20} color="#5B4FD1" />
        </View>
        <View className="flex-1">
          <Text style={fs(18, 16)} className="font-black text-[#1F1B3D]">Week-off requests</Text>
          <Text style={fs(12, 10)} className="font-bold text-[#7A76A6]">Approve or reject flexible week-offs</Text>
        </View>
      </View>

      <View className="web:lg:self-start web:lg:w-[480px] flex-row bg-[#EEECFA]/70 border border-[#E7E4F5] p-1.5 rounded-2xl gap-2">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((f) => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            className={`flex-1 py-2.5 rounded-xl items-center ${filter === f ? "bg-[#5B4FD1]" : ""}`}>
            <Text style={fs(13, 11)} className={`font-black ${filter === f ? "text-white" : "text-[#7A76A6]"}`}>
              {f === "PENDING" ? "Waiting" : f === "APPROVED" ? "Approved" : "Rejected"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#5B4FD1" />
      ) : error ? (
        <View className="items-center gap-3 py-4">
          <Text style={fs(13, 11)} className="font-bold text-[#E4453C] text-center">{error}</Text>
          <TouchableOpacity onPress={load} className="bg-[#5B4FD1] px-5 py-2.5 rounded-xl">
            <Text className="text-white text-xs font-black">Try again</Text>
          </TouchableOpacity>
        </View>
      ) : rows.length === 0 ? (
        <Text style={fs(13, 11)} className="font-bold text-[#7A76A6] text-center py-6">No {filter.toLowerCase()} requests.</Text>
      ) : (
        <View className="gap-2.5">
          {rows.map((r) => {
            const key = `${r.emp_id}|${r.off_date}`;
            const busy = busyKey === key;
            const limitReached = r.approvedThisWeek >= r.allowedPerWeek;
            return (
              <View key={key} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl p-3.5 gap-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-2">
                    <Text style={fs(14, 12)} className="font-black text-[#1F1B3D]" numberOfLines={1}>{r.full_name || r.emp_id}</Text>
                    <Text style={fs(12, 10)} className="font-semibold text-[#7A76A6]">{r.emp_id}{r.department ? ` • ${r.department}` : ""}</Text>
                  </View>
                  <View className="bg-white border border-[#E7E4F5] px-3 py-1 rounded-lg">
                    <Text style={fs(12, 10)} className="font-black text-[#5B4FD1]">{r.dayName} {r.off_date}</Text>
                  </View>
                </View>
                <Text style={fs(11, 10)} className="font-semibold text-[#7A76A6]">
                  This week: {r.approvedThisWeek} of {r.allowedPerWeek} approved{r.requested_at ? ` • asked ${r.requested_at}` : ""}
                </Text>
                {filter === "PENDING" ? (
                  <View className="flex-row gap-2">
                    <TouchableOpacity disabled={busy} onPress={() => ask(r, "REJECT")}
                      className="flex-1 py-2.5 rounded-xl items-center border border-[#E4453C]/40">
                      <Text style={fs(12, 11)} className="font-black text-[#E4453C]">Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={busy || limitReached} onPress={() => ask(r, "APPROVE")}
                      className={`flex-1 py-2.5 rounded-xl items-center ${limitReached ? "bg-[#CBD5E1]" : "bg-[#5B4FD1]"}`}>
                      {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                        <Text style={fs(12, 11)} className="font-black text-white">{limitReached ? "Limit reached" : "Approve"}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : filter === "APPROVED" ? (
                  <TouchableOpacity disabled={busy} onPress={() => ask(r, "REVOKE")}
                    className="py-2.5 rounded-xl items-center border border-[#E4453C]/40">
                    <Text style={fs(12, 11)} className="font-black text-[#E4453C]">Revoke</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}