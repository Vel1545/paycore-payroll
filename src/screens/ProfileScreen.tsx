import React from "react";
import { View, Text, TouchableOpacity, Image, ScrollView } from "react-native";
import { 
  ArrowLeft, Mail, Calendar, Briefcase, 
  ShieldCheck, Phone, MapPin, Building, Award 
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";

interface ProfileScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string) => void;
  };
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  // Employee Profile Details
  const userProfile = {
    name: "Marcus Vance Sterling",
    empId: "EMP-1042",
    designation: "Principal Software Lead",
    department: "Core Platform & Infrastructure",
    officialEmail: "marcus.sterling@paycore.io",
    phone: "+91 98450 12345",
    dob: "14 Aug 1994",
    doj: "15 Mar 2024",
    workLocation: "Bangalore HQ • Tech Park",
    employmentType: "Full-Time Regular",
    reportingManager: "Sarah Jenkins (Director of Eng)",
    bloodGroup: "O +ve",
  };

  return (
    <ScreenContainer>
      {/* Top Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            className="w-10 h-10 bg-brand-card border border-brand-border rounded-xl items-center justify-center mr-3 shadow-xs"
          >
            <ArrowLeft size={18} color="#0F172A" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-black text-brand-dark tracking-tight">My Hub • Profile</Text>
            <Text className="text-xs font-bold text-brand-muted">Employee Identity & Official Records</Text>
          </View>
        </View>

        <View className="bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-xl flex-row items-center">
          <ShieldCheck size={14} color="#065F46" />
          <Text className="text-[10px] font-black text-emerald-900 ml-1">VERIFIED</Text>
        </View>
      </View>

      {/* Main Avatar & Hero Card */}
      <View className="bg-brand-hero border border-brand-hero rounded-3xl p-6 mb-5 shadow-sm items-center">
        <View className="relative mb-3">
          <Image 
            source={{ uri: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop" }}
            className="w-24 h-24 rounded-full border-4 border-brand-border"
          />
          <View className="absolute bottom-0 right-0 bg-brand-primary p-1.5 rounded-full border-2 border-brand-hero">
            <Award size={14} color="#FFFFFF" />
          </View>
        </View>

        <Text className="text-xl font-black text-white">{userProfile.name}</Text>
        <Text className="text-xs font-bold text-brand-canvas mt-0.5">{userProfile.designation}</Text>
        
        <View className="flex-row items-center space-x-2 mt-3">
          <View className="bg-white/10 px-3 py-1 rounded-full border border-white/15">
            <Text className="text-[11px] font-black text-white">{userProfile.empId}</Text>
          </View>
          <View className="bg-brand-primary/30 px-3 py-1 rounded-full border border-brand-primary/40">
            <Text className="text-[11px] font-bold text-teal-200">{userProfile.department}</Text>
          </View>
        </View>
      </View>

      {/* Primary Details Block */}
      <Text className="text-xs font-black text-brand-dark uppercase tracking-widest mb-3">
        Official Details
      </Text>
      <View className="bg-brand-card border border-brand-border rounded-3xl p-5 mb-5 shadow-xs divide-y divide-slate-100">
        {/* Official Email */}
        <View className="py-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 items-center justify-center mr-3">
              <Mail size={16} color="#0D9488" />
            </View>
            <View>
              <Text className="text-[10px] font-bold text-brand-muted uppercase">Official Email</Text>
              <Text className="text-xs font-black text-brand-dark mt-0.5">{userProfile.officialEmail}</Text>
            </View>
          </View>
        </View>

        {/* Date of Joining (DOJ) */}
        <View className="py-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 items-center justify-center mr-3">
              <Briefcase size={16} color="#D97706" />
            </View>
            <View>
              <Text className="text-[10px] font-bold text-brand-muted uppercase">Date of Joining (DOJ)</Text>
              <Text className="text-xs font-black text-brand-dark mt-0.5">{userProfile.doj}</Text>
            </View>
          </View>
          <View className="bg-amber-100 px-2.5 py-0.5 rounded-md">
            <Text className="text-[10px] font-black text-amber-900">2+ Yrs Tenured</Text>
          </View>
        </View>

        {/* Date of Birth (DOB) */}
        <View className="py-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 items-center justify-center mr-3">
              <Calendar size={16} color="#7E22CE" />
            </View>
            <View>
              <Text className="text-[10px] font-bold text-brand-muted uppercase">Date of Birth (DOB)</Text>
              <Text className="text-xs font-black text-brand-dark mt-0.5">{userProfile.dob}</Text>
            </View>
          </View>
        </View>

        {/* Designation & Role */}
        <View className="py-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3">
              <Building size={16} color="#0284C7" />
            </View>
            <View>
              <Text className="text-[10px] font-bold text-brand-muted uppercase">Designation</Text>
              <Text className="text-xs font-black text-brand-dark mt-0.5">{userProfile.designation}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Secondary Information Block */}
      <Text className="text-xs font-black text-brand-dark uppercase tracking-widest mb-3">
        Organization & Contact
      </Text>
      <View className="bg-brand-card border border-brand-border rounded-3xl p-5 mb-8 shadow-xs divide-y divide-slate-100">
        <View className="py-2.5 flex-row justify-between items-center">
          <Text className="text-xs font-bold text-brand-muted">Employment Type</Text>
          <Text className="text-xs font-black text-brand-dark">{userProfile.employmentType}</Text>
        </View>
        <View className="py-2.5 flex-row justify-between items-center">
          <Text className="text-xs font-bold text-brand-muted">Reporting Manager</Text>
          <Text className="text-xs font-black text-brand-dark">{userProfile.reportingManager}</Text>
        </View>
        <View className="py-2.5 flex-row justify-between items-center">
          <Text className="text-xs font-bold text-brand-muted">Work Base Location</Text>
          <Text className="text-xs font-black text-brand-dark">{userProfile.workLocation}</Text>
        </View>
        <View className="py-2.5 flex-row justify-between items-center">
          <Text className="text-xs font-bold text-brand-muted">Blood Group</Text>
          <Text className="text-xs font-black text-rose-600">{userProfile.bloodGroup}</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}