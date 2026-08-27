import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Cake, Sparkles, Award, ArrowLeft } from "lucide-react-native";

export default function CelebrationsScreen({ navigation }: any) {
  return (
    <SafeAreaView className="flex-1 bg-slate-100/60">
      {/* Centered Desktop Shell */}
      <View className="flex-1 w-full max-w-2xl mx-auto px-4 py-4 md:py-6">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          
          {/* Top Title & Subtitle */}
          <View className="mb-5">
            <Text className="text-2xl font-black text-slate-900 tracking-tight">
              Team Celebrations 🎉
            </Text>
            <Text className="text-sm font-medium text-slate-600 mt-0.5">
              Celebrate milestones, birthdays & work anniversaries
            </Text>
          </View>

          {/* Today's Birthday Hero Card */}
          <View className="bg-purple-700 rounded-2xl p-5 mb-6 shadow-md border border-purple-800">
            <View className="flex-row items-center">
              <View className="w-14 h-14 bg-white rounded-2xl items-center justify-center mr-4 shadow-sm">
                <Cake size={28} color="#7E22CE" />
              </View>
              <View className="flex-1">
                <Text className="text-[11px] font-extrabold text-purple-200 uppercase tracking-wider mb-0.5">
                  Today's Birthday
                </Text>
                <Text className="text-white font-black text-lg">
                  Alex Richardson
                </Text>
                <Text className="text-purple-100 text-xs font-semibold mt-0.5">
                  Senior Product Designer • Design Team
                </Text>
                <TouchableOpacity className="mt-3 bg-white/20 self-start px-3.5 py-1.5 rounded-lg border border-white/20 active:opacity-80">
                  <Text className="text-white font-bold text-xs">
                    🎈 Send Birthday Wish
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Work Anniversaries Section */}
          <Text className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3">
            Work Anniversaries (This Month)
          </Text>
          <View className="space-y-3 mb-6">
            <View className="bg-white border border-slate-200 rounded-2xl p-4 flex-row items-center justify-between shadow-xs">
              <View className="flex-row items-center flex-1">
                <View className="w-11 h-11 bg-amber-100 rounded-xl items-center justify-center mr-3 border border-amber-200">
                  <Text className="text-amber-800 font-black text-sm">5Y</Text>
                </View>
                <View>
                  <Text className="text-sm font-bold text-slate-900">
                    Priya Sharma
                  </Text>
                  <Text className="text-xs font-semibold text-slate-500">
                    Principal DevOps • Jan 25
                  </Text>
                </View>
              </View>
              <TouchableOpacity className="bg-teal-50 border border-teal-200 px-3.5 py-1.5 rounded-lg active:opacity-80">
                <Text className="text-xs font-extrabold text-teal-800">
                  👏 Kudos
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Upcoming Birthdays Section */}
          <Text className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3">
            Upcoming (Next 14 Days)
          </Text>
          <View className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-xs mb-8">
            <View className="p-4 flex-row justify-between items-center">
              <Text className="text-xs font-extrabold text-teal-700 w-16">
                Feb 02
              </Text>
              <Text className="text-xs font-bold text-slate-800 flex-1 px-2">
                Elena Gomez • HR Ops
              </Text>
              <Text className="text-xs font-semibold text-slate-500">
                In 9 Days
              </Text>
            </View>
            <View className="p-4 flex-row justify-between items-center">
              <Text className="text-xs font-extrabold text-teal-700 w-16">
                Feb 06
              </Text>
              <Text className="text-xs font-bold text-slate-800 flex-1 px-2">
                David Vance • QA Lead
              </Text>
              <Text className="text-xs font-semibold text-slate-500">
                In 13 Days
              </Text>
            </View>
          </View>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}