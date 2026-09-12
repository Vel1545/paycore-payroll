import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  User,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  KeyRound,
  CheckCircle,
  Key,
} from "lucide-react-native";
import { useAuth, UserDetails } from "../context/AuthContext"; // Import global auth hook

interface LoginScreenProps {
  onLoginSuccess: (userData: { empId: string; isAdmin: boolean }) => void;
}

const API_BASE_URL =
  Platform.OS === "android"
    ? "http://192.168.31.133:8080/api/auth"
    : "http://192.168.31.133:8080/api/auth";

type UserStatus =
  | "NO_RECORD"
  | "ALREADY_VERIFIED"
  | "OTP_PENDING"
  | "ACCOUNT_LOCKED"
  | "ERROR";

const showUniversalAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    try {
      window.alert(`${title}\n\n${message}`);
    } catch (e) {
      console.log(`[ALERT] ${title}: ${message}`);
    }
  } else {
    Alert.alert(title, message, [{ text: "OK" }]);
  }
};

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;

  // Access the global save function from AuthContext
  const { saveUserSession } = useAuth();

  const [empId, setEmpId] = useState("");
  const [status, setStatus] = useState<UserStatus>("NO_RECORD");
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverNotice, setServerNotice] = useState("");
  const [activeDevOtp, setActiveDevOtp] = useState<string | null>(null);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpInputs = useRef<Array<TextInput | null>>([]);
  const debounceTimer = useRef<any>(null);

  const handleEmpIdChange = (text: string) => {
    const cleanId = text.trim().toUpperCase();
    setEmpId(cleanId);
    setActiveDevOtp(null);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (cleanId.length >= 3) {
      debounceTimer.current = setTimeout(() => {
        checkUserStatusInDb(cleanId);
      }, 400);
    } else {
      setStatus("NO_RECORD");
      setServerNotice("");
      setOtpSent(false);
      setIsFirstTime(false);
    }
  };

  const checkUserStatusInDb = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/check-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empId: id }),
      });

      const data = await res.json();

      if (data.status === "ALREADY_VERIFIED") {
        setStatus("ALREADY_VERIFIED");
        setOtpSent(false);
        setIsFirstTime(false);
        setActiveDevOtp(null);
        setServerNotice("Employee OTP Verified • Direct Access Enabled");
      } else if (data.status === "ACCOUNT_LOCKED") {
        setStatus("ACCOUNT_LOCKED");
        setServerNotice(data.message);
        setActiveDevOtp(null);
        showUniversalAlert("Account Locked", data.message);
      } else if (data.status === "OTP_PENDING") {
        setStatus("OTP_PENDING");
        setOtpSent(true);
        setServerNotice(data.message || `Enter 6-digit code for ${id}`);

        if (data.devOtp) {
          setActiveDevOtp(data.devOtp);
          showUniversalAlert("Pending Security OTP", `Your verification code is: ${data.devOtp}`);
        }
      } else {
        setStatus("NO_RECORD");
        setOtpSent(false);
        setActiveDevOtp(null);
        setServerNotice("First time login for this ID. Please verify with OTP.");
      }
    } catch (e) {
      setStatus("NO_RECORD");
    }
  };

  // Helper to structure and save user payload to AuthContext globally
  const handleSuccessfulAuthentication = async (backendUser: any, token?: string) => {
    const formattedUser: UserDetails = {
      userId: backendUser.empId,
      empId: backendUser.empId,
      name: backendUser.fullName || backendUser.name, // maps your backend fullName response
      email: backendUser.email,
      isAdmin: !!backendUser.isAdmin,
      token: token,
      role:backendUser.role,
    };

    // Save globally into state and AsyncStorage
    await saveUserSession(formattedUser);

    // Trigger success callback to navigate screens
    onLoginSuccess({
      empId: formattedUser.empId,
      isAdmin: formattedUser.isAdmin,
    });
  };

  // 2. Direct 1-Click Login
  const handleDirectLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/direct-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empId: empId.trim().toUpperCase() }),
      });

      const data = await res.json();
      if (data.success && data.user) {
        await handleSuccessfulAuthentication(data.user, data.token);
      } else {
        showUniversalAlert(
          "Verification Required",
          data.message || "No verification record found. Please verify with OTP."
        );
        setStatus("NO_RECORD");
        setOtpSent(false);
        setIsFirstTime(false);
        setActiveDevOtp(null);
      }
    } catch (err) {
      showUniversalAlert("Error", "Authentication server unreachable.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    const cleanId = empId.trim().toUpperCase();
    if (!cleanId) {
      showUniversalAlert("Missing ID", "Please enter your Employee ID.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empId: cleanId }),
      });

      const data = await res.json();

      if (data.success) {
        setServerNotice(data.message);
        setOtpSent(true);
        setStatus("OTP_PENDING");

        if (data.devOtp) {
          setActiveDevOtp(data.devOtp);
          showUniversalAlert("One-Time Password", `Your verification OTP is: ${data.devOtp}`);
        }
      } else {
        showUniversalAlert("Failed", data.message || "Failed to generate OTP.");
      }
    } catch (err) {
      showUniversalAlert("Connection Error", "Cannot reach authentication server at " + API_BASE_URL);
    } finally {
      setLoading(false);
    }
  };

  // 4. Verify OTP
  const handleVerifyOtp = async () => {
    const fullOtp = otp.join("");
    if (fullOtp.length !== 6) {
      showUniversalAlert("Incomplete Code", "Please enter all 6 digits.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: empId.trim().toUpperCase(),
          otp: fullOtp,
        }),
      });

      const data = await res.json();
      if (data.success && data.user) {
        await handleSuccessfulAuthentication(data.user, data.token);
      } else {
        showUniversalAlert("Invalid OTP", data.message || "OTP is wrong. Enter the correct OTP.");

        setOtp(["", "", "", "", "", ""]);
        otpInputs.current[0]?.focus();

        if (data.message && data.message.includes("limit exceeded")) {
          setStatus("ACCOUNT_LOCKED");
          setActiveDevOtp(null);
        }
      }
    } catch (err) {
      showUniversalAlert("Error", "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    const clean = value.replace(/[^0-9]/g, "");
    const updatedOtp = [...otp];
    updatedOtp[index] = clean ? clean[clean.length - 1] : "";
    setOtp(updatedOtp);

    if (clean && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = () => {
    if (status === "ACCOUNT_LOCKED") {
      showUniversalAlert("Access Locked", serverNotice);
      return;
    }
    if (status === "ALREADY_VERIFIED") {
      handleDirectLogin();
      return;
    }
    if (otpSent || status === "OTP_PENDING") {
      handleVerifyOtp();
      return;
    }
    if (isFirstTime || status === "NO_RECORD") {
      handleRequestOtp();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-canvas">
      <View className="flex-1 flex-row">
        {isDesktop && (
          <View className="w-[45%] h-full bg-brand-hero relative overflow-hidden">
            <ImageBackground
              source={{
                uri: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1600&auto=format&fit=crop",
              }}
              resizeMode="cover"
              className="flex-1 justify-between p-10 lg:p-14"
            >
              <View className="absolute inset-0 bg-brand-hero/85" />
              <View className="relative z-10 flex-row items-center">
                <View className="w-11 h-11 bg-brand-primary rounded-xl items-center justify-center mr-3.5 shadow-md">
                  <ShieldCheck size={24} color="#FFFFFF" />
                </View>
                <Text className="text-2xl font-black text-white">PayCore Global</Text>
              </View>
              <View className="relative z-10 my-auto">
                <Text className="text-3xl lg:text-4xl font-black text-white leading-tight mb-5">
                  Streamlined Payroll, Attendance & Culture for Modern Teams.
                </Text>
                <View className="space-y-3.5">
                  <View className="flex-row items-center">
                    <CheckCircle size={18} color="#34D399" />
                    <Text className="text-slate-100 text-sm ml-3 font-semibold">
                      Instant Verified Access
                    </Text>
                  </View>
                </View>
              </View>
            </ImageBackground>
          </View>
        )}

        <View
          className={`${
            isDesktop ? "w-[55%]" : "w-full"
          } h-full bg-brand-canvas justify-center items-center px-4 md:px-8 py-8`}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="w-full max-w-xl"
          >
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
              showsVerticalScrollIndicator={false}
            >
              <View className="bg-brand-card border border-brand-border rounded-3xl p-8 md:p-10 shadow-sm">
                <Text className="text-2xl font-black text-brand-dark tracking-tight mb-1">
                  {otpSent || status === "OTP_PENDING"
                    ? "Verify Security OTP"
                    : "Sign In to Workspace"}
                </Text>
                <Text className="text-sm font-semibold text-brand-muted mb-6">
                  {otpSent || status === "OTP_PENDING"
                    ? `Enter 6-digit code for ${empId.toUpperCase()}`
                    : status === "ALREADY_VERIFIED"
                    ? "Verified Employee Recognized • Direct Access Ready"
                    : "Enter your Employee ID to continue"}
                </Text>

                {serverNotice ? (
                  <View className="bg-brand-cardTint border border-brand-border rounded-xl p-3 mb-4">
                    <Text className="text-[11px] font-bold text-brand-dark">
                      💡 {serverNotice}
                    </Text>
                  </View>
                ) : null}

                {activeDevOtp && (
                  <View className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 mb-5 shadow-xs flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Key size={20} color="#B45309" />
                      <View className="ml-3">
                        <Text className="text-[10px] uppercase font-black text-amber-800 tracking-wider">
                          Active Security OTP
                        </Text>
                        <Text className="text-2xl font-black text-amber-950 tracking-widest">
                          {activeDevOtp}
                        </Text>
                      </View>
                    </View>
                    <View className="bg-amber-200 px-2.5 py-1 rounded-lg">
                      <Text className="text-[10px] font-bold text-amber-900">Valid 5m</Text>
                    </View>
                  </View>
                )}

                {!otpSent && status !== "OTP_PENDING" && (
                  <View className="mb-5">
                    <Text className="text-xs font-black text-brand-dark uppercase tracking-wider mb-2">
                      Employee ID
                    </Text>
                    <View className="flex-row items-center bg-brand-cardTint border border-brand-border rounded-2xl px-4 py-3.5">
                      <User size={20} color="#5C4D41" />
                      <TextInput
                        value={empId}
                        onChangeText={handleEmpIdChange}
                        placeholder="e.g. EMP-1042"
                        placeholderTextColor="#8C7A6B"
                        autoCapitalize="characters"
                        className="flex-1 ml-3 text-sm font-bold text-brand-dark"
                      />
                    </View>
                  </View>
                )}

                {status === "NO_RECORD" && !otpSent && (
                  <TouchableOpacity
                    onPress={() => setIsFirstTime(!isFirstTime)}
                    className="flex-row items-center mb-7 py-1"
                  >
                    <View
                      className={`w-5 h-5 rounded-md border justify-center items-center mr-2.5 ${
                        isFirstTime
                          ? "bg-brand-hero border-brand-hero"
                          : "border-slate-400 bg-white"
                      }`}
                    >
                      {isFirstTime && <Text className="text-white text-xs font-black">✓</Text>}
                    </View>
                    <Text className="text-xs md:text-sm font-semibold text-brand-dark">
                      First time logging in?{" "}
                      <Text className="text-brand-primary font-extrabold underline">
                        Verify with OTP
                      </Text>
                    </Text>
                  </TouchableOpacity>
                )}

                {(otpSent || status === "OTP_PENDING") && (
                  <View className="mb-7">
                    <View className="flex-row justify-between mb-5">
                      {otp.map((digit, index) => (
                        <TextInput
                          key={index}
                          ref={(ref) => {
                            otpInputs.current[index] = ref;
                          }}
                          value={digit}
                          onChangeText={(val) => handleOtpChange(val, index)}
                          onKeyPress={(e) => handleOtpKeyPress(e, index)}
                          keyboardType="number-pad"
                          maxLength={1}
                          className={`w-12 h-14 text-center text-lg font-black border-2 rounded-2xl bg-brand-cardTint ${
                            digit
                              ? "border-brand-primary text-brand-primary bg-white"
                              : "border-brand-border text-brand-dark"
                          }`}
                        />
                      ))}
                    </View>

                    <View className="flex-row items-center justify-between">
                      <TouchableOpacity
                        onPress={() => {
                          setOtpSent(false);
                          setStatus("NO_RECORD");
                          setActiveDevOtp(null);
                        }}
                        className="flex-row items-center py-1"
                      >
                        <KeyRound size={15} color="#5C4D41" />
                        <Text className="text-xs text-brand-muted font-bold ml-1.5">
                          Change ID
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleRequestOtp}
                        className="flex-row items-center py-1"
                      >
                        <RefreshCw size={15} color="#0D9488" />
                        <Text className="text-xs font-extrabold text-brand-primary ml-1.5">
                          Resend OTP
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading || status === "ACCOUNT_LOCKED"}
                  className={`rounded-2xl py-4 flex-row items-center justify-center shadow-sm active:opacity-90 ${
                    status === "ACCOUNT_LOCKED" ? "bg-gray-400" : "bg-brand-hero"
                  }`}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text className="text-white font-black text-sm uppercase tracking-wider mr-2">
                        {status === "ACCOUNT_LOCKED"
                          ? "ACCOUNT LOCKED (24 HRS)"
                          : status === "ALREADY_VERIFIED"
                          ? "SIGN IN"
                          : otpSent || status === "OTP_PENDING"
                          ? "AUTHENTICATE SESSION"
                          : "SEND VERIFICATION CODE"}
                      </Text>
                      <ArrowRight size={18} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
    </SafeAreaView>
  );
}