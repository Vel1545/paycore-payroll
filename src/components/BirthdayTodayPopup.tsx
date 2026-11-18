// Once a day, the first time the employee opens the app: "Today is Raju's birthday!" (or "Happy Birthday" for the
// birthday person). Send wishes / See wishes opens the Celebrations page, where the existing wish box is open today.
// Closing it hides it until tomorrow (remembered per employee and date).
import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Confetti from "./Confetti";
import { joinNames, useBirthdaysToday } from "../utils/useBirthdaysToday";

const PRIMARY = "#5B4FD1";

type Props = { empId?: string | null; navigation: { navigate: (screen: string, params?: any) => void } };

const seenKey = (empId: string, day: string) => `paycore_birthday_popup_${empId.toUpperCase()}_${day}`;

export default function BirthdayTodayPopup({ empId, navigation }: Props) {
  const { data } = useBirthdaysToday(!!empId);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!empId || !data || data.people.length === 0) return;
    let alive = true;
    (async () => {
      let seen: string | null = null;
      try {
        seen = await AsyncStorage.getItem(seenKey(empId, data.today));
      } catch {
        seen = null;
      }
      if (alive && !seen) setVisible(true);
    })();
    return () => {
      alive = false;
    };
  }, [empId, data]);

  if (!empId || !data || data.people.length === 0) return null;

  const me = data.people.find((p) => p.empId.toUpperCase() === empId.toUpperCase());
  const others = data.people.filter((p) => p !== me);

  const close = async (openCelebrations: boolean) => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(seenKey(empId, data.today), "1");
    } catch {
      /* storage unavailable: it may show once more, that is fine */
    }
    if (openCelebrations) navigation.navigate("Celebrations");
  };

  const title = me
    ? `🎉 Happy Birthday, ${me.name}!`
    : `🎂 Today is ${joinNames(others.map((p) => p.name))}'s ${others.length === 1 ? "birthday" : "birthdays"}!`;
  const body = me
    ? "Your team is wishing you today. Open Celebrations to see their wishes."
    : "Send your wishes on the Celebrations page. Wishes are open only today.";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => close(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Confetti kind="BIRTHDAY" height={170} count={22} rounds={3} />
          <Text style={styles.emoji}>{me ? "🎉" : "🎂"}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          {me && others.length > 0 ? (
            <Text style={styles.small}>Also celebrating today: {joinNames(others.map((p) => p.name))}</Text>
          ) : null}
          <View style={styles.row}>
            <Pressable style={styles.secondaryBtn} onPress={() => close(false)}>
              <Text style={styles.secondaryText}>{me ? "Close" : "Later"}</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={() => close(true)}>
              <Text style={styles.primaryText}>{me ? "See wishes" : "Send wishes"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFF7FA",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 22,
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F9A8C4",
  },
  emoji: { fontSize: 46, marginBottom: 6 },
  title: { fontSize: 19, fontWeight: "800", color: "#1F1B3A", textAlign: "center" },
  body: { fontSize: 14, color: "#4B4868", marginTop: 8, textAlign: "center", lineHeight: 20 },
  small: { fontSize: 12, color: "#7A7799", marginTop: 8, textAlign: "center" },
  row: { flexDirection: "row", gap: 12, marginTop: 20, alignSelf: "stretch" },
  primaryBtn: { flex: 1, backgroundColor: PRIMARY, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  secondaryBtn: { flex: 1, backgroundColor: "#EEEDF5", paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  secondaryText: { color: "#4B4868", fontSize: 15, fontWeight: "700" },
});
