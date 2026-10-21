import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, Text, View } from "react-native";

// Falling confetti + emoji for a celebration card. Built on the React Native Animated API only: no extra package,
// no new app build, works on the web version too. Place it inside a card with overflow hidden; it never blocks taps.
const SETS: Record<string, { colors: string[]; icons: string[] }> = {
  BIRTHDAY: { colors: ["#F43F5E", "#F59E0B", "#10B981", "#3B82F6", "#A855F7", "#EC4899"], icons: ["🎈", "🎉", "🎂", "🎊"] },
  ANNIVERSARY: { colors: ["#F59E0B", "#FBBF24", "#5B4FD1", "#10B981"], icons: ["⭐", "👏", "🎉", "✨"] },
  ACHIEVEMENT: { colors: ["#F59E0B", "#FCD34D", "#5B4FD1", "#EC4899"], icons: ["🏆", "⭐", "🌟", "🎉"] },
};

interface Props {
  kind?: "BIRTHDAY" | "ANNIVERSARY" | "ACHIEVEMENT";
  height?: number;
  count?: number;
  rounds?: number; // how many times the shower repeats; -1 = non-stop (default)
}

export default function Confetti({ kind = "BIRTHDAY", height = 170, count = 24, rounds = -1 }: Props) {
  const set = SETS[kind] ?? SETS.BIRTHDAY;

  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 96,
        size: i % 5 === 0 ? 16 : 6 + Math.random() * 6,
        isIcon: i % 5 === 0,
        color: set.colors[i % set.colors.length],
        icon: set.icons[Math.floor(i / 5) % set.icons.length],
        delay: Math.random() * 1800,
        duration: 2600 + Math.random() * 2200,
        sway: 8 + Math.random() * 14,
        round: i % 3 === 0,
      })),
    [count, kind]
  );

  const values = useRef(parts.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const anims = parts.map((p, i) => {
      values[i].setValue(0);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(values[i], { toValue: 1, duration: p.duration, easing: Easing.linear, useNativeDriver: Platform.OS !== "web" }),
        ]),
        { iterations: rounds }
      );
    });
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [parts]);

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, height, overflow: "hidden", pointerEvents: "none" } as any}>
      {parts.map((p, i) => {
        const v = values[i];
        const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [-24, height + 8] });
        const translateX = v.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, p.sway, 0, -p.sway, 0] });
        const rotate = v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "540deg"] });
        const opacity = v.interpolate({ inputRange: [0, 0.05, 0.85, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: `${p.left}%` as any,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          >
            {p.isIcon ? (
              <Text style={{ fontSize: p.size }}>{p.icon}</Text>
            ) : (
              <View style={{ width: p.size, height: p.size * (p.round ? 1 : 0.6), borderRadius: p.round ? p.size : 2, backgroundColor: p.color }} />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}