import React, { useState } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";

export interface CrossPlatformDatePickerProps {
  label: string;
  value: string | Date; // Supports both legacy Date objects and "YYYY-MM-DD" strings
  onChange: (val: any) => void;
  compact?: boolean;
}

export default function CrossPlatformDatePicker({
  label,
  value,
  onChange,
  compact = false,
}: CrossPlatformDatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Normalize input value to both Date object and YYYY-MM-DD string
  const dateObj = value instanceof Date 
    ? value 
    : typeof value === "string" && value 
      ? new Date(value + (value.includes("T") ? "" : "T00:00:00")) 
      : new Date();

  const formattedStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;

  const handleEmit = (newDate: Date) => {
    // If the original consumer passed a Date object, return a Date; otherwise return YYYY-MM-DD string
    if (value instanceof Date) {
      onChange(newDate);
    } else {
      const y = newDate.getFullYear();
      const m = String(newDate.getMonth() + 1).padStart(2, "0");
      const d = String(newDate.getDate()).padStart(2, "0");
      onChange(`${y}-${m}-${d}`);
    }
  };

  const handleMobileChange = (event: any, selected?: Date) => {
    setShowPicker(false);
    if (event.type === "set" && selected) {
      handleEmit(selected);
    }
  };

  return (
    <View
      className={`border border-[#E7E4F5] bg-white rounded-xl ${
        compact ? "flex-1 flex-row items-center px-2.5 py-1.5" : "flex-1 p-3"
      }`}
    >
      <Text
        className={`font-black text-[#7A76A6] uppercase ${
          compact ? "text-[9px] mr-1.5 shrink-0" : "text-[10px] mb-1"
        }`}
      >
        {label}{compact ? ":" : ""}
      </Text>

      {Platform.OS === "web" ? (
        <input
          type="date"
          value={formattedStr}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              const [y, m, d] = val.split("-").map(Number);
              handleEmit(new Date(y, m - 1, d));
            }
          }}
          style={{
            border: "none",
            outline: "none",
            backgroundColor: "transparent",
            fontSize: compact ? "11px" : "12px",
            fontWeight: "700",
            color: "#1F1B3D",
            fontFamily: "inherit",
            cursor: "pointer",
            width: "100%",
            padding: 0,
          }}
        />
      ) : (
        <>
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            activeOpacity={0.7}
            className="flex-row items-center justify-between"
          >
            <Text
              className={`font-bold text-[#1F1B3D] ${
                compact ? "text-[11px]" : "text-xs"
              }`}
            >
              {formattedStr}
            </Text>
            <Calendar size={compact ? 13 : 15} color="#5B4FD1" />
          </TouchableOpacity>

          {showPicker && (
            <DateTimePicker
              value={isNaN(dateObj.getTime()) ? new Date() : dateObj}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleMobileChange}
            />
          )}
        </>
      )}
    </View>
  );
}