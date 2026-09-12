import React, { useState, useEffect, useRef } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Alert, 
  Platform, 
  Image, 
  ActivityIndicator,
  ScrollView
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { 
  ChevronLeft, 
  Camera as CameraIcon, 
  MapPin, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Clock,
  Sparkles,
  Check
} from "lucide-react-native";
import ScreenContainer from "../components/ScreenContainer";

interface PunchClockScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    canGoBack?: () => boolean;
  };
}

export default function PunchClockScreen({ navigation }: PunchClockScreenProps) {
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [currentTimeIST, setCurrentTimeIST] = useState("");
  const [currentDateIST, setCurrentDateIST] = useState("");
  const [userDistance, setUserDistance] = useState<number | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const COMPANY_COORDS = {
    latitude: 12.9716,
    longitude: 77.5946,
  };
  const ALLOWED_RADIUS_METERS = 200;

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  const syncServerTimeIST = () => {
    const now = new Date();
    const istTimeStr = now.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const istDateStr = now.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    setCurrentTimeIST(istTimeStr);
    setCurrentDateIST(istDateStr);
  };

  const checkLiveLocation = () => {
    setIsVerifying(true);
    setTimeout(() => {
      const simulatedUserLat = 12.9719;
      const simulatedUserLng = 77.5949;
      const dist = calculateDistance(
        simulatedUserLat,
        simulatedUserLng,
        COMPANY_COORDS.latitude,
        COMPANY_COORDS.longitude
      );

      setUserDistance(dist);
      setIsWithinGeofence(dist <= ALLOWED_RADIUS_METERS);
      setIsVerifying(false);
    }, 800);
  };

  useEffect(() => {
    syncServerTimeIST();
    checkLiveLocation();

    const timer = setInterval(() => {
      syncServerTimeIST();
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleTakeSelfie = async () => {
    if (!cameraRef.current) return;

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      });
      setCapturedPhotoUri(photo.uri);
    } catch (err) {
      const msg = "Could not capture image from front camera. Please try again.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Camera Error", msg);
    } finally {
      setIsCapturing(false);
    }
  };

  const handlePunch = (type: "CHECK_IN" | "CHECK_OUT") => {
    if (!capturedPhotoUri) {
      const msg = "Please take a verification selfie before submitting your attendance punch.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Selfie Required", msg);
      return;
    }

    if (!isWithinGeofence) {
      const msg = `Geofence violation: You are ${userDistance}m away from the office. Must be within 200m.`;
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Location Error", msg);
      return;
    }

    const successMsg = `Successfully ${type === "CHECK_IN" ? "Checked In" : "Checked Out"} at ${currentTimeIST} (IST) with Geofence & Selfie verification.`;
    Platform.OS === "web" ? window.alert(successMsg) : Alert.alert("Punch Recorded", successMsg);
  };

  return (
    <ScreenContainer>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ========================================================================= */}
        {/* 1. TOP PURPLE BANNER HEADER                                               */}
        {/* ========================================================================= */}
        <View className="bg-[#5B4FD1] rounded-3xl pt-3 pb-4 px-4 mb-4 shadow-xs relative overflow-hidden">
          {/* Geometric Accents */}
          <View 
            className="absolute -top-3 -right-4 w-20 h-20 rounded-3xl border-2 border-white/20 pointer-events-none"
            style={{ transform: [{ rotate: "20deg" }] }}
          />
          <View 
            className="absolute top-12 -left-6 w-16 h-16 rounded-2xl border-2 border-white/10 pointer-events-none"
            style={{ transform: [{ rotate: "-15deg" }] }}
          />

          <View className="flex-row items-center justify-between mb-3">
            <TouchableOpacity 
              onPress={() => (navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate("Home"))}
              className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center active:opacity-80"
            >
              <ChevronLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View className="bg-white/20 px-3 py-1 rounded-full border border-white/25 flex-row items-center">
              <ShieldCheck size={12} color="#FFFFFF" />
              <Text className="text-[10px] font-black text-white ml-1 uppercase tracking-wider">
                NTP Live Synced
              </Text>
            </View>
          </View>

          <View className="items-center">
            <Text className="text-xl md:text-2xl font-black text-white tracking-tight">
              Biometric Punch Clock
            </Text>
            <Text className="text-xs font-semibold text-white/80 mt-0.5 text-center">
              Geofenced GPS & Live Camera Attendance
            </Text>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 3. GEOFENCE PERIMETER MONITOR                                             */}
        {/* ========================================================================= */}
        <View className="bg-white border border-[#E7E4F5] rounded-3xl p-4 mb-4 shadow-xs">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View className={`w-9 h-9 rounded-xl items-center justify-center mr-2.5 ${
                isWithinGeofence ? "bg-[#E7FAEE] border border-[#1FAE5C]/20" : "bg-[#FDE9E8] border border-[#E4453C]/20"
              }`}>
                <MapPin size={18} color={isWithinGeofence ? "#1FAE5C" : "#E4453C"} />
              </View>
              <View>
                <Text className="text-xs font-black text-[#1F1B3D]">Company Perimeter (200m)</Text>
                <Text className="text-[10px] font-semibold text-[#7A76A6]">
                  {isVerifying ? "Verifying live GPS lock..." : `Current distance: ${userDistance !== null ? userDistance : "--"}m`}
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              onPress={checkLiveLocation} 
              className="w-8 h-8 rounded-xl bg-[#F6F5FC] border border-[#E7E4F5] items-center justify-center active:bg-[#EEECFA]"
            >
              <RefreshCw size={14} color="#5B4FD1" />
            </TouchableOpacity>
          </View>

          <View className={`p-2.5 rounded-2xl flex-row items-center ${
            isWithinGeofence ? "bg-[#E7FAEE] border border-[#1FAE5C]/30" : "bg-[#FDE9E8] border border-[#E4453C]/30"
          }`}>
            {isWithinGeofence ? (
              <>
                <CheckCircle2 size={15} color="#1FAE5C" />
                <Text className="text-xs font-bold text-[#1FAE5C] ml-2">
                  Inside Bangalore HQ Perimeter ({userDistance}m away)
                </Text>
              </>
            ) : (
              <>
                <AlertTriangle size={15} color="#E4453C" />
                <Text className="text-xs font-bold text-[#E4453C] ml-2">
                  Outside Perimeter. Attendance punch disabled.
                </Text>
              </>
            )}
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 4. LIVE SELFIE CAMERA VERIFICATION (INCREASED CIRCULAR SIZE)              */}
        {/* ========================================================================= */}
        <View className="bg-white border border-[#E7E4F5] rounded-3xl p-5 mb-4 shadow-xs items-center">
          <View className="w-full flex-row items-center justify-between mb-4">
            <Text className="text-xs font-black text-[#1F1B3D] uppercase tracking-wider">
              Live Photo Verification
            </Text>
            <Text className="text-[10px] font-semibold uppercase text-[#5B4FD1]">Front Biometric Lens</Text>
          </View>

          {!permission?.granted ? (
            /* Permission Request View */
            <View className="w-64 h-64 rounded-full border-2 border-dashed border-[#5B4FD1] bg-[#F6F5FC] items-center justify-center p-4">
              <CameraIcon size={26} color="#5B4FD1" />
              <Text className="text-xs font-black text-[#1F1B3D] mt-2 text-center">
                Camera Access
              </Text>
              <TouchableOpacity
                onPress={requestPermission}
                className="bg-[#5B4FD1] px-3 py-1.5 rounded-full mt-2.5 active:opacity-90 shadow-xs"
              >
                <Text className="text-white text-[10px] font-black uppercase">
                  Grant Access
                </Text>
              </TouchableOpacity>
            </View>
          ) : !capturedPhotoUri ? (
            /* Live Camera Viewfinder (Increased Circular Frame: w-72 h-72) */
            <View className="relative items-center justify-center my-2">
              <View className="w-72 h-72 rounded-full border-4 border-[#1FAE5C] bg-black overflow-hidden relative items-center justify-center shadow-md">
                <CameraView
                  ref={cameraRef}
                  facing="front"
                  style={{ width: "100%", height: "100%" }}
                />
                
                {/* Shutter Button Inside Ring */}
                <TouchableOpacity
                  onPress={handleTakeSelfie}
                  disabled={isCapturing}
                  className="absolute bottom-4 w-12 h-12 rounded-full bg-white/90 border-2 border-[#1FAE5C] items-center justify-center active:scale-95 shadow-md"
                >
                  {isCapturing ? (
                    <ActivityIndicator color="#1FAE5C" size="small" />
                  ) : (
                    <CameraIcon size={18} color="#1FAE5C" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Overlap Status Badge */}
              <View className="absolute bottom-2 right-3 w-9 h-9 rounded-full bg-[#1FAE5C] border-2 border-white items-center justify-center shadow-sm">
                <Sparkles size={14} color="#FFFFFF" />
              </View>
            </View>
          ) : (
            /* Captured Photo Preview (Increased Circular Frame: w-72 h-72) */
            <View className="items-center justify-center my-2">
              <View className="relative">
                <View className="w-72 h-72 rounded-full border-4 border-[#1FAE5C] overflow-hidden shadow-md">
                  <Image 
                    source={{ uri: capturedPhotoUri }} 
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                </View>

                {/* Verified Checkmark Badge */}
                <View className="absolute bottom-2 right-3 w-10 h-10 rounded-full bg-[#1FAE5C] border-4 border-white items-center justify-center shadow-md">
                  <Check size={18} color="#FFFFFF" strokeWidth={3.5} />
                </View>
              </View>

              <TouchableOpacity 
                onPress={() => setCapturedPhotoUri(null)}
                className="mt-4 px-4 py-1.5 bg-[#F6F5FC] border border-[#E7E4F5] rounded-xl flex-row items-center active:bg-[#EEECFA]"
              >
                <RefreshCw size={12} color="#5B4FD1" />
                <Text className="text-[11px] font-bold text-[#5B4FD1] ml-1.5">
                  Retake Verification Photo
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ========================================================================= */}
        {/* 5. PUNCH ACTION CONTROLS (PROPERLY SPACED)                                */}
        {/* ========================================================================= */}
        <View className="flex-row space-x-3 gap-3 mb-4">
          {/* Check-In Button: Royal Purple Theme */}
          <TouchableOpacity
            onPress={() => handlePunch("CHECK_IN")}
            disabled={!isWithinGeofence || !capturedPhotoUri}
            className={`flex-1 py-4 rounded-2xl items-center shadow-md ${
              isWithinGeofence && capturedPhotoUri 
                ? "bg-[#5B4FD1] active:opacity-90 shadow-purple-600/30" 
                : "bg-slate-300 opacity-60"
            }`}
          >
            <Text className="text-white font-black text-xs uppercase tracking-wider">
              Punch Check-In
            </Text>
          </TouchableOpacity>

          {/* Check-Out Button: Midnight Indigo Hero Theme */}
          <TouchableOpacity
            onPress={() => handlePunch("CHECK_OUT")}
            disabled={!isWithinGeofence || !capturedPhotoUri}
            className={`flex-1 py-4 rounded-2xl items-center shadow-md ${
              isWithinGeofence && capturedPhotoUri 
                ? "bg-[#150F38] active:opacity-90 shadow-indigo-950/30" 
                : "bg-slate-300 opacity-60"
            }`}
          >
            <Text className="text-white font-black text-xs uppercase tracking-wider">
              Punch Check-Out
            </Text>
          </TouchableOpacity>
        </View>

        {/* Check-In / Check-Out Timings & Day Summary Card */}
        <View className="bg-[#5B4FD1] border border-[#2C2270] rounded-3xl p-5 mb-4 shadow-sm">
          {/* Date / Day Header */}
          <View className="flex-row items-center justify-between pb-3 mb-3 border-b border-white/10">
            <View className="flex-row items-center gap-1.5">
              <Clock size={14} color="#A6A2CE" />
              <Text className="text-[11px] font-bold text-[#A6A2CE] uppercase tracking-wider">
                {currentDateIST || "Today's Timings"}
              </Text>
            </View>
            <View className="bg-white/10 px-2.5 py-0.5 rounded-full">
              <Text className="text-[10px] font-black text-emerald-300 uppercase tracking-wider">
                IST Live
              </Text>
            </View>
          </View>

          {/* Dual Timings Row */}
          <View className="flex-row justify-between items-center divide-x divide-white/10">
            {/* Check-In Column */}
            <View className="flex-1 items-center px-2">
              <Text className="text-[10px] font-bold text-[#A6A2CE] uppercase tracking-widest mb-1">
                Checked In At
              </Text>
              <Text className="text-xl md:text-2xl font-black text-white tracking-tight">
                09:05 AM
              </Text>
              <View className="bg-emerald-500/20 px-2 py-0.5 rounded-full mt-1.5">
                <Text className="text-[9.5px] font-black text-emerald-400 uppercase">
                  On Time
                </Text>
              </View>
            </View>

            {/* Check-Out Column */}
            <View className="flex-1 items-center px-2">
              <Text className="text-[10px] font-bold text-[#A6A2CE] uppercase tracking-widest mb-1">
                Checked Out At
              </Text>
              <Text className="text-xl md:text-2xl font-black text-white/50 tracking-tight">
                --:-- PM
              </Text>
              <View className="bg-amber-500/20 px-2 py-0.5 rounded-full mt-1.5">
                <Text className="text-[9.5px] font-black text-amber-300 uppercase">
                  Pending
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}