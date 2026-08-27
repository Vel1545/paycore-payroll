import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import ScreenContainer from "../components/ScreenContainer";

export default function ApprovalsScreen() {
  return (
    <ScreenContainer>
      <View className="mb-4">
        <Text className="text-3xl font-black text-brand-dark tracking-tight">Approval Inbox</Text>
        <Text className="text-xs font-bold text-brand-muted mt-0.5">Review pending requests from your direct team</Text>
      </View>

      <View className="flex-row space-x-2 mb-5">
        <View className="bg-brand-hero px-4 py-1.5 rounded-full"><Text className="text-white text-xs font-black">Pending (2)</Text></View>
        <View className="bg-brand-card border border-brand-border px-4 py-1.5 rounded-full"><Text className="text-brand-dark text-xs font-bold">Approved</Text></View>
        <View className="bg-brand-card border border-brand-border px-4 py-1.5 rounded-full"><Text className="text-brand-dark text-xs font-bold">History</Text></View>
      </View>

      {/* Card 1 */}
      <View className="bg-brand-card border border-brand-border rounded-2xl p-4 mb-4 shadow-xs">
        <View className="flex-row justify-between items-center mb-2">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-brand-hero items-center justify-center mr-2.5">
              <Text className="text-white text-xs font-bold">SJ</Text>
            </View>
            <View>
              <Text className="text-xs font-black text-brand-dark">Sarah Jenkins</Text>
              <Text className="text-[10px] font-semibold text-brand-muted">Software Engineer I</Text>
            </View>
          </View>
          <View className="bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg">
            <Text className="text-[10px] font-black text-brand-primary">Bal: 12d</Text>
          </View>
        </View>
        <Text className="text-xs font-bold text-brand-dark mb-1">• Annual Leave (Jan 28 - Feb 02 • 5 Days)</Text>
        <Text className="text-xs font-medium text-brand-muted italic mb-3">"Sprint tasks completed and handed over to David."</Text>
        <View className="flex-row space-x-2">
          <TouchableOpacity className="flex-1 bg-slate-100 py-2.5 rounded-xl items-center">
            <Text className="text-xs font-bold text-slate-700">Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 bg-brand-hero py-2.5 rounded-xl items-center">
            <Text className="text-white text-xs font-bold">Approve</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Card 2 */}
      <View className="bg-brand-card border border-brand-border rounded-2xl p-4 mb-8 shadow-xs">
        <View className="flex-row justify-between items-center mb-2">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-amber-700 items-center justify-center mr-2.5">
              <Text className="text-white text-xs font-bold">DM</Text>
            </View>
            <View>
              <Text className="text-xs font-black text-brand-dark">David Miller</Text>
              <Text className="text-[10px] font-semibold text-brand-muted">Senior Analyst</Text>
            </View>
          </View>
          <Text className="text-sm font-black text-brand-primary">$480.00</Text>
        </View>
        <Text className="text-xs font-bold text-brand-dark mb-1">• Client Outstation Travel</Text>
        <Text className="text-xs font-medium text-brand-muted italic mb-3">"Quarterly on-site workshop with client stakeholders."</Text>
        <View className="flex-row space-x-2">
          <TouchableOpacity className="flex-1 bg-slate-100 py-2.5 rounded-xl items-center">
            <Text className="text-xs font-bold text-slate-700">Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 bg-brand-hero py-2.5 rounded-xl items-center">
            <Text className="text-white text-xs font-bold">Approve</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}