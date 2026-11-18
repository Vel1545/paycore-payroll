// Home screen strip, all day: "Today's birthdays" + Wish button (opens Celebrations). Hidden when nobody has a birthday.
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useBirthdaysToday } from "../utils/useBirthdaysToday";

type Props = { empId?: string | null; onOpen: () => void };

export default function BirthdayTodayCard({ empId, onOpen }: Props) {
  const { data } = useBirthdaysToday(true);
  if (!data || data.people.length === 0) return null;

  const meId = (empId || "").toUpperCase();
  const isMe = data.people.some((p) => p.empId.toUpperCase() === meId);
  const onlyMe = isMe && data.people.length === 1;

  return (
    <View
      className="rounded-2xl p-4 mb-6 flex-row items-center border"
      style={{ backgroundColor: "#FFF1F5", borderColor: "#F9A8C4" }}
    >
      <Text style={{ fontSize: 30, marginRight: 12 }}>{isMe ? "🎉" : "🎂"}</Text>
      <View className="flex-1">
        <Text className="text-[11px] font-black uppercase tracking-wider text-[#BE185D]">
          {onlyMe ? "Happy birthday to you!" : "Today's birthdays"}
        </Text>
        <View className="flex-row flex-wrap mt-1.5" style={{ gap: 6 }}>
          {data.people.map((p) => {
            const mine = p.empId.toUpperCase() === meId;
            return (
              <View key={p.empId} className="px-2.5 py-1 rounded-full bg-white border" style={{ borderColor: "#F9A8C4" }}>
                <Text className="text-xs font-bold text-[#1F1B3D]">{mine ? `${p.name} (you)` : p.name}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <TouchableOpacity onPress={onOpen} className="ml-3 px-4 py-2.5 rounded-xl bg-[#5B4FD1] active:opacity-80">
        <Text className="text-xs font-black text-white">{onlyMe ? "See wishes" : "Wish"}</Text>
      </TouchableOpacity>
    </View>
  );
}
