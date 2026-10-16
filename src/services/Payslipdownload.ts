// services/payslipDownload.ts - one function used by the employee page AND the admin page.
// Web: downloads the PDF through the browser. Phone: saves the file and opens the share / save sheet.
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { BASE_HOST } from "../constants/config";

type Opts = {
  /** admin check: paints every field that has no data yellow */
  highlight?: boolean;
  /** payslip template name (organisation); leave empty for the default */
  template?: string;
  /** add { Authorization: `Bearer ${token}` } here when the endpoint is protected */
  headers?: Record<string, string>;
};

export async function downloadPayslipPdf(empId: string, month: string, opts: Opts = {}) {
  const q =
    `empId=${encodeURIComponent(empId)}&month=${encodeURIComponent(month)}` +
    (opts.highlight ? "&highlight=true" : "") +
    (opts.template ? `&template=${encodeURIComponent(opts.template)}` : "");
  const url = `${BASE_HOST}/api/payroll/payslip/pdf?${q}`;
  const fileName = `Payslip_${empId}_${month}${opts.highlight ? "_check" : ""}.pdf`;

  if (Platform.OS === "web") {
    const res = await fetch(url, { headers: opts.headers });
    if (!res.ok) throw new Error(await errorText(res));
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

  const target = `${FileSystem.documentDirectory}${fileName}`;
  const out = await FileSystem.downloadAsync(url, target, { headers: opts.headers });
  if (out.status !== 200) {
    // the server sent {"message": "..."} instead of a PDF: show that message
    let msg = `HTTP ${out.status}`;
    try {
      const body = JSON.parse(await FileSystem.readAsStringAsync(out.uri));
      if (body?.message) msg = body.message;
    } catch { /* keep the status text */ }
    await FileSystem.deleteAsync(out.uri, { idempotent: true });
    throw new Error(msg);
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(out.uri, { mimeType: "application/pdf", dialogTitle: "Save payslip", UTI: "com.adobe.pdf" });
  }
}

async function errorText(res: Response) {
  try {
    const j = await res.json();
    if (j?.message) return String(j.message);
  } catch { /* not json */ }
  return `HTTP ${res.status}`;
}