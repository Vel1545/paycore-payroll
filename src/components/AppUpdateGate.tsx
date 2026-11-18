// Wraps the whole app (App.tsx).
//  - App start: applies a published OTA update (app restarts by itself), then asks the server if this APK is current.
//  - Server says REQUIRED (or any API call answers 426): a full-screen "Update required" page replaces the app.
//  - Server says OPTIONAL: a popup with Update / Later (Later = until the next app start).
//  - Back in the app after 15+ minutes: the same checks run again.
// Does nothing on the website and in `npx expo start`.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  UPDATE_CHECKS_ENABLED,
  VersionInfo,
  absoluteDownloadUrl,
  applyOtaUpdate,
  checkAppVersion,
  installedLabel,
  onUpdateRequired,
} from "../services/appUpdate";

const RECHECK_AFTER_BACKGROUND_MS = 15 * 60 * 1000;
const PRIMARY = "#5B4FD1";

export default function AppUpdateGate({ children }: { children: React.ReactNode }) {
  const [starting, setStarting] = useState(UPDATE_CHECKS_ENABLED);
  const [downloadingOta, setDownloadingOta] = useState(false);
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [required, setRequired] = useState(false);
  const [optionalHidden, setOptionalHidden] = useState(false);
  const [checking, setChecking] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  const checkVersion = useCallback(async (timeoutMs?: number) => {
    const v = await checkAppVersion(timeoutMs);
    if (!v) return; // offline: keep the current state
    setInfo(v);
    setRequired(v.status === "REQUIRED");
  }, []);

  // ---- app start ----
  useEffect(() => {
    if (!UPDATE_CHECKS_ENABLED) return;
    let alive = true;
    (async () => {
      const restarting = await applyOtaUpdate((busy) => alive && setDownloadingOta(busy));
      if (restarting || !alive) return;
      await checkVersion(5000); // poor network: open the app after 5 s, the API's 426 still protects
      if (alive) setStarting(false);
    })();
    return () => {
      alive = false;
    };
  }, [checkVersion]);

  // ---- back from the background ----
  useEffect(() => {
    if (!UPDATE_CHECKS_ENABLED) return;
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "background") {
        backgroundAt.current = Date.now();
        return;
      }
      if (state !== "active") return;
      const away = backgroundAt.current ? Date.now() - backgroundAt.current : 0;
      backgroundAt.current = null;
      // Short trips (camera, file picker, share sheet) must not restart the app in the middle of a task.
      if (away >= RECHECK_AFTER_BACKGROUND_MS) {
        const restarting = await applyOtaUpdate(setDownloadingOta);
        if (restarting) return;
      }
      checkVersion();
    });
    return () => sub.remove();
  }, [checkVersion]);

  // ---- the server refused an API call with 426 ----
  useEffect(() => {
    if (!UPDATE_CHECKS_ENABLED) return;
    return onUpdateRequired(() => {
      setRequired(true);
      checkVersion();
    });
  }, [checkVersion]);

  const openDownload = useCallback(() => {
    const url = absoluteDownloadUrl(info);
    if (url) Linking.openURL(url).catch(() => {});
  }, [info]);

  const checkAgain = useCallback(async () => {
    setChecking(true);
    await checkVersion(8000);
    setChecking(false);
  }, [checkVersion]);

  if (downloadingOta) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.title}>Updating PayCore…</Text>
        <Text style={styles.body}>Installing the latest version. This takes a few seconds.</Text>
      </View>
    );
  }

  if (starting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (required) {
    const url = absoluteDownloadUrl(info);
    return (
      <View style={styles.center}>
        <Text style={styles.badge}>⬆</Text>
        <Text style={styles.title}>Update required</Text>
        <Text style={styles.body}>
          {info?.message ||
            "A new version of PayCore is available. Please update the app to continue using it."}
        </Text>
        {info?.latestVersionName ? <Text style={styles.small}>New version: {info.latestVersionName}</Text> : null}
        <Text style={styles.small}>Installed: {installedLabel()}</Text>

        <Pressable style={[styles.primaryBtn, !url && styles.disabled]} onPress={openDownload} disabled={!url}>
          <Text style={styles.primaryText}>Update now</Text>
        </Pressable>
        {!url ? <Text style={styles.small}>Please contact HR for the new version.</Text> : null}

        <Text style={styles.hint}>
          After the download, open the file and tap Install. If Android asks, allow “Install unknown apps” for
          your browser.
        </Text>
        <Pressable onPress={checkAgain} disabled={checking} style={styles.linkBtn}>
          <Text style={styles.linkText}>{checking ? "Checking…" : "Check again"}</Text>
        </Pressable>
      </View>
    );
  }

  const showOptional = !!info && info.status === "OPTIONAL" && !optionalHidden;

  return (
    <>
      {children}
      <Modal visible={showOptional} transparent animationType="fade" onRequestClose={() => setOptionalHidden(true)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Update available</Text>
            <Text style={styles.body}>
              {info?.message || "A new version of PayCore is available with fixes and improvements."}
            </Text>
            {info?.latestVersionName ? <Text style={styles.small}>New version: {info.latestVersionName}</Text> : null}
            <View style={styles.row}>
              <Pressable style={styles.secondaryBtn} onPress={() => setOptionalHidden(true)}>
                <Text style={styles.secondaryText}>Later</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, styles.rowBtn]}
                onPress={() => {
                  setOptionalHidden(true);
                  openDownload();
                }}
              >
                <Text style={styles.primaryText}>Update</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: "#F6F5FC",
  },
  badge: {
    fontSize: 34,
    color: PRIMARY,
    width: 72,
    height: 72,
    lineHeight: 72,
    textAlign: "center",
    borderRadius: 36,
    backgroundColor: "#E9E6FB",
    overflow: "hidden",
    marginBottom: 18,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#1F1B3A", marginTop: 12, textAlign: "center" },
  body: { fontSize: 15, color: "#4B4868", marginTop: 10, textAlign: "center", lineHeight: 21 },
  small: { fontSize: 13, color: "#7A7799", marginTop: 6, textAlign: "center" },
  hint: { fontSize: 12, color: "#8E8BA8", marginTop: 18, textAlign: "center", lineHeight: 17 },
  primaryBtn: {
    marginTop: 22,
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  linkBtn: { marginTop: 14, padding: 8 },
  linkText: { color: PRIMARY, fontSize: 14, fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 22 },
  row: { flexDirection: "row", marginTop: 4, gap: 12 },
  rowBtn: { flex: 1, paddingHorizontal: 0 },
  secondaryBtn: {
    flex: 1,
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#EEEDF5",
  },
  secondaryText: { color: "#4B4868", fontSize: 16, fontWeight: "700" },
});
