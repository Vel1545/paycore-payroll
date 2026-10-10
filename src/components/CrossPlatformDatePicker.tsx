import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, Platform, Modal } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";

export interface CrossPlatformDatePickerProps {
  label: string;
  value: string | Date; // Supports both legacy Date objects and "YYYY-MM-DD" strings
  onChange: (val: any) => void;
  compact?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function CrossPlatformDatePicker({
  label,
  value,
  onChange,
  compact = false,
  minimumDate,
  maximumDate,
}: CrossPlatformDatePickerProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const lastEmitAt = useRef(0);

  // Normalize the input value to a Date object and a YYYY-MM-DD string
  const parsed =
    value instanceof Date
      ? value
      : typeof value === "string" && value
      ? new Date(value + (value.includes("T") ? "" : "T00:00:00"))
      : new Date();
  const dateObj = isNaN(parsed.getTime()) ? new Date() : parsed;
  const formattedStr = toYmd(dateObj);

  const [temp, setTemp] = useState<Date>(dateObj);

  // Returns the same type the page gave us: a Date, or a "YYYY-MM-DD" string
  const handleEmit = (newDate: Date) => {
    if (value instanceof Date) onChange(newDate);
    else onChange(toYmd(newDate));
  };

  // Ignore a second report of the same selection that arrives right after the first
  const emitOnce = (newDate: Date) => {
    const now = Date.now();
    if (now - lastEmitAt.current < 400) return;
    lastEmitAt.current = now;
    handleEmit(newDate);
  };

  const openPicker = () => {
    if (Platform.OS === "android") {
      // Android shows its own dialog and calls us once, when the user taps OK
      const handler = (event: any, selected?: Date) => {
        if (event?.type === "dismissed") return;
        if (selected) emitOnce(selected);
      };
      DateTimePickerAndroid.open({
        value: dateObj,
        mode: "date",
        minimumDate,
        maximumDate,
        onValueChange: handler, // fires once, when the user taps OK
        onDismiss: () => {},
      } as any);
    } else {
      setTemp(dateObj);
      setIosOpen(true);
    }
  };

  return (
    <View
      className={`border border-[#E7E4F5] bg-white rounded-xl ${
        compact ? "flex-1 flex-row items-center px-2.5 py-1.5" : "flex-1 p-3"
      }`}
    >
      <Text
        className={`font-black text-[#7A76A6] uppercase ${compact ? "text-[9px] mr-1.5 shrink-0" : "text-[10px] mb-1"}`}
      >
        {label}
        {compact ? ":" : ""}
      </Text>

      {Platform.OS === "web" ? (
        <input
          type="date"
          value={formattedStr}
          min={minimumDate ? toYmd(minimumDate) : undefined}
          max={maximumDate ? toYmd(maximumDate) : undefined}
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
            onPress={openPicker}
            activeOpacity={0.7}
            className="flex-row items-center justify-between"
          >
            <Text className={`font-bold text-[#1F1B3D] ${compact ? "text-[11px]" : "text-xs"}`}>{formattedStr}</Text>
            <Calendar size={compact ? 13 : 15} color="#5B4FD1" />
          </TouchableOpacity>

          {/* iPhone: a sheet with Cancel / Done, so the page only changes when the user confirms */}
          {Platform.OS === "ios" && (
            <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
              <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
                <View
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    paddingBottom: 28,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      padding: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: "#E7E4F5",
                    }}
                  >
                    <TouchableOpacity onPress={() => setIosOpen(false)}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: "#7A76A6" }}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 15, fontWeight: "900", color: "#1F1B3D" }}>{label}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setIosOpen(false);
                        handleEmit(temp);
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: "900", color: "#5B4FD1" }}>Done</Text>
                    </TouchableOpacity>
                  </View>

                  <DateTimePicker
                    value={temp}
                    mode="date"
                    display="spinner"
                    themeVariant="light"
                    textColor="#1F1B3D"
                    minimumDate={minimumDate}
                    maximumDate={maximumDate}
                    onValueChange={(_event: any, selected?: Date) => {
                      if (selected) setTemp(selected);
                    }}
                  />
                </View>
              </View>
            </Modal>
          )}
        </>
      )}
    </View>
  );
}