import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";
import CheckoutRequestsPanel from "../components/Checkoutrequestspanel";
import { useAuth } from "../context/AuthContext";
import { UserSession } from "../services/UserSession";

interface Nav {
  goBack?: () => void;
  navigate?: (screen: string, params?: any) => void;
  canGoBack?: () => boolean;
}

/** Stand-alone page (optional). The same list is also a tab inside the Apply screen. */
export default function MyCheckoutRequestsScreen({ navigation }: { navigation?: Nav }) {
  const { user } = useAuth();
  const empId = String(user?.empId || user?.userId || UserSession.empId || "");

  return (
    <ScreenContainer>
      <View className="mb-4 flex-row items-center gap-2.5">
        <TouchableOpacity
          onPress={() => (navigation?.canGoBack?.() ? navigation.goBack?.() : navigation?.navigate?.("Home"))}
          className="w-8 h-8 rounded-xl bg-white border border-[#E7E4F5] items-center justify-center shadow-xs"
        >
          <ChevronLeft size={18} color="#1F1B3D" />
        </TouchableOpacity>
        <View>
          <Text className="text-2xl font-black text-[#1F1B3D] tracking-tight">My Check-Out Requests</Text>
          <Text className="text-xs font-bold text-[#7A76A6] mt-0.5">Missed check-outs sent to admin</Text>
        </View>
      </View>
      <CheckoutRequestsPanel empId={empId} onOpenAttendance={() => navigation?.navigate?.("Attendance")} />
    </ScreenContainer>
  );
}