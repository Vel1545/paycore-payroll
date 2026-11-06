import React from "react";
import { Platform, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft } from "lucide-react-native";

// Back button for website pages that have none on the phone. Renders nothing in the Android and iOS apps.
export default function WebBackButton({ onHero = false }: { onHero?: boolean }) {
  const navigation = useNavigation<any>();
  if (Platform.OS !== "web") return null;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
      className={`w-10 h-10 rounded-2xl items-center justify-center mr-3 ${
        onHero ? "bg-white/20 border border-white/25" : "bg-white border border-[#E7E4F5]"
      }`}
    >
      <ChevronLeft size={20} color={onHero ? "#FFFFFF" : "#1F1B3D"} />
    </TouchableOpacity>
  );
}
