import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Calendar as CalendarIcon } from "lucide-react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

interface CrossPlatformDatePickerProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
}

export default function CrossPlatformDatePicker({
  label,
  value,
  onChange,
}: CrossPlatformDatePickerProps) {
  const [showNativePicker, setShowNativePicker] = React.useState(false);

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const formatDateIso = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  if (Platform.OS === "web") {
    return (
      <View className="flex-1">
        <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1.5">
          {label}
        </Text>
        <View className="bg-brand-card border border-brand-border rounded-2xl px-4 py-3 flex-row justify-between items-center">
          <input
            type="date"
            value={formatDateIso(value)}
            onChange={(e) => {
              if (e.target.value) {
                const [year, month, day] = e.target.value.split("-").map(Number);
                onChange(new Date(year, month - 1, day));
              }
            }}
            style={{
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              fontFamily: "inherit",
              fontSize: "12px",
              fontWeight: "700",
              color: "#0F172A",
              width: "100%",
              cursor: "pointer",
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-1.5">
        {label}
      </Text>
      <TouchableOpacity
        onPress={() => setShowNativePicker(true)}
        className="bg-brand-card border border-brand-border rounded-2xl p-4 flex-row justify-between items-center"
      >
        <Text className="text-xs font-bold text-brand-dark">{formatDateDisplay(value)}</Text>
        <CalendarIcon size={15} color="#0D9488" />
      </TouchableOpacity>

      {showNativePicker && (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            setShowNativePicker(false);
            if (event.type === "set" && selectedDate) {
              onChange(selectedDate);
            }
          }}
        />
      )}
    </View>
  );
}