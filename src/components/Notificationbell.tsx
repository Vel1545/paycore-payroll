import React, { useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Bell } from "lucide-react-native";
import { useNotifications } from "../constants/Usenotifications";
import { registerPushTokenWithServer } from "../constants/Notifications";

interface Props {
  navigation: any;
  empId: string;
  isAdmin: boolean;
}

/**
 * Everyone (admins too): shows the unread count and opens the Notifications screen.
 * Admin: requests raised by staff arrive there; tapping one opens Approvals.
 */
export default function NotificationBell({ navigation, empId, isAdmin }: Props) {
  const { unread } = useNotifications(empId, true);

  // Every role (admins too) hands its phone token to the server once the Home screen opens
  useEffect(() => {
    registerPushTokenWithServer(empId);
  }, [empId]);

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate("Notifications")}
      className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 items-center justify-center relative active:opacity-80 shadow-sm"
    >
      <Bell size={20} color="#FFFFFF" />

      {unread > 0 ? (
        <View
          style={{ minWidth: 20, height: 20, paddingHorizontal: 4, top: -6, right: -6 }}
          className="absolute rounded-full bg-rose-500 border-2 border-[#5B4FD1] items-center justify-center"
        >
          <Text className="text-[10px] font-black text-white">{unread > 99 ? "99+" : unread}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
