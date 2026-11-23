import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { FileSpreadsheet, Download, Upload, ShieldCheck, CheckCircle2, XCircle, AlertTriangle } from "lucide-react-native";
import { BASE_HOST } from "../constants/config";
import { authHeaders } from "../services/apiAuth";

const API = `${BASE_HOST}/api/admin/bulk-import`;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Table = "users" | "user_configs";
type Picked = { uri: string; name: string; size?: number; mimeType?: string; file?: any };
type Result = { ok: boolean; dryRun: boolean; text: string; warnings: string[] };
type LogItem = { table: Table; file: string; rows: number; at: string };

const STEPS: { table: Table; step: string; title: string; note: string; columns: string }[] = [
  {
    table: "users",
    step: "Step 1",
    title: "Employees (users)",
    note: "Personal, salary and bank details. Upload this first.",
    columns: "emp_id, full_name, email, mobile_number, department, designation, doj, salary, role, is_active ...",
  },
  {
    table: "user_configs",
    step: "Step 2",
    title: "Work settings (user_configs)",
    note: "Shift, leave allocation and work mode. Every emp_id must already be uploaded in Step 1.",
    columns: "emp_id, user_name, department, status, shift_code, shift_start, shift_end, allocated_cl, allocated_sl ...",
  },
];

const notify = (title: string, msg: string) => (Platform.OS === "web" ? window.alert(`${title}\n\n${msg}`) : Alert.alert(title, msg));
const confirmAsk = (title: string, msg: string, onYes: () => void) => {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${msg}`)) onYes();
  } else {
    Alert.alert(title, msg, [{ text: "Cancel", style: "cancel" }, { text: "Upload", onPress: onYes }]);
  }
};
const kb = (n?: number) => (n == null ? "" : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

// Onboarding page > Bulk Import: Excel upload into users and user_configs (the same API Postman used).
// Check file = every row checked and inserted, then undone (nothing saved). Upload = saved, all rows or none.
export default function BulkImportPanel({ isDesktop }: { isDesktop?: boolean }) {
  const [files, setFiles] = useState<Record<Table, Picked | null>>({ users: null, user_configs: null });
  const [busy, setBusy] = useState<string | null>(null); // "users:check" | "users:upload" | "users:template" ...
  const [results, setResults] = useState<Record<Table, Result | null>>({ users: null, user_configs: null });
  const [log, setLog] = useState<LogItem[]>([]);

  const pick = async (table: Table) => {
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === "web" ? [".xlsx", XLSX_MIME] : [XLSX_MIME, "application/octet-stream"],
        copyToCacheDirectory: true,
      });
      if (r.canceled || !r.assets?.length) return;
      const a: any = r.assets[0];
      if (!String(a.name || "").toLowerCase().endsWith(".xlsx")) {
        notify("Excel file needed", "Please choose an .xlsx file (in Excel: File > Save As > Excel Workbook).");
        return;
      }
      setFiles((f) => ({ ...f, [table]: { uri: a.uri, name: a.name, size: a.size, mimeType: a.mimeType, file: a.file } }));
      setResults((s) => ({ ...s, [table]: null }));
    } catch (e: any) {
      notify("Could not open the file", e?.message || "Try again");
    }
  };

  const send = async (table: Table, dryRun: boolean) => {
    const f = files[table];
    if (!f) return;
    setBusy(`${table}:${dryRun ? "check" : "upload"}`);
    setResults((s) => ({ ...s, [table]: null }));
    try {
      const form = new FormData();
      form.append("tableName", table);
      form.append("dryRun", String(dryRun));
      if (Platform.OS === "web") {
        const blob: Blob = f.file ?? (await (await fetch(f.uri)).blob());
        form.append("file", blob, f.name);
      } else {
        form.append("file", { uri: f.uri, name: f.name, type: f.mimeType || XLSX_MIME } as any);
      }
      const res = await fetch(`${API}/upload`, { method: "POST", body: form });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.status !== "SUCCESS") {
        setResults((s) => ({
          ...s,
          [table]: { ok: false, dryRun, text: j?.error || j?.message || `The server answered ${res.status}.`, warnings: [] },
        }));
        return;
      }
      setResults((s) => ({
        ...s,
        [table]: { ok: true, dryRun, text: j?.message || "Done.", warnings: Array.isArray(j?.warnings) ? j.warnings : [] },
      }));
      if (!dryRun) {
        const at = new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
        setLog((l) => [{ table, file: f.name, rows: Number(j?.recordsInserted || 0), at }, ...l].slice(0, 5));
        setFiles((x) => ({ ...x, [table]: null })); // the same file cannot be imported twice by mistake
      }
    } catch (e: any) {
      setResults((s) => ({ ...s, [table]: { ok: false, dryRun, text: e?.message || "No connection. Try again.", warnings: [] } }));
    } finally {
      setBusy(null);
    }
  };

  const upload = (table: Table) => {
    const f = files[table];
    if (!f) return;
    confirmAsk(
      "Import into " + table,
      `Insert all rows from ${f.name} into ${table}? All rows are saved, or none if any row has a problem.`,
      () => send(table, false)
    );
  };

  const downloadTemplate = async (table: Table) => {
    setBusy(`${table}:template`);
    const url = `${API}/template?tableName=${table}`;
    const fileName = `Import_template_${table}.xlsx`;
    try {
      if (Platform.OS === "web") {
        const res = await fetch(url);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const href = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.setAttribute("download", fileName);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => window.URL.revokeObjectURL(href), 10000);
        return;
      }
      const out = await FileSystem.downloadAsync(url, `${FileSystem.documentDirectory}${fileName}`, { headers: authHeaders() });
      if (out.status !== 200) {
        let msg = `HTTP ${out.status}`;
        try {
          const body = JSON.parse(await FileSystem.readAsStringAsync(out.uri));
          msg = body?.message || body?.error || msg;
        } catch {
          /* keep the status */
        }
        await FileSystem.deleteAsync(out.uri, { idempotent: true });
        throw new Error(msg);
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(out.uri, { mimeType: XLSX_MIME, dialogTitle: "Save the template", UTI: "org.openxmlformats.spreadsheetml.sheet" });
      } else {
        notify("Template saved", out.uri);
      }
    } catch (e: any) {
      notify("Could not download the template", e?.message || "Try again");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ width: isDesktop ? 760 : "100%", alignSelf: "center" }} className="gap-4">
      {STEPS.map((s) => {
        const f = files[s.table];
        const r = results[s.table];
        const isBusy = (k: string) => busy === `${s.table}:${k}`;
        const anyBusy = busy !== null;
        return (
          <View key={s.table} className="bg-white border border-[#E7E4F5] rounded-3xl p-5 gap-3 shadow-xs">
            <View className="flex-row items-center gap-3 pb-3 border-b border-slate-100">
              <View className="w-10 h-10 rounded-xl bg-[#EEECFA] items-center justify-center">
                <FileSpreadsheet size={20} color="#5B4FD1" />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-black text-[#5B4FD1] uppercase tracking-wider">{s.step}</Text>
                <Text className="text-base font-black text-[#1F1B3D]">{s.title}</Text>
                <Text className="text-[11px] font-semibold text-[#7A76A6]">{s.note}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => downloadTemplate(s.table)}
              disabled={anyBusy}
              className="self-start flex-row items-center border border-[#5B4FD1]/30 rounded-xl px-3 py-2 active:opacity-80"
            >
              {isBusy("template") ? <ActivityIndicator size="small" color="#5B4FD1" /> : <Download size={13} color="#5B4FD1" />}
              <Text className="text-[11px] font-black text-[#5B4FD1] ml-1.5">Download template</Text>
            </TouchableOpacity>
            <Text className="text-[10.5px] font-semibold text-[#A6A2CE]">Main columns: {s.columns}</Text>

            <TouchableOpacity
              onPress={() => pick(s.table)}
              disabled={anyBusy}
              className="border-2 border-dashed border-[#D4D2FC] rounded-2xl p-4 items-center bg-[#F8F7FF] active:opacity-80"
            >
              {f ? (
                <>
                  <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>{f.name}</Text>
                  <Text className="text-[10.5px] font-semibold text-[#7A76A6] mt-0.5">{kb(f.size)} • tap to choose another file</Text>
                </>
              ) : (
                <>
                  <Upload size={18} color="#5B4FD1" />
                  <Text className="text-xs font-black text-[#5B4FD1] mt-1">Choose Excel file (.xlsx)</Text>
                </>
              )}
            </TouchableOpacity>

            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => send(s.table, true)}
                disabled={!f || anyBusy}
                className={`flex-1 rounded-xl py-3 flex-row items-center justify-center border ${
                  f && !anyBusy ? "border-[#5B4FD1] bg-white active:opacity-80" : "border-slate-200 bg-slate-50"
                }`}
              >
                {isBusy("check") ? (
                  <ActivityIndicator size="small" color="#5B4FD1" />
                ) : (
                  <>
                    <ShieldCheck size={14} color={f && !anyBusy ? "#5B4FD1" : "#94A3B8"} />
                    <Text className={`text-xs font-black uppercase ml-1.5 ${f && !anyBusy ? "text-[#5B4FD1]" : "text-slate-400"}`}>
                      Check file
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => upload(s.table)}
                disabled={!f || anyBusy}
                className={`flex-1 rounded-xl py-3 flex-row items-center justify-center ${
                  f && !anyBusy ? "bg-[#5B4FD1] active:opacity-90" : "bg-slate-300"
                }`}
              >
                {isBusy("upload") ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Upload size={14} color="#FFFFFF" />
                    <Text className="text-xs font-black text-white uppercase ml-1.5">Upload</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {r && (
              <View
                className={`rounded-xl p-3 border flex-row ${
                  r.ok ? (r.dryRun ? "bg-sky-50 border-sky-200" : "bg-emerald-50 border-emerald-200") : "bg-rose-50 border-rose-200"
                }`}
              >
                {r.ok ? (
                  <CheckCircle2 size={16} color={r.dryRun ? "#0369A1" : "#047857"} />
                ) : (
                  <XCircle size={16} color="#BE123C" />
                )}
                <View className="flex-1 ml-2">
                  <Text
                    className={`text-xs font-bold ${r.ok ? (r.dryRun ? "text-sky-800" : "text-emerald-800") : "text-rose-800"}`}
                  >
                    {r.text}
                  </Text>
                  {r.warnings.map((w) => (
                    <View key={w} className="flex-row items-start mt-1.5">
                      <AlertTriangle size={12} color="#B45309" />
                      <Text className="text-[11px] font-semibold text-amber-800 ml-1 flex-1">{w}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        );
      })}

      <View className="bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl p-4 gap-1">
        <Text className="text-[11px] font-black text-[#1F1B3D] uppercase">Rules</Text>
        {[
          "Use the template: row 1 must be the column names, exactly as in the template. Fill the first sheet only.",
          "Red columns in the template are required. An empty cell means no value.",
          "Dates: 2026-11-05 or 05/11/2026. Times: 09:00 or 9:00 AM. Yes/No columns: 1 or 0.",
          "All rows are saved, or none: if one row has a problem nothing is imported, so fix it and upload again.",
          "Existing employees are never changed: a row with an emp_id that already exists stops the import.",
          "No welcome mail is sent for imported employees. Send it from Admin Hub > Policy Acceptance.",
        ].map((t) => (
          <Text key={t} className="text-[11px] font-semibold text-[#7A76A6] leading-5">• {t}</Text>
        ))}
      </View>

      {log.length > 0 && (
        <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 gap-1.5">
          <Text className="text-[11px] font-black text-[#1F1B3D] uppercase">Uploaded now</Text>
          {log.map((l, i) => (
            <Text key={`${l.at}-${i}`} className="text-[11px] font-semibold text-[#1F1B3D]">
              {l.at} • {l.table} • {l.file} • <Text className="font-black text-emerald-700">{l.rows} rows</Text>
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
