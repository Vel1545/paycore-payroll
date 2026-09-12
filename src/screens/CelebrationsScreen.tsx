import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Cake, Sparkles, Award, ChevronLeft, Heart, Calendar } from "lucide-react-native";

export default function CelebrationsScreen({ navigation }: any) {
  return (
    <SafeAreaView className="flex-1 bg-[#F6F5FC]" edges={["top"]}>
      {/* ========================================================================= */}
      {/* 1. TOP PURPLE BANNER HEADER                                               */}
      {/* ========================================================================= */}
      <View className="bg-[#5B4FD1] rounded-3xl pt-4 pb-6 px-5 mx-4 mt-2 mb-4 shadow-xs relative overflow-hidden">
        {/* Geometric Accents */}
        <View 
          className="absolute -top-3 -right-4 w-20 h-20 rounded-3xl border-2 border-white/20 pointer-events-none"
          style={{ transform: [{ rotate: "20deg" }] }}
        />
        <View 
          className="absolute top-12 -left-6 w-16 h-16 rounded-2xl border-2 border-white/10 pointer-events-none"
          style={{ transform: [{ rotate: "-15deg" }] }}
        />

        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity 
            onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate("Home"))}
            className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center active:opacity-80"
          >
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View className="bg-white/20 px-3 py-1 rounded-full border border-white/25 flex-row items-center">
            <Sparkles size={12} color="#FFFFFF" />
            <Text className="text-[10px] font-black text-white ml-1 uppercase tracking-wider">
              Workplace Culture
            </Text>
          </View>
        </View>

        <View className="items-center">
          <Text className="text-xl md:text-2xl font-black text-white tracking-tight">
            Team Celebrations 🎉
          </Text>
          <Text className="text-xs font-semibold text-white/80 mt-0.5 text-center">
            Birthdays, milestones & work anniversaries
          </Text>
        </View>
      </View>

      {/* Main Content Area */}
      <View className="flex-1 w-full max-w-4xl mx-auto px-4">
        <ScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: Platform.OS === "web" ? 30 : 120, // Clearance for floating navigation dock
          }}
        >
          {/* ========================================================================= */}
          {/* 2. TODAY'S BIRTHDAY HERO CARD                                             */}
          {/* ========================================================================= */}
          <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 mb-5 shadow-xs relative overflow-hidden">
            <View className="flex-row items-center">
              <View className="w-14 h-14 bg-[#EEECFA] rounded-2xl items-center justify-center mr-4 border border-[#5B4FD1]/20 shadow-xs">
                <Cake size={28} color="#5B4FD1" />
              </View>

              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <View className="bg-rose-100 px-2.5 py-0.5 rounded-full self-start mb-1">
                    <Text className="text-[9px] font-black text-rose-700 uppercase tracking-wider">
                      Today's Birthday 🎂
                    </Text>
                  </View>
                  <Text className="text-[10px] font-bold text-[#7A76A6]">Jan 24</Text>
                </View>

                <Text className="text-[#1F1B3D] font-black text-base">
                  Alex Richardson
                </Text>
                <Text className="text-[#7A76A6] text-xs font-medium mt-0.5">
                  Senior Product Designer • Design Team
                </Text>

                <TouchableOpacity className="mt-3 bg-[#5B4FD1] self-start px-3.5 py-2 rounded-xl flex-row items-center shadow-xs active:opacity-90">
                  <Heart size={13} color="#FFFFFF" />
                  <Text className="text-white font-black text-xs ml-1.5">
                    Send Birthday Wish
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ========================================================================= */}
          {/* 3. WORK ANNIVERSARIES SECTION                                             */}
          {/* ========================================================================= */}
          <View className="flex-row items-center justify-between mb-3 px-1">
            <View className="flex-row items-center gap-1.5">
              <Award size={15} color="#5B4FD1" />
              <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
                Work Anniversaries (This Month)
              </Text>
            </View>
            <Text className="text-[11px] font-bold text-[#7A76A6]">January 2026</Text>
          </View>

          <View className="space-y-3 mb-6">
            <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 flex-row items-center justify-between shadow-xs mb-2.5">
              <View className="flex-row items-center flex-1 pr-2">
                <View className="w-11 h-11 bg-[#FEF2D9] rounded-2xl items-center justify-center mr-3 border border-[#D08A0C]/20">
                  <Text className="text-[#D08A0C] font-black text-sm">5Y</Text>
                </View>
                <View>
                  <Text className="text-xs font-black text-[#1F1B3D]">
                    Priya Sharma
                  </Text>
                  <Text className="text-[11px] font-semibold text-[#7A76A6]">
                    Principal DevOps • Jan 25
                  </Text>
                </View>
              </View>

              <TouchableOpacity className="bg-[#E7FAEE] border border-[#1FAE5C]/30 px-3.5 py-1.5 rounded-xl active:opacity-80">
                <Text className="text-xs font-black text-[#1FAE5C]">
                  👏 Kudos
                </Text>
              </TouchableOpacity>
            </View>

            <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4 flex-row items-center justify-between shadow-xs">
              <View className="flex-row items-center flex-1 pr-2">
                <View className="w-11 h-11 bg-[#EEECFA] rounded-2xl items-center justify-center mr-3 border border-[#5B4FD1]/20">
                  <Text className="text-[#5B4FD1] font-black text-sm">2Y</Text>
                </View>
                <View>
                  <Text className="text-xs font-black text-[#1F1B3D]">
                    Marcus Sterling
                  </Text>
                  <Text className="text-[11px] font-semibold text-[#7A76A6]">
                    Software Engineer • Jan 29
                  </Text>
                </View>
              </View>

              <TouchableOpacity className="bg-[#E7FAEE] border border-[#1FAE5C]/30 px-3.5 py-1.5 rounded-xl active:opacity-80">
                <Text className="text-xs font-black text-[#1FAE5C]">
                  👏 Kudos
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ========================================================================= */}
          {/* 4. UPCOMING BIRTHDAYS SECTION                                             */}
          {/* ========================================================================= */}
          <View className="flex-row items-center justify-between mb-3 px-1">
            <View className="flex-row items-center gap-1.5">
              <Calendar size={15} color="#5B4FD1" />
              <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
                Upcoming (Next 14 Days)
              </Text>
            </View>
          </View>

          <View className="bg-white border border-[#E7E4F5] rounded-3xl divide-y divide-slate-100 shadow-xs mb-6">
            <View className="p-4 flex-row justify-between items-center">
              <View className="w-16 bg-[#EEECFA] py-1 rounded-lg items-center">
                <Text className="text-xs font-black text-[#5B4FD1]">Feb 02</Text>
              </View>
              <View className="flex-1 px-3">
                <Text className="text-xs font-black text-[#1F1B3D]">Elena Gomez</Text>
                <Text className="text-[10px] font-medium text-[#7A76A6]">HR Operations</Text>
              </View>
              <View className="bg-slate-100 px-2.5 py-1 rounded-full">
                <Text className="text-[10px] font-bold text-[#7A76A6]">In 9 Days</Text>
              </View>
            </View>

            <View className="p-4 flex-row justify-between items-center">
              <View className="w-16 bg-[#EEECFA] py-1 rounded-lg items-center">
                <Text className="text-xs font-black text-[#5B4FD1]">Feb 06</Text>
              </View>
              <View className="flex-1 px-3">
                <Text className="text-xs font-black text-[#1F1B3D]">David Vance</Text>
                <Text className="text-[10px] font-medium text-[#7A76A6]">QA Lead</Text>
              </View>
              <View className="bg-slate-100 px-2.5 py-1 rounded-full">
                <Text className="text-[10px] font-bold text-[#7A76A6]">In 13 Days</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}