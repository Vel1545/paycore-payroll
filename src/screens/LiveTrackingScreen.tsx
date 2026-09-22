import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  StyleSheet,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  BatteryCharging,
  MapPin,
  RefreshCw,
  Radio,
  Users,
  Navigation,
} from "lucide-react-native";

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

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
}

interface FleetEmployee {
  empId: string;
  userName: string;
  activeWorkMode: string;
  punchInTime: string;
  latestLatitude: number | null;
  latestLongitude: number | null;
  batteryPercentage: number | null;
  accuracyMeters: number | null;
  lastPingTime: string | null;
}

interface TracePoint {
  time: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  batteryPercentage?: number;
}

const API_BASE_URL = Platform.select({
  web: "http://localhost:8080/api/attendance",
  android: "http://192.168.31.228:8080/api/attendance",
  default: "http://192.168.31.228:8080/api/attendance",
});

export default function LiveTrackingScreen({ navigation, route }: any) {
  const mapRef = useRef<any>(null);

  const [fleet, setFleet] = useState<FleetEmployee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<FleetEmployee | null>(null);
  const [traces, setTraces] = useState<TracePoint[]>([]);
  const [loadingFleet, setLoadingFleet] = useState<boolean>(true);
  const [loadingTraces, setLoadingTraces] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadFleet = async (silent = false) => {
    if (!silent) setLoadingFleet(true);
    try {
      const res = await fetch(`${API_BASE_URL}/active-fleet`);
      if (res.ok) {
        const data: FleetEmployee[] = await res.json();
        setFleet(data);

        const targetId = route?.params?.empId;
        if (targetId && targetId !== "ALL_ACTIVE") {
          const match = data.find((e) => e.empId === targetId);
          if (match) setSelectedEmp(match);
        }
      }
    } catch (err) {
      console.warn("Could not load fleet:", err);
    } finally {
      setLoadingFleet(false);
      setIsRefreshing(false);
    }
  };

  const loadTraces = async (empId: string) => {
    setLoadingTraces(true);
    try {
      const res = await fetch(`${API_BASE_URL}/traces?empId=${empId}`);
      if (res.ok) {
        const rawData = await res.json();
        const points: TracePoint[] = Array.isArray(rawData)
          ? rawData
          : typeof rawData === "string"
          ? JSON.parse(rawData)
          : [];

        setTraces(points);

        if (points.length > 0 && mapRef.current) {
          mapRef.current.fitToCoordinates(
            points.map((p) => ({
              latitude: Number(p.latitude),
              longitude: Number(p.longitude),
            })),
            {
              edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
              animated: true,
            }
          );
        }
      }
    } catch (err) {
      console.warn("Could not load traces:", err);
    } finally {
      setLoadingTraces(false);
    }
  };

  useEffect(() => {
    loadFleet();
    const interval = setInterval(() => {
      loadFleet(true);
      if (selectedEmp) {
        loadTraces(selectedEmp.empId);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedEmp) {
      loadTraces(selectedEmp.empId);
    } else {
      setTraces([]);
      const validFleetPoints = fleet
        .filter((e) => e.latestLatitude && e.latestLongitude)
        .map((e) => ({
          latitude: Number(e.latestLatitude),
          longitude: Number(e.latestLongitude),
        }));

      if (validFleetPoints.length > 0 && mapRef.current) {
        mapRef.current.fitToCoordinates(validFleetPoints, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        });
      }
    }
  }, [selectedEmp]);

  const defaultRegion = {
    latitude: selectedEmp?.latestLatitude ? Number(selectedEmp.latestLatitude) : 11.341,
    longitude: selectedEmp?.latestLongitude ? Number(selectedEmp.latestLongitude) : 77.7172,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F4F6F9]" edges={["top"]}>
      {/* 1. Header Bar */}
      <View className="bg-[#5B4FD1] px-5 py-4 flex-row items-center justify-between shadow-md">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
            className="w-9 h-9 bg-white/20 rounded-2xl items-center justify-center active:opacity-75"
          >
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View>
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-black text-white">
                {selectedEmp ? selectedEmp.userName : "Live Fleet Overview"}
              </Text>
              {selectedEmp && (
                <View className="bg-white/20 px-2 py-0.5 rounded-md">
                  <Text className="text-[10px] font-bold text-white tracking-wide">
                    {selectedEmp.empId}
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-[10px] font-bold text-purple-200">
              {selectedEmp
                ? `${selectedEmp.activeWorkMode} • Punched In ${selectedEmp.punchInTime}`
                : `${fleet.length} Active Staff in Field / Remote`}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {selectedEmp && (
            <TouchableOpacity
              onPress={() => setSelectedEmp(null)}
              className="bg-white/20 px-3 py-1.5 rounded-xl flex-row items-center gap-1 active:opacity-75"
            >
              <Users size={14} color="#FFFFFF" />
              <Text className="text-[10px] font-bold text-white">All Fleet</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              setIsRefreshing(true);
              loadFleet();
              if (selectedEmp) loadTraces(selectedEmp.empId);
            }}
            className="w-9 h-9 bg-white/20 rounded-2xl items-center justify-center active:opacity-75"
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <RefreshCw size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Top Carousel: Active Staff Selector */}
      <View className="bg-white border-b border-[#E7E4F5] py-2.5 px-4 shadow-xs">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={fleet}
          keyExtractor={(item) => item.empId}
          renderItem={({ item }) => {
            const isSelected = selectedEmp?.empId === item.empId;
            const isSales = item.activeWorkMode === "SALES";

            return (
              <TouchableOpacity
                onPress={() => setSelectedEmp(isSelected ? null : item)}
                activeOpacity={0.8}
                className={`mr-2.5 px-3.5 py-2 rounded-2xl border flex-row items-center gap-2.5 ${
                  isSelected
                    ? "bg-[#5B4FD1] border-[#5B4FD1]"
                    : "bg-[#F6F5FC] border-[#E7E4F5]"
                }`}
              >
                <View
                  className={`w-2.5 h-2.5 rounded-full ${
                    isSales ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                />
                <View>
                  <View className="flex-row items-center gap-1.5">
                    <Text
                      className={`text-xs font-black ${
                        isSelected ? "text-white" : "text-[#1F1B3D]"
                      }`}
                    >
                      {item.userName}
                    </Text>
                    <Text
                      className={`text-[9px] font-bold px-1 rounded ${
                        isSelected ? "text-purple-200 bg-white/20" : "text-slate-400 bg-slate-200"
                      }`}
                    >
                      {item.empId}
                    </Text>
                  </View>
                  <Text
                    className={`text-[9px] font-bold ${
                      isSelected ? "text-purple-200" : "text-[#7A76A6]"
                    }`}
                  >
                    {item.activeWorkMode} • {item.lastPingTime || item.punchInTime}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* 3. Map View */}
      <View style={{ height: "42%" }} className="w-full relative bg-slate-200">
        {loadingFleet || loadingTraces ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#5B4FD1" />
            <Text className="text-xs font-bold text-[#7A76A6] mt-2">
              Syncing Live GPS Stream...
            </Text>
          </View>
        ) : Platform.OS === "web" || !MapView ? (
          <View className="flex-1 items-center justify-center p-6 bg-slate-100">
            <Radio size={36} color="#7A76A6" />
            <Text className="text-sm font-bold text-[#1F1B3D] mt-2">Native Map View</Text>
            <Text className="text-xs text-[#7A76A6] text-center mt-1">
              Google Maps polyline streams on iOS & Android. View audit list below.
            </Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={defaultRegion}
          >
            {/* View A: Single Staff Route Path */}
            {selectedEmp && traces.length > 0 && (
              <>
                <Polyline
                  coordinates={traces.map((p) => ({
                    latitude: Number(p.latitude),
                    longitude: Number(p.longitude),
                  }))}
                  strokeColor="#5B4FD1"
                  strokeWidth={4}
                />
                <Marker
                  coordinate={{
                    latitude: Number(traces[0].latitude),
                    longitude: Number(traces[0].longitude),
                  }}
                  title={`Check-In: ${selectedEmp.userName} (${selectedEmp.empId})`}
                  description={traces[0].time}
                  pinColor="#1FAE5C"
                />
                <Marker
                  coordinate={{
                    latitude: Number(traces[traces.length - 1].latitude),
                    longitude: Number(traces[traces.length - 1].longitude),
                  }}
                  title={`Current: ${selectedEmp.userName} (${selectedEmp.empId})`}
                  description={traces[traces.length - 1].time}
                  pinColor="#5B4FD1"
                />
              </>
            )}

            {/* View B: Multi-staff Fleet Map Pins */}
            {!selectedEmp &&
              fleet
                .filter((e) => e.latestLatitude && e.latestLongitude)
                .map((emp) => (
                  <Marker
                    key={emp.empId}
                    coordinate={{
                      latitude: Number(emp.latestLatitude),
                      longitude: Number(emp.latestLongitude),
                    }}
                    title={`${emp.userName} (${emp.empId})`}
                    description={`${emp.activeWorkMode} • ${emp.lastPingTime || emp.punchInTime}`}
                    pinColor={emp.activeWorkMode === "SALES" ? "#F59E0B" : "#1FAE5C"}
                    onCalloutPress={() => setSelectedEmp(emp)}
                  />
                ))}
          </MapView>
        )}
      </View>

      {/* 4. Bottom Detail & Audit Trail */}
      <View className="flex-1 bg-[#F4F6F9] px-5 pt-3">
        <View className="flex-row items-center justify-between mb-2 px-1">
          <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
            {selectedEmp
              ? `Route Trail Points (${traces.length})`
              : `Active Personnel (${fleet.length})`}
          </Text>
          <Text className="text-[10px] font-bold text-[#5B4FD1]">Auto-syncs 30s</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {selectedEmp ? (
            traces.slice().reverse().map((pt, idx) => (
              <View
                key={`${pt.time}-${idx}`}
                className="bg-white border border-[#E7E4F5] rounded-2xl p-3.5 mb-2 shadow-xs flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className={`w-9 h-9 rounded-xl items-center justify-center ${
                      idx === 0 ? "bg-[#EEECFA] border border-[#5B4FD1]/30" : "bg-slate-100"
                    }`}
                  >
                    <MapPin size={16} color={idx === 0 ? "#5B4FD1" : "#7A76A6"} />
                  </View>
                  <View>
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-xs font-black text-[#1F1B3D]">
                        {pt.time}
                      </Text>
                      {idx === 0 && (
                        <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                          <Text className="text-[8.5px] font-black text-emerald-800">
                            CURRENT
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5">
                      Lat: {Number(pt.latitude).toFixed(4)}, Lng: {Number(pt.longitude).toFixed(4)}
                    </Text>
                  </View>
                </View>

                <View className="items-end">
                  <Text className="text-[10px] font-bold text-[#7A76A6]">
                    ±{Math.round(pt.accuracyMeters ?? 10)}m
                  </Text>
                  {pt.batteryPercentage !== undefined && (
                    <Text className="text-[9px] font-bold text-slate-400">
                      {pt.batteryPercentage}% bat
                    </Text>
                  )}
                </View>
              </View>
            ))
          ) : (
            fleet.map((emp) => (
              <TouchableOpacity
                key={emp.empId}
                onPress={() => setSelectedEmp(emp)}
                activeOpacity={0.8}
                className="bg-white border border-[#E7E4F5] rounded-2xl p-3.5 mb-2 shadow-xs flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className={`w-10 h-10 rounded-xl items-center justify-center ${
                      emp.activeWorkMode === "SALES" ? "bg-amber-100" : "bg-emerald-100"
                    }`}
                  >
                    <Navigation
                      size={18}
                      color={emp.activeWorkMode === "SALES" ? "#D97706" : "#059669"}
                    />
                  </View>
                  <View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs font-black text-[#1F1B3D]">
                        {emp.userName}
                      </Text>
                      <View className="bg-[#F0EEFB] px-1.5 py-0.5 rounded">
                        <Text className="text-[9px] font-bold text-[#5B4FD1]">
                          {emp.empId}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-[10px] font-semibold text-[#7A76A6] mt-0.5">
                      In: {emp.punchInTime} • Last ping: {emp.lastPingTime || "Active"}
                    </Text>
                  </View>
                </View>

                <View className="items-end gap-1">
                  <View
                    className={`px-2.5 py-0.5 rounded-full ${
                      emp.activeWorkMode === "SALES" ? "bg-purple-100" : "bg-emerald-100"
                    }`}
                  >
                    <Text
                      className={`text-[9px] font-black ${
                        emp.activeWorkMode === "SALES"
                          ? "text-[#5B4FD1]"
                          : "text-emerald-800"
                      }`}
                    >
                      {emp.activeWorkMode}
                    </Text>
                  </View>
                  {emp.batteryPercentage != null && (
                    <View className="flex-row items-center gap-1">
                      <BatteryCharging size={11} color="#059669" />
                      <Text className="text-[9px] font-bold text-slate-500">
                        {emp.batteryPercentage}%
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  map: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
});