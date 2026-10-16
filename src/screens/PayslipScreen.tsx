import React, { useState } from "react";
import { View, Text, TouchableOpacity, Platform, Alert, ActivityIndicator } from "react-native";
import { Download, ChevronRight } from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";
import PayslipView, { MonthStepper, monthKey, monthLabel } from "../components/Payslipview";
import { useAuth } from "../context/AuthContext";
import { UserSession } from "../services/UserSession";
import { downloadPayslipPdf } from "../services/Payslipdownload";

interface PayslipScreenProps {
  navigation?: { navigate: (screen: string, params?: any) => void };
}

/** The logged-in person's own payslip. Admins also get a shortcut to every employee's salary. */
export default function PayslipScreen({ navigation }: PayslipScreenProps) {
  const { user } = useAuth();
  const empId = String(user?.empId || user?.userId || UserSession.empId || "");
  const isAdmin = !!(user?.isAdmin || String(user?.role || "").toUpperCase() === "ADMIN");
  // last month first: the current month is usually not finalized yet
  const [month, setMonth] = useState(() => monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)));

  const [pdfBusy, setPdfBusy] = useState(false);
  const notify = (title: string, msg: string) => (Platform.OS === "web" ? window.alert(`${title}\n${msg}`) : Alert.alert(title, msg));

  const downloadPdf = async () => {
    if (!empId) return notify("Payslip", "Could not find your employee id.");
    setPdfBusy(true);
    try {
      await downloadPayslipPdf(empId, month);
    } catch (e: any) {
      notify("Payslip not available", e?.message || "Try again");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <View className="flex-row items-center justify-between mb-4">
        <View>
          <Text className="text-3xl font-black text-brand-dark tracking-tight">Payslip Detail</Text>
          <Text className="text-xs font-bold text-brand-muted mt-0.5">{monthLabel(month)}</Text>
        </View>
        <TouchableOpacity onPress={downloadPdf} disabled={pdfBusy} className="flex-row items-center bg-brand-hero px-4 py-2.5 rounded-xl active:opacity-90" style={{ opacity: pdfBusy ? 0.6 : 1 }}>
          {pdfBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Download size={14} color="#FFFFFF" />}
          <Text className="text-white font-black text-xs ml-1.5">PDF</Text>
        </TouchableOpacity>
      </View>

      {isAdmin && navigation && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate("SalaryView")}
          className="flex-row items-center justify-between bg-[#EEECFA] border border-[#5B4FD1]/20 rounded-2xl px-4 py-3 mb-4"
        >
          <Text className="text-xs font-black text-[#5B4FD1] uppercase tracking-wider">View all employees' salary</Text>
          <ChevronRight size={16} color="#5B4FD1" />
        </TouchableOpacity>
      )}

      <MonthStepper month={month} onChange={setMonth} />
      <PayslipView empId={empId} month={month} mode="my" />
      <View style={{ height: 32 }} />
    </ScreenContainer>
  );
}