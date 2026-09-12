import React from "react";
import { View, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResponsive } from "../hooks/useResponsive";

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: object;
  fullWidth?: boolean;
}

export default function ScreenContainer({
  children,
  scrollable = true,
  contentContainerStyle,
  fullWidth = false,
}: ScreenContainerProps) {
  const { isDesktop } = useResponsive();

  return (
    <View className="flex-1 w-full h-full bg-[#F6F5FC]">
      <SafeAreaView className="flex-1 bg-[#F6F5FC]" edges={["top", "left", "right"]}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: isDesktop ? (fullWidth ? "94%" : 1100) : "100%",
            marginHorizontal: "auto",
            paddingHorizontal: isDesktop ? 24 : 16,
            paddingTop: 8,
          }}
        >
          {scrollable ? (
            <ScrollView
              className="flex-1 w-full"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                {
                  flexGrow: 1,
                  paddingBottom: Platform.OS === "web" ? 40 : 110,
                },
                contentContainerStyle,
              ]}
            >
              {children}
            </ScrollView>
          ) : (
            <View
              className="flex-1 w-full"
              style={{ paddingBottom: Platform.OS === "web" ? 30 : 100 }}
            >
              {children}
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}