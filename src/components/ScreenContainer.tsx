import React from "react";
import { View, ScrollView, Platform,ScrollViewProps  } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PAGE_MAX_WIDTH, useResponsive } from "../hooks/useResponsive";

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean; // false: the screen brings its own ScrollView (for example one with pull-to-refresh)
  contentContainerStyle?: object;
  fullWidth?: boolean;
  webMaxWidth?: number; // laptop/PC website only: a narrower centred column for form pages
  webHeader?: React.ReactNode; // laptop/PC website only: page top bar, full width above the content
  scrollRef?: React.Ref<ScrollView>; // lets a screen scroll the page itself (for example to a field)
 // was:  refreshControl?: React.ReactElement;
refreshControl?: ScrollViewProps["refreshControl"]; // optional pull-to-refresh for screens that use the built-in scrolling
}

export default function ScreenContainer({
  children,
  scrollable = true,
  contentContainerStyle,
  fullWidth = false,
  webMaxWidth,
  webHeader,
  scrollRef,
  refreshControl,
}: ScreenContainerProps) {
  const { isDesktop, isWebDesktop } = useResponsive();

  return (
    <View className="flex-1 w-full h-full bg-[#F6F5FC]">
      {isWebDesktop ? webHeader : null}
      <SafeAreaView className="flex-1 bg-[#F6F5FC]" edges={["top", "left", "right"]}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: isWebDesktop ? (webMaxWidth ?? PAGE_MAX_WIDTH) : isDesktop ? (fullWidth ? "94%" : 1100) : "100%",
            marginHorizontal: "auto",
            paddingHorizontal: isWebDesktop ? 32 : isDesktop ? 24 : 16,
            paddingTop: isWebDesktop ? 24 : 8,
          }}
        >
          {scrollable ? (
            <ScrollView
              ref={scrollRef}
              className="flex-1 w-full"
              showsVerticalScrollIndicator={false}
              refreshControl={refreshControl}
              // A tap on a button works with the keyboard open (no first tap that only closes the keyboard)
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              contentContainerStyle={[
                {
                  flexGrow: 1,
                  // the bottom bar floats over the page everywhere except the laptop/PC website
                  paddingBottom: isWebDesktop ? 40 : 110,
                },
                contentContainerStyle,
              ]}
            >
              {children}
            </ScrollView>
          ) : (
            <View
              className="flex-1 w-full"
              style={{ paddingBottom: isWebDesktop ? 30 : 100 }}
            >
              {children}
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}