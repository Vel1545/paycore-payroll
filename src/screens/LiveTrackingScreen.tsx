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
} from "lucide-react-native";
import { BASE_HOST } from "../constants/config";

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
const POLL_MS = 60_000; // auto-refresh, today only
const STAY_RADIUS_M = 100; // consecutive points within this are one "stay"
const STOP_MIN_MINUTES = 5; // a stay at least this long counts as a stop (shorter ones are just passing by)
const APPROX_STAY_RADIUS_M = 600; // approximate (coarse) fixes are grouped more loosely
const MAX_ROUTE_WAYPOINTS = 8;
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
}

interface DirectoryUser {
  empId: string;
  name: string;
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
// Screen
// ---------------------------------------------------------------------------
export default function LiveTrackingScreen({ navigation, route }: any) {
  const isFocused = useIsFocused();
  const mapRef = useRef<any>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(() => parseYmd(route?.params?.date) ?? new Date());
  const [showIosPicker, setShowIosPicker] = useState(false);
  const dateStr = toYmd(selectedDate);
  const isToday = dateStr === toYmd(new Date());

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
  const [searchFocused, setSearchFocused] = useState(false);
  const [editing, setEditing] = useState(false); // true while the admin is typing a new search

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
            // hide staff with no GPS data (old backend sends no pointCount, so nothing is listed)
            .filter((r: any) => (r.pointCount ?? 0) > 0)
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
              .map((u: any) => ({ empId: u.empId, name: u.fullName || u.userName || u.empId }))
          );
        }
      } catch {
        /* search falls back to the staff list */
      }
    })();
  }, []);

  useEffect(() => {
    dateRef.current = dateStr;
    loadStaff(dateStr);
  }, [dateStr]);

  useEffect(() => {
    selectedRef.current = selected;
    dateRef.current = dateStr;
    setPoints([]);
    setEvents([]);
    if (selected) loadDay(selected.empId, dateStr, false);
  }, [selected?.empId, dateStr]);

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
    await Promise.all([
      loadStaff(dateStr),
      selected ? loadDay(selected.empId, dateStr, true) : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  // ----------------------------- date controls -----------------------------
  const shiftDay = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    if (toYmd(d) > toYmd(new Date())) return; // no future dates
    setSelectedDate(d);
  };

  const openDatePicker = () => {
    if (Platform.OS === "android") {
DateTimePickerAndroid.open({
  value: selectedDate,
  mode: "date",
  maximumDate: new Date(),
  onValueChange: (_event: any, d?: Date) => {
    if (d) setSelectedDate(d);
  },
  onDismiss: () => {},
});
    } else if (Platform.OS === "ios") {
      setShowIosPicker(true);
    }
  };

  // ----------------------------- search -----------------------------
  const staffMap = useMemo(() => new Map(staff.map((s) => [s.empId, s])), [staff]);

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
      ? [{ empId: selected.empId, userName: selectedName, pointCount: 0 }, ...staff]
      : staff;

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
    return staff
      .filter((s) => s.latestLatitude != null && s.latestLongitude != null)
      .map((s) => ({ latitude: Number(s.latestLatitude), longitude: Number(s.latestLongitude) }));
  }, [selected, stays, pathPoints, staff]);

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
      : staff
          .filter((st) => st.latestLatitude != null && st.latestLongitude != null)
          .map((st) => ({
            lat: Number(st.latestLatitude),
            lng: Number(st.latestLongitude),
            title: `${st.userName} (${st.empId})`,
            sub: st.lastTime ? `Last ping ${st.lastTime}` : "",
            color: "#5B4FD1",
          }));
    return buildLeafletHtml(route, markers);
  }, [selected, stays, pathPoints, markerStays, staff]);

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
  const renderMapPanel = () => (
    <View
      className="flex-1 mx-4 rounded-3xl overflow-hidden bg-slate-200 border border-[#E7E4F5]"
      style={{ marginBottom: 120 }} // keeps the panel clear of the floating tab bar
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
            staff
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
          className="absolute bottom-3 left-3 right-3 bg-[#150F38] rounded-2xl py-3 flex-row items-center justify-center active:opacity-90"
        >
          <ExternalLink size={14} color="#FFFFFF" />
          <Text className="text-white text-xs font-black ml-2 uppercase tracking-wider">
            {selected ? "Open day route in Google Maps" : "Open in Google Maps"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTimeline = () => {
    if (loadingDay && points.length === 0 && events.length === 0) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#5B4FD1" />
          <Text className="text-xs font-bold text-[#7A76A6] mt-2">Loading {fmtDateLong(selectedDate)}...</Text>
        </View>
      );
    }
    if (timeline.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#5B4FD1"]} />}
        >
          <View className="flex-1 items-center justify-center p-8">
            <MapPinOff size={36} color="#A6A2CE" />
            <Text className="text-sm font-black text-[#1F1B3D] mt-3 text-center">
              No location data for {fmtDateLong(selectedDate)}
            </Text>
            <Text className="text-xs text-[#7A76A6] text-center mt-1">
              {selectedName} has no recorded locations on this date. Field staff are tracked only while checked in.
            </Text>
          </View>
        </ScrollView>
      );
    }

    const coordText = (lat: number, lng: number) => `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;

    const rail = (key: string, dot: string, isLast: boolean, children: React.ReactNode) => (
      <View key={key} className="flex-row">
        <View className="items-center mr-3" style={{ width: 16 }}>
          <View className={`w-3 h-3 rounded-full mt-4 ${dot}`} />
          {!isLast && <View className="w-0.5 flex-1 bg-slate-200 mt-1" />}
        </View>
        <View className="flex-1 pb-3">{children}</View>
      </View>
    );

    const eventDot = (status: string) => (EVENT_META[status]?.tone === "red" ? "bg-rose-500" : "bg-amber-400");

    const eventCard = (item: EventItem) => (
      <View
        className={`border rounded-2xl p-3.5 flex-row items-start ${
          EVENT_META[item.status]?.tone === "red" ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"
        }`}
      >
        <AlertTriangle size={16} color={EVENT_META[item.status]?.tone === "red" ? "#E11D48" : "#D97706"} />
        <View className="ml-2.5 flex-1">
          <Text className="text-xs font-black text-[#1F1B3D]">
            {item.timeLabel}  ·  {EVENT_META[item.status]?.label ?? item.status}
          </Text>
          {item.reason ? (
            <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5">{item.reason}</Text>
          ) : null}
        </View>
      </View>
    );

    // One GPS ping: time, location name, latitude / longitude, accuracy, battery
    const pingRow = (p: PingRow, compact: boolean, latest: boolean) => {
      const tag = pingTags.get(p.key);
      return (
        <View key={p.key} className={`flex-row items-start ${compact ? "py-2.5 border-t border-[#F1EFFB]" : ""}`}>
          <View className="flex-1 pr-2">
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text className="text-xs font-black text-[#1F1B3D]">{p.time}</Text>
              {latest && (
                <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                  <Text className="text-[9px] font-black text-emerald-800">LATEST</Text>
                </View>
              )}
              {tag ? (
                <View className="bg-[#EEECFA] px-2 py-0.5 rounded-full">
                  <Text className="text-[9px] font-black text-[#5B4FD1]">{tag}</Text>
                </View>
              ) : null}
              {p.approx ? (
                <View className="bg-amber-100 px-2 py-0.5 rounded-full">
                  <Text className="text-[9px] font-black text-amber-800">{p.stale ? "Last known" : "Approximate"}</Text>
                </View>
              ) : null}
            </View>
            <Text className="text-[11px] font-semibold text-[#1F1B3D] mt-0.5" numberOfLines={2}>
              {p.place}
            </Text>
            <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5">
              {coordText(p.lat, p.lng)}
              {p.accuracy != null ? `  ·  ±${p.accuracy}m` : ""}
              {p.battery != null ? `  ·  ${p.battery}% bat` : ""}
            </Text>
            {p.remarks ? (
              <Text className="text-[10px] font-semibold text-amber-700 mt-0.5">Remarks: {p.remarks}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => openPin(p.lat, p.lng)}
            className="w-8 h-8 rounded-xl bg-[#EEECFA] items-center justify-center active:opacity-75"
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
      return (
        <View className="bg-white border border-[#E7E4F5] rounded-2xl p-3.5">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setExpanded((e) => ({ ...e, [item.key]: !e[item.key] }))}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-2">
                <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={2}>
                  {item.place}
                </Text>
                <Text className="text-[11px] font-bold text-[#5B4FD1] mt-0.5">
                  {item.startLabel === item.endLabel ? item.startLabel : `${item.startLabel} – ${item.endLabel}`}
                  {item.endMs - item.startMs >= 60000
                    ? `  ·  ${fmtDuration(Math.round((item.endMs - item.startMs) / 60000))}`
                    : ""}
                </Text>
                <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5">
                  {coordText(item.lat, item.lng)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => openPin(item.lat, item.lng)}
                className="w-8 h-8 rounded-xl bg-[#EEECFA] items-center justify-center active:opacity-75"
              >
                <ExternalLink size={14} color="#5B4FD1" />
              </TouchableOpacity>
            </View>

            <View className="flex-row flex-wrap items-center gap-1.5 mt-2">
              {isToday && isLast && (
                <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                  <Text className="text-[9px] font-black text-emerald-800">LATEST</Text>
                </View>
              )}
              {item.tags.map((t) => (
                <View
                  key={t}
                  className={`px-2 py-0.5 rounded-full ${(t === "Approximate" || t === "Last known") ? "bg-amber-100" : "bg-[#EEECFA]"}`}
                >
                  <Text className={`text-[9px] font-black ${(t === "Approximate" || t === "Last known") ? "text-amber-800" : "text-[#5B4FD1]"}`}>
                    {t}
                  </Text>
                </View>
              ))}
              <Text className="text-[10px] font-semibold text-[#7A76A6]">
                {item.accuracy != null ? `±${item.accuracy}m` : ""}
                {item.battery != null ? `${item.accuracy != null ? "  ·  " : ""}${item.battery}% battery` : ""}
              </Text>
            </View>

            {firstRemark ? (
              <Text className="text-[10px] font-semibold text-amber-700 mt-1.5" numberOfLines={2}>
                Remarks: {firstRemark}
              </Text>
            ) : null}

            <View className="flex-row items-center mt-2">
              <Text className="text-[10px] font-black text-[#5B4FD1]">
                {open ? "Hide" : "Show"} all {item.count} location{item.count === 1 ? "" : "s"}
              </Text>
              {open ? <ChevronUp size={12} color="#5B4FD1" /> : <ChevronDown size={12} color="#5B4FD1" />}
            </View>
          </TouchableOpacity>

          {open && <View className="mt-2">{item.pings.map((p) => pingRow(p, true, false))}</View>}
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
      <View className="flex-row items-center justify-between py-1">
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
        <Text className="text-[10px] font-bold text-[#7A76A6] mt-1.5 ml-1">
          ↓ {km.toFixed(1)} km  ·  {fmtDuration(mins)} to the next stop
        </Text>
      );
    };

    const pingCount = flatItems.filter((i) => i.kind === "ping").length;

    return (
      <View className="flex-1">
        <View className="flex-row mx-4 mb-2 bg-white border border-[#E7E4F5] rounded-xl p-0.5">
          {(["grouped", "all"] as const).map((m) => {
            const active = viewMode === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setViewMode(m)}
                className={`flex-1 py-2 rounded-lg items-center ${active ? "bg-[#EEECFA]" : ""}`}
              >
                <Text className={`text-[11px] font-black ${active ? "text-[#5B4FD1]" : "text-[#7A76A6]"}`}>
                  {m === "grouped" ? "Grouped stops" : `All locations (${pingCount})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#5B4FD1"]} />}
        >
          {viewMode === "grouped"
            ? timeline.map((item, i) => {
                const last = i === timeline.length - 1;
                if (item.kind === "event") return rail(item.key, eventDot(item.status), last, eventCard(item));
                const stop = isStopItem(item);
                return rail(
                  item.key,
                  item.approx ? "bg-slate-400" : stop ? "bg-[#5B4FD1]" : "bg-slate-300",
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
            : flatItems.map((item, i) => {
                const last = i === flatItems.length - 1;
                return item.kind === "ping"
                  ? rail(
                      item.key,
                      item.approx ? "bg-slate-400" : "bg-[#5B4FD1]",
                      last,
                      <View className="bg-white border border-[#E7E4F5] rounded-2xl p-3.5">
                        {pingRow(item, false, isToday && last)}
                      </View>
                    )
                  : rail(item.key, eventDot(item.status), last, eventCard(item));
              })}
        </ScrollView>
      </View>
    );
  };

  const renderOverview = () => {
    if (!staffLoaded) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#5B4FD1" />
        </View>
      );
    }
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#5B4FD1"]} />}
      >
        {staff.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8">
            <MapPinOff size={36} color="#A6A2CE" />
            <Text className="text-sm font-black text-[#1F1B3D] mt-3 text-center">
              No location data for {fmtDateLong(selectedDate)}
            </Text>
            <Text className="text-xs text-[#7A76A6] text-center mt-1">
              Search an employee above, or pick another date.
            </Text>
          </View>
        ) : (
          staff.map((s) => (
            <TouchableOpacity
              key={s.empId}
              onPress={() => selectEmployee(s.empId, s.userName)}
              activeOpacity={0.85}
              className="bg-white border border-[#E7E4F5] rounded-2xl p-3.5 mb-2 flex-row items-center justify-between"
            >
              <View className="flex-row items-center flex-1 pr-2">
                <View className="w-10 h-10 rounded-xl bg-[#EEECFA] items-center justify-center mr-3">
                  <Text className="text-sm font-black text-[#5B4FD1]">
                    {(s.userName || "?").charAt(0).toUpperCase()}
                  </Text>
                  <View
                    className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${freshnessDot(s.lastTime)}`}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-black text-[#1F1B3D]" numberOfLines={1}>
                    {s.userName}  <Text className="text-[10px] text-[#7A76A6]">{s.empId}</Text>
                  </Text>
                  <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5" numberOfLines={1}>
                    {s.firstTime ?? "--:--"} – {s.lastTime ?? "--:--"}
                    {s.department ? `  ·  ${s.department}` : ""}
                  </Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-[11px] font-black text-[#5B4FD1]">
                  {s.pointCount != null ? `${s.pointCount} pts` : "—"}
                </Text>
                {s.batteryPercentage != null && s.batteryPercentage > 0 ? (
                  <Text className="text-[9px] font-bold text-slate-400">{s.batteryPercentage}% bat</Text>
                ) : null}
              </View>
              <ChevronRight size={16} color="#A6A2CE" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F4F6F9]" edges={["top"]}>
      {/* Header */}
      <View className="bg-[#5B4FD1] px-5 py-3.5 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
            className="w-9 h-9 bg-white/20 rounded-2xl items-center justify-center active:opacity-75"
          >
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View>
            <Text className="text-base font-black text-white">Location Tracking</Text>
            <Text className="text-[10px] font-bold text-purple-200">
              {isToday ? "Live • auto-refreshes every minute" : `History • ${fmtDateLong(selectedDate)}`}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          className="w-9 h-9 bg-white/20 rounded-2xl items-center justify-center active:opacity-75"
        >
          {refreshing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <RefreshCw size={16} color="#FFFFFF" />}
        </TouchableOpacity>
      </View>

      {/* Filters: date, search, staff */}
      <View className="bg-white border-b border-[#E7E4F5] pb-2.5">
        <View className="flex-row items-center px-4 pt-3">
          <TouchableOpacity
            onPress={() => shiftDay(-1)}
            className="w-9 h-9 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5] items-center justify-center active:bg-[#EEECFA]"
          >
            <ChevronLeft size={16} color="#1F1B3D" />
          </TouchableOpacity>

          {Platform.OS === "web" ? (
            <View className="flex-1 mx-2 h-9 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5] flex-row items-center justify-center px-2">
              <CalendarDays size={14} color="#5B4FD1" />
              <input
                type="date"
                value={dateStr}
                max={toYmd(new Date())}
                 onChange={(e) => { const d = parseYmd(e.target.value); if (d) setSelectedDate(d); }}
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  outline: "none",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#1F1B3D",
                  marginLeft: 8,
                  cursor: "pointer",
                }}
              />
              {isToday && (
                <View className="ml-2 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <Text className="text-[9px] font-black text-emerald-800">TODAY</Text>
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity
              onPress={openDatePicker}
              activeOpacity={0.8}
              className="flex-1 mx-2 h-9 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5] flex-row items-center justify-center"
            >
              <CalendarDays size={14} color="#5B4FD1" />
              <Text className="text-xs font-black text-[#1F1B3D] ml-2">{fmtDateLong(selectedDate)}</Text>
              {isToday && (
                <View className="ml-2 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <Text className="text-[9px] font-black text-emerald-800">TODAY</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => shiftDay(1)}
            disabled={isToday}
            style={{ opacity: isToday ? 0.35 : 1 }}
            className="w-9 h-9 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5] items-center justify-center active:bg-[#EEECFA]"
          >
            <ChevronRight size={16} color="#1F1B3D" />
          </TouchableOpacity>

          {!isToday && (
            <TouchableOpacity
              onPress={() => setSelectedDate(new Date())}
              className="ml-2 h-9 px-3 rounded-xl bg-[#5B4FD1] items-center justify-center active:opacity-90"
            >
              <Text className="text-[10px] font-black text-white">Today</Text>
            </TouchableOpacity>
          )}
        </View>

        {Platform.OS === "ios" && showIosPicker && (
<DateTimePicker
  value={selectedDate}
  mode="date"
  display="inline"
  maximumDate={new Date()}
  onValueChange={(_event: any, d?: Date) => {
    setShowIosPicker(false);
    if (d) setSelectedDate(d);
  }}
  onDismiss={() => setShowIosPicker(false)}
/>
        )}

        <View className="px-4 pt-2.5">
          <View className="flex-row items-center bg-[#F6F5FC] border border-[#E7E4F5] rounded-2xl px-3.5 h-11">
            <Search size={16} color="#7A76A6" />
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
              placeholder="Search employee by name or ID"
              placeholderTextColor="#A6A2CE"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              importantForAutofill="no"
              textContentType="none"
              className={`flex-1 ml-2 text-xs text-[#1F1B3D] ${selected && !editing ? "font-black" : "font-semibold"}`}
            />
            {selected || query ? (
              <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={16} color="#7A76A6" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {showSuggestions ? (
          <View className="mx-4 mt-2 bg-white border border-[#E7E4F5] rounded-2xl overflow-hidden">
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
                    <View className={`px-2 py-0.5 rounded-full ${row ? "bg-emerald-100" : "bg-slate-100"}`}>
                      <Text className={`text-[9px] font-black ${row ? "text-emerald-800" : "text-slate-500"}`}>
                        {row ? `${row.pointCount ?? "•"} pts on this date` : "No data on this date"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10 }}
          >
            <TouchableOpacity
              onPress={() => setSelected(null)}
              className={`mr-2 px-3.5 py-2 rounded-2xl border justify-center ${
                !selected ? "bg-[#5B4FD1] border-[#5B4FD1]" : "bg-[#F6F5FC] border-[#E7E4F5]"
              }`}
            >
              <Text className={`text-xs font-black ${!selected ? "text-white" : "text-[#1F1B3D]"}`}>All staff</Text>
              <Text className={`text-[9px] font-bold ${!selected ? "text-purple-200" : "text-[#7A76A6]"}`}>
                {staff.length} with data
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
                  <View className={`w-2.5 h-2.5 rounded-full mr-2 ${freshnessDot(s.lastTime)}`} />
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
        )}
      </View>

      {/* Body */}
      <View className="flex-1">
        {selected && (
          <View className="px-4 pt-3">
            <View className="flex-row items-center justify-between mb-2 px-1">
              <Text className="text-sm font-black text-[#1F1B3D]" numberOfLines={1}>
                {selectedName}  <Text className="text-[11px] font-bold text-[#7A76A6]">{selected.empId}</Text>
                {selectedDept ? (
                  <Text className="text-[11px] font-bold text-[#7A76A6]">  ·  {selectedDept}</Text>
                ) : null}
              </Text>
              {lastSeenMins != null && (
                <Text
                  className={`text-[10px] font-black ${
                    lastSeenMins <= 90 ? "text-emerald-600" : lastSeenMins <= 180 ? "text-amber-600" : "text-rose-600"
                  }`}
                >
                  Last seen {fmtDuration(lastSeenMins)} ago
                </Text>
              )}
            </View>
            <View className="flex-row gap-2">
              <Stat label="First ping" value={summary.first} />
              <Stat label="Last ping" value={summary.last} />
              <Stat label="Distance" value={`${summary.km} km`} />
              <Stat label="Remarks" value={String(summary.issues)} sub={summary.issues ? "see timeline" : "none"} />
            </View>
            {summary.battery !== "—" && (
              <Text className="text-[10px] font-semibold text-[#7A76A6] mt-1.5 px-1">Battery {summary.battery}</Text>
            )}
            {summary.stops > 0 && (
              <Text className="text-[10px] font-semibold text-[#7A76A6] mt-1 px-1">
                {summary.stops} stop{summary.stops === 1 ? "" : "s"}  ·  {fmtDuration(summary.stoppedMin)} at stops
                {summary.longest
                  ? `  ·  longest: ${summary.longest.place} (${fmtDuration(
                      Math.round((summary.longest.endMs - summary.longest.startMs) / 60000)
                    )})`
                  : ""}
              </Text>
            )}
          </View>
        )}

        <View className="flex-row mx-4 mt-3 mb-2 bg-[#EEECFA] rounded-2xl p-1">
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

        <View className="flex-1">
          {tab === "map" ? renderMapPanel() : selected ? renderTimeline() : renderOverview()}
        </View>
      </View>
    </SafeAreaView>
  );
}