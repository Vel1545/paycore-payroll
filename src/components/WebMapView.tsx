import React, { useRef, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import MapView, { Marker, Polyline, Callout } from "react-native-maps";

interface WebMapViewProps {
  fleet: any[];
  selectedEmp: any | null;
  traces: any[];
  onSelectEmp: (emp: any) => void;
}

export default function NativeMapView({
  fleet,
  selectedEmp,
  traces,
  onSelectEmp,
}: WebMapViewProps) {
  const mapRef = useRef<MapView | null>(null);

  // Filter valid coordinates
  const validFleet = (fleet || []).filter(
    (e) =>
      e.latestLatitude != null &&
      e.latestLongitude != null &&
      !isNaN(Number(e.latestLatitude)) &&
      !isNaN(Number(e.latestLongitude))
  );

  const validTraces = (traces || []).filter(
    (t) =>
      t.latitude != null &&
      t.longitude != null &&
      !isNaN(Number(t.latitude)) &&
      !isNaN(Number(t.longitude))
  );

  const centerLat = selectedEmp?.latestLatitude
    ? Number(selectedEmp.latestLatitude)
    : validFleet[0]?.latestLatitude ?? 11.341;

  const centerLng = selectedEmp?.latestLongitude
    ? Number(selectedEmp.latestLongitude)
    : validFleet[0]?.latestLongitude ?? 77.7172;

  // Prepare coordinate list for polyline and auto-zoom
  const polylineCoords = validTraces.map((t) => ({
    latitude: Number(t.latitude),
    longitude: Number(t.longitude),
  }));

  const fleetCoords = validFleet.map((e) => ({
    latitude: Number(e.latestLatitude),
    longitude: Number(e.latestLongitude),
  }));

  // Auto-fit bounds when points change
  useEffect(() => {
    const pointsToFit = selectedEmp ? polylineCoords : fleetCoords;

    if (mapRef.current && pointsToFit.length > 0) {
      if (pointsToFit.length === 1) {
        mapRef.current.animateCamera({
          center: pointsToFit[0],
          zoom: 15,
        });
      } else {
        mapRef.current.fitToCoordinates(pointsToFit, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        });
      }
    }
  }, [selectedEmp, validTraces.length, validFleet.length]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: Number(centerLat),
          longitude: Number(centerLng),
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* 1. Single Employee Route View */}
        {selectedEmp && validTraces.length > 0 && (
          <>
            {polylineCoords.length > 1 && (
              <Polyline
                coordinates={polylineCoords}
                strokeColor="#5B4FD1"
                strokeWidth={4}
              />
            )}

            {/* Start Marker */}
            <Marker
              coordinate={{
                latitude: Number(validTraces[0].latitude),
                longitude: Number(validTraces[0].longitude),
              }}
              pinColor="green"
            >
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>
                    Start Point: {selectedEmp.userName}
                  </Text>
                  <Text style={styles.calloutSub}>{validTraces[0].time}</Text>
                </View>
              </Callout>
            </Marker>

            {/* Current / Latest Marker */}
            {validTraces.length > 1 && (
              <Marker
                coordinate={{
                  latitude: Number(validTraces[validTraces.length - 1].latitude),
                  longitude: Number(validTraces[validTraces.length - 1].longitude),
                }}
                pinColor="#5B4FD1"
              >
                <Callout>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>
                      Current: {selectedEmp.userName}
                    </Text>
                    <Text style={styles.calloutHighlight}>
                      {validTraces[validTraces.length - 1].time}
                    </Text>
                  </View>
                </Callout>
              </Marker>
            )}
          </>
        )}

        {/* 2. All Active Fleet Markers View */}
        {!selectedEmp &&
          validFleet.map((emp) => (
            <Marker
              key={emp.empId}
              coordinate={{
                latitude: Number(emp.latestLatitude),
                longitude: Number(emp.latestLongitude),
              }}
              onPress={() => onSelectEmp(emp)}
            >
              <Callout onPress={() => onSelectEmp(emp)}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>
                    {emp.userName} ({emp.empId})
                  </Text>
                  <Text style={styles.calloutHighlight}>
                    {emp.activeWorkMode} • {emp.lastPingTime || emp.punchInTime}
                  </Text>
                </View>
              </Callout>
            </Marker>
          ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    minHeight: 250,
  },
map: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
},
  callout: {
    padding: 6,
    minWidth: 140,
  },
  calloutTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#222",
  },
  calloutSub: {
    fontSize: 11,
    color: "#7A76A6",
    marginTop: 2,
  },
  calloutHighlight: {
    fontSize: 11,
    color: "#5B4FD1",
    marginTop: 2,
  },
});