import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import Confetti from "./Confetti";

// Full-screen celebration for the person whose birthday / work anniversary is TODAY:
// fireworks (rocket + burst), rising balloons, party poppers from both corners and non-stop confetti.
// Plain Animated API only (no extra package, no new build). Effects never block taps; only the small
// "Pause effects" chip takes touches. The screen shows this component only on the day itself.

const PALETTES: Record<string, string[]> = {
  BIRTHDAY: ["#F43F5E", "#F59E0B", "#10B981", "#3B82F6", "#A855F7", "#EC4899", "#FACC15"],
  ANNIVERSARY: ["#F59E0B", "#FBBF24", "#FDE68A", "#5B4FD1", "#A78BFA", "#10B981"],
};
const POPPER_ICONS = ["🎉", "🎊", "✨", "⭐", "🎈", "🪅"];
const useNative = Platform.OS !== "web";

// ---------------------------------------------------------------- firework
function Firework({ x, y, delay, color, color2, radius, startY }: { x: number; y: number; delay: number; color: string; color2: string; radius: number; startY: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([Animated.delay(delay), Animated.timing(t, { toValue: 1, duration: 3400, easing: Easing.linear, useNativeDriver: useNative })]),
      { iterations: -1 }
    );
    a.start();
    return () => a.stop();
  }, []);

  const sparks = useMemo(() => {
    const out: { dx: number; dy: number; size: number; c: string }[] = [];
    const outer = 12, inner = 8;
    for (let i = 0; i < outer; i++) {
      const ang = (i / outer) * Math.PI * 2;
      out.push({ dx: Math.cos(ang) * radius, dy: Math.sin(ang) * radius, size: 6, c: color });
    }
    for (let i = 0; i < inner; i++) {
      const ang = (i / inner) * Math.PI * 2 + 0.3;
      out.push({ dx: Math.cos(ang) * radius * 0.55, dy: Math.sin(ang) * radius * 0.55, size: 4, c: color2 });
    }
    return out;
  }, [radius, color, color2]);

  // rocket: rises from the bottom to the burst point during the first 28% of the cycle
  const rocketY = t.interpolate({ inputRange: [0, 0.28, 0.29, 1], outputRange: [startY, 0, 0, 0] });
  const rocketOpacity = t.interpolate({ inputRange: [0, 0.02, 0.26, 0.29, 1], outputRange: [0, 1, 1, 0, 0] });

  return (
    <View style={{ position: "absolute", left: x, top: y, width: 0, height: 0 }}>
      <Animated.View
        style={{ position: "absolute", left: -1.5, top: 0, width: 3, height: 18, borderRadius: 2, backgroundColor: "#FDE68A", opacity: rocketOpacity, transform: [{ translateY: rocketY }] }}
      />
      {sparks.map((s, i) => {
        const tx = t.interpolate({ inputRange: [0, 0.3, 0.55, 1], outputRange: [0, 0, s.dx * 0.85, s.dx] });
        const ty = t.interpolate({ inputRange: [0, 0.3, 0.55, 1], outputRange: [0, 0, s.dy * 0.85, s.dy + 26] }); // droops a little, like real sparks
        const op = t.interpolate({ inputRange: [0, 0.3, 0.34, 0.8, 1], outputRange: [0, 0, 1, 0.9, 0] });
        const sc = t.interpolate({ inputRange: [0, 0.3, 0.38, 1], outputRange: [0.2, 0.2, 1.3, 0.4] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute", left: -s.size / 2, top: -s.size / 2, width: s.size, height: s.size, borderRadius: s.size,
              backgroundColor: s.c, opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
            }}
          />
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- balloon
function Balloon({ left, delay, duration, size, h }: { left: number; delay: number; duration: number; size: number; h: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: useNative })]),
      { iterations: -1 }
    );
    a.start();
    return () => a.stop();
  }, []);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [h + 60, -90] });
  const translateX = v.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 14, 0, -14, 0] });
  return (
    <Animated.View style={{ position: "absolute", left, top: 0, transform: [{ translateY }, { translateX }] }}>
      <Text style={{ fontSize: size }}>🎈</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- party popper
function Popper({ side, w, h, delay, colors }: { side: "left" | "right"; w: number; h: number; delay: number; colors: string[] }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const dir = side === "left" ? 1 : -1;
        return {
          dx: dir * (50 + Math.random() * Math.min(w * 0.45, 330)),
          peak: h * (0.32 + Math.random() * 0.4),
          fall: 30 + Math.random() * 90,
          icon: i % 3 === 0,
          emoji: POPPER_ICONS[i % POPPER_ICONS.length],
          c: colors[i % colors.length],
          size: 7 + Math.random() * 6,
          spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360),
        };
      }),
    [side, w, h]
  );
  const vs = useRef(pieces.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const anims = pieces.map((_, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay + i * 40),
          Animated.timing(vs[i], { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: useNative }),
          Animated.delay(1800),
        ]),
        { iterations: -1 }
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [pieces]);

  return (
    <View style={{ position: "absolute", bottom: 0, [side]: 0, width: 0, height: 0 } as any}>
      {pieces.map((p, i) => {
        const v = vs[i];
        const tx = v.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
        const ty = v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, -p.peak, p.fall] });   // up, then falls: a parabola
        const rot = v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin}deg`] });
        const op = v.interpolate({ inputRange: [0, 0.03, 0.85, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View key={i} style={{ position: "absolute", opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { rotate: rot }] }}>
            {p.icon ? (
              <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
            ) : (
              <View style={{ width: p.size, height: p.size * 0.6, borderRadius: 2, backgroundColor: p.c }} />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- the whole show
export default function FullPageCelebration({ kind = "BIRTHDAY", active = true }: { kind?: "BIRTHDAY" | "ANNIVERSARY"; active?: boolean }) {
  const { width: w, height: h } = useWindowDimensions();
  const [paused, setPaused] = useState(false);
  const colors = PALETTES[kind] ?? PALETTES.BIRTHDAY;
  const lite = Platform.OS === "web";   // browsers animate on the JS thread: fewer pieces keeps it smooth

  const bursts = useMemo(() => {
    const spots = [
      { fx: 0.2, fy: 0.22 }, { fx: 0.78, fy: 0.18 }, { fx: 0.5, fy: 0.3 }, { fx: 0.12, fy: 0.5 }, { fx: 0.88, fy: 0.46 },
    ].slice(0, lite ? 3 : 5);
    return spots.map((s, i) => ({
      x: s.fx * w, y: s.fy * h, delay: i * 900,
      color: colors[i % colors.length], color2: colors[(i + 3) % colors.length],
      radius: Math.min(120, w * 0.28), startY: h - s.fy * h,
    }));
  }, [w, h, kind, lite]);

  const balloons = useMemo(
    () => Array.from({ length: lite ? 4 : 7 }, (_, i) => ({
      left: (i + 0.5) * (w / (lite ? 4 : 7)) - 16, delay: i * 1300, duration: 9000 + (i % 3) * 2500, size: 30 + (i % 3) * 8,
    })),
    [w, lite]
  );

  if (!active) return null;

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, pointerEvents: "box-none" } as any}>
      {!paused && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden", pointerEvents: "none" } as any}>
          <Confetti kind={kind} height={h} count={lite ? 22 : 40} rounds={-1} />
          {bursts.map((b, i) => <Firework key={i} {...b} />)}
          {balloons.map((b, i) => <Balloon key={i} h={h} {...b} />)}
          <Popper side="left" w={w} h={h} delay={400} colors={colors} />
          <Popper side="right" w={w} h={h} delay={1500} colors={colors} />
        </View>
      )}

      <TouchableOpacity
        onPress={() => setPaused((p) => !p)}
        activeOpacity={0.85}
        style={{ position: "absolute", right: 14, top: Platform.OS === "web" ? 14 : 56, backgroundColor: "rgba(31,27,61,0.78)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "900" }}>{paused ? "▶ Play effects" : "⏸ Pause effects"}</Text>
      </TouchableOpacity>
    </View>
  );
}