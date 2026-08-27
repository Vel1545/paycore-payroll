import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Download, ShieldCheck, ChevronRight } from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";

export default function PayslipScreen() {
  return (
    <ScreenContainer>
      <View className="flex-row items-center justify-between mb-4">
        <View>
          <Text className="text-3xl font-black text-brand-dark tracking-tight">Payslip Detail</Text>
          <Text className="text-xs font-bold text-brand-muted mt-0.5">December 2025 • Disbursed Dec 28</Text>
        </View>
        <TouchableOpacity className="flex-row items-center bg-brand-hero px-4 py-2.5 rounded-xl active:opacity-90">
          <Download size={14} color="#FFFFFF" />
          <Text className="text-white font-black text-xs ml-1.5">PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Net Pay Banner */}
      <View className="bg-brand-hero border border-brand-hero rounded-3xl p-6 mb-5 shadow-sm">
        <Text className="text-xs font-black text-slate-300 uppercase tracking-widest">Take-Home Net Salary</Text>
        <Text className="text-3xl font-black text-brand-canvas mt-1">$5,420.00</Text>
        <View className="flex-row justify-between pt-3 mt-3 border-t border-white/10">
          <Text className="text-xs font-medium text-slate-300">Gross: <Text className="font-bold text-white">$6,500.00</Text></Text>
          <Text className="text-xs font-medium text-rose-300">Deductions: <Text className="font-bold text-rose-300">-$1,080.00</Text></Text>
        </View>
      </View>

      {/* Earnings */}
      <Text className="text-xs font-black text-brand-dark uppercase tracking-widest mb-3">Earnings & Allowances</Text>
      <View className="bg-brand-card border border-brand-border rounded-2xl p-4 mb-5 shadow-xs divide-y divide-slate-100">
        <View className="py-2.5 flex-row justify-between items-center"><Text className="text-xs font-bold text-brand-muted">Basic Salary</Text><Text className="text-xs font-black text-brand-dark">$4,200.00</Text></View>
        <View className="py-2.5 flex-row justify-between items-center"><Text className="text-xs font-bold text-brand-muted">House Rent Allowance (HRA)</Text><Text className="text-xs font-black text-brand-dark">$1,400.00</Text></View>
        <View className="py-2.5 flex-row justify-between items-center"><Text className="text-xs font-bold text-brand-muted">Special Allowance</Text><Text className="text-xs font-black text-brand-dark">$650.00</Text></View>
        <View className="py-2.5 flex-row justify-between items-center"><Text className="text-xs font-bold text-brand-muted">Bonus</Text><Text className="text-xs font-black text-brand-primary">+$250.00</Text></View>
      </View>

      {/* Deductions */}
      <Text className="text-xs font-black text-brand-dark uppercase tracking-widest mb-3">Tax & Statutory Deductions</Text>
      <View className="bg-brand-card border border-brand-border rounded-2xl p-4 mb-5 shadow-xs divide-y divide-slate-100">
        <View className="py-2.5 flex-row justify-between items-center"><Text className="text-xs font-bold text-brand-muted">Income Tax (TDS)</Text><Text className="text-xs font-black text-rose-600">-$620.00</Text></View>
        <View className="py-2.5 flex-row justify-between items-center"><Text className="text-xs font-bold text-brand-muted">Provident Fund (PF)</Text><Text className="text-xs font-black text-rose-600">-$380.00</Text></View>
        <View className="py-2.5 flex-row justify-between items-center"><Text className="text-xs font-bold text-brand-muted">Health Insurance</Text><Text className="text-xs font-black text-rose-600">-$80.00</Text></View>
      </View>

      <TouchableOpacity className="bg-brand-card border border-brand-border rounded-2xl p-4 flex-row items-center justify-between mb-8 shadow-xs">
        <View className="flex-row items-center">
          <ShieldCheck size={20} color="#0D9488" />
          <View className="ml-3">
            <Text className="text-xs font-black text-brand-dark">Form 16 / W-2 Annual Tax Summary</Text>
            <Text className="text-[11px] font-semibold text-brand-muted">YTD Tax Paid: $7,440.00</Text>
          </View>
        </View>
        <ChevronRight size={18} color="#0F172A" />
      </TouchableOpacity>
    </ScreenContainer>
  );
}