import React from "react";
import { View, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
}

export default function ScreenContainer({ children, scrollable = true }: ScreenContainerProps) {
  return (
    <View className="flex-1 w-full h-full bg-brand-canvas overflow-hidden">
      <SafeAreaView className="flex-1 bg-brand-canvas" edges={["top", "left", "right"]}>
        <View className="flex-1 w-full max-w-2xl mx-auto px-4 pt-2 pb-2">
          {scrollable ? (
            <ScrollView 
              className="flex-1" 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
            >
              {children}
            </ScrollView>
          ) : (
            <View className="flex-1 w-full overflow-hidden">
              {children}
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}