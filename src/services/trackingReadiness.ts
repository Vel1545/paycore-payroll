// Is this phone set up so shift tracking can run all day? Used by the tracking setup screen at check-in.
// Everything here only READS settings or OPENS a settings page; nothing is changed without the employee.
import { Linking, Platform } from "react-native";
import * as Location from "expo-location";
import * as Battery from "expo-battery";
import * as Device from "expo-device";

export type Readiness = {
  allTheTime: boolean; // location "Allow all the time"
  precise: boolean | null; // precise location (null = unknown)
  gpsOn: boolean; // phone location switch
  batteryUnrestricted: boolean | null; // not battery-optimised (null = unknown)
  brand: string;
};

export async function getTrackingReadiness(): Promise<Readiness> {
  let allTheTime = false;
  let precise: boolean | null = null;
  let gpsOn = true;
  let batteryUnrestricted: boolean | null = null;
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    allTheTime = fg.status === "granted" && bg.status === "granted";
    const acc = (fg as any).android?.accuracy;
    precise = acc ? acc === "fine" : null;
  } catch {
    /* unknown */
  }
  try {
    gpsOn = await Location.hasServicesEnabledAsync();
  } catch {
    /* unknown */
  }
  if (Platform.OS === "android") {
    try {
      batteryUnrestricted = !(await Battery.isBatteryOptimizationEnabledAsync());
    } catch {
      batteryUnrestricted = null;
    }
  }
  const brand = String(Device.manufacturer || Device.brand || "").trim();
  return { allTheTime, precise, gpsOn, batteryUnrestricted, brand };
}

/** true when something that stops tracking is missing (unknown values do not count). */
export function readinessMissing(r: Readiness): boolean {
  return !r.allTheTime || r.precise === false || !r.gpsOn || r.batteryUnrestricted === false;
}

export async function fixAllTheTime(): Promise<void> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status === "granted") {
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status === "granted") return;
    }
  } catch {
    /* fall through to the settings page */
  }
  await openAppSettings();
}

export async function fixGps(): Promise<void> {
  try {
    await Location.enableNetworkProviderAsync(); // Android: the "turn on location" dialog
    return;
  } catch {
    /* settings page instead */
  }
  try {
    await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
  } catch {
    await openAppSettings();
  }
}

/** Android list "Battery optimisation": choose PayCore > Don't optimise / Unrestricted. */
export async function fixBattery(): Promise<void> {
  try {
    await Linking.sendIntent("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
  } catch {
    await openAppSettings();
  }
}

export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    /* nothing more we can do */
  }
}

/** Extra steps for phone brands that stop background apps on their own. */
export function brandSteps(brand: string): { title: string; steps: string[] } {
  const b = brand.toLowerCase();
  if (/(xiaomi|redmi|poco)/.test(b)) {
    return {
      title: "Xiaomi / Redmi / POCO",
      steps: [
        "Settings > Apps > Manage apps > PayCore > Autostart: ON",
        "Same page > Battery saver: No restrictions",
        "Recent apps screen: pull PayCore down and tap the lock, so it is not closed when you clear apps",
      ],
    };
  }
  if (/(vivo|iqoo)/.test(b)) {
    return {
      title: "Vivo / iQOO",
      steps: [
        "Settings > Battery > Background power consumption management > PayCore: Allow",
        "Settings > Apps > Autostart (or i Manager > App manager > Autostart) > PayCore: ON",
        "Recent apps screen: lock PayCore",
      ],
    };
  }
  if (/(oppo|realme|oneplus)/.test(b)) {
    return {
      title: "OPPO / Realme / OnePlus",
      steps: [
        "Settings > Apps > PayCore > Battery usage: Allow background activity, Allow auto launch",
        "Settings > Battery > More settings: turn off 'Optimise battery use' for PayCore",
        "Recent apps screen: lock PayCore",
      ],
    };
  }
  if (/samsung/.test(b)) {
    return {
      title: "Samsung",
      steps: [
        "Settings > Apps > PayCore > Battery: Unrestricted",
        "Settings > Battery > Background usage limits > Never sleeping apps: add PayCore",
        "Make sure PayCore is not in 'Sleeping apps' or 'Deep sleeping apps'",
      ],
    };
  }
  return {
    title: brand ? brand : "Your phone",
    steps: [
      "Settings > Apps > PayCore > Battery: Unrestricted (or 'Allow background activity')",
      "If your phone has Autostart / Auto launch, turn it ON for PayCore",
      "Do not close PayCore from the recent apps screen during your shift",
    ],
  };
}
