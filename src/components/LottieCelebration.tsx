import React, { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import FullPageCelebration from "./FullPageCelebration";

// Full-page celebration powered by lottie-react-native. Shown only on the celebrant's own day (the screen decides).
// Plays for SHOW_SECONDS (30 s) after the page opens, then stops by itself. A small "Replay" chip plays it again.
const SHOW_SECONDS = 20;

// Safe by design: if the package is not installed / not in the build, or a file fails, it falls back to the
// old Animated show (FullPageCelebration) instead of crashing.

let LottieView: any = null;
try {
  LottieView = require("lottie-react-native").default ?? require("lottie-react-native");
} catch {
  LottieView = null;
}

// Metro needs static require paths. Put the JSON files in  src/assets/lottie/
const FILES: Record<string, any> = {};
try {
  FILES.fireworks_party = require("../assets/lottie/fireworks_party.json");
  FILES.fireworks_gold = require("../assets/lottie/fireworks_gold.json");
  FILES.confetti_party = require("../assets/lottie/confetti_party.json");
  FILES.confetti_gold = require("../assets/lottie/confetti_gold.json");
  FILES.poppers_party = require("../assets/lottie/poppers_party.json");
  FILES.poppers_gold = require("../assets/lottie/poppers_gold.json");
  FILES.balloons = require("../assets/lottie/balloons.json");
} catch {
  /* missing files -> fallback below */
}

// Which layers play for each occasion (bottom -> top).
const SHOW: Record<"BIRTHDAY" | "ANNIVERSARY", string[]> = {
  BIRTHDAY: ["balloons", "fireworks_party", "poppers_party", "confetti_party"],
  ANNIVERSARY: ["fireworks_gold", "poppers_gold", "confetti_gold"],
};

class Guard extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() {
    return { bad: true };
  }
  componentDidCatch() {}
  render() {
    return this.state.bad ? this.props.fallback : this.props.children;
  }
}

export default function LottieCelebration({ kind = "BIRTHDAY", active = true }: { kind?: "BIRTHDAY" | "ANNIVERSARY"; active?: boolean }) {
  const [paused, setPaused] = useState(false);
  const [round, setRound] = useState(1);   // changes on every replay
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDone(false);
    const t = setTimeout(() => setDone(true), SHOW_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [round]);
  const replay = (
    <Pressable
      onPress={() => { setPaused(false); setRound((r) => r + 1); }}
      style={{ position: "absolute", top: 10, right: 10, zIndex: 20, backgroundColor: "rgba(17,24,39,0.7)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "900" }}>🎉 Replay</Text>
    </Pressable>
  );
  const names = (SHOW[kind] ?? SHOW.BIRTHDAY).filter((n) => FILES[n]);
  if (done) return replay;   // after 30 s: nothing runs, page is completely normal
  const fallback = <FullPageCelebration key={round} kind={kind} active={active} />;

  if (!LottieView || names.length === 0 || !active) return fallback;

  return (
    <Guard fallback={fallback}>
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, pointerEvents: "box-none" } as any}>
        {!paused && (
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden", pointerEvents: "none" } as any}>
            {names.map((n) => (
              <LottieView
                key={n + round}
                source={FILES[n]}
                autoPlay
                loop
                resizeMode="cover"
                renderMode={Platform.OS === "web" ? undefined : "AUTOMATIC"}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", pointerEvents: "none" } as any}
                pointerEvents="none"
              />
            ))}
          </View>
        )}
        <Pressable
          onPress={() => setPaused((p) => !p)}
          style={{ position: "absolute", top: 10, right: 10, backgroundColor: "rgba(17,24,39,0.7)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "900" }}>{paused ? "▶ Play effects" : "⏸ Pause effects"}</Text>
        </Pressable>
      </View>
    </Guard>
  );
}