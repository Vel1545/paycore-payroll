import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator, AppState } from "react-native";
import { CheckCircle2, XCircle, MapPin, Battery, Navigation, Crosshair, Settings, X } from "lucide-react-native";
import {
  Readiness, getTrackingReadiness, readinessMissing, fixAllTheTime, fixGps, fixBattery, openAppSettings, brandSteps,
} from "../services/trackingReadiness";

interface Props {
  visible: boolean;
  onClose: (allOk: boolean) => void;
}

// Shown to sales staff at check-in when something on the phone would stop the shift route tracking.
// Each item has a button that opens the right setting; the list re-checks itself when the employee comes back.
export default function TrackingSetupModal({ visible, onClose }: Props) {
  const [r, setR] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setR(await getTrackingReadiness());
  }, []);

  useEffect(() => {
    if (!visible) return;
    refresh();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh(); // back from a settings page
    });
    return () => sub.remove();
  }, [visible, refresh]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const ok = r ? !readinessMissing(r) : false;
  const brand = brandSteps(r?.brand || "");

  const Row = ({ icon, title, hint, good, unknown, action, onPress }: {
    icon: React.ReactNode; title: string; hint: string; good: boolean; unknown?: boolean; action: string; onPress: () => void;
  }) => (
    <View className={`border rounded-2xl p-3 mb-2 ${good ? "border-emerald-200 bg-emerald-50" : unknown ? "border-slate-200 bg-slate-50" : "border-rose-200 bg-rose-50"}`}>
      <View className="flex-row items-center">
        {icon}
        <Text className="text-xs font-black text-[#1F1B3D] ml-2 flex-1">{title}</Text>
        {good ? <CheckCircle2 size={18} color="#059669" /> : unknown ? null : <XCircle size={18} color="#BE123C" />}
      </View>
      <Text className="text-[10.5px] font-semibold text-[#7A76A6] mt-1">{hint}</Text>
      {!good && (
        <TouchableOpacity onPress={onPress} disabled={busy} className="self-start mt-2 bg-[#5B4FD1] rounded-xl px-3 py-2">
          <Text className="text-[11px] font-black text-white">{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onClose(ok)}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl p-5" style={{ maxHeight: "92%" }}>
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-base font-black text-[#1F1B3D]">Set up shift tracking</Text>
            <TouchableOpacity onPress={() => onClose(ok)}><X size={18} color="#7A76A6" /></TouchableOpacity>
          </View>
          <Text className="text-[11px] font-semibold text-[#7A76A6] mb-3">
            Your route is recorded only between check-in and check-out. Fix the red items so the phone does not stop it.
          </Text>

          {!r ? (
            <ActivityIndicator size="small" color="#5B4FD1" style={{ marginVertical: 20 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Row
                icon={<MapPin size={16} color="#5B4FD1" />}
                title="Location: Allow all the time"
                hint="Needed so the route is recorded when the app is in the background."
                good={r.allTheTime}
                action="Allow"
                onPress={() => run(fixAllTheTime)}
              />
              <Row
                icon={<Crosshair size={16} color="#5B4FD1" />}
                title="Precise location"
                hint="With 'Approximate' only, points can be about 2 km off. App settings > Permissions > Location > Use precise location."
                good={r.precise !== false}
                unknown={r.precise === null}
                action="Open app settings"
                onPress={() => run(openAppSettings)}
              />
              <Row
                icon={<Navigation size={16} color="#5B4FD1" />}
                title="Phone location (GPS) ON"
                hint="The location switch in the quick settings."
                good={r.gpsOn}
                action="Turn on"
                onPress={() => run(fixGps)}
              />
              <Row
                icon={<Battery size={16} color="#5B4FD1" />}
                title="Battery: not optimised / unrestricted"
                hint="Otherwise the phone stops PayCore in the background. In the list choose PayCore > Don't optimise (Unrestricted)."
                good={r.batteryUnrestricted !== false}
                unknown={r.batteryUnrestricted === null}
                action="Open battery settings"
                onPress={() => run(fixBattery)}
              />

              <View className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl p-3 mt-1 mb-3">
                <Text className="text-xs font-black text-[#1F1B3D] mb-1">{brand.title}: also check</Text>
                {brand.steps.map((s) => (
                  <Text key={s} className="text-[11px] font-semibold text-[#7A76A6] mb-0.5">• {s}</Text>
                ))}
                <TouchableOpacity onPress={() => run(openAppSettings)} className="flex-row items-center self-start mt-2 border border-[#5B4FD1]/30 rounded-xl px-3 py-2">
                  <Settings size={13} color="#5B4FD1" />
                  <Text className="text-[11px] font-black text-[#5B4FD1] ml-1.5">Open PayCore app settings</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => onClose(ok)} className={`rounded-xl py-3.5 items-center mb-2 ${ok ? "bg-emerald-600" : "bg-[#5B4FD1]"}`}>
                <Text className="text-white text-xs font-black uppercase">{ok ? "All set - continue" : "Continue (fix later)"}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
