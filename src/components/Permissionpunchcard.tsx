import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import * as Location from "expo-location";
import { MapPin, Play, Square } from "lucide-react-native";
import { UserSession } from "../services/UserSession";
import { BASE_HOST } from "../constants/config";

const API = `${BASE_HOST}/api/attendance/permission-punch`;

type Kind = "PERMISSION" | "OD";

interface Props {
  kind: Kind; // the option that is open on the Apply screen
}

// Start / End by punch (location only, no photo). The admin verifies every punch.
// Hidden until the server says the new system is switched on (permissionpunch.start-date),
// and hidden if the server does not have it yet, so the old form keeps working exactly as before.
export default function Permissionpunchcard({ kind }: Props) {
  const empId = UserSession.empId;
  const [data, setData] = useState<any>(null);
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tick, setTick] = useState(0);
  const loadedAt = useRef(Date.now());

  const load = useCallback(async () => {
    if (!empId) return;
    try {
      const res = await fetch(`${API}/current?empId=${encodeURIComponent(empId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      loadedAt.current = Date.now();
      setData(j);
    } catch {
      /* the card simply stays hidden */
    }
  }, [empId]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      load();
    }, 30000);
    const tk = setInterval(() => setTick((x: number) => x + 1), 15000);
    return () => {
      clearInterval(t);
      clearInterval(tk);
    };
  }, [load]);

  const getFix = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") throw new Error("Location permission is required for permission / OD punch.");
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const acc = loc.coords.accuracy != null ? Math.round(loc.coords.accuracy) : null;
    return {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: acc,
      mock: !!((loc as any).mocked || (loc as any).isFromMockProvider),
    };
  };

  const post = async (path: string, body: any) => {
    const res = await fetch(`${API}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j?.status === "FAILED") throw new Error(j?.message || "Something went wrong. Please try again.");
    return j;
  };
  

  const handleStart = async () => {
    if (kind === "OD" && !purpose.trim()) {
      setMsg({ ok: false, text: "Please enter the purpose of the OD." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const fix = await getFix();
      const j = await post("start", { empId, kind, ...fix, purpose: purpose.trim() });
      setPurpose("");
      setMsg({ ok: true, text: j?.message || "Started." });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Could not start." });
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const fix = await getFix();
      const j = await post("end", { empId, ...fix });
      setMsg({
        ok: true,
        text: `${j?.message || "Sent to the admin for verification."} Counted as ${j?.chargedMinutes ?? "-"} min.`,
      });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Could not end." });
    } finally {
      setBusy(false);
    }
  };

  if (!data || !data.enabled) return null;

  const open = !!data.open;
  const running = open ? Math.floor((data.runningMinutes || 0) + (Date.now() - loadedAt.current) / 60000) : 0;
  const runningKind: string = open ? data.session?.kind : "";
  const label = kind === "OD" ? "OD" : "Permission";
  const balance = Number(data.balanceHours ?? 0).toFixed(2);
  const canStart = kind === "OD" ? data.canStartOd === true : data.canStartPermission === true;
  const blockedReason = kind === "OD" ? data.odBlockedReason : data.permissionBlockedReason;

  return (
    <View className="bg-[#EEECFA] border border-[#5B4FD1]/25 rounded-xl p-3 mb-3">
      <View className="flex-row items-center mb-1">
        <MapPin size={14} color="#5B4FD1" />
        <Text className="text-xs font-black text-[#5B4FD1] ml-1.5">Punch {label} (location only)</Text>
      </View>

      {kind === "PERMISSION" ? (
        <Text className="text-[10.5px] font-semibold text-[#7A76A6] mb-2">
          Paid permission left this month: {balance} hr. A permission of 1 hour or less is counted as 1 hour; time beyond your
          paid balance is unpaid. The admin verifies every punch.
        </Text>
      ) : (
        <Text className="text-[10.5px] font-semibold text-[#7A76A6] mb-2">
          No limit on OD hours. Start when you leave for the work and End when you are back. The admin verifies every punch.
        </Text>
      )}

      {!open ? (
        <View>
          {kind === "OD" && (
            <TextInput
              value={purpose}
              onChangeText={setPurpose}
              placeholder="Purpose of the OD (required)"
              placeholderTextColor="#A6A2CE"
              className="bg-white border border-[#E7E4F5] rounded-xl p-2.5 text-xs font-medium text-[#1F1B3D] mb-2"
            />
          )}
          <TouchableOpacity
  onPress={handleStart}
  disabled={busy || !canStart}
  className={`rounded-xl py-3 flex-row items-center justify-center ${canStart ? "bg-[#5B4FD1] active:opacity-90" : "bg-slate-300"}`}
>
  {busy ? (
    <ActivityIndicator size="small" color="#FFFFFF" />
  ) : (
    <>
      <Play size={14} color="#FFFFFF" />
      <Text className="text-white font-black text-xs uppercase tracking-wider ml-1.5">Start {label}</Text>
    </>
  )}
</TouchableOpacity>

{!canStart && !!blockedReason && (
  <View className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 mt-2 flex-row items-center">
    <Text className="text-[11px] font-bold text-amber-800 flex-1">
      {blockedReason}
    </Text>
  </View>
)}
{!canStart && !!data.startBlockedReason && (
  <View className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 mt-2 flex-row items-center">
    <Text className="text-[11px] font-bold text-amber-800 flex-1">
      {data.startBlockedReason}
    </Text>
  </View>
)}
        </View>
      ) : (
        <View>
          <View className="bg-white rounded-xl p-2.5 mb-2 flex-row justify-between items-center">
            <Text className="text-[11px] font-bold text-[#1F1B3D]">
              {runningKind === "OD" ? "OD" : "Permission"} running
            </Text>
            <Text className="text-xs font-black text-[#E4453C]">{running} min</Text>
          </View>
          <TouchableOpacity
            onPress={handleEnd}
            disabled={busy}
            className="bg-[#E4453C] rounded-xl py-3 flex-row items-center justify-center active:opacity-90"
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Square size={14} color="#FFFFFF" />
                <Text className="text-white font-black text-xs uppercase tracking-wider ml-1.5">
                  End {runningKind === "OD" ? "OD" : "Permission"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {msg && (
        <Text className={`text-[11px] font-bold mt-2 ${msg.ok ? "text-emerald-700" : "text-[#E4453C]"}`}>{msg.text}</Text>
      )}
    </View>
  );
}