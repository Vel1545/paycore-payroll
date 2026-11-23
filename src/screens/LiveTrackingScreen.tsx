import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  StyleSheet,
  TextInput,
  Keyboard,
  Linking,
  AppState,
  RefreshControl,
  Alert,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import Constants, { ExecutionEnvironment } from "expo-constants";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  X,
  CalendarDays,
  MapPinOff,
  AlertTriangle,
  ExternalLink,
  List as ListIcon,
  Map as MapIcon,
  LocateFixed,
  Smartphone,
  Phone,
  Clock,
  Navigation,
  Battery,
  RotateCcw,
} from "lucide-react-native";
import { BASE_HOST } from "../constants/config";
import { PAGE_MAX_WIDTH } from "../hooks/useResponsive";
import { UserSession } from "../services/UserSession";
import { can } from "../services/Access";
import { useResponsive } from "../hooks/useResponsive";
import { Card as WebCard, IconBtn, Txt, WebPageHeader, ui } from "../components/web/webUi";

// ---------------------------------------------------------------------------
// Native map (Google Maps) - used in development / release builds with a key
// ---------------------------------------------------------------------------
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

// WebView map (Leaflet + OpenStreetMap) - works in Expo Go, no Google key needed
let WebView: any = null;

if (Platform.OS !== "web") {
  try {
    const Maps = require("react-native-maps");
    MapView = Maps.default;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.warn("Native maps import failed:", e);
  }
  try {
    WebView = require("react-native-webview").WebView;
  } catch {
    /* optional package: only needed for the map fallback in Expo Go on Android */
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_ATTENDANCE = `${BASE_HOST}/api/attendance`;
const API_ADMIN = `${BASE_HOST}/api/admin`;
const API_TRACKING = `${BASE_HOST}/api/tracking`;
const POLL_MS = 60_000; // auto-refresh, today only
const STAY_RADIUS_M = 100; // consecutive points within this are one "stay"
const STOP_MIN_MINUTES = 5; // a stay at least this long counts as a stop (shorter ones are just passing by)
const APPROX_STAY_RADIUS_M = 600; // approximate (coarse) fixes are grouped more loosely
const MAX_ROUTE_WAYPOINTS = 8;
const PAGE_SIZE = 50; // rows per page in every list
const MAX_RANGE_DAYS = 31; // From - To filter (the server allows the same)
// Turn on only after the events_json column, the /trace-events endpoint and tracking.events-enabled=true are live.
// While false, no request is sent to /trace-events and gaps are worked out from the pings instead.
const USE_SERVER_EVENTS = false;
// OpenStreetMap tile servers expect an identifiable referrer: put your own domain here
const MAP_REFERRER_URL = "https://your-company-domain.com";

// Google Maps renders black inside Expo Go on Android SDK 57, so use the WebView map there
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface StaffRow {
  empId: string;
  userName: string;
  department?: string | null;
  pointCount?: number | null;
  firstTime?: string | null;
  lastTime?: string | null;
  batteryPercentage?: number | null;
  latestLatitude?: number | null;
  latestLongitude?: number | null;
  // tracking health (newer backend): last point quality / remarks, check-in / out, what the phone reported
  activeWorkMode?: string | null;
  lastQuality?: string | null;
  lastRemarks?: string | null;
  lastTs?: string | null;
  punchInHm?: string | null;
  punchOutHm?: string | null;
  clientCode?: string | null;
  clientMessage?: string | null;
  clientAt?: string | null;
}

// What the admin sees per employee: a badge and the reason in words
interface TrackStatus {
  key: "OK" | "DELAYED" | "STOPPED" | "NEVER" | "WEAK" | "NOFIX" | "OUT" | "IOS" | "NODATA" | "HISTORY";
  label: string;
  tone: "green" | "amber" | "red" | "slate";
  dot: string;
  reason?: string | null;
  phone?: string | null; // what the phone itself reported (permission refused, GPS off, restarted ...)
}

// Everyone over a date range: one row per employee per day
interface RangeStaffRow extends StaffRow {
  traceDate: string;
  punchInTime?: string | null;
}

// One employee over a date range: a stored GPS point plus its day
interface RangePoint {
  date: string;
  time: string;
  ts?: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters?: number | null;
  batteryPercentage?: number | null;
  locationName?: string;
  quality?: "GOOD" | "LOW" | "STALE";
  remarks?: string;
  source?: string;
}

type RangeData =
  | { kind: "staff"; total: number; items: RangeStaffRow[] }
  | { kind: "points"; total: number; items: RangePoint[] };

interface DirectoryUser {
  empId: string;
  name: string;
  phone?: string;
}

interface TracePoint {
  time: string;
  ts?: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters?: number | null;
  batteryPercentage?: number | null;
  locationName?: string;
  quality?: "GOOD" | "LOW" | "STALE";
  remarks?: string;
  source?: string;
}

interface TraceEvent {
  time: string;
  ts?: string;
  status: string;
  reason?: string;
}

// One stored GPS ping (every location, with its name and coordinates)
interface PingRow {
  key: string;
  ms: number;
  time: string;
  lat: number;
  lng: number;
  place: string;
  accuracy: number | null;
  battery: number | null;
  approx: boolean;
  stale: boolean;
  remarks?: string;
  isPunch: boolean;
}

interface StayItem {
  kind: "stay";
  key: string;
  startMs: number;
  endMs: number;
  startLabel: string;
  endLabel: string;
  lat: number;
  lng: number;
  place: string;
  count: number;
  battery: number | null;
  accuracy: number | null;
  approx: boolean;
  punchCount: number;
  tags: string[];
  pings: PingRow[];
}

interface EventItem {
  kind: "event";
  key: string;
  startMs: number;
  timeLabel: string;
  status: string;
  reason?: string;
}

type TimelineItem = StayItem | EventItem;
type FlatItem = (PingRow & { kind: "ping" }) | EventItem;

type WebMarker = { lat: number; lng: number; title: string; sub: string; color: string };

const EVENT_META: Record<string, { label: string; tone: "red" | "amber" }> = {
  LOCATION_OFF: { label: "Location turned off", tone: "red" },
  PERMISSION_REVOKED: { label: "Location permission removed", tone: "red" },
  MOCK_LOCATION: { label: "Fake location detected", tone: "red" },
  NO_FIX: { label: "GPS signal not found", tone: "amber" },
  MISSED: { label: "No location received", tone: "amber" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s?: string): Date | null => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fmtDateLong = (d: Date) =>
  d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const fmtDateShort = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const addDays = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};
// whole days from a to b (b - a), ignoring the time of day
const daysBetween = (a: Date, b: Date) =>
  Math.round(
    (new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() -
      new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) /
      86400000
  );

const distM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Points written by older builds only have "HH:mm"; newer ones also carry an ISO "ts"
const toMs = (x: { ts?: string; time: string }, ymd: string) => {
  if (x.ts) {
    const t = Date.parse(x.ts);
    if (!isNaN(t)) return t;
  }
  const t = Date.parse(`${ymd}T${(x.time || "00:00").padStart(5, "0")}:00`);
  return isNaN(t) ? 0 : t;
};

const fmtDuration = (min: number) => {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${pad(min % 60)}m`;
};

const minutesSinceHHmm = (t?: string | null): number | null => {
  if (!t || !/^\d{1,2}:\d{2}/.test(t)) return null;
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
};

const openPin = (lat: number, lng: number) =>
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {});

const openRoute = (coords: { latitude: number; longitude: number }[]) => {
  if (!coords.length) return;
  const fmt = (c: { latitude: number; longitude: number }) => `${c.latitude},${c.longitude}`;
  if (coords.length === 1) {
    openPin(coords[0].latitude, coords[0].longitude);
    return;
  }
  const mid = coords.slice(1, -1);
  const step = Math.max(1, Math.ceil(mid.length / MAX_ROUTE_WAYPOINTS));
  const waypoints = mid
    .filter((_, i) => i % step === 0)
    .slice(0, MAX_ROUTE_WAYPOINTS)
    .map(fmt)
    .join("|");
  const url =
    `https://www.google.com/maps/dir/?api=1&origin=${fmt(coords[0])}` +
    `&destination=${fmt(coords[coords.length - 1])}` +
    (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : "") +
    `&travelmode=driving`;
  Linking.openURL(url).catch(() => {});
};

// Builds the HTML for the Leaflet / OpenStreetMap map shown inside a WebView
const buildLeafletHtml = (route: { lat: number; lng: number }[], markers: WebMarker[]) => {
  // "<" is escaped so the data can never close the script tag
  const data = JSON.stringify({ route, markers }).replace(/</g, "\\u003c");
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0;padding:0}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var d = ${data};
var map = L.map('map');
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '© OpenStreetMap'}).addTo(map);
var pts = [];
if (d.route.length > 1) {
  L.polyline(d.route.map(function(p){return [p.lat, p.lng];}), {color: '#5B4FD1', weight: 4}).addTo(map);
}
d.markers.forEach(function(m) {
  var el = document.createElement('div');
  var b = document.createElement('b'); b.textContent = m.title; el.appendChild(b);
  el.appendChild(document.createElement('br'));
  el.appendChild(document.createTextNode(m.sub));
  L.circleMarker([m.lat, m.lng], {radius: 8, color: '#fff', weight: 2, fillColor: m.color, fillOpacity: 1})
    .addTo(map).bindPopup(el);
  pts.push([m.lat, m.lng]);
});
if (pts.length) { map.fitBounds(pts, {padding: [30, 30], maxZoom: 16}); } else { map.setView([11.341, 77.7172], 11); }
</script></body></html>`;
};

// Groups consecutive points at (nearly) the same place into one "stay" and
// interleaves problem events, giving a readable day story instead of raw rows.
const buildTimeline = (points: TracePoint[], events: TraceEvent[], ymd: string): TimelineItem[] => {
  const valid = points
    .filter(
      (p) =>
        p.latitude != null &&
        p.longitude != null &&
        !isNaN(Number(p.latitude)) &&
        !isNaN(Number(p.longitude))
    )
    .map((p) => ({ p, ms: toMs(p, ymd) }))
    .sort((a, b) => a.ms - b.ms);

  const stays: StayItem[] = [];
  let cur: StayItem | null = null;
  let pingSeq = 0; // keeps every ping key unique, even for identical duplicate rows

  for (const { p, ms } of valid) {
    const lat = Number(p.latitude);
    const lng = Number(p.longitude);
    const stale = p.quality === "STALE"; // no usable fix: the position is a copy of the last known one
    const approx = p.quality === "LOW" || stale;
    const isPunch = p.source === "PUNCH";
    // Old check-in/out rows stored 0 for unknown battery/accuracy
    const placeholder = p.accuracyMeters === 0 && p.batteryPercentage === 0;
    const battery = placeholder ? null : p.batteryPercentage ?? null;
    const accuracy = p.accuracyMeters ? p.accuracyMeters : null;

    const ping: PingRow = {
      key: `ping-${pingSeq++}-${ms}`,
      ms,
      time: p.time,
      lat,
      lng,
      place: p.locationName || (approx ? "Approximate location" : `${lat.toFixed(4)}, ${lng.toFixed(4)}`),
      accuracy,
      battery,
      approx,
      stale,
      remarks: p.remarks,
      isPunch,
    };

    if (
      cur &&
      cur.approx === approx &&
      distM(cur.lat, cur.lng, lat, lng) <= (approx ? APPROX_STAY_RADIUS_M : STAY_RADIUS_M)
    ) {
      cur.endMs = ms;
      cur.endLabel = p.time;
      cur.count += 1;
      if (battery != null) cur.battery = battery;
      if (isPunch) cur.punchCount += 1;
      cur.pings.push(ping);
      continue;
    }

    cur = {
      kind: "stay",
      key: `stay-${ms}-${stays.length}`,
      startMs: ms,
      endMs: ms,
      startLabel: p.time,
      endLabel: p.time,
      lat,
      lng,
      place: stale
        ? p.locationName || "Last known position"
        : approx
        ? "Approximate location"
        : p.locationName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      count: 1,
      battery,
      accuracy,
      approx,
      punchCount: isPunch ? 1 : 0,
      tags: [],
      pings: [ping],
    };
    stays.push(cur);
  }

  const punchStays = stays.filter((s) => s.punchCount > 0);
  if (punchStays.length > 0) {
    const first = punchStays[0];
    const last = punchStays[punchStays.length - 1];
    if (first === last) first.tags.push(first.punchCount >= 2 ? "Check-in & Check-out" : "Check-in");
    else {
      first.tags.push("Check-in");
      last.tags.push("Check-out");
    }
  }
  stays.forEach((s) => {
    if (s.approx) s.tags.push(s.pings.every((x) => x.stale) ? "Last known" : "Approximate");
  });

  const eventItems: EventItem[] = events.map((e, i) => ({
    kind: "event",
    key: `event-${i}-${e.ts ?? e.time}`,
    startMs: toMs(e, ymd),
    timeLabel: e.time,
    status: e.status,
    reason: e.reason,
  }));

  return [...stays, ...eventItems].sort((a, b) => a.startMs - b.startMs);
};

const toEventItems = (events: TraceEvent[], ymd: string): EventItem[] =>
  events.map((e, i) => ({
    kind: "event",
    key: `event-${i}-${e.ts ?? e.time}`,
    startMs: toMs(e, ymd),
    timeLabel: e.time,
    status: e.status,
    reason: e.reason,
  }));

// Distance travelled along a path. Steps shorter than minStep are ignored, so GPS jitter while standing still
// does not add up to fake kilometres.
const pathLengthM = (points: { lat: number; lng: number }[], minStep: number) => {
  let total = 0;
  let anchor: { lat: number; lng: number } | null = null;
  for (const p of points) {
    if (!anchor) {
      anchor = p;
      continue;
    }
    const d = distM(anchor.lat, anchor.lng, p.lat, p.lng);
    if (d >= minStep) {
      total += d;
      anchor = p;
    }
  }
  return total;
};

const stopTitle = (s: StayItem) => {
  const mins = Math.round((s.endMs - s.startMs) / 60000);
  const range = s.startLabel === s.endLabel ? s.startLabel : `${s.startLabel} – ${s.endLabel}`;
  return mins >= 1 ? `${range} · ${fmtDuration(mins)}` : range;
};

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <View className="flex-1 bg-white border border-[#E7E4F5] rounded-2xl px-3 py-2.5">
    <Text className="text-[9px] font-bold text-[#7A76A6] uppercase tracking-wider">{label}</Text>
    <Text className="text-sm font-black text-[#1F1B3D] mt-0.5" numberOfLines={1}>
      {value}
    </Text>
    {sub ? (
      <Text className="text-[9px] font-semibold text-[#7A76A6]" numberOfLines={1}>
        {sub}
      </Text>
    ) : null}
  </View>
);

// ---------------------------------------------------------------------------
// Look & feel: small building blocks used by the page
// ---------------------------------------------------------------------------
// Content never stretches wider than this on big screens (web / tablet)
const CONTENT = { width: "100%", maxWidth: Platform.OS === "web" ? PAGE_MAX_WIDTH : 980, alignSelf: "center" } as const;

const CARD: any = Platform.select({
  web: { boxShadow: "0 1px 2px rgba(31,27,61,0.05), 0 8px 22px rgba(31,27,61,0.06)" },
  default: {
    elevation: 2,
    shadowColor: "#1F1B3D",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});

const TONES: Record<string, [string, string]> = {
  green: ["bg-emerald-100", "text-emerald-800"],
  amber: ["bg-amber-100", "text-amber-800"],
  red: ["bg-rose-100", "text-rose-800"],
  slate: ["bg-slate-100", "text-slate-600"],
  purple: ["bg-[#EEECFA]", "text-[#5B4FD1]"],
};

const Pill = ({ text, tone = "slate" }: { text: string; tone?: keyof typeof TONES }) => (
  <View className={`px-2.5 py-1 rounded-full ${TONES[tone][0]}`}>
    <Text className={`text-[10px] font-black ${TONES[tone][1]}`}>{text}</Text>
  </View>
);

const Card = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <View className={`bg-white rounded-3xl border border-[#E7E4F5] ${className}`} style={CARD}>
    {children}
  </View>
);

const Avatar = ({ name, dot, size = 44 }: { name: string; dot?: string; size?: number }) => (
  <View
    style={{ width: size, height: size, borderRadius: size * 0.34 }}
    className="bg-[#EEECFA] items-center justify-center"
  >
    <Text className="font-black text-[#5B4FD1]" style={{ fontSize: size * 0.4 }}>
      {(name || "?").charAt(0).toUpperCase()}
    </Text>
    {dot ? <View className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${dot}`} /> : null}
  </View>
);

const MiniStat = ({
  icon,
  label,
  value,
  sub,
  basis,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  basis: string;
}) => (
  <View
    style={{ flexBasis: basis as any, flexGrow: 1 }}
    className="bg-white border border-[#E7E4F5] rounded-2xl p-3.5"
  >
    <View className="flex-row items-center">
      <View className="w-6 h-6 rounded-lg bg-[#EEECFA] items-center justify-center mr-2">{icon}</View>
      <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider">{label}</Text>
    </View>
    <Text className="text-lg font-black text-[#1F1B3D] mt-2" numberOfLines={1}>
      {value}
    </Text>
    {sub ? (
      <Text className="text-[10px] font-semibold text-[#7A76A6]" numberOfLines={1}>
        {sub}
      </Text>
    ) : null}
  </View>
);

// The reason under a tracking badge, and what the phone itself reported (if anything)
const StatusLines = ({ status, big }: { status: TrackStatus; big?: boolean }) => {
  if (!status.reason && !status.phone) return null;
  const color =
    status.tone === "red" ? "text-rose-700" : status.tone === "amber" ? "text-amber-700" : status.tone === "green" ? "text-emerald-700" : "text-[#7A76A6]";
  const size = big ? "text-[12px]" : "text-[10px]";
  return (
    <View className="mt-1">
      {status.reason ? (
        <Text className={`${size} font-bold ${color}`} numberOfLines={2}>
          {status.reason}
        </Text>
      ) : null}
      {status.phone ? (
        <View className="flex-row items-start mt-0.5">
          <Smartphone size={big ? 12 : 10} color="#B45309" style={{ marginTop: 2 }} />
          <Text className={`${size} font-semibold text-amber-700 ml-1 flex-1`} numberOfLines={2}>
            Phone: {status.phone}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

// "Showing 51–100 of 230" + Prev / Next (50 rows per page)
const Pager = ({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) => {
  if (total <= 0) return null;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(total, page * PAGE_SIZE);
  const btn = (label: string, to: number, disabled: boolean, Icon: any, iconFirst: boolean) => (
    <TouchableOpacity
      onPress={() => !disabled && onChange(to)}
      disabled={disabled}
      style={{ opacity: disabled ? 0.35 : 1 }}
      className="h-9 px-3 rounded-xl bg-white border border-[#E7E4F5] flex-row items-center active:bg-[#EEECFA]"
    >
      {iconFirst ? <Icon size={14} color="#5B4FD1" /> : null}
      <Text className="text-[11px] font-black text-[#5B4FD1] mx-1">{label}</Text>
      {!iconFirst ? <Icon size={14} color="#5B4FD1" /> : null}
    </TouchableOpacity>
  );
  return (
    <View className="flex-row items-center justify-between mt-2 mb-1 px-1">
      <Text className="text-[11px] font-bold text-[#7A76A6]">
        Showing {first}–{last} of {total}
        {pages > 1 ? `  ·  Page ${page} of ${pages}` : ""}
      </Text>
      {pages > 1 ? (
        <View className="flex-row" style={{ gap: 6 }}>
          {btn("Prev", page - 1, page <= 1, ChevronLeft, true)}
          {btn("Next", page + 1, page >= pages, ChevronRight, false)}
        </View>
      ) : null}
    </View>
  );
};

const EmptyState = ({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) => (
  <View className="items-center justify-center px-8 py-14">
    <View className="w-16 h-16 rounded-full bg-[#EEECFA] items-center justify-center">{icon}</View>
    <Text className="text-sm font-black text-[#1F1B3D] mt-4 text-center">{title}</Text>
    <Text className="text-xs text-[#7A76A6] text-center mt-1.5 leading-5">{text}</Text>
  </View>
);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function LiveTrackingScreen({ navigation, route }: any) {
  const { isWebDesktop } = useResponsive();
  const isFocused = useIsFocused();
  const mapRef = useRef<any>(null);

  // Date filter: From (selectedDate) - To. Opens on today (From = To = today).
  // From = To -> the one-day view (timeline, map, live actions). From < To -> range lists, 50 per page.
  const [selectedDate, setSelectedDate] = useState<Date>(() => parseYmd(route?.params?.date) ?? new Date());
  const [toDate, setToDate] = useState<Date>(() => parseYmd(route?.params?.date) ?? new Date());
  const [pickerFor, setPickerFor] = useState<null | "from" | "to">(null); // iPhone inline picker
  const dateStr = toYmd(selectedDate);
  const toStr = toYmd(toDate);
  const isRange = toStr !== dateStr;
  const isToday = !isRange && dateStr === toYmd(new Date());
  // "Open day" from a range remembers the range, so the admin can go back to it
  const [prevRange, setPrevRange] = useState<{ from: Date; to: Date } | null>(null);

  // Page of the list on screen (everyone, one person's day, or a range list)
  const [page, setPage] = useState(1);
  const [rangeData, setRangeData] = useState<RangeData | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const rangeReq = useRef(0);

  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);

  const initialEmp = route?.params?.empId && route.params.empId !== "ALL_ACTIVE" ? route.params.empId : null;
  const [selected, setSelected] = useState<{ empId: string; name: string } | null>(
    initialEmp ? { empId: initialEmp, name: initialEmp } : null
  );

  const [points, setPoints] = useState<TracePoint[]>([]);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState<"timeline" | "map">("timeline");
  const [viewMode, setViewMode] = useState<"grouped" | "all">("grouped");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string | null>(null); // null = all departments
  const [searchFocused, setSearchFocused] = useState(false);
  const [editing, setEditing] = useState(false); // true while the admin is typing a new search

  // "Ping now": ask the selected employee's phone for its location right now
  const canPing = can("LIVE_TRACKING");
  const adminEmpId = String((UserSession as any).empId ?? "");
  const [ping, setPing] = useState<{ phase: "idle" | "sending" | "waiting" | "done" | "timeout" | "error"; msg?: string; point?: TracePoint }>({ phase: "idle" });
  const [statusCheck, setStatusCheck] = useState<{
    phase: "idle" | "sending" | "waiting" | "done" | "timeout" | "error";
    msg?: string;
    status?: any;
  }>({ phase: "idle" });
  const pingTimers = useRef<any[]>([]);
  useEffect(() => () => pingTimers.current.forEach((t) => clearInterval(t)), []);

  // Refs so polling always sees the latest selection/date (no stale closures)
  const selectedRef = useRef(selected);
  const dateRef = useRef(dateStr);
  const staffReq = useRef(0);
  const dayReq = useRef(0);

  // ----------------------------- data loading -----------------------------
  const loadStaff = async (ymd: string) => {
    const my = ++staffReq.current;
    try {
      const res = await fetch(`${API_ATTENDANCE}/active-fleet?date=${ymd}`, { cache: "no-store" });
      let rows: StaffRow[] = [];
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d)) {
          rows = d
            // an old backend ignores ?date= and returns today's staff: never show them under another date
            .filter((r: any) => r.traceDate == null || r.traceDate === ymd)
            // staff with GPS data, plus checked-in sales staff with none (shown as "Never started" with the reason)
            .filter(
              (r: any) =>
                (r.pointCount ?? 0) > 0 ||
                String(r.activeWorkMode || "").toUpperCase() === "SALES" ||
                !!r.clientCode
            )
            .map((r: any) => ({ ...r, lastTime: r.lastPingTime }));
        }
      }
      if (my !== staffReq.current) return;
      setStaff(rows);
    } catch (e) {
      console.warn("Could not load staff:", e);
    } finally {
      if (my === staffReq.current) setStaffLoaded(true);
    }
  };

  // "Phone status": is the phone reachable, is location on, is shift tracking running (sales staff only)
  const checkStatus = async () => {
    if (!selected || !adminEmpId || statusCheck.phase === "sending" || statusCheck.phase === "waiting") return;
    const empId = selected.empId;
    const same = () => selectedRef.current?.empId === empId;
    setStatusCheck({ phase: "sending" });
    try {
      const res = await fetch(`${API_TRACKING}/status-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmpId, empId }),
      });
      if (!res.ok) {
        setStatusCheck({ phase: "error", msg: res.status === 403 ? "You are not allowed to do this." : "Could not send the request." });
        return;
      }
      const d = await res.json();
      if (!d.requestId) {
        setStatusCheck({
          phase: "error",
          msg:
            d.reason === "NOT_SALES"
              ? "Phone status is available for sales staff only."
              : d.reason === "NO_DEVICE"
              ? "No phone is registered for this employee (they must log in on the app once)."
              : d.reason === "RECENT"
              ? "A request was just sent. Wait a few seconds."
              : "Could not reach the push service. Try again.",
        });
        return;
      }
      setStatusCheck({ phase: "waiting" });
      let tries = 0;
      const id = setInterval(async () => {
        tries += 1;
        try {
          const r = await fetch(
            `${API_TRACKING}/status-result?adminEmpId=${encodeURIComponent(adminEmpId)}&requestId=${encodeURIComponent(d.requestId)}`,
            { cache: "no-store" }
          );
          const j = r.ok ? await r.json() : null;
          if (j?.replied) {
            clearInterval(id);
            if (same()) setStatusCheck({ phase: "done", status: j.status });
            return;
          }
        } catch {
          /* try again on the next tick */
        }
        if (tries >= 10) {
          clearInterval(id);
          if (same()) setStatusCheck({ phase: "timeout" });
        }
      }, 3000);
      pingTimers.current.push(id);
    } catch {
      setStatusCheck({ phase: "error", msg: "Check your connection and try again." });
    }
  };

  const pingNow = async () => {
    if (!selected || !adminEmpId || ping.phase === "sending" || ping.phase === "waiting") return;
    const empId = selected.empId;
    const clickMs = Date.now();
    const same = () => selectedRef.current?.empId === empId;
    setPing({ phase: "sending" });
    try {
      const res = await fetch(`${API_TRACKING}/ping-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmpId, empId }),
      });
      if (!res.ok) {
        setPing({ phase: "error", msg: res.status === 403 ? "You are not allowed to do this." : "Could not send the ping." });
        return;
      }
      const d = await res.json();
      if (!d.sent) {
        setPing({
          phase: "error",
          msg:
            d.reason === "NO_DEVICE"
              ? "No phone is registered for this employee (they must log in on the app once)."
              : d.reason === "RECENT"
              ? "A ping was just sent. Wait a few seconds."
              : "Could not reach the push service. Try again.",
        });
        return;
      }
      setPing({ phase: "waiting" });
      let tries = 0;
      const id = setInterval(async () => {
        tries += 1;
        try {
          const ymd = toYmd(new Date());
          const r = await fetch(`${API_ATTENDANCE}/traces?empId=${encodeURIComponent(empId)}&date=${ymd}`, { cache: "no-store" });
          const raw = r.ok ? await r.json() : [];
          const pts: TracePoint[] = Array.isArray(raw) ? raw : typeof raw === "string" ? JSON.parse(raw) : [];
          // the answer is the newest point whose remarks start with "Manager ping", made after the tap
          const hit = [...pts].reverse().find((p) => (p.remarks || "").includes("Manager ping") && toMs(p, ymd) >= clickMs - 60000);
          if (hit) {
            clearInterval(id);
            if (same()) {
              setPing({ phase: "done", point: hit });
              loadDay(empId, dateRef.current, true);
            }
            return;
          }
        } catch {
          /* try again on the next tick */
        }
        if (tries >= 15) {
          clearInterval(id);
          if (same()) {
            setPing({
              phase: "timeout",
              msg: "No reply in 45 seconds. The person may not be checked in, or the phone is off, offline or has notifications blocked.",
            });
          }
        }
      }, 3000);
      pingTimers.current.push(id);
    } catch {
      setPing({ phase: "error", msg: "Check your connection and try again." });
    }
  };

  const loadDay = async (empId: string, ymd: string, silent: boolean) => {
    const my = ++dayReq.current;
    if (!silent) setLoadingDay(true);
    try {
      const [tRes, eRes] = await Promise.all([
        fetch(`${API_ATTENDANCE}/traces?empId=${encodeURIComponent(empId)}&date=${ymd}`, { cache: "no-store" }),
        USE_SERVER_EVENTS
          ? fetch(`${API_ATTENDANCE}/trace-events?empId=${empId}&date=${ymd}`).catch(() => null)
          : Promise.resolve(null),
      ]);
      const raw = tRes.ok ? await tRes.json() : [];
      const pts: TracePoint[] = Array.isArray(raw) ? raw : typeof raw === "string" ? JSON.parse(raw) : [];
      const ev = eRes && eRes.ok ? await eRes.json() : [];
      if (my !== dayReq.current) return; // a newer request (other staff/date) won
      setPoints(pts);
      setEvents(Array.isArray(ev) ? ev : []);
    } catch (e) {
      console.warn("Could not load traces:", e);
    } finally {
      if (my === dayReq.current) setLoadingDay(false);
    }
  };

  // Date range lists come from the server one page (50 rows) at a time
  const loadRange = async (empId: string | null, from: string, to: string, pageNo: number, silent: boolean) => {
    const my = ++rangeReq.current;
    if (!silent) setRangeLoading(true);
    try {
      const qs = `from=${from}&to=${to}&page=${pageNo}&size=${PAGE_SIZE}`;
      const url = empId
        ? `${API_ATTENDANCE}/traces-range?empId=${encodeURIComponent(empId)}&${qs}`
        : `${API_ATTENDANCE}/active-fleet?${qs}`;
      const res = await fetch(url, { cache: "no-store" });
      if (my !== rangeReq.current) return;
      if (res.status === 404) {
        setRangeError("The server does not support date ranges yet. Update the backend, or pick a single day.");
        setRangeData(null);
        return;
      }
      if (!res.ok) {
        setRangeError(res.status === 400 ? `Pick a range of at most ${MAX_RANGE_DAYS} days.` : "Could not load this range. Pull to refresh.");
        setRangeData(null);
        return;
      }
      const d = await res.json();
      if (my !== rangeReq.current) return;
      // an old backend ignores from/to and returns one day as a plain list
      if (Array.isArray(d) || !Array.isArray(d?.items)) {
        setRangeError("The server does not support date ranges yet. Update the backend, or pick a single day.");
        setRangeData(null);
        return;
      }
      setRangeError(null);
      setRangeData(
        empId
          ? { kind: "points", total: Number(d.total) || 0, items: d.items }
          : {
              kind: "staff",
              total: Number(d.total) || 0,
              items: d.items.map((r: any) => ({ ...r, lastTime: r.lastPingTime })),
            }
      );
    } catch (e) {
      if (my === rangeReq.current) setRangeError("Can't reach the server. Check your internet connection.");
    } finally {
      if (my === rangeReq.current) setRangeLoading(false);
    }
  };

  // Directory for search suggestions (all employees, not only those with data)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_ADMIN}/users`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setDirectory(
            data
              .filter((u: any) => u?.empId)
              .map((u: any) => ({
                empId: u.empId,
                name: u.fullName || u.userName || u.empId,
                phone: String(u.mobileNumber || u.phone || "").trim(),
              }))
          );
        }
      } catch {
        /* search falls back to the staff list */
      }
    })();
  }, []);

  useEffect(() => {
    dateRef.current = dateStr;
    if (!isRange) loadStaff(dateStr);
  }, [dateStr, isRange]);

  // Back to page 1 whenever the filter changes
  useEffect(() => {
    setPage(1);
  }, [dateStr, toStr, selected?.empId, viewMode, deptFilter]);

  // Date range: load the page on screen (one employee if chosen, otherwise everyone)
  useEffect(() => {
    if (!isRange) {
      setRangeData(null);
      setRangeError(null);
      return;
    }
    loadRange(selected?.empId ?? null, dateStr, toStr, page, false);
  }, [isRange, selected?.empId, dateStr, toStr, page]);

  useEffect(() => {
    setPing({ phase: "idle" });
    setStatusCheck({ phase: "idle" });
  }, [selected?.empId]);

  useEffect(() => {
    selectedRef.current = selected;
    dateRef.current = dateStr;
    setPoints([]);
    setEvents([]);
    if (selected && !isRange) loadDay(selected.empId, dateStr, false);
  }, [selected?.empId, dateStr, isRange]);

  // Auto-refresh only for today, while this screen is visible and the app is active
  useEffect(() => {
    if (!isFocused || !isToday) return;
    const id = setInterval(() => {
      if (AppState.currentState !== "active") return;
      loadStaff(dateRef.current);
      const s = selectedRef.current;
      if (s) loadDay(s.empId, dateRef.current, true);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [isFocused, isToday]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (isRange) {
      await loadRange(selected?.empId ?? null, dateStr, toStr, page, true);
    } else {
      await Promise.all([
        loadStaff(dateStr),
        selected ? loadDay(selected.empId, dateStr, true) : Promise.resolve(),
      ]);
    }
    setRefreshing(false);
  };

  // ----------------------------- date controls -----------------------------
  // No future dates; To never before From; at most 31 days (the other end moves to fit)
  const capToday = (d: Date) => (toYmd(d) > toYmd(new Date()) ? new Date() : d);
  const setDay = (d: Date) => {
    const x = capToday(d);
    setSelectedDate(x);
    setToDate(x);
  };
  const setFrom = (d: Date) => {
    const f = capToday(d);
    let t = toDate;
    if (toYmd(f) > toYmd(t)) t = f;
    if (daysBetween(f, t) >= MAX_RANGE_DAYS) t = addDays(f, MAX_RANGE_DAYS - 1);
    setPrevRange(null);
    setSelectedDate(f);
    setToDate(capToday(t));
  };
  const setTo = (d: Date) => {
    const t = capToday(d);
    let f = selectedDate;
    if (toYmd(t) < toYmd(f)) f = t;
    if (daysBetween(f, t) >= MAX_RANGE_DAYS) f = addDays(t, -(MAX_RANGE_DAYS - 1));
    setPrevRange(null);
    setSelectedDate(f);
    setToDate(t);
  };
  const setQuickRange = (days: number) => {
    const today = new Date();
    setPrevRange(null);
    setSelectedDate(addDays(today, -(days - 1)));
    setToDate(today);
  };
  // From a range list: open one day (timeline + map), remembering the range
  const openDay = (ymd: string) => {
    const d = parseYmd(ymd);
    if (!d) return;
    setPrevRange({ from: selectedDate, to: toDate });
    setDay(d);
  };
  const backToRange = () => {
    if (!prevRange) return;
    setSelectedDate(prevRange.from);
    setToDate(prevRange.to);
    setPrevRange(null);
  };

  // One-day view: step a day back / forward
  const shiftDay = (delta: number) => {
    const d = addDays(selectedDate, delta);
    if (toYmd(d) > toYmd(new Date())) return; // no future dates
    setPrevRange(null);
    setDay(d);
  };

  const openDatePicker = (which: "from" | "to") => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: which === "from" ? selectedDate : toDate,
        mode: "date",
        maximumDate: new Date(),
        onValueChange: (_event: any, d?: Date) => {
          if (d) (which === "from" ? setFrom : setTo)(d);
        },
        onDismiss: () => {},
      });
    } else if (Platform.OS === "ios") {
      setPickerFor(which);
    }
  };

  // ----------------------------- search -----------------------------
  const staffMap = useMemo(() => new Map(staff.map((s) => [s.empId, s])), [staff]);

  // ----------------------------- department filter -----------------------------
  const deptName = (d?: string | null) => (d && d.trim() ? d.trim() : "No department");
  const departments = useMemo(() => {
    const counts = new Map<string, number>();
    staff.forEach((s) => counts.set(deptName(s.department), (counts.get(deptName(s.department)) || 0) + 1));
    const last = (n: string) => (n === "No department" ? 1 : 0); // real departments first, A to Z
    return [...counts.entries()]
      .sort((a, b) => last(a[0]) - last(b[0]) || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [staff]);
  // A department that has nobody on the chosen date falls back to all departments
  const activeDept = deptFilter && departments.some((d) => d.name === deptFilter) ? deptFilter : null;
  const shownStaff = useMemo(
    () => (activeDept ? staff.filter((s) => deptName(s.department) === activeDept) : staff),
    [staff, activeDept]
  );

  // Phone number from the employee directory (the tracking data has none)
  const phoneMap = useMemo(() => new Map(directory.map((u) => [u.empId, u.phone || ""])), [directory]);
  const phoneOf = (empId?: string | null) => (empId ? phoneMap.get(empId) || "" : "");

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const pool: DirectoryUser[] = directory.length
      ? directory
      : staff.map((s) => ({ empId: s.empId, name: s.userName }));
    const starts = (u: DirectoryUser) =>
      u.name.toLowerCase().startsWith(q) || u.empId.toLowerCase().startsWith(q) ? 0 : 1;
    return pool
      .filter((u) => u.name.toLowerCase().includes(q) || u.empId.toLowerCase().includes(q))
      .sort((a, b) => starts(a) - starts(b) || a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [query, directory, staff]);

  const selectEmployee = (empId: string, name: string) => {
    setSelected({ empId, name });
    setQuery("");
    setEditing(false);
    setSearchFocused(false);
    Keyboard.dismiss();
  };

  const showSuggestions = searchFocused && query.trim().length > 0;
  const selectedName =
    (selected &&
      (directory.find((u) => u.empId === selected.empId)?.name ||
        staffMap.get(selected.empId)?.userName ||
        selected.name)) ||
    "";
  const selectedDept = selected ? staffMap.get(selected.empId)?.department : null;

  // The search bar shows the chosen employee until the admin starts typing again
  const inputValue = selected && !editing ? `${selectedName}  (${selected.empId})` : query;

  // Clear = forget the chosen employee and go back to the all-staff view
  const clearSearch = () => {
    setQuery("");
    setEditing(false);
    setSelected(null);
    setSearchFocused(false);
    Keyboard.dismiss();
  };

  const chipRows: StaffRow[] =
    selected && !staffMap.has(selected.empId)
      ? [{ empId: selected.empId, userName: selectedName, pointCount: 0 }, ...shownStaff]
      : shownStaff;

  const freshnessDot = (lastTime?: string | null) => {
    if (!isToday) return "bg-slate-300";
    const mins = minutesSinceHHmm(lastTime);
    if (mins == null) return "bg-slate-300";
    if (mins <= 90) return "bg-emerald-500";
    if (mins <= 180) return "bg-amber-400";
    return "bg-rose-500";
  };

  // ----------------------------- derived day data -----------------------------
  // No separate "missing" rows any more: a weak or missing position is explained by the entry's own remarks
  const allEvents = events;

  const timeline = useMemo(() => buildTimeline(points, allEvents, dateStr), [points, allEvents, dateStr]);
  const stays = useMemo(() => timeline.filter((i): i is StayItem => i.kind === "stay"), [timeline]);

  // Every ping in time order (with events), for the "All pings" view
  const flatItems = useMemo<FlatItem[]>(() => {
    const pingItems = stays.flatMap((s) => s.pings).map((p) => ({ ...p, kind: "ping" as const }));
    const t = (x: FlatItem) => (x.kind === "ping" ? x.ms : x.startMs);
    return [...pingItems, ...toEventItems(allEvents, dateStr)].sort((a, b) => t(a) - t(b));
  }, [stays, allEvents, dateStr]);

  // Check-in / Check-out labels for the punch pings
  const pingTags = useMemo(() => {
    const m = new Map<string, string>();
    const punches = stays
      .flatMap((s) => s.pings)
      .filter((p) => p.isPunch)
      .sort((a, b) => a.ms - b.ms);
    if (punches.length === 1) m.set(punches[0].key, "Check-in");
    else if (punches.length > 1) {
      m.set(punches[0].key, "Check-in");
      m.set(punches[punches.length - 1].key, "Check-out");
    }
    return m;
  }, [stays]);

  // Every reliable position in time order: this is the flow path drawn on the map
  const pathPoints = useMemo(
    () =>
      stays
        .filter((st) => !st.approx)
        .flatMap((st) => st.pings)
        .sort((x, y) => x.ms - y.ms),
    [stays]
  );

  // First stay, last stay and every stop; each gets a map marker with its time spent
  const markerStays = useMemo(() => {
    const good = stays.filter((st) => !st.approx);
    const first = good[0];
    const lastStay = good[good.length - 1];
    return good
      .filter((st) => st === first || st === lastStay || (st.endMs - st.startMs) / 60000 >= STOP_MIN_MINUTES)
      .map((st) => ({ stay: st, color: st === first ? "#1FAE5C" : st === lastStay ? "#5B4FD1" : "#F59E0B" }));
  }, [stays]);

  const summary = useMemo(() => {
    const path = pathPoints.length ? pathPoints : stays.flatMap((st) => st.pings);
    const km = pathLengthM(path, 50) / 1000;
    const stops = stays.filter((st) => (st.endMs - st.startMs) / 60000 >= STOP_MIN_MINUTES);
    const stoppedMin = stops.reduce((n, st) => n + Math.round((st.endMs - st.startMs) / 60000), 0);
    const longest = stops.reduce<StayItem | null>(
      (best, st) => (!best || st.endMs - st.startMs > best.endMs - best.startMs ? st : best),
      null
    );
    const batts = stays.map((st) => st.battery).filter((v): v is number => v != null);
    return {
      first: stays[0]?.startLabel ?? "--:--",
      last: stays[stays.length - 1]?.endLabel ?? "--:--",
      km: km.toFixed(1),
      issues: stays.reduce((n, st) => n + st.pings.filter((x) => x.remarks).length, 0),
      battery: batts.length ? `${batts[0]}% → ${batts[batts.length - 1]}%` : "—",
      stops: stops.length,
      stoppedMin,
      longest,
    };
  }, [stays, pathPoints]);

  const lastSeenMins = isToday && stays.length ? minutesSinceHHmm(stays[stays.length - 1].endLabel) : null;

  // ----------------------------- map -----------------------------
  const mapCoords = useMemo(() => {
    if (selected) {
      const src = pathPoints.length ? pathPoints : stays.flatMap((st) => st.pings);
      return src.map((p) => ({ latitude: p.lat, longitude: p.lng }));
    }
    return shownStaff
      .filter((s) => s.latestLatitude != null && s.latestLongitude != null)
      .map((s) => ({ latitude: Number(s.latestLatitude), longitude: Number(s.latestLongitude) }));
  }, [selected, stays, pathPoints, shownStaff]);

  const hasCoords = mapCoords.length > 0;

  // HTML for the WebView (Leaflet) map, rebuilt only when the data changes
  const leafletHtml = useMemo(() => {
    const src = pathPoints.length ? pathPoints : stays.flatMap((st) => st.pings);
    const route = selected ? src.map((p) => ({ lat: p.lat, lng: p.lng })) : [];
    const markers: WebMarker[] = selected
      ? markerStays.map(({ stay, color }) => ({
          lat: stay.lat,
          lng: stay.lng,
          title: stopTitle(stay),
          sub: stay.place,
          color,
        }))
      : shownStaff
          .filter((st) => st.latestLatitude != null && st.latestLongitude != null)
          .map((st) => ({
            lat: Number(st.latestLatitude),
            lng: Number(st.latestLongitude),
            title: `${st.userName} (${st.empId})`,
            sub: st.lastTime ? `Last ping ${st.lastTime}` : "",
            color: "#5B4FD1",
          }));
    return buildLeafletHtml(route, markers);
  }, [selected, stays, pathPoints, markerStays, shownStaff]);

  useEffect(() => {
    if (tab !== "map" || !hasCoords) return;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates?.(mapCoords, {
        edgePadding: { top: 60, right: 60, bottom: 100, left: 60 },
        animated: true,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [tab, selected?.empId, dateStr, hasCoords]);

  // Google Maps is skipped on web and inside Expo Go (black map); the WebView map is used instead
  const mapBlocked = !MapView || Platform.OS === "web" || (IS_EXPO_GO && Platform.OS === "android");

  // ----------------------------- render -----------------------------
  const { width: winW } = useWindowDimensions();
  const statBasis = winW >= 720 ? "23.5%" : "47.5%";

  // How recent the last point is: this decides the coloured dot / badge
  const freshInfo = (lastTime?: string | null) => {
    if (!isToday) return { label: "History", dot: "bg-slate-300", tone: "slate" as const };
    const mins = minutesSinceHHmm(lastTime);
    if (mins == null) return { label: "No data", dot: "bg-slate-300", tone: "slate" as const };
    if (mins <= 90) return { label: "Active", dot: "bg-emerald-500", tone: "green" as const };
    if (mins <= 180) return { label: "Idle", dot: "bg-amber-400", tone: "amber" as const };
    return { label: "No signal", dot: "bg-rose-500", tone: "red" as const };
  };

  // Tracking health of one employee today. Expected rhythm: a point every ~2 min when moving,
  // at least one every 10 min when standing still. The phone's own report (if any) explains the cause.
  const trackingStatus = (s: StaffRow): TrackStatus => {
    const phoneProblem =
      s.clientCode && s.clientCode !== "STARTED" && s.clientMessage
        ? `${s.clientMessage}${s.clientAt && !s.clientMessage.includes(s.clientAt) ? ` · reported ${s.clientAt}` : ""}`
        : null;
    if (!isToday) {
      return {
        key: "HISTORY",
        label: "History",
        tone: "slate",
        dot: "bg-slate-300",
        reason: s.punchOutHm ? `Checked out ${s.punchOutHm}` : null,
        phone: phoneProblem,
      };
    }
    if (s.punchOutHm) {
      return { key: "OUT", label: "Checked out", tone: "slate", dot: "bg-slate-300", reason: `Checked out ${s.punchOutHm} · tracking ended` };
    }
    if (s.clientCode === "IOS_NOT_SUPPORTED") {
      return {
        key: "IOS",
        label: "iPhone",
        tone: "slate",
        dot: "bg-slate-300",
        reason: "Not tracked on iPhone – only check-in and check-out locations are saved",
      };
    }
    const tsMs = s.lastTs ? Date.parse(s.lastTs) : NaN;
    const mins = !isNaN(tsMs) ? Math.max(0, Math.round((Date.now() - tsMs) / 60000)) : minutesSinceHHmm(s.lastTime);
    const sinceIn = minutesSinceHHmm(s.punchInHm);
    if ((s.pointCount ?? 0) <= 1 && (sinceIn == null || sinceIn >= 15)) {
      return {
        key: "NEVER",
        label: "Never started",
        tone: "red",
        dot: "bg-rose-500",
        reason: phoneProblem ?? "Only the check-in point – tracking did not start on the phone",
      };
    }
    if (mins == null) return { key: "NODATA", label: "No data", tone: "slate", dot: "bg-slate-300", phone: phoneProblem };
    if (mins > 30) {
      return {
        key: "STOPPED",
        label: "Tracking stopped",
        tone: "red",
        dot: "bg-rose-500",
        reason: `Stopped at ${s.lastTime ?? "--:--"} · no point for ${fmtDuration(mins)}`,
        phone: phoneProblem,
      };
    }
    if (mins > 15) {
      return {
        key: "DELAYED",
        label: "Delayed",
        tone: "amber",
        dot: "bg-amber-400",
        reason: `No point for ${mins} min (expected every 10 min)`,
        phone: phoneProblem,
      };
    }
    if (s.lastQuality === "STALE") {
      return { key: "NOFIX", label: "Location unavailable", tone: "amber", dot: "bg-amber-400", reason: s.lastRemarks || "No GPS fix", phone: phoneProblem };
    }
    if (s.lastQuality === "LOW") {
      return { key: "WEAK", label: "GPS weak", tone: "amber", dot: "bg-amber-400", reason: s.lastRemarks || "Weak GPS signal", phone: phoneProblem };
    }
    return {
      key: "OK",
      label: "Tracking OK",
      tone: "green",
      dot: "bg-emerald-500",
      reason: mins <= 1 ? "Last point just now" : `Last point ${mins} min ago`,
      phone: phoneProblem,
    };
  };

  const kpi = useMemo(() => {
    let ok = 0;
    let delayed = 0;
    let stopped = 0;
    shownStaff.forEach((s) => {
      const k = trackingStatus(s).key;
      if (k === "OK") ok += 1;
      else if (k === "DELAYED" || k === "WEAK" || k === "NOFIX") delayed += 1;
      else if (k === "STOPPED" || k === "NEVER") stopped += 1;
    });
    return { ok, delayed, stopped };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownStaff, isToday]);

  const selectedRow = selected ? staffMap.get(selected.empId) : undefined;
  const selectedFresh: TrackStatus =
    selectedRow && !isRange
      ? trackingStatus(selectedRow)
      : {
          key: "HISTORY",
          ...freshInfo(summary.last !== "--:--" ? summary.last : null),
        };

  // ----- map -----
  const renderMapPanel = () => (
    <View
      className="mx-4 mt-3 rounded-3xl overflow-hidden bg-slate-200 border border-[#E7E4F5]"
      style={[{ height: 480 }, CARD]}
    >
      {!mapBlocked ? (
        <MapView
          ref={mapRef}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined} // iPhone uses Apple Maps: no Google key needed
          style={StyleSheet.absoluteFill}
          initialRegion={{ latitude: 11.341, longitude: 77.7172, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        >
          {selected && pathPoints.length > 1 && (
            <Polyline
              coordinates={pathPoints.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
              strokeColor="#5B4FD1"
              strokeWidth={4}
            />
          )}
          {selected &&
            markerStays.map(({ stay, color }) => (
              <Marker
                key={stay.key}
                coordinate={{ latitude: stay.lat, longitude: stay.lng }}
                title={stopTitle(stay)}
                description={stay.place}
                pinColor={color}
              />
            ))}
          {!selected &&
            shownStaff
              .filter((s) => s.latestLatitude != null && s.latestLongitude != null)
              .map((s) => (
                <Marker
                  key={s.empId}
                  coordinate={{ latitude: Number(s.latestLatitude), longitude: Number(s.latestLongitude) }}
                  title={`${s.userName} (${s.empId})`}
                  description={s.lastTime ? `Last ping ${s.lastTime}` : undefined}
                  pinColor="#5B4FD1"
                  onCalloutPress={() => selectEmployee(s.empId, s.userName)}
                />
              ))}
        </MapView>
      ) : Platform.OS === "web" ? (
        <iframe title="Route map" srcDoc={leafletHtml} style={{ border: 0, width: "100%", height: "100%" }} />
      ) : WebView ? (
        <WebView
          originWhitelist={["*"]}
          source={{ html: leafletHtml, baseUrl: MAP_REFERRER_URL }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          nestedScrollEnabled
        />
      ) : (
        <View className="flex-1 items-center justify-center p-6">
          <MapPinOff size={34} color="#7A76A6" />
          <Text className="text-sm font-black text-[#1F1B3D] mt-2 text-center">Map not available here</Text>
          <Text className="text-xs text-[#7A76A6] text-center mt-1">
            Install react-native-webview, or open the route in Google Maps.
          </Text>
        </View>
      )}

      {hasCoords && (
        <TouchableOpacity
          onPress={() => openRoute(mapCoords)}
          className="absolute bottom-3 left-3 right-3 bg-[#150F38] rounded-2xl py-3.5 flex-row items-center justify-center active:opacity-90"
        >
          <ExternalLink size={14} color="#FFFFFF" />
          <Text className="text-white text-xs font-black ml-2 uppercase tracking-wider">
            {selected ? "Open day route in Google Maps" : "Open in Google Maps"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ----- one person's day -----
  const renderTimelineBody = () => {
    if (loadingDay && points.length === 0 && events.length === 0) {
      return (
        <View className="items-center justify-center py-16">
          <ActivityIndicator size="large" color="#5B4FD1" />
          <Text className="text-xs font-bold text-[#7A76A6] mt-3">Loading {fmtDateLong(selectedDate)}...</Text>
        </View>
      );
    }
    if (timeline.length === 0) {
      return (
        <EmptyState
          icon={<MapPinOff size={30} color="#7A76A6" />}
          title={`No location data for ${fmtDateLong(selectedDate)}`}
          text={`${selectedName} has no recorded locations on this date. Field staff are tracked only while checked in.`}
        />
      );
    }

    const coordText = (lat: number, lng: number) => `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;

    // left rail: a dot inside a soft ring, joined by a line
    const rail = (key: string, dot: string, ring: string, isLast: boolean, children: React.ReactNode) => (
      <View key={key} className="flex-row">
        <View className="items-center mr-3" style={{ width: 22 }}>
          <View
            className="w-[22px] h-[22px] rounded-full items-center justify-center mt-3.5"
            style={{ backgroundColor: ring }}
          >
            <View className={`w-2.5 h-2.5 rounded-full ${dot}`} />
          </View>
          {!isLast && <View className="w-0.5 flex-1 bg-[#E7E4F5] mt-1" />}
        </View>
        <View className="flex-1 pb-3">{children}</View>
      </View>
    );

    const eventTone = (status: string) => EVENT_META[status]?.tone === "red";
    const eventDot = (status: string) => (eventTone(status) ? "bg-rose-500" : "bg-amber-400");
    const eventRing = (status: string) => (eventTone(status) ? "#FFE4E6" : "#FEF3C7");

    const eventCard = (item: EventItem) => (
      <View
        className={`border rounded-2xl p-3.5 flex-row items-start ${
          eventTone(item.status) ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"
        }`}
      >
        <AlertTriangle size={16} color={eventTone(item.status) ? "#E11D48" : "#D97706"} />
        <View className="ml-2.5 flex-1">
          <Text className="text-xs font-black text-[#1F1B3D]">
            {item.timeLabel}  ·  {EVENT_META[item.status]?.label ?? item.status}
          </Text>
          {item.reason ? <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5">{item.reason}</Text> : null}
        </View>
      </View>
    );

    // One GPS ping: time, place, coordinates, accuracy, battery
    const pingRow = (p: PingRow, compact: boolean, latest: boolean) => {
      const tag = pingTags.get(p.key);
      return (
        <View key={p.key} className={`flex-row items-start ${compact ? "py-2.5 border-t border-[#F1EFFB]" : ""}`}>
          <View className="flex-1 pr-2">
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text className="text-xs font-black text-[#5B4FD1]">{p.time}</Text>
              {latest && <Pill text="LATEST" tone="green" />}
              {tag ? <Pill text={tag} tone="purple" /> : null}
              {p.approx ? <Pill text={p.stale ? "Last known" : "Approximate"} tone="amber" /> : null}
            </View>
            <Text className="text-[12px] font-bold text-[#1F1B3D] mt-1" numberOfLines={2}>
              {p.place}
            </Text>
            <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5">
              {coordText(p.lat, p.lng)}
              {p.accuracy != null ? `  ·  ±${p.accuracy}m` : ""}
              {p.battery != null ? `  ·  ${p.battery}% bat` : ""}
            </Text>
            {p.remarks ? <Text className="text-[10px] font-semibold text-amber-700 mt-1">Remarks: {p.remarks}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={() => openPin(p.lat, p.lng)}
            className="w-9 h-9 rounded-xl bg-[#EEECFA] items-center justify-center active:opacity-75"
          >
            <ExternalLink size={14} color="#5B4FD1" />
          </TouchableOpacity>
        </View>
      );
    };

    // Grouped view: one card per stop; tap to see every ping inside it
    const stayCard = (item: StayItem, isLast: boolean) => {
      const open = !!expanded[item.key];
      const firstRemark = item.pings.find((x) => x.remarks)?.remarks;
      const mins = Math.round((item.endMs - item.startMs) / 60000);
      return (
        <View className="bg-white border border-[#E7E4F5] rounded-2xl p-4" style={CARD}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setExpanded((e) => ({ ...e, [item.key]: !e[item.key] }))}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-2">
                <View className="flex-row flex-wrap items-center gap-1.5">
                  <Text className="text-[11px] font-black text-[#5B4FD1]">
                    {item.startLabel === item.endLabel ? item.startLabel : `${item.startLabel} – ${item.endLabel}`}
                  </Text>
                  {mins >= 1 ? <Pill text={fmtDuration(mins)} tone="purple" /> : null}
                  {isToday && isLast ? <Pill text="LATEST" tone="green" /> : null}
                  {item.tags.map((t) => (
                    <Pill key={t} text={t} tone={t === "Approximate" || t === "Last known" ? "amber" : "purple"} />
                  ))}
                </View>
                <Text className="text-[13px] font-black text-[#1F1B3D] mt-1.5" numberOfLines={2}>
                  {item.place}
                </Text>
                <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5">
                  {coordText(item.lat, item.lng)}
                  {item.accuracy != null ? `  ·  ±${item.accuracy}m` : ""}
                  {item.battery != null ? `  ·  ${item.battery}% battery` : ""}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => openPin(item.lat, item.lng)}
                className="w-9 h-9 rounded-xl bg-[#EEECFA] items-center justify-center active:opacity-75"
              >
                <ExternalLink size={14} color="#5B4FD1" />
              </TouchableOpacity>
            </View>

            {firstRemark ? (
              <Text className="text-[10px] font-semibold text-amber-700 mt-2" numberOfLines={2}>
                Remarks: {firstRemark}
              </Text>
            ) : null}

            <View className="flex-row items-center mt-2.5 pt-2.5 border-t border-[#F1EFFB]">
              <Text className="text-[11px] font-black text-[#5B4FD1]">
                {open ? "Hide" : "Show"} all {item.count} location{item.count === 1 ? "" : "s"}
              </Text>
              {open ? <ChevronUp size={13} color="#5B4FD1" /> : <ChevronDown size={13} color="#5B4FD1" />}
            </View>
          </TouchableOpacity>

          {open && <View className="mt-1">{item.pings.map((p) => pingRow(p, true, false))}</View>}
        </View>
      );
    };

    // A stop is a stay of 5+ minutes, a check-in / check-out, or the first / last place of the day
    const isStopItem = (st: StayItem) =>
      st.tags.length > 0 ||
      (st.endMs - st.startMs) / 60000 >= STOP_MIN_MINUTES ||
      st === stays[0] ||
      st === stays[stays.length - 1];
    const stopStays = stays.filter(isStopItem);

    const compactStay = (st: StayItem) => (
      <View className="flex-row items-center justify-between py-1.5">
        <Text className="text-[10px] font-semibold text-[#7A76A6] flex-1" numberOfLines={1}>
          {st.startLabel}  ·  passing  ·  {st.place}
        </Text>
        <TouchableOpacity onPress={() => openPin(st.lat, st.lng)}>
          <ExternalLink size={12} color="#A6A2CE" />
        </TouchableOpacity>
      </View>
    );

    // How far and how long the person travelled to the next stop
    const travelHint = (st: StayItem) => {
      const idx = stopStays.findIndex((x) => x.key === st.key);
      const next = stopStays[idx + 1];
      if (idx < 0 || !next) return null;
      const km = distM(st.lat, st.lng, next.lat, next.lng) / 1000;
      const mins = Math.max(0, Math.round((next.startMs - st.endMs) / 60000));
      return (
        <View className="flex-row items-center mt-2 ml-1">
          <Navigation size={11} color="#7A76A6" />
          <Text className="text-[10px] font-bold text-[#7A76A6] ml-1.5">
            {km.toFixed(1)} km  ·  {fmtDuration(mins)} to the next stop
          </Text>
        </View>
      );
    };

    const pingCount = flatItems.filter((i) => i.kind === "ping").length;

    // 50 rows per page; "last" still means the last row of the whole day (LATEST tag, rail line)
    const offset = (page - 1) * PAGE_SIZE;
    const rows = viewMode === "grouped" ? timeline : flatItems;
    const pageTimeline = timeline.slice(offset, offset + PAGE_SIZE);
    const pageFlat = flatItems.slice(offset, offset + PAGE_SIZE);

    return (
      <View className="px-4 web:lg:px-8 pt-3">
        <View className="flex-row self-start mb-3 bg-white border border-[#E7E4F5] rounded-full p-1">
          {(["grouped", "all"] as const).map((m) => {
            const active = viewMode === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setViewMode(m)}
                className={`px-4 py-1.5 rounded-full ${active ? "bg-[#5B4FD1]" : ""}`}
              >
                <Text className={`text-[11px] font-black ${active ? "text-white" : "text-[#7A76A6]"}`}>
                  {m === "grouped" ? "Grouped stops" : `All locations (${pingCount})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Pager page={page} total={rows.length} onChange={setPage} />

        {viewMode === "grouped"
          ? pageTimeline.map((item, i) => {
              const last = offset + i === timeline.length - 1;
              if (item.kind === "event") {
                return rail(item.key, eventDot(item.status), eventRing(item.status), last, eventCard(item));
              }
              const stop = isStopItem(item);
              return rail(
                item.key,
                item.approx ? "bg-slate-400" : stop ? "bg-[#5B4FD1]" : "bg-slate-300",
                item.approx ? "#F1F5F9" : stop ? "#EEECFA" : "#F1F5F9",
                last,
                stop ? (
                  <>
                    {stayCard(item, last)}
                    {travelHint(item)}
                  </>
                ) : (
                  compactStay(item)
                )
              );
            })
          : pageFlat.map((item, i) => {
              const last = offset + i === flatItems.length - 1;
              return item.kind === "ping"
                ? rail(
                    item.key,
                    item.approx ? "bg-slate-400" : "bg-[#5B4FD1]",
                    item.approx ? "#F1F5F9" : "#EEECFA",
                    last,
                    <View className="bg-white border border-[#E7E4F5] rounded-2xl p-3.5" style={CARD}>
                      {pingRow(item, false, isToday && last)}
                    </View>
                  )
                : rail(item.key, eventDot(item.status), eventRing(item.status), last, eventCard(item));
            })}

        {rows.length > PAGE_SIZE ? <Pager page={page} total={rows.length} onChange={setPage} /> : null}
      </View>
    );
  };

  // ----- everyone -----
  const renderOverviewBody = () => {
    if (!staffLoaded) {
      return (
        <View className="items-center justify-center py-16">
          <ActivityIndicator size="large" color="#5B4FD1" />
        </View>
      );
    }
    if (staff.length === 0) {
      return (
        <EmptyState
          icon={<MapPinOff size={30} color="#7A76A6" />}
          title={`No location data for ${fmtDateLong(selectedDate)}`}
          text="Search an employee above, or pick another date."
        />
      );
    }
    return (
      <View className="px-4 web:lg:px-8 pt-4">
        <View className="flex-row items-center justify-between mb-2.5 px-1">
          <Text className="text-sm font-black text-[#1F1B3D]">
            {activeDept || "Field staff"} <Text className="text-[#7A76A6]">· {shownStaff.length}</Text>
          </Text>
          {isToday && (
            <View className="flex-row items-center">
              {[
                ["bg-emerald-500", "OK"],
                ["bg-amber-400", "Delayed"],
                ["bg-rose-500", "Stopped"],
              ].map(([c, l]) => (
                <View key={l} className="flex-row items-center ml-3">
                  <View className={`w-2 h-2 rounded-full mr-1 ${c}`} />
                  <Text className="text-[10px] font-bold text-[#7A76A6]">{l}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Pager page={page} total={shownStaff.length} onChange={setPage} />

        {shownStaff.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((s) => {
          const f = trackingStatus(s);
          return (
            <TouchableOpacity
              key={s.empId}
              onPress={() => selectEmployee(s.empId, s.userName)}
              activeOpacity={0.85}
              className="mb-2.5"
            >
              <Card className="p-3.5 flex-row items-center">
                <Avatar name={s.userName} dot={f.dot} size={46} />
                <View className="flex-1 ml-3 pr-2">
                  <Text className="text-[13px] font-black text-[#1F1B3D]" numberOfLines={1}>
                    {s.userName}
                  </Text>
                  <View className="flex-row items-center mt-0.5">
                    <Phone size={11} color="#7A76A6" />
                    <Text className="text-[11px] font-bold text-[#1F1B3D] ml-1" numberOfLines={1}>
                      {phoneOf(s.empId) || "No phone number"}
                    </Text>
                  </View>
                  <Text className="text-[10px] font-bold text-[#7A76A6] mt-0.5" numberOfLines={1}>
                    {s.empId}
                    {s.department ? `  ·  ${s.department}` : ""}
                  </Text>
                  <View className="flex-row items-center mt-1.5">
                    <Clock size={11} color="#7A76A6" />
                    <Text className="text-[10px] font-bold text-[#7A76A6] ml-1">
                      {s.firstTime ?? "--:--"} – {s.lastTime ?? "--:--"}
                    </Text>
                    {s.batteryPercentage != null && s.batteryPercentage > 0 ? (
                      <>
                        <Battery size={11} color="#7A76A6" style={{ marginLeft: 10 }} />
                        <Text className="text-[10px] font-bold text-[#7A76A6] ml-1">{s.batteryPercentage}%</Text>
                      </>
                    ) : null}
                  </View>
                  <StatusLines status={f} />
                </View>
                <View className="items-end mr-1">
                  <Pill text={f.label} tone={f.tone} />
                  <Text className="text-[10px] font-black text-[#5B4FD1] mt-1.5">
                    {s.pointCount != null ? `${s.pointCount} pts` : "—"}
                  </Text>
                </View>
                <ChevronRight size={16} color="#A6A2CE" />
              </Card>
            </TouchableOpacity>
          );
        })}

        {shownStaff.length > PAGE_SIZE ? <Pager page={page} total={shownStaff.length} onChange={setPage} /> : null}
      </View>
    );
  };

  // ----- date range: everyone (one row per employee per day) -----
  const rangeLabel = `${fmtDateShort(selectedDate)} – ${fmtDateShort(toDate)}`;

  const renderRangeState = () => {
    if (rangeError) {
      return (
        <EmptyState icon={<AlertTriangle size={30} color="#D97706" />} title="Could not show this range" text={rangeError} />
      );
    }
    if (rangeLoading && !rangeData) {
      return (
        <View className="items-center justify-center py-16">
          <ActivityIndicator size="large" color="#5B4FD1" />
          <Text className="text-xs font-bold text-[#7A76A6] mt-3">Loading {rangeLabel}...</Text>
        </View>
      );
    }
    return null;
  };

  const renderRangeOverviewBody = () => {
    const state = renderRangeState();
    if (state) return state;
    const data = rangeData?.kind === "staff" ? rangeData : null;
    if (!data || data.total === 0) {
      return (
        <EmptyState
          icon={<MapPinOff size={30} color="#7A76A6" />}
          title={`No location data for ${rangeLabel}`}
          text="Field staff are tracked only while checked in. Pick other dates."
        />
      );
    }
    return (
      <View className="px-4 web:lg:px-8 pt-4">
        <Text className="text-sm font-black text-[#1F1B3D] mb-1 px-1">
          Field staff by day <Text className="text-[#7A76A6]">· {rangeLabel}</Text>
        </Text>
        <Pager page={page} total={data.total} onChange={setPage} />
        {data.items.map((s) => (
          <TouchableOpacity
            key={`${s.empId}-${s.traceDate}`}
            onPress={() => selectEmployee(s.empId, s.userName)}
            activeOpacity={0.85}
            className="mb-2.5"
          >
            <Card className="p-3.5 flex-row items-center">
              <Avatar name={s.userName} size={46} />
              <View className="flex-1 ml-3 pr-2">
                <Text className="text-[13px] font-black text-[#1F1B3D]" numberOfLines={1}>
                  {s.userName}
                </Text>
                <Text className="text-[10px] font-bold text-[#7A76A6] mt-0.5" numberOfLines={1}>
                  {s.empId}
                  {s.department ? `  ·  ${s.department}` : ""}
                  {phoneOf(s.empId) ? `  ·  ${phoneOf(s.empId)}` : ""}
                </Text>
                <View className="flex-row items-center mt-1.5">
                  <Clock size={11} color="#7A76A6" />
                  <Text className="text-[10px] font-bold text-[#7A76A6] ml-1">
                    {s.firstTime ?? "--:--"} – {s.lastTime ?? "--:--"}
                  </Text>
                  {s.batteryPercentage != null && s.batteryPercentage > 0 ? (
                    <>
                      <Battery size={11} color="#7A76A6" style={{ marginLeft: 10 }} />
                      <Text className="text-[10px] font-bold text-[#7A76A6] ml-1">{s.batteryPercentage}%</Text>
                    </>
                  ) : null}
                </View>
              </View>
              <View className="items-end mr-1">
                <Pill text={fmtDateShort(parseYmd(s.traceDate) ?? new Date())} tone="purple" />
                <Text className="text-[10px] font-black text-[#5B4FD1] mt-1.5">
                  {s.pointCount != null ? `${s.pointCount} pts` : "—"}
                </Text>
              </View>
              <ChevronRight size={16} color="#A6A2CE" />
            </Card>
          </TouchableOpacity>
        ))}
        {data.total > PAGE_SIZE ? <Pager page={page} total={data.total} onChange={setPage} /> : null}
      </View>
    );
  };

  // ----- date range: one employee (every location, newest first, grouped by day) -----
  const renderRangePersonBody = () => {
    const state = renderRangeState();
    if (state) return state;
    const data = rangeData?.kind === "points" ? rangeData : null;
    if (!data || data.total === 0) {
      return (
        <EmptyState
          icon={<MapPinOff size={30} color="#7A76A6" />}
          title={`No location data for ${rangeLabel}`}
          text={`${selectedName} has no recorded locations in this range. Field staff are tracked only while checked in.`}
        />
      );
    }
    let lastDate = "";
    return (
      <View className="px-4 web:lg:px-8 pt-3">
        <Pager page={page} total={data.total} onChange={setPage} />
        {data.items.map((p, i) => {
          const header = p.date !== lastDate;
          lastDate = p.date;
          const hasPos = p.latitude != null && p.longitude != null && !isNaN(Number(p.latitude)) && !isNaN(Number(p.longitude));
          const lat = Number(p.latitude);
          const lng = Number(p.longitude);
          const stale = p.quality === "STALE";
          const approx = p.quality === "LOW" || stale;
          const placeholder = p.accuracyMeters === 0 && p.batteryPercentage === 0;
          const battery = placeholder ? null : p.batteryPercentage ?? null;
          return (
            <View key={`${p.date}-${i}-${p.ts ?? p.time}`}>
              {header && (
                <View className="flex-row items-center justify-between mt-3 mb-2 px-1">
                  <Text className="text-[12px] font-black text-[#1F1B3D]">
                    {fmtDateLong(parseYmd(p.date) ?? new Date())}
                  </Text>
                  <TouchableOpacity
                    onPress={() => openDay(p.date)}
                    className="flex-row items-center px-3 py-1.5 rounded-xl bg-[#EEECFA] active:opacity-80"
                  >
                    <MapIcon size={12} color="#5B4FD1" />
                    <Text className="text-[11px] font-black text-[#5B4FD1] ml-1.5">Open day</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View className="bg-white border border-[#E7E4F5] rounded-2xl p-3.5 mb-2 flex-row items-start" style={CARD}>
                <View className="flex-1 pr-2">
                  <View className="flex-row flex-wrap items-center gap-1.5">
                    <Text className="text-xs font-black text-[#5B4FD1]">{p.time}</Text>
                    {p.source === "PUNCH" ? <Pill text="Check-in / out" tone="purple" /> : null}
                    {approx ? <Pill text={stale ? "Last known" : "Approximate"} tone="amber" /> : null}
                  </View>
                  <Text className="text-[12px] font-bold text-[#1F1B3D] mt-1" numberOfLines={2}>
                    {p.locationName || (hasPos ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "No position")}
                  </Text>
                  {hasPos ? (
                    <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5">
                      Lat: {lat.toFixed(5)}, Lng: {lng.toFixed(5)}
                      {p.accuracyMeters ? `  ·  ±${p.accuracyMeters}m` : ""}
                      {battery != null ? `  ·  ${battery}% bat` : ""}
                    </Text>
                  ) : null}
                  {p.remarks ? <Text className="text-[10px] font-semibold text-amber-700 mt-1">Remarks: {p.remarks}</Text> : null}
                </View>
                {hasPos ? (
                  <TouchableOpacity
                    onPress={() => openPin(lat, lng)}
                    className="w-9 h-9 rounded-xl bg-[#EEECFA] items-center justify-center active:opacity-75"
                  >
                    <ExternalLink size={14} color="#5B4FD1" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })}
        {data.total > PAGE_SIZE ? <Pager page={page} total={data.total} onChange={setPage} /> : null}
      </View>
    );
  };

  // ----- the "Ping now" and "Phone status" answers -----
  const renderPingResults = () => {
    const pingBusy = ping.phase === "sending" || ping.phase === "waiting";
    const statusBusy = statusCheck.phase === "sending" || statusCheck.phase === "waiting";
    return (
      <View className="mt-3.5 pt-3.5 border-t border-[#F1EFFB]">
        <Text className="text-[10px] font-bold text-[#7A76A6] uppercase tracking-wider mb-2">Live actions</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={pingNow}
            disabled={pingBusy}
            activeOpacity={0.85}
            className="flex-1 h-11 rounded-2xl bg-[#5B4FD1] flex-row items-center justify-center"
          >
            {pingBusy ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text className="text-[12px] font-black text-white ml-2">Waiting...</Text>
              </>
            ) : (
              <>
                <LocateFixed size={15} color="#FFFFFF" />
                <Text className="text-[12px] font-black text-white ml-1.5">Ping now</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={checkStatus}
            disabled={statusBusy}
            activeOpacity={0.85}
            className="flex-1 h-11 rounded-2xl bg-white border border-[#5B4FD1] flex-row items-center justify-center"
          >
            {statusBusy ? (
              <>
                <ActivityIndicator size="small" color="#5B4FD1" />
                <Text className="text-[12px] font-black text-[#5B4FD1] ml-2">Waiting...</Text>
              </>
            ) : (
              <>
                <Smartphone size={15} color="#5B4FD1" />
                <Text className="text-[12px] font-black text-[#5B4FD1] ml-1.5">Phone status</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        <Text className="text-[10px] font-semibold text-[#7A76A6] mt-2">
          Ping now gets the current location. Phone status checks network, location switch and shift tracking (sales only).
        </Text>

        {/* Phone status answer */}
        {(statusCheck.phase === "error" || statusCheck.phase === "timeout") && (
          <View
            className={`mt-3 rounded-2xl p-3 border ${
              statusCheck.phase === "timeout" ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"
            }`}
          >
            {statusCheck.phase === "timeout" ? (
              <>
                <Text className="text-[11px] font-black text-rose-800">Network: OFF / not reachable</Text>
                <Text className="text-[10px] font-semibold text-rose-700 mt-0.5">
                  No reply in 30 seconds. The phone may be offline, switched off, or have notifications blocked.
                </Text>
              </>
            ) : (
              <Text className="text-[11px] font-bold text-amber-800">{statusCheck.msg}</Text>
            )}
          </View>
        )}

        {statusCheck.phase === "done" && statusCheck.status && (() => {
          const st = statusCheck.status;
          const locOn = st.gpsEnabled !== false && st.permission !== "DENIED" && st.permission !== "NOT_ASKED";
          const permText =
            st.permission === "GRANTED"
              ? "Allowed all the time"
              : st.permission === "FOREGROUND_ONLY"
              ? "Only while app is open"
              : st.permission === "DENIED"
              ? "Denied"
              : "Not asked yet";
          const Row = ({ label, value, ok }: { label: string; value: string; ok: boolean | null }) => (
            <View className="flex-row items-center justify-between py-2 border-t border-[#F1EFFB]">
              <Text className="text-[11px] font-bold text-[#7A76A6]">{label}</Text>
              <Pill text={value} tone={ok === null ? "slate" : ok ? "green" : "red"} />
            </View>
          );
          return (
            <View className="mt-3 bg-[#FBFAFF] border border-[#E7E4F5] rounded-2xl px-3.5 pt-3 pb-1">
              <Text className="text-[12px] font-black text-[#1F1B3D] pb-1.5">Phone status</Text>
              <Row label="Network" value="ON (replied)" ok={true} />
              <Row
                label="Phone location"
                value={st.gpsEnabled === false ? "OFF" : st.gpsEnabled === true ? "ON" : "Unknown"}
                ok={st.gpsEnabled == null ? null : st.gpsEnabled}
              />
              <Row label="App permission" value={permText} ok={st.permission === "GRANTED"} />
              {st.preciseLocation != null ? (
                <Row label="Precise location" value={st.preciseLocation ? "ON" : "OFF (about 2 km off)"} ok={st.preciseLocation} />
              ) : null}
              <Row
                label="Shift tracking"
                value={st.trackingRunning ? "Running" : st.shiftActive ? "Stopped (should run)" : "Not running"}
                ok={st.trackingRunning ? true : st.shiftActive ? false : null}
              />
              <Row label="App" value={st.appState === "OPEN" ? "Open" : "In background"} ok={null} />
              {st.lastStop ? (
                <Row
                  label="Last stop reason"
                  value={`${st.lastStop.detail} (${new Date(st.lastStop.at).toLocaleString("en-IN")})`}
                  ok={false}
                />
              ) : null}
              {st.lastDrop ? (
                <Row
                  label="Last refused point"
                  value={`${st.lastDrop.detail} (${new Date(st.lastDrop.at).toLocaleString("en-IN")})`}
                  ok={false}
                />
              ) : null}
              {st.outboxPending ? (
                <Row label="Waiting to upload" value={`${st.outboxPending} point(s)`} ok={st.outboxPending < 5} />
              ) : null}
              {st.battery != null ? <Row label="Battery" value={`${st.battery}%`} ok={st.battery > 15} /> : null}
              {!locOn ? (
                <Text className="text-[10px] font-bold text-rose-700 py-2">
                  Location is blocked on this phone, so no route points can be recorded.
                </Text>
              ) : (
                <View className="pb-1.5" />
              )}
            </View>
          );
        })()}

        {/* Ping now answer */}
        {(ping.phase === "error" || ping.phase === "timeout") && (
          <View className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
            <Text className="text-[11px] font-bold text-amber-800">{ping.msg}</Text>
          </View>
        )}

        {ping.phase === "done" && ping.point && (() => {
          const p = ping.point;
          const hasPos = p.latitude != null && p.longitude != null;
          const note = (p.remarks || "").replace(/^Manager ping( - )?/, "");
          const stale = p.quality === "STALE";
          const low = p.quality === "LOW";
          return (
            <View className="mt-3 bg-[#FBFAFF] border border-[#E7E4F5] rounded-2xl p-3.5">
              <View className="flex-row items-center justify-between">
                <Pill
                  text={stale ? "Online · no location" : low ? "Online · weak signal" : "Online"}
                  tone={stale ? "red" : low ? "amber" : "green"}
                />
                <Text className="text-[10px] font-bold text-[#7A76A6]">
                  Replied {p.time}
                  {p.batteryPercentage ? `  ·  ${p.batteryPercentage}% bat` : ""}
                </Text>
              </View>
              {hasPos ? (
                <View className="flex-row items-center justify-between mt-2.5">
                  <View className="flex-1 pr-2">
                    <Text className="text-[12px] font-black text-[#1F1B3D]" numberOfLines={2}>
                      {p.locationName || "Current location"}
                    </Text>
                    <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5">
                      Lat: {Number(p.latitude).toFixed(5)}, Lng: {Number(p.longitude).toFixed(5)}
                      {p.accuracyMeters ? `  ·  ±${p.accuracyMeters}m` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => openPin(Number(p.latitude), Number(p.longitude))}
                    className="w-9 h-9 rounded-xl bg-[#EEECFA] items-center justify-center active:opacity-75"
                  >
                    <ExternalLink size={14} color="#5B4FD1" />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text className="text-[11px] font-semibold text-[#7A76A6] mt-2">No position was sent.</Text>
              )}
              {note ? <Text className="text-[10px] font-bold text-amber-700 mt-2">{note}</Text> : null}
            </View>
          );
        })()}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F6F5FC]" edges={["top"]}>
      {/* ------------------------------ Header ------------------------------ */}
      {isWebDesktop ? <WebPageHeader title="Location Tracking" subtitle={isToday ? "Live · refreshes every minute" : isRange ? `History · ${rangeLabel}` : `History · ${fmtDateLong(selectedDate)}`} onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}><IconBtn label="Refresh" onPress={onRefresh}>{refreshing ? <ActivityIndicator size="small" color={ui.color.primary} /> : <RefreshCw size={16} color={ui.color.ink} />}</IconBtn></WebPageHeader> : null}
      {!isWebDesktop && (
      <View className="bg-[#5B4FD1]">
        <View style={CONTENT} className="px-5 web:lg:px-8 pt-3 web:lg:pt-5 pb-4 web:lg:pb-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <TouchableOpacity
                onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
                className="w-10 h-10 bg-white/20 rounded-2xl items-center justify-center active:opacity-75"
              >
                <ChevronLeft size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <View className="ml-3 flex-1">
                <Text className="text-lg font-black text-white" numberOfLines={1}>
                  Location Tracking
                </Text>
                <View className="flex-row items-center mt-0.5">
                  <View className={`w-2 h-2 rounded-full mr-1.5 ${isToday ? "bg-emerald-400" : "bg-white/50"}`} />
                  <Text className="text-[11px] font-bold text-purple-100" numberOfLines={1}>
                    {isToday
                      ? "Live · refreshes every minute"
                      : isRange
                      ? `History · ${rangeLabel}`
                      : `History · ${fmtDateLong(selectedDate)}`}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              onPress={onRefresh}
              className="w-10 h-10 bg-white/20 rounded-2xl items-center justify-center active:opacity-75"
            >
              {refreshing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <RefreshCw size={16} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>

          {/* Day at a glance (everyone view only) */}
          {!selected && staffLoaded && isToday && (
            <View className="flex-row gap-2.5 mt-4">
              {[
                { label: "Tracked today", value: shownStaff.length, dot: "bg-white" },
                { label: "Tracking OK", value: kpi.ok, dot: "bg-emerald-400" },
                {
                  label: "Delayed / stopped",
                  value: kpi.delayed + kpi.stopped,
                  dot: kpi.stopped ? "bg-rose-400" : "bg-amber-300",
                },
              ].map((k) => (
                <View key={k.label} className="flex-1 web:lg:flex-none web:lg:w-56 bg-white/15 border border-white/20 rounded-2xl px-3 py-2.5">
                  <View className="flex-row items-center">
                    <View className={`w-1.5 h-1.5 rounded-full mr-1.5 ${k.dot}`} />
                    <Text className="text-[9px] font-bold text-purple-100 uppercase tracking-wider" numberOfLines={1}>
                      {k.label}
                    </Text>
                  </View>
                  <Text className="text-2xl font-black text-white mt-0.5">{k.value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
      )}

      {/* ------------------------------ Scrolling page ------------------------------ */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#5B4FD1"]} />}
      >
        <View style={CONTENT}>
          {isWebDesktop && !selected && staffLoaded && isToday ? (
            <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 32, marginTop: 20 }}>
              {[
                { label: "Tracked today", value: shownStaff.length, dot: ui.color.primary },
                { label: "Tracking OK", value: kpi.ok, dot: "#1FAE5C" },
                { label: "Delayed / stopped", value: kpi.delayed + kpi.stopped, dot: kpi.stopped ? ui.color.danger : "#D08A0C" },
              ].map((k) => (
                <WebCard key={k.label} style={{ width: 220, padding: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: k.dot }} />
                    <Txt variant="label">{k.label}</Txt>
                  </View>
                  <Txt variant="title" style={{ marginTop: 4 }}>{k.value}</Txt>
                </WebCard>
              ))}
            </View>
          ) : null}
          {/* Filters: date, search, staff */}
          <View className="px-4 web:lg:px-8 mt-3 web:lg:mt-5">
            <Card className="p-3">
              <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
                {/* Dates: From - To (one day = From and To the same). Arrows step a single day. */}
                <View className="flex-row items-center">
                  {!isRange && (
                    <TouchableOpacity
                      onPress={() => shiftDay(-1)}
                      className="w-8 h-11 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5] items-center justify-center active:bg-[#EEECFA] mr-1.5"
                    >
                      <ChevronLeft size={15} color="#1F1B3D" />
                    </TouchableOpacity>
                  )}

                  {(["from", "to"] as const).map((which) => {
                    const value = which === "from" ? selectedDate : toDate;
                    const label = which === "from" ? "From" : "To";
                    return (
                      <React.Fragment key={which}>
                        {which === "to" && <Text className="text-[11px] font-black text-[#7A76A6] mx-1">–</Text>}
                        {Platform.OS === "web" ? (
                          <View className="h-11 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5] justify-center px-2.5">
                            <Text className="text-[8px] font-black text-[#7A76A6] uppercase tracking-wider">{label}</Text>
                            <input
                              type="date"
                              aria-label={`${label} date`}
                              value={toYmd(value)}
                              max={toYmd(new Date())}
                              onChange={(e) => {
                                const d = parseYmd(e.target.value);
                                if (d) (which === "from" ? setFrom : setTo)(d);
                              }}
                              style={{
                                backgroundColor: "transparent",
                                border: "none",
                                outline: "none",
                                fontFamily: "inherit",
                                fontSize: 12,
                                fontWeight: 800,
                                color: "#1F1B3D",
                                width: 112,
                                cursor: "pointer",
                                padding: 0,
                              }}
                            />
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => openDatePicker(which)}
                            activeOpacity={0.8}
                            className="h-11 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5] justify-center px-2.5"
                          >
                            <Text className="text-[8px] font-black text-[#7A76A6] uppercase tracking-wider">{label}</Text>
                            <View className="flex-row items-center">
                              <CalendarDays size={12} color="#5B4FD1" />
                              <Text className="text-xs font-black text-[#1F1B3D] ml-1">{fmtDateShort(value)}</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {!isRange && (
                    <TouchableOpacity
                      onPress={() => shiftDay(1)}
                      disabled={isToday}
                      style={{ opacity: isToday ? 0.35 : 1 }}
                      className="w-8 h-11 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5] items-center justify-center active:bg-[#EEECFA] ml-1.5"
                    >
                      <ChevronRight size={15} color="#1F1B3D" />
                    </TouchableOpacity>
                  )}

                  {!isToday && (
                    <TouchableOpacity
                      onPress={() => {
                        setPrevRange(null);
                        setDay(new Date());
                      }}
                      accessibilityLabel="Back to today"
                      className="ml-1.5 w-9 h-11 rounded-xl bg-[#5B4FD1] items-center justify-center active:opacity-90"
                    >
                      <RotateCcw size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Search, on the same line */}
                <View
                  className="flex-1 flex-row items-center bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl px-3 h-11"
                  style={{ minWidth: 130 }}
                >
                  <Search size={15} color="#7A76A6" />
                  <TextInput
                    value={inputValue}
                    onChangeText={(t) => {
                      setEditing(true);
                      setQuery(t);
                    }}
                    onFocus={() => {
                      setSearchFocused(true);
                      if (selected) {
                        setEditing(true); // start a fresh search; the current employee stays selected until a new one is picked
                        setQuery("");
                      }
                    }}
                    onBlur={() =>
                      setTimeout(() => {
                        setSearchFocused(false);
                        setEditing(false);
                        setQuery("");
                      }, 150)
                    }
                    selectTextOnFocus
                    placeholder="Search staff"
                    placeholderTextColor="#A6A2CE"
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    autoComplete="off"
                    importantForAutofill="no"
                    textContentType="none"
                    className={`flex-1 ml-2 text-xs text-[#1F1B3D] ${selected && !editing ? "font-black" : "font-semibold"}`}
                    style={Platform.OS === "web" ? ({ outlineStyle: "none", minWidth: 0 } as any) : undefined}
                  />
                  {selected || query ? (
                    <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <X size={15} color="#7A76A6" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Quick ranges (and the way back after "Open day") */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingTop: 10, paddingRight: 4, alignItems: "center" }}
              >
                {[
                  { key: "today", label: "Today", on: isToday, press: () => { setPrevRange(null); setDay(new Date()); } },
                  {
                    key: "yesterday",
                    label: "Yesterday",
                    on: !isRange && dateStr === toYmd(addDays(new Date(), -1)),
                    press: () => { setPrevRange(null); setDay(addDays(new Date(), -1)); },
                  },
                  {
                    key: "7",
                    label: "Last 7 days",
                    on: toStr === toYmd(new Date()) && dateStr === toYmd(addDays(new Date(), -6)),
                    press: () => setQuickRange(7),
                  },
                  {
                    key: "30",
                    label: "Last 30 days",
                    on: toStr === toYmd(new Date()) && dateStr === toYmd(addDays(new Date(), -29)),
                    press: () => setQuickRange(30),
                  },
                ].map((q) => (
                  <TouchableOpacity
                    key={q.key}
                    onPress={q.press}
                    accessibilityRole="button"
                    accessibilityState={{ selected: q.on }}
                    className={`mr-2 px-3 py-1.5 rounded-full border ${q.on ? "bg-[#EEECFA] border-[#5B4FD1]" : "bg-white border-[#E7E4F5]"}`}
                  >
                    <Text className={`text-xs font-bold ${q.on ? "text-[#5B4FD1]" : "text-[#1F1B3D]"}`}>{q.label}</Text>
                  </TouchableOpacity>
                ))}
                {prevRange && !isRange ? (
                  <TouchableOpacity
                    onPress={backToRange}
                    className="mr-2 px-3 py-1.5 rounded-full bg-[#5B4FD1] flex-row items-center"
                  >
                    <ChevronLeft size={13} color="#FFFFFF" />
                    <Text className="text-xs font-black text-white ml-0.5">
                      Back to {fmtDateShort(prevRange.from)} – {fmtDateShort(prevRange.to)}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </ScrollView>

              {Platform.OS === "ios" && pickerFor && (
                <DateTimePicker
                  value={pickerFor === "from" ? selectedDate : toDate}
                  mode="date"
                  display="inline"
                  maximumDate={new Date()}
                  onValueChange={(_event: any, d?: Date) => {
                    const which = pickerFor;
                    setPickerFor(null);
                    if (d) (which === "from" ? setFrom : setTo)(d);
                  }}
                  onDismiss={() => setPickerFor(null)}
                />
              )}

              {showSuggestions ? (
                <View className="mt-2 bg-white border border-[#E7E4F5] rounded-2xl overflow-hidden">
                  {suggestions.length === 0 ? (
                    <Text className="text-xs font-semibold text-[#7A76A6] p-3.5">No employee matches “{query.trim()}”</Text>
                  ) : (
                    suggestions.map((u, i) => {
                      const row = staffMap.get(u.empId);
                      return (
                        <TouchableOpacity
                          key={u.empId}
                          onPressIn={() => selectEmployee(u.empId, u.name)}
                          className={`px-3.5 py-2.5 flex-row items-center justify-between active:bg-[#F6F5FC] ${
                            i > 0 ? "border-t border-[#F1EFFB]" : ""
                          }`}
                        >
                          <View className="flex-1 pr-2">
                            <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>
                              {u.name}
                            </Text>
                            <Text className="text-[10px] font-semibold text-[#7A76A6]">{u.empId}</Text>
                          </View>
                          {!isRange ? (
                            <Pill
                              text={row ? `${row.pointCount ?? "•"} pts on this date` : "No data on this date"}
                              tone={row ? "green" : "slate"}
                            />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              ) : isRange ? (
                <Text className="text-[11px] font-semibold text-[#7A76A6] pt-2.5 px-1">
                  {selected
                    ? `Showing ${selectedName}'s locations for ${rangeLabel}. Clear the search to see everyone.`
                    : `Showing everyone for ${rangeLabel}. Search an employee to see only their locations.`}
                </Text>
              ) : (
                <>
                {departments.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingTop: 10, paddingRight: 4, alignItems: "center" }}
                  >
                    <Text className="text-[11px] font-black text-[#7A76A6] mr-2">Department</Text>
                    {[{ name: null as string | null, label: "All", count: staff.length }, ...departments.map((d) => ({ name: d.name as string | null, label: d.name, count: d.count }))].map((d) => {
                      const on = activeDept === d.name;
                      return (
                        <TouchableOpacity
                          key={d.label}
                          onPress={() => setDeptFilter(d.name)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          className={`mr-2 px-3 py-1.5 rounded-full border flex-row items-center ${
                            on ? "bg-[#EEECFA] border-[#5B4FD1]" : "bg-white border-[#E7E4F5]"
                          }`}
                        >
                          <Text className={`text-xs font-bold ${on ? "text-[#5B4FD1]" : "text-[#1F1B3D]"}`}>{d.label}</Text>
                          <Text className={`text-[11px] font-bold ml-1.5 ${on ? "text-[#5B4FD1]" : "text-[#7A76A6]"}`}>{d.count}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingTop: 10, paddingRight: 4 }}
                >
                  <TouchableOpacity
                    onPress={() => setSelected(null)}
                    className={`mr-2 px-3.5 py-2 rounded-2xl border justify-center ${
                      !selected ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"
                    }`}
                  >
                    <Text className={`text-xs font-black ${!selected ? "text-white" : "text-[#1F1B3D]"}`}>All staff</Text>
                    <Text className={`text-[9px] font-bold ${!selected ? "text-purple-200" : "text-[#7A76A6]"}`}>
                      {shownStaff.length} with data
                    </Text>
                  </TouchableOpacity>

                  {chipRows.map((s) => {
                    const active = selected?.empId === s.empId;
                    return (
                      <TouchableOpacity
                        key={s.empId}
                        onPress={() => (active ? setSelected(null) : selectEmployee(s.empId, s.userName))}
                        activeOpacity={0.8}
                        className={`mr-2 px-3.5 py-2 rounded-2xl border flex-row items-center ${
                          active ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"
                        }`}
                      >
                        <View
                          className={`w-2.5 h-2.5 rounded-full mr-2 ${
                            staffMap.has(s.empId) ? trackingStatus(s).dot : freshnessDot(s.lastTime)
                          }`}
                        />
                        <View>
                          <Text className={`text-xs font-black ${active ? "text-white" : "text-[#1F1B3D]"}`}>{s.userName}</Text>
                          <Text className={`text-[9px] font-bold ${active ? "text-purple-200" : "text-[#7A76A6]"}`}>
                            {s.empId}
                            {s.pointCount ? `  ·  ${s.pointCount} pts` : ""}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                </>
              )}
            </Card>
          </View>

          {/* Selected employee: profile, actions, numbers */}
          {selected && (
            <View className="px-4 web:lg:px-8 mt-3 web:lg:mt-5">
              <Card className="p-4">
                <View className="flex-row items-center">
                  <Avatar name={selectedName} dot={selectedFresh.dot} size={54} />
                  <View className="flex-1 ml-3 pr-2">
                    <Text className="text-base font-black text-[#1F1B3D]" numberOfLines={1}>
                      {selectedName}
                    </Text>
                    <View className="flex-row items-center mt-0.5">
                      <Phone size={12} color="#7A76A6" />
                      <Text className="text-xs font-bold text-[#1F1B3D] ml-1" numberOfLines={1}>
                        {phoneOf(selected.empId) || "No phone number"}
                      </Text>
                    </View>
                    <Text className="text-[11px] font-bold text-[#7A76A6] mt-0.5" numberOfLines={1}>
                      {selected.empId}
                      {selectedDept ? `  ·  ${selectedDept}` : ""}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Pill text={selectedFresh.label} tone={selectedFresh.tone} />
                    {lastSeenMins != null && (
                      <Text className="text-[10px] font-bold text-[#7A76A6] mt-1.5">
                        Last seen {fmtDuration(lastSeenMins)} ago
                      </Text>
                    )}
                  </View>
                </View>

                {!isRange && (selectedFresh.reason || selectedFresh.phone) ? (
                  <View className="mt-3 pt-3 border-t border-[#F1EFFB]">
                    <StatusLines status={selectedFresh} big />
                  </View>
                ) : null}
                {canPing && isToday ? renderPingResults() : null}
                {isRange && rangeData?.kind === "points" ? (
                  <Text className="text-[11px] font-bold text-[#7A76A6] mt-3 pt-3 border-t border-[#F1EFFB]">
                    {rangeData.total} location{rangeData.total === 1 ? "" : "s"}  ·  {rangeLabel}  ·  tap "Open day" for the map
                  </Text>
                ) : null}
              </Card>

              {!isRange && (
              <>
              <View className="flex-row flex-wrap gap-2 mt-2.5">
                <MiniStat icon={<Clock size={13} color="#5B4FD1" />} label="First ping" value={summary.first} basis={statBasis} />
                <MiniStat icon={<Clock size={13} color="#5B4FD1" />} label="Last ping" value={summary.last} basis={statBasis} />
                <MiniStat icon={<Navigation size={13} color="#5B4FD1" />} label="Distance" value={`${summary.km} km`} basis={statBasis} />
                <MiniStat
                  icon={<AlertTriangle size={13} color="#5B4FD1" />}
                  label="Remarks"
                  value={String(summary.issues)}
                  sub={summary.issues ? "see timeline" : "none"}
                  basis={statBasis}
                />
              </View>

              {(summary.battery !== "—" || summary.stops > 0) && (
                <View className="mt-2.5">
                  <Card className="px-4 py-3">
                    {summary.battery !== "—" && (
                      <View className="flex-row items-center">
                        <Battery size={13} color="#7A76A6" />
                        <Text className="text-[11px] font-bold text-[#7A76A6] ml-2">Battery {summary.battery}</Text>
                      </View>
                    )}
                    {summary.stops > 0 && (
                      <View className={`flex-row items-start ${summary.battery !== "—" ? "mt-2" : ""}`}>
                        <Navigation size={13} color="#7A76A6" style={{ marginTop: 2 }} />
                        <Text className="text-[11px] font-bold text-[#7A76A6] ml-2 flex-1">
                          {summary.stops} stop{summary.stops === 1 ? "" : "s"}  ·  {fmtDuration(summary.stoppedMin)} at stops
                          {summary.longest
                            ? `  ·  longest: ${summary.longest.place} (${fmtDuration(
                                Math.round((summary.longest.endMs - summary.longest.startMs) / 60000)
                              )})`
                            : ""}
                        </Text>
                      </View>
                    )}
                  </Card>
                </View>
              )}
              </>
              )}
            </View>
          )}

          {/* View switch (one day only: a range is a paged list; "Open day" shows its map) */}
          {!isRange && (
          <View className="mx-4 web:lg:mx-8 mt-4 web:lg:self-start web:lg:w-[320px] flex-row bg-[#EEECFA] rounded-2xl p-1">
            {(["timeline", "map"] as const).map((t) => {
              const active = tab === t;
              const Icon = t === "timeline" ? ListIcon : MapIcon;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTab(t)}
                  className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center ${active ? "bg-[#5B4FD1]" : ""}`}
                >
                  <Icon size={14} color={active ? "#FFFFFF" : "#7A76A6"} />
                  <Text className={`text-xs font-black ml-1.5 ${active ? "text-white" : "text-[#7A76A6]"}`}>
                    {t === "timeline" ? (selected ? "Timeline" : "Staff list") : "Map"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          )}

          {isRange
            ? selected
              ? renderRangePersonBody()
              : renderRangeOverviewBody()
            : tab === "map"
            ? renderMapPanel()
            : selected
            ? renderTimelineBody()
            : renderOverviewBody()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}