import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { CheckSquare, Square, Clock } from "lucide-react-native";
import { BASE_HOST } from "../constants/config";
import { Btn, Card, Detail, Input, Txt, twoColumn, ui } from "./web/webUi";

/**
 * "Work" tab for the Add / Edit User page: shows and edits the employee's user_configs row.
 * <UserConfigPanel empId={selectedUserEmpId} adminEmpId={...} isDesktop={isDesktop} />
 */
interface Props {
  empId: string;
  adminEmpId: string;
  isDesktop: boolean;
  webDesign?: boolean; // laptop/PC website layout; the phone layout is unchanged
}

type Kind = "text" | "num" | "flag" | "json";
const GROUPS: { title: string; fields: { key: string; label: string; kind?: Kind }[] }[] = [
  { title: "Shift & attendance", fields: [
    { key: "status", label: "Config status" },
    { key: "defaultWorkMode", label: "Default work mode" },
    { key: "shiftCode", label: "Shift code" },
    { key: "shiftStart", label: "Shift start (HH:mm)" },
    { key: "shiftEnd", label: "Shift end (HH:mm)" },
    { key: "graceMinutes", label: "Grace minutes", kind: "num" },
    { key: "hoursPerWorkingDay", label: "Hours per working day", kind: "num" },
    { key: "perDaySalary", label: "Per-day salary", kind: "num" },
    { key: "assignedBranchId", label: "Assigned branch ID" },
    { key: "geofenceExempt", label: "Geofence exempt", kind: "flag" },
    { key: "geofenceConfig", label: "Geofence (JSON)", kind: "json" },
    { key: "weeklySchedule", label: "Weekly schedule (JSON)", kind: "json" },
  ]},
  { title: "Yearly leave quota", fields: [
    { key: "allocatedCl", label: "Casual leave (CL)", kind: "num" },
    { key: "allocatedSl", label: "Sick leave (SL)", kind: "num" },
    { key: "allocatedMl", label: "Maternity leave (ML)", kind: "num" },
    { key: "allocatedPermissionHours", label: "Permission hours", kind: "num" },
  ]},
];

async function call(url: string, init?: RequestInit): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
      signal: ctrl.signal,
    });
    const text = await res.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    if (!res.ok) throw new Error(body?.message || `Request failed (${res.status})`);
    return body;
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("The server took too long. Try again.");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

const say = (title: string, msg: string) =>
  Platform.OS === "web" ? window.alert(`${title}: ${msg}`) : Alert.alert(title, msg);

const asText = (v: any, kind?: Kind): string => {
  if (v === null || v === undefined) return "";
  if (kind === "json") return typeof v === "string" ? v : JSON.stringify(v);
  if (kind === "flag") return String(!!v);
  return String(v);
};

export default function UserConfigPanel({ empId, adminEmpId, isDesktop, webDesign }: Props) {
  const url = `${BASE_HOST}/api/admin/users/${encodeURIComponent(empId)}/config`;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!empId) return;
    setLoading(true);
    setError(null);
    setEditing(false);
    try {
      setData(await call(`${url}?adminEmpId=${encodeURIComponent(adminEmpId)}`));
    } catch (e: any) {
      setData(null);
      setError(e.message || "Could not load work settings");
    } finally {
      setLoading(false);
    }
  }, [url, empId, adminEmpId]);

  useEffect(() => { load(); }, [load]);

  const startEdit = () => {
    const d: Record<string, string> = {};
    GROUPS.forEach(g => g.fields.forEach(f => { d[f.key] = asText(data?.config?.[f.key], f.kind); }));
    setDraft(d);
    setEditing(true);
  };

  const changed = (): Record<string, any> => {
    const out: Record<string, any> = {};
    GROUPS.forEach(g => g.fields.forEach(f => {
      const before = asText(data?.config?.[f.key], f.kind);
      const now = (draft[f.key] ?? "").trim();
      if (before !== now) out[f.key] = f.kind === "flag" ? now === "true" : now;
    }));
    return out;
  };

  const save = async () => {
    const configFields = changed();
    if (Object.keys(configFields).length === 0) { setEditing(false); return; }
    setBusy(true);
    try {
      setData(await call(url, { method: "PUT", body: JSON.stringify({ adminEmpId, configFields }) }));
      setEditing(false);
      say("Saved", "Work settings updated.");
    } catch (e: any) {
      say("Could not save", e.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const createRow = async () => {
    setBusy(true);
    try {
      setData(await call(url, { method: "POST", body: JSON.stringify({ adminEmpId, configFields: {} }) }));
      say("Created", "Work settings created with the default shift and leave quota. You can edit them now.");
    } catch (e: any) {
      say("Could not create", e.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const fs = (d: number, m: number) => ({ fontSize: isDesktop ? d : m });

  if (!empId) return null;

  // Laptop/PC website layout. Same data and same load, save and create functions as the phone layout below.
  if (webDesign) {
    if (loading) {
      return (
        <Card style={{ padding: 40, alignItems: "center" }}>
          <ActivityIndicator color={ui.color.primary} />
        </Card>
      );
    }
    if (error) {
      return (
        <Card style={{ padding: 24, alignItems: "center", gap: 12 }}>
          <Txt variant="body" style={{ color: ui.color.danger, textAlign: "center" }}>{error}</Txt>
          <Btn label="Try again" variant="secondary" onPress={load} />
        </Card>
      );
    }
    if (data && !data.hasConfig) {
      return (
        <Card style={{ padding: 24, gap: 12, alignItems: "flex-start" }}>
          <Txt variant="section">Work settings</Txt>
          <Txt variant="body">{data.name || empId} has no work settings yet (shift, grace time, yearly leave quota).</Txt>
          <Btn label="Create work settings" onPress={createRow} busy={busy} />
        </Card>
      );
    }
    if (!data) return null;

    const webField = (f: { key: string; label: string; kind?: Kind }) => {
      const wide = f.kind === "json";
      const box = wide ? { width: "100%" as const } : twoColumn;
      const raw = data.config?.[f.key];
      if (editing && f.kind === "flag") {
        const on = draft[f.key] === "true";
        return (
          <TouchableOpacity
            key={f.key}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => setDraft(d => ({ ...d, [f.key]: on ? "false" : "true" }))}
            style={[box, { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, alignSelf: "flex-end" }]}
          >
            {on ? <CheckSquare size={18} color={ui.color.primary} /> : <Square size={18} color={ui.color.borderStrong} />}
            <Txt variant="strong">{f.label}</Txt>
          </TouchableOpacity>
        );
      }
      if (editing) {
        return (
          <Input
            key={f.key}
            style={box}
            label={f.label}
            value={draft[f.key] ?? ""}
            autoCapitalize="none"
            onChangeText={(v: string) => setDraft(d => ({ ...d, [f.key]: v }))}
            keyboardType={f.kind === "num" ? "decimal-pad" : "default"}
            multiline={wide}
          />
        );
      }
      const shown = f.kind === "flag" ? (raw ? "Yes" : "No")
        : raw === null || raw === undefined || raw === "" ? ""
        : wide ? JSON.stringify(raw) : String(raw);
      return <Detail key={f.key} style={box} label={f.label} value={shown} />;
    };

    return (
      <Card style={{ padding: 24, gap: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View>
            <Txt variant="section">Work settings</Txt>
            <Txt variant="caption">Shift, attendance rules and yearly leave quota</Txt>
          </View>
          {editing ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn label="Cancel" variant="secondary" onPress={() => setEditing(false)} disabled={busy} />
              <Btn label="Save changes" onPress={save} busy={busy} />
            </View>
          ) : (
            <Btn label="Edit settings" variant="secondary" onPress={startEdit} />
          )}
        </View>

        {GROUPS.map(g => (
          <View key={g.title} style={{ gap: 16, paddingTop: 20, borderTopWidth: 1, borderTopColor: ui.color.border }}>
            <Txt variant="strong">{g.title}</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 24, rowGap: 18 }}>{g.fields.map(webField)}</View>
          </View>
        ))}

        {data.balances ? (
          <View style={{ gap: 16, paddingTop: 20, borderTopWidth: 1, borderTopColor: ui.color.border }}>
            <Txt variant="strong">Current balances (view only)</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {Object.entries(data.balances).map(([k, v]) => (
                <View key={k} style={{ minWidth: 130, flexGrow: 1, padding: 12, borderRadius: ui.radius.control, backgroundColor: ui.color.canvas, borderWidth: 1, borderColor: ui.color.border }}>
                  <Txt variant="caption">{k}</Txt>
                  <Txt variant="heading" style={{ marginTop: 2 }}>{v === null || v === undefined ? "-" : String(v)}</Txt>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </Card>
    );
  }

  if (loading) {
    return (
      <View className="bg-white border border-[#E7E4F5] rounded-3xl p-8 items-center">
        <ActivityIndicator color="#5B4FD1" />
      </View>
    );
  }
  if (error) {
    return (
      <View className="bg-white border border-[#E7E4F5] rounded-3xl p-6 items-center gap-3">
        <Text style={fs(13, 11)} className="font-bold text-[#E4453C] text-center">{error}</Text>
        <TouchableOpacity onPress={load} className="bg-[#5B4FD1] px-5 py-2.5 rounded-xl">
          <Text className="text-white text-xs font-black">Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (data && !data.hasConfig) {
    return (
      <View className="bg-white border border-[#E7E4F5] rounded-3xl p-6 gap-4">
        <Text style={fs(15, 12)} className="font-black text-[#1F1B3D] uppercase tracking-wider">Work settings</Text>
        <Text style={fs(13, 11)} className="font-semibold text-[#7A76A6]">
          {data.name || empId} has no work settings yet (shift, grace time, yearly leave quota).
        </Text>
        <TouchableOpacity onPress={createRow} disabled={busy}
          style={{ width: isDesktop ? 260 : "100%" }}
          className="bg-[#5B4FD1] py-3.5 rounded-xl items-center active:opacity-90">
          {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
            <Text style={fs(13, 11)} className="text-white font-black uppercase tracking-wider">Create work settings</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }
  if (!data) return null;

  const renderField = (f: { key: string; label: string; kind?: Kind }) => {
    const raw = data.config?.[f.key];
    if (editing) {
      if (f.kind === "flag") {
        const on = draft[f.key] === "true";
        return (
          <TouchableOpacity key={f.key} onPress={() => setDraft(d => ({ ...d, [f.key]: on ? "false" : "true" }))}
            className="flex-row items-center justify-between bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5">
            <Text style={fs(13, 11)} className="font-bold text-[#7A76A6]">{f.label}</Text>
            {on ? <CheckSquare size={18} color="#5B4FD1" /> : <Square size={18} color="#CBD5E1" />}
          </TouchableOpacity>
        );
      }
      return (
        <View key={f.key} style={{ flexBasis: isDesktop ? "48%" : "100%", flexGrow: 1 }}>
          <Text style={fs(12, 10)} className="font-bold text-[#7A76A6] uppercase mb-1.5">{f.label}</Text>
          <TextInput value={draft[f.key] ?? ""} autoCapitalize="none"
            onChangeText={(v: string) => setDraft(d => ({ ...d, [f.key]: v }))}
            keyboardType={f.kind === "num" ? "decimal-pad" : "default"}
            multiline={f.kind === "json"}
            style={fs(14, 12)}
            className="bg-white border border-[#5B4FD1]/40 rounded-xl p-3.5 font-bold text-[#1F1B3D]" />
        </View>
      );
    }
    const shown = f.kind === "flag" ? (raw ? "Yes" : "No")
      : raw === null || raw === undefined || raw === "" ? "-"
      : f.kind === "json" ? JSON.stringify(raw) : String(raw);
    return (
      <View key={f.key} style={{ flexBasis: isDesktop ? "48%" : "100%", flexGrow: 1 }}>
        <Text style={fs(12, 10)} className="font-bold text-[#7A76A6] uppercase mb-1.5">{f.label}</Text>
        <View className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl p-3.5">
          <Text style={fs(14, 12)} className="font-bold text-[#1F1B3D]">{shown}</Text>
        </View>
      </View>
    );
  };

  return (
    <View className="bg-white border border-[#E7E4F5] rounded-3xl p-6 md:p-7 gap-5">
      <View className="flex-row justify-between items-center pb-3 border-b border-slate-100">
        <View className="flex-1 pr-3">
          <Text style={fs(15, 12)} className="font-black text-[#1F1B3D] uppercase tracking-wider">Work settings</Text>
          <Text style={fs(13, 10)} className="font-bold text-[#7A76A6] mt-0.5">{data.name} • {empId}</Text>
        </View>
        <Clock size={isDesktop ? 20 : 18} color="#5B4FD1" />
      </View>

      {GROUPS.map(g => (
        <View key={g.title} className="gap-3">
          <Text style={fs(12, 10)} className="font-black text-[#5B4FD1] uppercase tracking-wider">{g.title}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>{g.fields.map(renderField)}</View>
        </View>
      ))}

      {data.balances ? (
        <View className="gap-3">
          <Text style={fs(12, 10)} className="font-black text-[#5B4FD1] uppercase tracking-wider">Current balances (view only)</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {Object.entries(data.balances).map(([k, v]) => (
              <View key={k} className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl p-3.5 items-center" style={{ minWidth: 120, flexGrow: 1 }}>
                <Text style={fs(12, 10)} className="font-bold text-[#7A76A6] text-center">{k}</Text>
                <Text style={fs(18, 15)} className="font-black text-[#1F1B3D] mt-1">{v === null || v === undefined ? "-" : String(v)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View className="flex-row gap-3 pt-1">
        {editing ? (
          <>
            <TouchableOpacity onPress={() => setEditing(false)} disabled={busy}
              style={{ width: isDesktop ? 140 : undefined, flex: isDesktop ? undefined : 1 }}
              className="py-3.5 rounded-xl items-center border border-[#E7E4F5]">
              <Text style={fs(13, 11)} className="text-[#1F1B3D] font-black uppercase tracking-wider">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} disabled={busy}
              style={{ width: isDesktop ? 220 : undefined, flex: isDesktop ? undefined : 1 }}
              className="bg-[#5B4FD1] py-3.5 rounded-xl items-center active:opacity-90">
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                <Text style={fs(13, 11)} className="text-white font-black uppercase tracking-wider">Save work settings</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity onPress={startEdit}
            style={{ width: isDesktop ? 260 : "100%" }}
            className="bg-[#5B4FD1] py-3.5 rounded-xl items-center active:opacity-90">
            <Text style={fs(13, 11)} className="text-white font-black uppercase tracking-wider">Edit work settings</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}