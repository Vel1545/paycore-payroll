import React from "react";
import { Pressable, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { CalendarClock, House, MessagesSquare, ShieldCheck, UserRoundCog } from "lucide-react-native";
import { FingerprintIcon } from "phosphor-react-native";
import { SIDEBAR_WIDTH } from "../hooks/useResponsive";
import { Txt, ui } from "./web/webUi";

// The same five destinations as the phone's bottom bar, shown as a left menu on a laptop/PC.
const MENU = [
  { route: "Home", label: "Home", Icon: House },
  { route: "Chat", label: "Chats", Icon: MessagesSquare },
  { route: "PunchClock", label: "Punch Clock", Icon: FingerprintIcon },
  { route: "Attendance", label: "Attendance", Icon: CalendarClock },
  { route: "Profile", label: "Settings", Icon: UserRoundCog },
];

export default function WebSidebar({ state, descriptors, navigation }: BottomTabBarProps) {
  const activeName = state.routes[state.index]?.name;

  return (
    <View
      style={{ width: SIDEBAR_WIDTH, height: "100%" }}
      className="bg-white border-r border-[#E7E4F5] px-3 pt-6"
    >
      <View className="flex-row items-center px-3 mb-8">
        <View className="w-9 h-9 rounded-xl bg-[#5B4FD1] items-center justify-center mr-2.5">
          <ShieldCheck size={20} color="#FFFFFF" />
        </View>
        <Txt variant="section" numberOfLines={1} style={{ fontSize: 16 }}>
          PayCore Global
        </Txt>
      </View>

      {MENU.map(({ route: routeName, label, Icon }) => {
        const route = state.routes.find((r) => r.name === routeName);
        if (!route) return null;
        const active = activeName === routeName;
        const badge = descriptors[route.key]?.options.tabBarBadge;

        const open = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) navigation.navigate(routeName);
        };

        return (
          <Pressable
            key={routeName}
            onPress={open}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            className={`flex-row items-center h-11 px-3 mb-1 rounded-xl ${
              active ? "bg-[#EEECFA]" : "web:hover:bg-[#F6F5FC]"
            }`}
          >
            <Icon size={20} color={active ? "#5B4FD1" : "#7A76A6"} />
            <Txt
              variant="strong"
              numberOfLines={1}
              style={{ flex: 1, marginLeft: 12, color: active ? ui.color.primary : ui.color.text }}
            >
              {label}
            </Txt>
            {badge != null && (
              <View className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#16A34A] items-center justify-center">
                <Text className="text-[10px] font-extrabold text-white">{badge}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
