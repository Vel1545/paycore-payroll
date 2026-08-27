import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { UploadCloud } from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";

export default function ApplyScreen({ route }: any) {
  const [activeTab, setActiveTab] = useState(route?.params?.tab || "leave");

  return (
    <ScreenContainer>
      <View className="mb-4">
        <Text className="text-3xl font-black text-brand-dark tracking-tight">Unified Request</Text>
        <Text className="text-xs font-bold text-brand-muted mt-0.5">Submit HR or Payroll requests instantly</Text>
      </View>

      {/* 4 Tabs */}
      <View className="flex-row bg-brand-hero/10 p-1 rounded-2xl mb-5 border border-brand-border">
        {["leave", "expense", "overtime", "advance"].map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl items-center ${activeTab === tab ? "bg-brand-hero shadow-xs" : ""}`}
          >
            <Text className={`text-xs capitalize font-black ${activeTab === tab ? "text-white" : "text-brand-dark"}`}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* TAB 1: LEAVE */}
      {activeTab === "leave" && (
        <View className="space-y-4">
          <View className="bg-brand-card border border-brand-border rounded-2xl p-4">
            <Text className="text-xs font-black text-brand-primary">Earned Leave Balance: 14 Days Available</Text>
          </View>
          <View>
            <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1.5">Leave Category</Text>
            <View className="bg-brand-card border border-brand-border rounded-2xl p-4">
              <Text className="text-xs font-bold text-brand-dark">Annual / Paid Vacation (EL)</Text>
            </View>
          </View>
          <View className="flex-row space-x-3">
            <View className="flex-1">
              <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1.5">From Date</Text>
              <View className="bg-brand-card border border-brand-border rounded-2xl p-4">
                <Text className="text-xs font-bold text-brand-dark">Jan 28, 2026 📅</Text>
              </View>
            </View>
            <View className="flex-1">
              <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1.5">To Date</Text>
              <View className="bg-brand-card border border-brand-border rounded-2xl p-4">
                <Text className="text-xs font-bold text-brand-dark">Feb 02, 2026 📅</Text>
              </View>
            </View>
          </View>
          <View>
            <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1.5">Reason / Handover Note</Text>
            <TextInput
              multiline
              numberOfLines={3}
              placeholder="Handover to David Miller. Reachable via email."
              placeholderTextColor="#8C7A6B"
              className="bg-brand-card border border-brand-border rounded-2xl p-4 text-xs font-semibold text-brand-dark"
            />
          </View>
          <TouchableOpacity className="bg-brand-hero rounded-2xl py-4 items-center mt-2 shadow-sm active:opacity-90">
            <Text className="text-white font-black text-xs uppercase tracking-wider">Submit Leave Request</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* TAB 2: EXPENSE */}
      {activeTab === "expense" && (
        <View className="space-y-4">
          <View>
            <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1.5">Expense Category</Text>
            <View className="bg-brand-card border border-brand-border rounded-2xl p-4">
              <Text className="text-xs font-bold text-brand-dark">Travel & Client Lodging</Text>
            </View>
          </View>
          <View className="flex-row space-x-3">
            <View className="flex-1">
              <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1.5">Amount (USD)</Text>
              <TextInput defaultValue="$ 320.50" className="bg-brand-card border border-brand-border rounded-2xl p-4 text-xs font-black text-brand-primary" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1.5">Expense Date</Text>
              <View className="bg-brand-card border border-brand-border rounded-2xl p-4">
                <Text className="text-xs font-bold text-brand-dark">Jan 22, 2026 📅</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity className="border-2 border-dashed border-brand-border bg-brand-card rounded-2xl p-4 items-center justify-center">
            <UploadCloud size={24} color="#0D9488" />
            <Text className="text-xs font-black text-brand-dark mt-1.5">receipt_dinner_2201.pdf (1.2 MB)</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-brand-hero rounded-2xl py-4 items-center mt-2 shadow-sm active:opacity-90">
            <Text className="text-white font-black text-xs uppercase tracking-wider">Submit Reimbursement Claim</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* TAB 3: OVERTIME */}
      {activeTab === "overtime" && (
        <View className="space-y-4">
          <View>
            <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1.5">Project / Cost Center</Text>
            <View className="bg-brand-card border border-brand-border rounded-2xl p-4">
              <Text className="text-xs font-bold text-brand-dark">PRJ-8092 • Core Banking Migration</Text>
            </View>
          </View>
          <View className="flex-row space-x-3">
            <View className="flex-1">
              <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1.5">OT Date</Text>
              <View className="bg-brand-card border border-brand-border rounded-2xl p-4"><Text className="text-xs font-bold text-brand-dark">Jan 20, 2026 📅</Text></View>
            </View>
            <View className="flex-1">
              <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1.5">Hours Logged</Text>
              <TextInput defaultValue="4.5 Hours" className="bg-brand-card border border-brand-border rounded-2xl p-4 text-xs font-black text-brand-primary" />
            </View>
          </View>
          <TouchableOpacity className="bg-brand-hero rounded-2xl py-4 items-center mt-2 shadow-sm active:opacity-90">
            <Text className="text-white font-black text-xs uppercase tracking-wider">Submit Overtime for Approval</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* TAB 4: ADVANCE */}
      {activeTab === "advance" && (
        <View className="space-y-4">
          <View className="bg-brand-card border border-brand-border rounded-2xl p-4 flex-row justify-between">
            <Text className="text-xs font-black text-brand-dark">Max Limit: $2,500.00</Text>
            <Text className="text-xs font-bold text-brand-primary">0% Interest</Text>
          </View>
          <View>
            <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1.5">Requested Amount</Text>
            <TextInput defaultValue="$ 1,500.00" className="bg-brand-card border border-brand-border rounded-2xl p-4 text-base font-black text-brand-primary" />
          </View>
          <TouchableOpacity className="bg-brand-hero rounded-2xl py-4 items-center mt-2 shadow-sm active:opacity-90">
            <Text className="text-white font-black text-xs uppercase tracking-wider">Confirm & Sign Loan Agreement</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}