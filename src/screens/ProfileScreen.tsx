import React, { useState } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Platform, 
  Alert,
  Modal
} from "react-native";
import { 
  User, 
  Landmark, 
  FileText, 
  Bell, 
  Lock, 
  HelpCircle, 
  LogOut, 
  ChevronRight, 
  X,
  ShieldCheck,
  Building,
  Mail,
  Phone
} from "lucide-react-native";
import { clearActiveSessionOnly } from "../utils/authStorage";

interface ProfileScreenProps {
  navigation: {
    goBack?: () => void;
    navigate: (screen: string) => void;
    replace?: (screen: string) => void;
    reset?: (config: any) => void;
  };
  onLogout?: () => void;
}

export default function ProfileScreen({ navigation, onLogout }: ProfileScreenProps) {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const userProfile = {
    name: "Marcus Smith",
    role: "HR Manager",
    empId: "EMP-1042",
    email: "marcus.smith@paycore.io",
    phone: "+91 98450 12345",
    department: "Human Resources",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop"
  };

  const menuItems = [
    { id: "personal", title: "Personal Information", icon: User },
    { id: "bank", title: "Bank Details", icon: Landmark },
    { id: "tax", title: "Tax Information", icon: FileText },
    { id: "notifications", title: "Notification Settings", icon: Bell },
    { id: "password", title: "Change Password", icon: Lock },
    { id: "help", title: "Help & Support", icon: HelpCircle },
  ];

  const handleLogoutPress = () => {
    const confirmLogout = async () => {
      await clearActiveSessionOnly();
      if (onLogout) {
        onLogout();
      } else if (navigation.replace) {
        navigation.replace("Login");
      } else if (navigation.reset) {
        navigation.reset({
          index: 0,
          routes: [{ name: "Login" }],
        });
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to log out?")) {
        confirmLogout();
      }
    } else {
      Alert.alert("Confirm Logout", "Are you sure you want to log out of your session?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: confirmLogout },
      ]);
    }
  };

  return (
    <View className="flex-1 bg-[#5B4FD1]">
      {/* ========================================================================= */}
      {/* 1. TOP PURPLE HERO HEADER (Profile Avatar & Title)                         */}
      {/* ========================================================================= */}
      <View className="pt-12 pb-8 px-6 max-w-xl mx-auto w-full">
        <View className="flex-row items-center gap-4">
          <View className="w-16 h-16 rounded-full border-2 border-white/80 overflow-hidden shadow-sm bg-white">
            <Image 
              source={{ uri: userProfile.avatar }} 
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>

          <View>
            <Text className="text-xl font-black text-white tracking-tight">
              {userProfile.name}
            </Text>
            <Text className="text-xs font-semibold text-purple-200 mt-0.5">
              {userProfile.role}
            </Text>
          </View>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2. ROUNDED BODY SHEET & ITEM NAVIGATION                                   */}
      {/* ========================================================================= */}
      <View className="flex-1 bg-white rounded-t-[36px] shadow-lg overflow-hidden">
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 12,
            paddingBottom: Platform.OS === "web" ? 30 : 110, // Dock clearance
          }}
          className="flex-1 max-w-xl mx-auto w-full"
        >
          {/* Main Action Rows */}
          <View className="px-4 divide-y divide-slate-100">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setActiveModal(item.id)}
                  activeOpacity={0.7}
                  className="py-4 px-2 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-3.5">
                    <Icon size={20} color="#7A76A6" />
                    <Text className="text-sm font-bold text-[#1F1B3D]">
                      {item.title}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#A6A2CE" />
                </TouchableOpacity>
              );
            })}

            {/* Logout Row */}
            <TouchableOpacity
              onPress={handleLogoutPress}
              activeOpacity={0.7}
              className="py-4 px-2 flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3.5">
                <LogOut size={20} color="#E4453C" />
                <Text className="text-sm font-bold text-[#E4453C]">
                  Logout
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* ========================================================================= */}
      {/* 3. INFORMATION MODAL (Sheet Preview for Tap Actions)                       */}
      {/* ========================================================================= */}
      <Modal visible={!!activeModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="w-full max-w-md bg-white rounded-3xl p-5 border border-[#E7E4F5] shadow-2xl">
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <Text className="text-sm font-black text-[#1F1B3D] uppercase tracking-wider">
                {activeModal === "personal" && "Personal Information"}
                {activeModal === "bank" && "Verified Bank Account"}
                {activeModal === "tax" && "Tax & Statutory Info"}
                {activeModal === "notifications" && "Notification Preferences"}
                {activeModal === "password" && "Security & Password"}
                {activeModal === "help" && "Help & Support"}
              </Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <X size={18} color="#7A76A6" />
              </TouchableOpacity>
            </View>

            {activeModal === "personal" && (
              <View className="space-y-2.5">
                <View className="flex-row justify-between py-1.5 border-b border-slate-50">
                  <Text className="text-xs font-bold text-[#7A76A6]">Employee ID</Text>
                  <Text className="text-xs font-black text-[#1F1B3D]">{userProfile.empId}</Text>
                </View>
                <View className="flex-row justify-between py-1.5 border-b border-slate-50">
                  <Text className="text-xs font-bold text-[#7A76A6]">Department</Text>
                  <Text className="text-xs font-black text-[#1F1B3D]">{userProfile.department}</Text>
                </View>
                <View className="flex-row justify-between py-1.5 border-b border-slate-50">
                  <Text className="text-xs font-bold text-[#7A76A6]">Official Email</Text>
                  <Text className="text-xs font-black text-[#1F1B3D]">{userProfile.email}</Text>
                </View>
                <View className="flex-row justify-between py-1.5">
                  <Text className="text-xs font-bold text-[#7A76A6]">Phone</Text>
                  <Text className="text-xs font-black text-[#1F1B3D]">{userProfile.phone}</Text>
                </View>
              </View>
            )}

            {activeModal === "bank" && (
              <View className="space-y-2 py-2">
                <Text className="text-xs font-bold text-[#7A76A6]">Salary Credit Account</Text>
                <Text className="text-sm font-black text-[#1F1B3D]">HDFC Bank •••• 8842</Text>
                <Text className="text-[11px] text-emerald-600 font-bold">✓ Active Direct Deposit</Text>
              </View>
            )}

            {activeModal !== "personal" && activeModal !== "bank" && (
              <View className="py-4 items-center">
                <Text className="text-xs font-medium text-[#7A76A6]">
                  Record details are synced with corporate enterprise servers.
                </Text>
              </View>
            )}

            <TouchableOpacity 
              onPress={() => setActiveModal(null)}
              className="mt-4 bg-[#5B4FD1] py-3 rounded-xl items-center"
            >
              <Text className="text-white text-xs font-black">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}